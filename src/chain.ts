import { DataBody } from "@dedis/cothority/byzcoin/proto";
import { Roster, WebSocketAdapter } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { Chunk } from "./chunk";
import { Flash } from "./flash";
import { LastAddedBlock } from "./lastAddedBlock";
import { Utils } from "./utils";

/**
 * The core class that builds the chain and creates autonomous parts on it
 * @author Sophia Artioli (sophia.artioli@epfl.ch)
 * @author Noémien Kocher (noémien.kocher@epfl.ch)
 */
export class Chain {
<<<<<<< HEAD
=======

>>>>>>> 86574ef80f8bef0db2af919bc2b2240bc9ef55be
    // Getter for the subject that is notified when a block is clicked on.
    get getBlockClickedSubject(): Subject<SkipBlock> {
        return this.blockClickedSubject;
    }

    // Getter for the subject that is notified when new blocks are loaded from the client.
    get getNewBlocksSubject(): Subject<SkipBlock[]> {
        return this.newBlocksSubject;
    }

    // Go to https://color.adobe.com/create/color-wheel with this base color to
    // find the palet of colors.
    static readonly blockColor = { r: 23, v: 73, b: 179 };

    // Block properties
    static readonly blockPadding = 10;
    static readonly blockHeight = 50;
    static readonly blockWidth = 70;
    static readonly svgHeight = 200;
    static readonly svgWidth = window.innerWidth;

<<<<<<< HEAD
    static unitBlockAndPaddingWidth = Chain.blockPadding + Chain.blockWidth;
=======
    static  unitBlockAndPaddingWidth =
        Chain.blockPadding + Chain.blockWidth;
>>>>>>> 86574ef80f8bef0db2af919bc2b2240bc9ef55be
    static readonly axisPadding = 8;

    // The number of blocks the window can display at normal scale. Used to
    // define the domain for the xScale
<<<<<<< HEAD
    static numBlocks = Chain.svgWidth / (Chain.blockWidth + Chain.blockPadding);
=======
    static  numBlocks =
        Chain.svgWidth / (Chain.blockWidth + Chain.blockPadding);
>>>>>>> 86574ef80f8bef0db2af919bc2b2240bc9ef55be

    // Recommended pageSize / nbPages: 80 / 50
    static pageSize = 50;
    static readonly nbPages = 1;

    // The coordinate transformation of the chain.
    static zoom: any;

    // The number of total loaded blocks on the chains
    // Initialized to 0
    static totalLoaded = 0;

    /**
     * Determine the color of the blocks.
     * The darker the block the more transactions it contains.
     */
    static getBlockColor(block: SkipBlock): string {
        const body = DataBody.decode(block.payload);
        const nbTransactions = body.txResults.length;
        const factor = 1 - nbTransactions * 0.004;
        return `rgb(${Chain.blockColor.r * factor}, ${
            Chain.blockColor.v * factor
        }, ${Chain.blockColor.b * factor})`;
    }

    // The group that contains the blocks on the chain.
    readonly gblocks: any;
    // The group that contains the arrows between blocks.
    readonly garrow: any;
    // The groups that contains the circles on the blocks of the chain
    // readonly gcircle: any;

    // The array that contains all autonomous parts on the chain.
    readonly chunks = new Array<Chunk>();

    // The roster defines the blockchain nodes
    roster: Roster;

    // The websocket used to talk to the blockchain. We keep it to re-use it
    // between the different calls instead of creating a new connection each time.
    ws: WebSocketAdapter;

    // This subject is notified each time a block is clicked.
    blockClickedSubject = new Subject<SkipBlock>();

    // This subject is notified when a new series of block has been added to the
    // view.
    newBlocksSubject = new Subject<SkipBlock[]>();

    // Flash is a utility class to display flash messages in the view.
    flash: Flash;

    // The first block displayed by the chain.
    initialBlock: SkipBlock;
<<<<<<< HEAD

    lastAddedBlock: SkipBlock;

    // Coordinates and scale factor of the view of the chain
    lastTransform = { x: 0, y: 0, k: 1 };
=======

    // Coordinates and scale factor of the view of the chain
    lastTransform = { x: 0, y: 0, k: 1 };

    constructor(roster: Roster, flash: Flash, initialBlock: SkipBlock) {
>>>>>>> 86574ef80f8bef0db2af919bc2b2240bc9ef55be

    constructor(roster: Roster, flash: Flash, initialBlock: SkipBlock) {
        // Blockchain properties
        this.roster = roster;
        this.flash = flash;

        // First block displayed on the chain
        this.initialBlock = initialBlock;
<<<<<<< HEAD

        // This subject will be notified when the main SVG canvas in moved by the user
        const subject = new Subject();

        // Main SVG canvas that contains the chain
        const svg = d3.select("#svg-container").attr("height", Chain.svgHeight);

=======

        // This subject will be notified when the main SVG canvas in moved by the user
        const subject = new Subject();

        // Main SVG canvas that contains the chain
        const svg = d3
            .select("#svg-container")
            .attr("height", Chain.svgHeight);

>>>>>>> 86574ef80f8bef0db2af919bc2b2240bc9ef55be
        // This group will contain the blocks
        this.gblocks = svg.append("g").attr("class", "gblocks");

        // This group will contain the arrows between blocks
        this.garrow = svg.append("g").attr("class", "garrow");

        // This group will contain the circles. We need two separate groups because the
        // transform on the text group should not change the scale to keep the text
        // readable
        // this.gcircle = svg.append("g").attr("class", "gcircle");

        // The xScale displays the block index and allows the user to quickly see
        // where he is in the chain
        const xScale = d3
            .scaleLinear()
            .domain([initialBlock.index, initialBlock.index + Chain.numBlocks])
            .range([0, Chain.svgWidth]);

        const xAxis = d3
            .axisBottom(xScale)
            .ticks(Chain.numBlocks)
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

                // Horizontal transformation on the blocks only (sets Y scale to 1)
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
                // this.gcircle.attr("transform", transformString);
            },
        });

        // Initialize the last added block of the chain in its dedicated space
        // It is initialized here as it takes longer to load.
        // We need to use it when creating new chunks
        const lastAddedBlock = new LastAddedBlock(
            roster,
            flash,
            initialBlock,
            this.blockClickedSubject
        );

        // Subject that is notified about the transformation on the chain
        subject.pipe(debounceTime(50)).subscribe({
            next: (transform: any) => {
                const bounds = Utils.transformToIndexes(
                    transform,
                    Chain.blockWidth + Chain.blockPadding,
                    Chain.svgWidth
                );

                let alreadyHandled = false;

                // The adjacent neighbours to the current Chunk
                let leftNei: Chunk;
                let rightNei: Chunk;

                // The adjacent neighbours indexes to the current Chunk
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
                    // A new Chunk is created,
<<<<<<< HEAD
                    let leftBound = (bounds.left + (bounds.right - bounds.left) / 2);
                    let rightBound = (bounds.left + (bounds.right - bounds.left) / 2 + 20);
    
                    if (leftBound > lastAddedBlock.lastBlock.index){
                        leftBound = bounds.left;
                        rightBound = lastAddedBlock.lastBlock.index;

                    }
=======
>>>>>>> 86574ef80f8bef0db2af919bc2b2240bc9ef55be
                    const c = new Chunk(
                        subject,
                        initialBlock,
                        lastAddedBlock,
                        leftNei,
                        rightNei,
<<<<<<< HEAD
                        leftBound,
                        rightBound,
=======
                        bounds.left + (bounds.right - bounds.left) / 2,
                        bounds.left + (bounds.right - bounds.left) / 2 + 20,
>>>>>>> 86574ef80f8bef0db2af919bc2b2240bc9ef55be
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

                    // Keep the chunks sorted.
                    this.chunks.splice(leftNeiIndex + 1, 0, c);
                }
            },
        });
    }
}
