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
import { Utils } from "./utils";

export class Chain {
    // Go to https://color.adobe.com/create/color-wheel with this base color to
    // find the palette of colors.
    static readonly blockColor = { r: 23, v: 73, b: 179 }; // #D9BA82

    // This subject is notified each time a block is clicked.
    static readonly blockClickedSubject = new Subject<SkipBlock>();

    // This subject is notified when a new series of block has been added to the view.
    static readonly newBlocksSubject = new Subject<SkipBlock[]>();

    /**
     * Determine the color of the blocks.
     */
    static getBlockColor(block: SkipBlock): string {
        const body = DataBody.decode(block.payload);
        const nbTransactions = body.txResults.length;
        const factor = 1 - nbTransactions * 0.004;
        return `rgb(${Chain.blockColor.r * factor}, ${
            Chain.blockColor.v * factor
        }, ${Chain.blockColor.b * factor})`;
    }


    readonly zoom: any;
    readonly blockPadding = 10;
    readonly textMargin = 5;
    readonly blockHeight = 50;
    readonly blockWidth = 100;

    readonly svgWidth = window.innerWidth;
    readonly svgHeight = 200;
    readonly unitBlockAndPaddingWidth = this.blockPadding + this.blockWidth;

    // Svg <g> element for the blocks of the chain.
    readonly gblocks: any;
    // Svg <g> element for the arrows between blocks the chain.
    readonly garrow: any;

    // Svg <g> element for shape elements on the blocks
    // readonly gcircle: any;

    // Recomended pageSize / nbPages: 80 / 50
    readonly pageSize = 50;
    readonly nbPages = 1;

    readonly textColor = "black";

    readonly chunks = new Array<Chunk>();

    // The roster defines the blockchain nodes
    roster: Roster;

    // The websocket used to talk to the blockchain. We keep it to re-use it
    // between the different calls instead of creating a new connection each time.
    ws: WebSocketAdapter;

    // This subject is notified each time a new page containing new blocks has
    // been loaded from the cothority client.
    subjectBrowse = new Subject<[number, SkipBlock[], boolean]>();

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

        // This subject will be notified when the main SVG canevas in moved by the user
        const subject = new Subject();

        // Main SVG caneva that contains the chain
        const svg = d3.select("#svg-container").attr("height", this.svgHeight);

        // this group will contain the blocks
        this.gblocks = svg.append("g").attr("class", "gblocks");

        // this group will contain the text. We need two separate groups because the
        // transform on the text group should not change the scale to keep the text
        // readable
        // const gcircle = svg.append("g").attr("class", "gtext");

        // this group will contain the left and right loaders that display a spinner
        // when new blocks are being added
        const gloader = svg.append("g").attr("class", "gloader");

        // the number of block the window can display at normal scale. Used to
        // define the domain the xScale
        const numblocks = this.svgWidth / (this.blockWidth + this.blockPadding);

        // the xScale displays the block index and allows the user to quickly see
        // where he is in the chain
        const {xScale, xAxis, xAxisDraw} = this.buildAxis(initialBlock, numblocks, svg);

        // Update the subject when the view is dragged and zoomed in-out
        const zoom = d3
            .zoom()
            .extent([
                [0, 0],
                [this.svgWidth, this.svgHeight],
            ])
            .scaleExtent([0.0001, 1.4])
            .on("zoom", () => {
                subject.next(d3.event.transform);
            });
        svg.call(zoom);
        this.zoom = zoom;

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
                this.gblocks.attr("transform", transformString);
                // Standard transformation on the circles since we need to keep the
                // original scale
                //  gblocks.selectAll("circle").attr("r",transform.k*5);
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
                this.checkAndLoadChunks(transform, subject);
            },
        });
    }

    private checkAndLoadChunks(transform: any, subject: Subject<unknown>) {
        const bounds = Utils.transformToIndexes(
            transform,
            this.blockWidth + this.blockPadding,
            this.svgWidth
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
                leftNei,
                rightNei,
                bounds.left + (bounds.right - bounds.left) / 2,
                bounds.left + (bounds.right - bounds.left) / 2 + 20,
                this,
                this.lastTransform
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
    }

    private buildAxis(initialBlock: SkipBlock, numblocks: number, svg: any) {
        const xScale = d3
            .scaleLinear()
            .domain([initialBlock.index, initialBlock.index + numblocks])
            .range([0, this.svgWidth]);

        const xAxis = d3
            .axisBottom(xScale)
            .ticks(numblocks)
            .tickFormat(d3.format("d"));

        const xAxisDraw = svg
            .insert("g", ":first-child")
            .attr("class", "x-axis")
            .attr("transform", `translate(${this.blockPadding}, 0)`)
            .attr("fill", "#8C764A")
            .call(xAxis);
        return {xScale, xAxis, xAxisDraw};
    }

    /**
     * Append the given blocks to the blockchain.
     * @param listBlocks list of blocks to append
     * @param backwards  false for loading blocks to the right, true for loading
     *                   blocks to the left
     * @param gblocks the svg where the block are appended
     * @param garrow the svg where the arrows are appended
     * @param numblocks the number of blocks loaded from the initial block. In the
     * case of a backward loading, this number should be negative. -10 means we
     * already loaded 10 blocks on the left from the initial block.
     */
    displayBlocks(
        listBlocks: SkipBlock[],
        backwards: boolean,
        gblocks: any,
        garrow: any,
        // gcircle: any,
        numblocks: number
    ) {
        // Iterate over the blocks to append them
        // tslint:disable-next-line
        for (let i = 0; i < listBlocks.length; ++i) {
            const block = listBlocks[i];

            let xTranslateBlock: number;
            if (backwards) {
                xTranslateBlock =
                    (numblocks - 1 - i) * this.unitBlockAndPaddingWidth +
                    this.blockPadding;
            } else {
                xTranslateBlock =
                    (numblocks + i) * this.unitBlockAndPaddingWidth +
                    this.blockPadding;
            }

            // Append the block inside the svg container
            this.appendBlock(xTranslateBlock, block, gblocks);
            this.getToAndFromIndexes(xTranslateBlock, block, garrow);
            // this.appendCircleInBlock(xTranslateBlock, gcircle);

        }

        Chain.newBlocksSubject.next(listBlocks);
    }

    /**
     * Helper for displayBlocks: appends a block to the blockchain and adds it to
     * the subscriber list.
     * @param xTranslate horizontal position where the block should be appended
     * @param block the block to append
     * @param svgBlocks the svg where the block are appended
     */
    private appendBlock(xTranslate: number, block: SkipBlock, svgBlocks: any) {
        svgBlocks
            .append("rect")
            .attr("id", Utils.bytes2String(block.hash))
            .attr("width", this.blockWidth)

            .attr("height", block.height * 40)

            .attr("x", xTranslate)
            .attr("y", 20)
            .attr("fill", Chain.getBlockColor(block))
            .on("click", () => {
                Chain.blockClickedSubject.next(block);
                window.location.hash = `index:${block.index}`;
            });
    }

    /**
     * Helper function to append arrows between two blocks
     * @param xTrans horizontal position where the block should be appended
     * @param skipBlockFrom starting skipBlock point of the arrow
     * @param skipBlockTo the skipBlock the arrow points to
     * @param svgBlocks the svg where the block are appended
     * @param height the y coordinate where the arrow is appended on the blocks
     */
    private async appendArrows(
        xTrans: number,
        skipBlockFrom: SkipBlock,
        skipBlockTo: SkipBlock,
        svgBlocks: any,
        height: number
    ) {
        if (skipBlockTo.index - skipBlockFrom.index === 1) {
            const line = svgBlocks.append("line");
            line.attr("id", skipBlockFrom.index)
                .attr("x1", xTrans)
                .attr("y1", 15 + this.blockHeight / 2)
                .attr("x2", xTrans - this.blockPadding)
                .attr("y2", 15 + this.blockHeight / 2)
                .attr("stroke-width", 2)
                .attr("stroke", "grey");
            // .attr("marker-end", "url(#triangle)");
        } else {
            const line = svgBlocks.append("line");
            line.attr("x2", xTrans - this.blockPadding)
                .attr("y1", 40 + height * 38)
                .attr(
                    "x1",
                    xTrans -
                    (skipBlockTo.index - skipBlockFrom.index) *
                    (this.blockWidth + this.blockPadding) +
                    this.blockWidth
                )

                .attr("y2", 40 + height * 38)
                .attr("stroke-width", 2)
                .attr("stroke", "grey")
                .attr("marker-end", "url(#triangle)")
                .on("click", () => {
                    // tslint:disable-next-line:max-line-length
                    Utils.scrollOnChain(this.roster, this.initialBlock.hash.toString("hex"), skipBlockTo, this.initialBlock, this);
                    Chain.blockClickedSubject.next(skipBlockTo);
                });

            const triangle = svgBlocks.append("svg:defs").append("svg:marker");
            triangle
                .attr("id", "triangle")
                .attr("refX", 5.5)
                .attr("refY", 4.5)
                .attr("markerWidth", 15)
                .attr("markerHeight", 15)
                .attr("orient", "auto-start-reverse")
                .append("path")
                .attr("d", "M 0 0 L 10 5 L 0 10 z")
                .on("click", () => {
                    // tslint:disable-next-line:max-line-length
                    Utils.scrollOnChain(this.roster, skipBlockTo.hash.toString("hex"), skipBlockTo, this.initialBlock, this);
                    Chain.blockClickedSubject.next(skipBlockTo);
                })
                .style("fill", "grey");
            // FIXME can't change the colour of the svg markers like this. Only option I see
            // is to create another triangle and witch when needed
            triangle.on("mouseover", () => {
                line.style("stroke", "var(--selected-colour");
                triangle.style("fill", "var(--selected-colour");
            });
            line.on("mouseover", () => {
                line.style("stroke", "var(--selected-colour");
                triangle.attr("stroke", "var(--selected-colour");
            });
            triangle.on("mouseout", () => {
                line.style("stroke", "grey");
                triangle.style("stroke", "grey");
            });
            line.on("mouseout", () => {
                line.style("stroke", "grey");
                triangle.style("stroke", "grey");
            });
        }
    }
    /**
     * Helper function to get starting point and ending SkipBlocks of the arrow
     * @param xTranslate horizontal position where the block should be appended
     * @param skipBlockTo the skipBlock the arrow points to
     * @param svgBlocks the svg where the blocks are appended
     */
    private async getToAndFromIndexes(
        xTranslate: number,
        skipBlockTo: SkipBlock,
        svgBlocks: any
    ) {
        for (let i = 0; i < skipBlockTo.backlinks.length; i++) {
            const skipBlockFrom = await Utils.getBlock(
                skipBlockTo.backlinks[i],
                this.roster
            );

            await this.appendArrows(
                xTranslate,
                skipBlockFrom,
                skipBlockTo,
                svgBlocks,
                i
            );
        }
    }

    /**
     * Helper for displayBlocks: appends a text element in a block.
     * @param xTranslate horizontal position where the text should be displayed
     * @param gtext the svg where the text or shapes are appended
     */
    private appendCircleInBlock(xTranslate: number, gtext: any) {
        gtext
            .append("circle")
            .attr("cx", xTranslate + 35)
            .attr("cy", 40)
            .attr("r", 6)
            .attr("fill", "#b3ffb3");

        gtext
            .append("circle")
            .attr("cx", xTranslate + this.blockWidth - 35)
            .attr("cy", 40)
            .attr("r", 6)
            .attr("fill", "#EF5959");
    }

    /**
     * Requests blocks to the blockchain.
     * @param nextBlockID hash of the first block of the next blocks to get
     * @param pageSize number of blocks in a page
     * @param nbPages number of pages to request
     * @param subjectBrowse observable to get the blocks from the blockchain
     * @param backward false for loading blocks to the right, true for loading
     * blocks to the left
     */
    getNextBlocks(
        nextBlockID: string,
        pageSize: number,
        nbPages: number,
        subjectBrowse: Subject<[number, SkipBlock[], boolean]>,
        backward: boolean
    ) {
        let bid: Buffer;

        try {
            bid = Utils.hex2Bytes(nextBlockID);
        } catch (error) {
            this.flash.display(
                Flash.flashType.ERROR,
                `failed to parse the block ID: ${error}`
            );
            return;
        }

        let conn: WebSocketConnection;
        try {
            conn = new WebSocketConnection(
                this.roster.list[0].getWebSocketAddress(),
                ByzCoinRPC.serviceName
            );
        } catch (error) {
            this.flash.display(
                Flash.flashType.ERROR,
                `error creating conn: ${error}`
            );
            return;
        }

        if (this.ws !== undefined) {
            const message = new PaginateRequest({
                backward,
                numpages: nbPages,
                pagesize: pageSize,
                startid: bid,
            });

            const messageByte = Buffer.from(
                message.$type.encode(message).finish()
            );
            this.ws.send(messageByte); // fetch next block
        } else {
            conn.sendStream<PaginateResponse>( // fetch next block
                new PaginateRequest({
                    backward,
                    numpages: nbPages,
                    pagesize: pageSize,
                    startid: bid,
                }),
                PaginateResponse
            ).subscribe({
                // ws callback "onMessage":
                complete: () => {
                    this.flash.display(Flash.flashType.ERROR, "closed");
                    this.ws = undefined;
                },
                error: (err: Error) => {
                    this.flash.display(Flash.flashType.ERROR, `error 555: ${err}`);
                    this.ws = undefined;
                },
                next: ([data, ws]) => {
                    // tslint:disable-next-line
                    if (data.errorcode != 0) {
                        this.flash.display(
                            Flash.flashType.ERROR,
                            `got an error with code ${data.errorcode} : ${data.errortext}`
                        );
                        return 1;
                    }
                    if (ws !== undefined) {
                        this.ws = ws;
                    }

                    subjectBrowse.next([
                        data.pagenumber,
                        data.blocks,
                        data.backward,
                    ]);
                    return 0;
                },
            });
        }
    }
}
