
import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import {
    PaginateRequest,
    PaginateResponse,
} from "@dedis/cothority/byzcoin/proto/stream";
import {
    Roster,
    WebSocketAdapter,
    WebSocketConnection,
} from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { Chain } from "./chain";
import { Flash } from "./flash";
import { Utils } from "./utils";

/**
 * A chunk is an autonomous part of the chain that will update itself when the
 * user drags to one of its edge. It will checks its neighbor and try not to
 * load blocks that would overlap.
 *
 * @author Noémien Kocher (noémien.kocher@epfl.ch)
 * @author Sophia Artioli (sophia.artioli@epfl.ch)
 */
export class Chunk {

    // Set to true when it is the first time loading blocks
    static firstPass = true;

    readonly maxHeightBlock = 8;

    // Blockchain properties
    roster: Roster;
    flash: Flash;

    // Left adjacent neighbour of the Chunk
    leftNeighbor: Chunk;
    // Right adjacent neighbour of the Chunk
    rightNeighbor: Chunk;

    // First block loaded of the chunk
    initialBlock: SkipBlock;

    // Left-most block of the Chunk
    leftBlock: SkipBlock;
    // Right-most block of the Chunk
    rightBlock: SkipBlock;

    // svg container for the blocks
    gblocks: any;
    // svg container for the arrows between blocks
    garrow: any;
    // container that for the left and right loaders
    gloader: d3.Selection<SVGElement, {}, HTMLElement, any>;

    // Those are the perimeter, set before blocks are loaded
    left: number;
    right: number;

    // Paginate request page number
    nbPages = 1;

    // Indicator to know if blocks should be loaded to the right or/and to the left
    // The first load will then set them to false
    isLoadingLeft = true;
    isLoadingRight = true;
    loadedFirst = false;

    // This subject is called when new blocks are loaded
    subjectBrowse = new Subject<[number, SkipBlock[], boolean]>();
    // This subject is called when new blocks are added to the view
    newBlocksSubject: Subject<SkipBlock[]>;
    // This subject is called when a block is clicked on.
    blockClickedSubject: Subject<SkipBlock>;

    // This subject is called when the user zoom/drag the chain
    chainSubject: Subject<any>;

    // The coordinates of the view.
    lastTransform = { x: 0, y: 0, k: 1 };

    // The number of total loaded blocks on the chains
    totalLoaded: number;
    // The container for the total loaded number.
    readonly loadedInfo = document.getElementById("loaded-blocks");

    // The websocket used to talk to the blockchain. We keep it to re-use it
    // between the different calls instead of creating a new connection each
    // time. Each chunk creates a ws connections because we need to have
    // different callbacks for each of them.
    ws: WebSocketAdapter;

    constructor(
        chainSubject: Subject<any>,
        initialBlock: SkipBlock,
        leftNei: Chunk,
        rightNei: Chunk,
        left: number,
        right: number,
        newBlocksSubject: Subject<SkipBlock[]>,
        blockClickedSubject: Subject<SkipBlock>,
        transform: any,
        roster: Roster,
        flash: Flash,
        ws: WebSocketAdapter,
        gblocks: any,
        garrow: any
    ) {
        this.roster = roster;
        this.flash = flash;
        this.totalLoaded = 0; // Initilize to 0

        this.chainSubject = chainSubject;
        this.newBlocksSubject = newBlocksSubject;
        this.blockClickedSubject = blockClickedSubject;

        this.leftNeighbor = leftNei;
        this.rightNeighbor = rightNei;
        this.initialBlock = initialBlock;

        this.lastTransform = transform;

        this.garrow = garrow;
        this.gblocks = gblocks;

        this.ws = ws;

        this.left = left;
        this.right = right;

        this.chainSubject.subscribe((transform: any) => {
            this.lastTransform = transform;
        });

        // The svg container for the chain
        const svg = d3.select("#svg-container");

        // This group will contain the left and right loaders that display a
        // spinner when new blocks are being added
        this.gloader = svg
            .append("g")
            .attr("class", "loader")
            .attr("transform", transform);

        this.setSubjectBrowse();

        this.chainSubject.subscribe({
            next: (transform: any) => {
                this.gloader.attr("transform", transform);
                // resize the loaders to always have a relative scale of 1
                this.gloader
                    .selectAll("svg")
                    .attr("transform", `scale(${1 / transform.k})`);
            },
        });

        // Handler to check if new blocks need to be loaded. We check once we
        // don't receive new event for 50ms.
        this.chainSubject.pipe(debounceTime(50)).subscribe({
            next: (transform: any) => {
                if (!this.loadedFirst) {
                    return;
                }

                if (!this.isLoadingLeft) {
                    this.isLoadingLeft = true;

                    const isLoading = this.checkAndLoadLeft(
                        transform,
                        this.leftBlock,
                        this.gloader
                    );
                    if (!isLoading) {
                        this.isLoadingLeft = false;
                    }
                }

                if (!this.isLoadingRight) {
                    this.isLoadingRight = true;
                    const isLoading = this.checkAndLoadRight(
                        transform,
                        this.rightBlock,
                        this.gloader
                    );
                    if (!isLoading) {
                        this.isLoadingRight = false;
                    }
                }
            },
        });

        // Load first blocks of the Chunk
        this.loadInitial(left);
    }

    /**
     * Check if new blocks need to be loaded to the left and load them if
     * necessary.
     * @param transform the transform object that contain the x,y,k
     * transformations
     * @param lastBlockLeft the last block loaded to the left
     * @param gloader the svg container that should welcome the loader
     * @returns a boolean that tells if a request to load new blocks has been
     * sent
     */
    checkAndLoadLeft(
        transform: any,
        lastBlockLeft: SkipBlock,
        gloader: any
    ): boolean {
        const bounds = Utils.transformToIndexes(
            transform,
            Chain.blockWidth + Chain.blockPadding,
            Chain.svgWidth
        );

        // Check if we need to load blocks on the left. We check that we haven't
        // yet loaded all the possible blocks from the left and that the user
        // has moved enough to the left. The -50 is to give a small margin
        // because we want to let the user drag a bit before we trigger the
        // load.
        if (
            this.leftBlock.index > bounds.left &&
            this.leftBlock.index < bounds.right
        ) {
            // check if our neighbor has not already loaded the blocks
            if (
                this.leftNeighbor !== undefined &&
                this.leftNeighbor.right > this.left
            ) {
                return false;
            }

            const hashNextBlockLeft = Utils.getLeftBlockHash(lastBlockLeft);

            this.loadLeft(transform, gloader, hashNextBlockLeft);

            return true;
        }

        return false;
    }

    /**
     * Check if new blocks need to be loaded to the right and load them if
     * necessary.
     * @param transform the transform object that contain the x,y,k
     * transformations
     * @param lastBlockRight right-most block
     * @param gloader the svg container for the loader
     * @returns a boolean that tells if a request to load new blocks has been
     * sent
     */
    checkAndLoadRight(
        transform: any,
        lastBlockRight: SkipBlock,
        gloader: any
    ): boolean {
        const bounds = Utils.transformToIndexes(
            transform,
            Chain.blockWidth + Chain.blockPadding,
            Chain.svgWidth
        );

        // Check if we need to load blocks on the right. (x + this.svgWidth)
        // represents the actual rightmost x coordinate on the svg canvas. +50
        // is to allow a margin before loading a new block, because we want to
        // allow a bit of blank space before triggering the load.
        if (
            this.rightBlock.index < bounds.right &&
            this.rightBlock.index + 2 >= bounds.left
        ) {
            // check if our neighbor has not already loaded the blocks
            if (
                this.rightNeighbor !== undefined &&
                this.rightNeighbor.left < this.right
            ) {
                return false;
            }
            let hashNextBlockRight: any ;
            try {
            hashNextBlockRight = Utils.getRightBlockHash(lastBlockRight);
            } catch {
                // If no forward links exist, it is the last block of the chain
                this.flash.display(Flash.flashType.WARNING, "End of blockchain");
                this.gloader.select(".right-loader").remove();
            }

            this.loadRight(transform, gloader, hashNextBlockRight);
            return true;
        }

        return false;
    }

    loadLeft(transform: any, gloader: any, blockHash: any) {

        // In case we are reaching the beginning of the chain, we should not
        // load more blocks than available.
        let numblocks = Chain.pageSize;
        if (this.left - Chain.pageSize <= 0) {
            numblocks = this.left;
        }

        this.left -= numblocks;

        this.addLoader(
            true,
            gloader,

            (this.leftBlock.index - 1) * Chain.unitBlockAndPaddingWidth +
                Chain.blockPadding +
                Chain.blockWidth / 2,
            transform.k
        );

        setTimeout(() => {
            this.getNextBlocks(
                blockHash,
                numblocks,
                this.nbPages,
                this.subjectBrowse,
                true
            );
        }, 800);
    }

    loadRight(transform: any, gloader: any, blockHash: string) {
        this.right += Chain.pageSize;

        this.addLoader(
            false,
            gloader,
            (this.rightBlock.index + 1) * Chain.unitBlockAndPaddingWidth +
                Chain.blockPadding +
                Chain.blockWidth / 2,
            transform.k
        );

        if (Chunk.firstPass) {
            // First time requesting blocks
            // In the case we are less than a page size away from the end of the chain

        setTimeout(() => {
            this.getNextBlocks(
                blockHash,
                1, // Since we are very close to the end, we send smaller paginate requests
                this.nbPages,
                this.subjectBrowse,
                false
            );
        }, 800);

    } else {
        setTimeout(() => {
            this.getNextBlocks(
                blockHash,
                Chain.pageSize,
                this.nbPages,
                this.subjectBrowse,
                false
            );
        }, 800);
    }
    }

    /**
     * Create a loader.
     * @param backwards true for a left loader, false for a right loader
     * @param gloader the svg container for the loaders
     * @param xPos the horizontal position
     * @param k the scale level
     *
     */
    addLoader(backwards: boolean, gloader: any, xPos: number, k: number) {
        let className = "right-loader";

        if (backwards) {
            className = "left-loader";
        }

        // Some loaders: https://codepen.io/aurer/pen/jEGbA
        gloader
            .append("svg")
            .attr("class", `${className}`)
            .attr("viewBox", "0, 0, 24, 30")
            .attr("x", xPos - 24)
            .attr("y", Chain.blockHeight / 2 - 30)
            .attr("width", "48px")
            .attr("height", "60px")
            .attr("transform-origin", `${xPos}px 0px`)
            .attr("enable-background", "new 0 0 50 50")
            .attr("transform", `scale(${1 / k})`).html(`
         <rect x="0" y="13" width="4" height="5" fill="#333">
           <animate attributeName="height" attributeType="XML"
             values="5;21;5"
             begin="0s" dur="0.6s" repeatCount="indefinite" />
           <animate attributeName="y" attributeType="XML"
             values="13; 5; 13"
             begin="0s" dur="0.6s" repeatCount="indefinite" />
         </rect>
         <rect x="10" y="13" width="4" height="5" fill="#333">
           <animate attributeName="height" attributeType="XML"
             values="5;21;5"
             begin="0.15s" dur="0.6s" repeatCount="indefinite" />
           <animate attributeName="y" attributeType="XML"
             values="13; 5; 13"
             begin="0.15s" dur="0.6s" repeatCount="indefinite" />
         </rect>
         <rect x="20" y="13" width="4" height="5" fill="#333">
           <animate attributeName="height" attributeType="XML"
             values="5;21;5"
             begin="0.3s" dur="0.6s" repeatCount="indefinite" />
           <animate attributeName="y" attributeType="XML"
             values="13; 5; 13"
             begin="0.3s" dur="0.6s" repeatCount="indefinite" />
         </rect>
      `);
    }
    /*
     * Append the given blocks to the blockchain.
     * @param listBlocks list of blocks to append
     * @param backwards  false for loading blocks to the right, true for loading
     *                   blocks to the left
     * @param numblocks the number of blocks loaded from the initial block. In the
     * case of a backward loading, this number should be negative. -10 means we
     * already loaded 10 blocks on the left from the initial block.
     *
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
        for (let i = 0; i < listBlocks.length; ++i) {
            const block = listBlocks[i];

            let xTranslateBlock: number;
            if (backwards) {
                // Blocks are appended to the left
                xTranslateBlock =
                    (numblocks - 1 - i) * Chain.unitBlockAndPaddingWidth;
            } else {
                // Blocks are appended to the right
                xTranslateBlock =
                    (numblocks  + i) * Chain.unitBlockAndPaddingWidth;
            }

            // Append the block inside the svg container
            this.appendBlock(xTranslateBlock, block, gblocks);
            // Append arrows between blocks
            this.getToAndFromIndexes(xTranslateBlock, block, garrow);
            // this.appendCircleInBlock(xTranslateBlock, gcircle);
        }

        this.newBlocksSubject.next(listBlocks);
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

        if (this.ws != undefined) {
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
                    this.ws = undefined;
                },
                error: (err: Error) => {
                    this.flash.display(Flash.flashType.ERROR, `error: ${err}`);
                    this.ws = undefined;
                },
                next: ([data, ws]) => {

                    if (data.errorcode != 0) {

                        if (data.errorcode == 5 || data.errorcode == 4) {

                            if (ws != undefined) {
                                this.ws = ws;
                            }
                            subjectBrowse.next([
                                data.pagenumber,
                                data.blocks,
                                data.backward,
                            ]);
                            return 0;
                         } else {

                        this.flash.display(
                            Flash.flashType.ERROR,
                            `got an error with code ${data.errorcode} : ${data.errortext}`
                        );
                        return 1;
                        }
                    }
                    if (ws != undefined) {
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

    /**
     * Helper function: sets up the fist request to load blocks on the chain.
     * @param left the left-most block index of the chunk
     * @private
     */
    private loadInitial(left: number) {

        // Fetch the block
        Utils.getBlockByIndex(this.initialBlock.hash, left, this.roster).then(
            (block: SkipBlock) => {
                this.leftBlock = block;
                this.rightBlock = block;
                if (left != 0) {
                    // left is not the first block of the chain
                    this.loadLeft(
                        this.lastTransform,
                        this.gloader,
                        Utils.getLeftBlockHash(block) // Fetch blocks smaller than left index

                    );
                } else {
                    this.isLoadingLeft = false;
                }

                this.loadRight(
                    this.lastTransform,
                    this.gloader,
                    Utils.bytes2String(block.hash) // Fetch block from left index and higher
                );
            }
        );
    }

    /**
     * @private Helper function to define methods of the subjectBrowse subject
     */
    private setSubjectBrowse() {
        this.subjectBrowse.subscribe({
            complete: () => {
                this.flash.display(
                    Flash.flashType.INFO,
                    "End of the blockchain"
                );
            },
            error: (err: any) => {
                if (err == 1) {
                    // To reset the websocket, create a new handler for the next
                    // function (of getNextBlock)
                    this.ws = undefined;
                } else {
                    this.flash.display(Flash.flashType.ERROR, `Error: ${err}`);
                }
                // Stop loading the blocks
                this.isLoadingLeft = false;
                this.isLoadingRight = false;
            },
            /**
             * Displaying blocks on the chain once blocks are fetched from the cothority client
             * @param i page number
             * @param skipBlocks list of blocks to display
             * @param backward true to append blocks to the left, false to append to the right
             */
            next: ([i, skipBlocks, backward]) => {

                this.totalLoaded += skipBlocks.length;
                this.loadedInfo.innerText = `${this.totalLoaded}`;
                let isLastPage = false;

                if (i == this.nbPages - 1) {
                    isLastPage = true;
                }

                if (backward) {
                    // Load blocks to the left
                    this.displayBlocks(
                        skipBlocks,
                        true,
                        this.gblocks,
                        this.garrow,
                        this.leftBlock.index
                    );

                    this.leftBlock = skipBlocks[skipBlocks.length - 1];

                    if (isLastPage) {
                        this.gloader.select(".left-loader").remove();

                        const loadMore = this.checkAndLoadLeft(
                            this.lastTransform,
                            this.leftBlock,
                            this.gloader
                        );

                        if (!loadMore) {
                            this.isLoadingLeft = false;
                        }
                    }
                } else {
                   // Load blocks to the right

                    let num = this.rightBlock.index;
                    if (this.rightBlock.index < skipBlocks[0].index) {
                        // Update the first block to load to the right
                        num = skipBlocks[0].index;

                    }

                    this.displayBlocks(
                        skipBlocks,
                        false,
                        this.gblocks,
                        this.garrow,
                        num
                    );
                    // Right-most block
                    this.rightBlock = skipBlocks[skipBlocks.length - 1];

                    if (isLastPage) {
                        this.gloader.select(".right-loader").remove();

                        const loadMore = this.checkAndLoadRight(
                            this.lastTransform,
                            this.rightBlock,
                            this.gloader
                        );

                        if (!loadMore) {
                            this.isLoadingRight = false;
                        }
                    }
                }

                this.loadedFirst = true;
            },
        });
    }

    /**
     * Helper for displayBlocks: appends a block to the blockchain and adds it to
     * the subscriber list.
     * @param xTranslate horizontal position where the block should be appended
     * @param block the block to append
     * @param svgBlocks the svg container for the blocks
     */
    private appendBlock(xTranslate: number, block: SkipBlock, svgBlocks: any) {
        svgBlocks
            .append("rect")
            .attr("id", Utils.bytes2String(block.hash))
            .attr("width", Chain.blockWidth)
            // Heights are described by level
            // (Chain.svgHeight / this.maxHeightBlock) is the height a level to fit the chain height
            .attr(
                "height",
                block.height * (Chain.svgHeight / this.maxHeightBlock)
            )
            .attr("x", xTranslate)
            .attr("y", 20) // Blocks are appended below the axis
            .attr("fill", Chain.getBlockColor(block))
            .on("click", () => {
                this.blockClickedSubject.next(block);
                window.location.hash = `index:${block.index}`;
            })
            .on("mouseover", function() {
                d3.select(this).style("cursor", "pointer");
            })
            .on("mouseout", function() {
                d3.select(this).style("cursor", "default");
            });
    }

    /**
     * Helper function to append arrows between two blocks
     * @param xTrans horizontal position where the block should be appended
     * @param skipBlockFrom starting skipBlock point of the arrow
     * @param skipBlockTo the skipBlock the arrow points to
     * @param svgBlocks the svg where the block are appended
     * @param height the y coordinate where the arrow is appended on the blocks
     * @author Sophia Artioli <sophia.artioli@epfl.ch>
     */
    private async appendArrows(
        xTrans: number,
        skipBlockFrom: SkipBlock,
        skipBlockTo: SkipBlock,
        svgBlocks: any,
        height: number
    ) {
        if (skipBlockTo.index - skipBlockFrom.index == 1) {
            // Consecutive blocks
            const line = svgBlocks.append("line");
            line
                .attr("x1", xTrans)
                .attr("y1", Chain.blockHeight / 2 + Chain.axisPadding)
                .attr("x2", xTrans - Chain.blockPadding)
                .attr("y2", Chain.blockHeight / 2 + Chain.axisPadding)
                .attr("stroke-width", 2)
                .attr("stroke", "#808080");
        } else {
            // Blocks that are minimum two indexes away
            const line = svgBlocks.append("line");

            // Starting point of the arrow: Right side of the block
            line.attr(
                "x1",
                xTrans -
                    (skipBlockTo.index - skipBlockFrom.index) *
                        (Chain.blockWidth + Chain.blockPadding) +
                    Chain.blockWidth
            ) // Arrows are appended to each height level
                .attr(
                    "y1",
                    Chain.axisPadding +
                        Chain.svgHeight / this.maxHeightBlock +
                        height * (Chain.svgHeight / this.maxHeightBlock)
                ) // Ending point of the arrow: left-side of the block
                .attr("x2", xTrans - Chain.blockPadding + 2)
                .attr(
                    "y2",
                    Chain.axisPadding +
                        Chain.svgHeight / this.maxHeightBlock +
                        height * (Chain.svgHeight / this.maxHeightBlock)
                )
                .attr("marker-end", "url(#triangle)")
                .attr("stroke-width", 1.5)
                .attr("stroke", "#A0A0A0")
                // Enables translation to the block the arrow is pointing to
                .on("click", () => {
                    Utils.translateOnChain(
                        skipBlockTo,
                        this.initialBlock,
                        this.blockClickedSubject
                    );
                });

            // Triangle end of the arrow
            const triangle = svgBlocks.append("svg:defs").append("svg:marker");
            triangle
                .attr("id", "triangle")
                .attr("refX", 5.5)
                .attr("refY", 4.5)
                .attr("markerWidth", 17)
                .attr("markerHeight", 15)
                .attr("fill", "#A0A0A0")
                .attr("orient", "auto-start-reverse")
                .append("path")
                .attr("d", "M 0 0 L 10 5 L 0 10 z")
                .on("click", () => {
                   Utils.translateOnChain(skipBlockTo, this.initialBlock, this.blockClickedSubject);
                   this.blockClickedSubject.next(skipBlockTo);
                });

            // Arrows change color on hover
            triangle.on("mouseover",
                    function() {
                        d3.select(this).style("stroke", "var(--selected-colour");
                        triangle.attr("stroke", "var(--selected-colour");

                });
            line.on("mouseover",
                    function() {
                        d3.select(this).style("stroke", "var(--selected-colour");
                        triangle.attr("stroke", "var(--selected-colour");

                });
            triangle.on("mouseout", () => {
                    line.style("stroke", "#A0A0A0");
                    triangle.style("stroke", "#A0A0A0");

                });
            line.on("mouseout", () => {
                    line.style("stroke", "#A0A0A0");
                    triangle.style("stroke", "#A0A0A0");
                    triangle.style("fill", "#A0A0A0");
                });

        }
    }
    /**
     * Helper function to get starting point and ending SkipBlocks of the arrow
     * @param xTranslate horizontal position where the block should be appended
     * @param skipBlockTo the skipBlock the arrow points to
     * @param svgBlocks the svg where the blocks are appended
     * @author Sophia Artioli <sophia.artioli@epfl.ch>
     */
    private getToAndFromIndexes(
        xTranslate: number,
        skipBlockTo: SkipBlock,
        svgBlocks: any
    ) {
        // Iterate through all blocks
        for (let i = 0; i < skipBlockTo.backlinks.length; i++) {
            Utils.getBlock(
                skipBlockTo.backlinks[i], // Get all blocks that point to skipBlockTo
                this.roster
            ).then((skipBlockFrom) => {
                this.appendArrows(
                    xTranslate,
                    skipBlockFrom,
                    skipBlockTo,
                    svgBlocks,
                    i
            ); }).catch((e) => { this.flash.display((Flash.flashType.INFO), "Start of the blockchain"); });

        }
    }

    /**
     * Helper for displayBlocks: appends a text element in a block.
     * @param xTranslate horizontal position where the text should be displayed
     * @param gcircle the svg container for the circles
     * @author Sophia Artioli <sophia.artioli@epfl.ch>
     */
    private appendCircleInBlock(xTranslate: number, gcircle: any) {
        gcircle
            .append("circle")
            .attr("cx", xTranslate + 35)
            .attr("cy", 40)
            .attr("r", 6)
            .attr("fill", "#b3ffb3");

        gcircle
            .append("circle")
            .attr("cx", xTranslate + Chain.blockWidth - 35)
            .attr("cy", 40)
            .attr("r", 6)
            .attr("fill", "#EF5959");
    }
}
