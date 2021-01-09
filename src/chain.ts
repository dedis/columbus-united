import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import { DataBody } from "@dedis/cothority/byzcoin/proto";
import {
    PaginateRequest,
    PaginateResponse,
} from "@dedis/cothority/byzcoin/proto/stream";
import { Roster, WebSocketAdapter } from "@dedis/cothority/network";
import { WebSocketConnection } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { Chunk } from "./chunk";
import { Flash } from "./flash";
import { LastAddedBlock } from "./lastAddedBlock";
import { Utils } from "./utils";

/**
 * @author Sophia Artioli (sophia.artioli@epfl.ch)
 * The core class that builds the chain.
 */
export class Chain {
    get getBlockClickedSubject(): Subject<SkipBlock> {
        return this.blockClickedSubject;
    }

    get getNewBlocksSubject(): Subject<SkipBlock[]> {
        return this.newBlocksSubject;
    }

    // Go to https://color.adobe.com/create/color-wheel with this base color to
    // find the palet of colors.
    static readonly blockColor = { r: 23, v: 73, b: 179 }; // #D9BA82

    static readonly blockPadding = 10;
    static readonly blockHeight = 50;
    static readonly blockWidth = 70;
    static readonly svgHeight = 200;
    static readonly svgWidth = 1270;
    static readonly unitBlockAndPaddingWidth =
        Chain.blockPadding + Chain.blockWidth;
    static readonly axisPadding = 8;
     // the number of block the window can display at normal scale. Used to
        // define the domain the xScale
    static readonly numblocks =
            Chain.svgWidth / (Chain.blockWidth + Chain.blockPadding);

    // Recommended pageSize / nbPages: 80 / 50
    static pageSize = 50;

    // The coordinate transformation on the chain.
    static zoom: any;

    /**
     * * Determine the color of the blocks.
     */
    static getBlockColor(block: SkipBlock): string {
        const body = DataBody.decode(block.payload);
        const nbTransactions = body.txResults.length;
        const factor = 1 - nbTransactions * 0.004;
        return `rgb(${Chain.blockColor.r * factor}, ${
            Chain.blockColor.v * factor
        }, ${Chain.blockColor.b * factor})`;
    }

    readonly textMargin = 5;
    readonly nbPages = 1;
    readonly textColor = "black";
    readonly loadedInfo = document.getElementById("loaded-blocks");

    readonly gblocks: any;
    readonly garrow: any;
    readonly gcircle: any;

    readonly chunks = new Array<Chunk>();

    // The roster defines the blockchain nodes
    roster: Roster;

    // The websocket used to talk to the blockchain. We keep it to re-use it
    // between the different calls instead of creating a new connection each time.
    ws: WebSocketAdapter;

    // This subject is notified each time a block is clicked.
    blockClickedSubject = new Subject<SkipBlock>();
    newBlocksSubject = new Subject<SkipBlock[]>();

    // Flash is a utility class to display flash messages in the view.
    flash: Flash;

    // First block displayed on the chain
    initialBlock: SkipBlock;

    // Coordinates and scale factor of the view of the chain
    lastTransform = { x: 0, y: 0, k: 1 };

    constructor(roster: Roster, flash: Flash, initialBlock: SkipBlock) {
        // Blockchain properties
        this.roster = roster;
        this.flash = flash;

        // First block displayed on the chain
        this.initialBlock = initialBlock;

        // This subject will be notified when the main SVG caneva in moved by the user
        const subject = new Subject();

        // Main SVG caneva that contains the chain
        const svg = d3
            .select("#svg-container")
            .attr("height", Chain.svgHeight)
            .attr("width", Chain.svgWidth);

        // This group will contain the blocks
        this.gblocks = svg.append("g").attr("class", "gblocks");

        // This group will contain the arrows between
        this.garrow = svg.append("g").attr("class", "garrow");

        // this group will contain the text. We need two separate groups because the
        // transform on the text group should not change the scale to keep the text
        // readable
        // const gcircle = svg.append("g").attr("class", "gtext");
        // this.gcircle = gcircle;

        // this group will contain the left and right loaders that display a spinner
        // when new blocks are being added
        const gloader = svg.append("g").attr("class", "gloader");


        // the xScale displays the block index and allows the user to quickly see
        // where he is in the chain
        const xScale = d3
            .scaleLinear()
            .domain([initialBlock.index, initialBlock.index + Chain.numblocks])
            .range([0, Chain.svgWidth]);

        const xAxis = d3
            .axisBottom(xScale)
            .ticks(Chain.numblocks)
            .tickFormat(d3.format("d"));

        const xAxisDraw = svg
            .insert("g", ":first-child")
            .attr("class", "x-axis")
            .attr("fill", "#8C764A")
            .call(xAxis);

        // Update the subject when the view is dragged and zoomed in-out
        const zoom = d3
            .zoom()
            .extent([
                [0, 0],
                [Chain.svgWidth, Chain.svgHeight],
            ])
            .scaleExtent([0.0001, 1.4])
            .on("zoom", () => {
                subject.next(d3.event.transform);
            });
        svg.call(zoom);
        Chain.zoom = zoom;

        // Handler to update the view (drag the view, zoom in-out). We subscribe to
        // the subject, which will notify us each time the view is dragged and
        // zoomed in-out by the user.
        subject.subscribe({
            next: (transform: any) => {
                this.lastTransform = transform;

                // This line disables translate to the left. (for reference)
                // transform.x = Math.min(0, transform.x);

                // Disable translation up/down
                transform.y = 0;

                // Update the scale
                const xScaleNew = transform.rescaleX(xScale);
                xAxis.scale(xScaleNew);
                xAxisDraw.call(xAxis);

                // Horizontal only transformation on the blocks (sets scale Y to
                // 1)
                const transformString =
                    "translate(" +
                    transform.x +
                    "," +
                    "0) scale(" +
                    transform.k +
                    "," +
                    "1" +
                    ")";

                // The blocks and arrows follow the transformations of the chain.
                this.gblocks.attr("transform", transformString);
                this.garrow.attr("transform", transformString);

                // Standard transformation on the text since we need to keep the
                // original scale
                // gcircle.selectAll("circle").attr("transform", transformString);

                // Update the loader. We want to keep them at their original
                // scale so we only translate them
                gloader.attr("transform", transform);
                // resize the loaders to always have a relative scale of 1
                gloader
                    .selectAll("svg")
                    .attr("transform", `scale(${1 / transform.k})`);
            },
        });

        subject.pipe(debounceTime(50)).subscribe({
            next: (transform: any) => {
                const bounds = Utils.transformToIndexes(
                    transform,
                    Chain.blockWidth + Chain.blockPadding,
                    Chain.svgWidth
                );

                let alreadyHandled = false;

                let leftNei: Chunk;
                let rightNei: Chunk;

                let leftNeiIndex = 0;
                let rightNeiIndex = 0;

                for (let i = 0; i < this.chunks.length; i++) {
                    const chunk = this.chunks[i];

                    // the chunk is "fully inside"
                    // ---[--***--]---
                    if (
                        chunk.left >= bounds.left &&
                        chunk.right <= bounds.right
                    ) {
                        alreadyHandled = true;
                        break;
                    }

                    // the chunk is "partially inside, from the left"
                    // --*[**----]---
                    if (chunk.left < bounds.left && chunk.right > bounds.left) {
                        alreadyHandled = true;
                        break;
                    }

                    // the chunk is "partially inside, from the right"
                    // ---[----**]*--
                    if (
                        chunk.left < bounds.right &&
                        chunk.right > bounds.right
                    ) {
                        alreadyHandled = true;
                        break;
                    }

                    // the chuck is "overly inside"
                    // ---*[***]*---
                    if (
                        chunk.left < bounds.left &&
                        chunk.right > bounds.right
                    ) {
                        alreadyHandled = true;
                        break;
                    }

                    // --**-[---]-----
                    if (chunk.right < bounds.left) {
                        if (
                            leftNei === undefined ||
                            chunk.right > leftNei.right
                        ) {
                            leftNei = chunk;
                            leftNeiIndex = i;
                        }
                    }

                    // -----[---]-**--
                    if (chunk.left > bounds.right) {
                        if (
                            rightNei === undefined ||
                            chunk.left < rightNei.left
                        ) {
                            rightNei = chunk;
                            rightNeiIndex = i;
                        }
                    }
                }
                
                if (!alreadyHandled) {
                
                    const c = new Chunk(
                        subject,
                        initialBlock,
                        leftNei,
                        rightNei,
                        bounds.left + (bounds.right - bounds.left) / 2,
                        bounds.left + (bounds.right - bounds.left) / 2 + 20,
                        this.getNewBlocksSubject,
                        this.blockClickedSubject,
                        this.lastTransform,
                        this.roster,
                        this.flash,
                        this.ws,
                        this.gblocks,
                        this.garrow
                    );

                    if (leftNei !== undefined) {
                        leftNei.rightNeighbor = c;
                    }

                    if (rightNei !== undefined) {
                        rightNei.leftNeighbor = c;
                    }

                    // keep the chunks sorted
                    this.chunks.splice(leftNeiIndex + 1, 0, c);
                }
            },
        });

        // We intialize the last added block of the chain
        new LastAddedBlock(
            roster,
            flash,
            initialBlock,
            this.blockClickedSubject
        );
    }

}