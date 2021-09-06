import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import * as blockies from "blockies-ts";

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
import { LastAddedBlock } from "./lastAddedBlock";
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
    // Maximum known possible height of block
    // We fix it to 8 so that all arrows can fit in the canevas
    readonly maxHeightBlock = 8;

    // Blockchain properties
    roster: Roster;
    flash: Flash;

    // The websocket used to talk to the blockchain. We keep it to re-use it
    // between the different calls instead of creating a new connection each time.
    ws: WebSocketAdapter;

    // Left adjacent neighbour of the Chunk
    leftNeighbor: Chunk;
    // Right adjacent neighbour of the Chunk
    rightNeighbor: Chunk;

    // First block loaded of the chunk

    // Last added block of the chain
    lastAddedBlock: SkipBlock;

    // Left-most block of the Chunk
    leftBlock: SkipBlock;
    // Right-most block of the Chunk
    rightBlock: SkipBlock;

    // svg container for the blocks
    readonly gblocks: any;
    // svg container for the arrows between blocks
    readonly garrow: any;
    // container that for the left and right loaders
    readonly gloader: any;

    // These are the perimeters, set before blocks are loaded
    left: number;
    right: number;

    // Paginate request page number
    nbPages = 1;

    // Indicators to know if blocks should be loaded to the right or/and to the left
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

    // The container for the total loaded number.
    readonly loadedInfo = document.getElementById("loaded-blocks");

    initialBlock: SkipBlock;

    constructor(
        roster: Roster,
        flash: Flash,
        leftNei: Chunk,
        rightNei: Chunk,
        bounds: { left: number; right: number },
        initialBlock: SkipBlock,
        lastAddedBlock: LastAddedBlock,
        chainSubject: Subject<any>,
        newBlocksSubject: Subject<SkipBlock[]>,
        blockClickedSubject: Subject<SkipBlock>
    ) {
        this.roster = roster;
        this.flash = flash;

        this.chainSubject = chainSubject;
        this.newBlocksSubject = newBlocksSubject;
        this.blockClickedSubject = blockClickedSubject;

        this.leftNeighbor = leftNei;
        this.rightNeighbor = rightNei;
        this.lastAddedBlock = lastAddedBlock.lastBlock;
        this.initialBlock = initialBlock;

        this.left = bounds.left;
        this.right = bounds.right;

        // The svg container for the chain
        const svg = d3.select("#svg-container");

        this.garrow = svg.selectAll(".garrow");
        this.gblocks = svg.selectAll(".gblocks");
        this.gloader = svg.select("#loader");

        this.setSubjectBrowse();

        this.chainSubject.subscribe({
            next: (transform: any) => {
                this.lastTransform = transform;
                this.gloader.attr("transform", transform);
                // // resize the loaders to always have a relative scale of 1
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
        this.loadInitial(this.left);
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
        // has moved enough to the left.
        if (
            this.leftBlock.index > bounds.left &&
            this.leftBlock.index < bounds.right
        ) {
            // Check if our neighbor has not already loaded the blocks
            if (
                this.leftNeighbor !== undefined &&
                this.leftNeighbor.right > this.left
            ) {
                return false;
            }
            // Load block to the left
            const hashNextBlockLeft = Utils.getLeftBlockHash(lastBlockLeft);
            this.loadLeft(transform, gloader, hashNextBlockLeft);

            return true;
        }

        return false;
    }
    /**
     * Loads blocks to the left if necessary
     * @param transform the transform object that contain the x,y,k
     * transformations
     * @param gloader the svg container for the loader
     * @param blockHash the hash of the next block to load to the left
     *
     */
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
            if (
                this.rightNeighbor !== undefined &&
                this.rightNeighbor.left < this.right
            ) {
                // The neighbor has not already loaded the blocks
                return false;
            }
            let hashNextBlockRight: any;
            try {
                hashNextBlockRight = Utils.getRightBlockHash(lastBlockRight);
            } catch {
                // If no forward links exist, it is the last block of the chain
                this.flash.display(Flash.flashType.INFO, "End of blockchain");
            }

            this.loadRight(transform, gloader, hashNextBlockRight);
            return true;
        }

        return false;
    }

    /**
     * Loads blocks to the right if necessary
     * @param transform the transform object that contain the x,y,k
     * transformations
     * @param gloader the svg container for the loader
     * @param blockHash the hash of the next block to load to the left
     *
     */
    loadRight(transform: any, gloader: any, blockHash: string) {
        // In case we are reaching the end of the chain, we should not
        // load more blocks than available.
        let numblocks = Chain.pageSize;
        if (this.right + Chain.pageSize >= this.lastAddedBlock.index) {
            numblocks = this.lastAddedBlock.index - this.rightBlock.index + 1;
        }

        this.right += numblocks;

        this.addLoader(
            false,
            gloader,
            (this.rightBlock.index + 1) * Chain.unitBlockAndPaddingWidth +
                Chain.blockPadding +
                Chain.blockWidth / 2,
            transform.k
        );

        setTimeout(() => {
            this.getNextBlocks(
                blockHash,
                numblocks == 0 ? 1 : numblocks,
                this.nbPages,
                this.subjectBrowse,
                false
            );
        }, 800);
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
                        // Reaching the end of the chain
                        if (ws != undefined) {
                            this.ws = ws;
                            // Continue to load blocks
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
     * Append the given blocks to the blockchain.
     * @param listBlocks list of blocks to append
     * @param backwards  false for loading blocks to the right, true for loading
     *                   blocks to the left
     * @param gblocks the group that hold the blocks
     * @param garrow the group that hold the arrows
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
                    (numblocks + i) * Chain.unitBlockAndPaddingWidth;
            }

            // Append the block inside the svg container
            this.appendBlock(xTranslateBlock, block, gblocks);
            // Append arrows between blocks
            this.getToAndFromIndexes(xTranslateBlock, block, garrow);

            // this.appendCircleInBlock(
            //     xTranslateBlock,
            //     d3.selectAll(".gcircle"),
            //     block
            // );
        }

        // Notify the subject that new blocks have been added
        this.newBlocksSubject.next(listBlocks);
    }

    /**
     * Helper function: sets up the fist request to load blocks on the chain.
     * @param left the left-most block index of the chunk
     * @private
     */
    private loadInitial(left: number) {
        // Fetch the initial block
        Utils.getBlockByIndex(this.initialBlock.hash, left, this.roster)
            .then((block: SkipBlock) => {
                this.leftBlock = block;
                this.rightBlock = block;
                if (left != 0) {
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
            })
            .catch((e) =>
                this.flash.display(
                    Flash.flashType.ERROR,
                    `Unable to load initial blocks: ${e}`
                )
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
                Chain.totalLoaded += skipBlocks.length;
                this.loadedInfo.innerText = `${Chain.totalLoaded}`;
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
                    if (skipBlocks[0] == undefined) {
                        // No more skipblocks can be requested from the client
                        this.isLoadingRight = false;
                    } else {
                        if (this.rightBlock.index != skipBlocks[0].index) {
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
                }
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
            .attr("x", xTranslate) // The blocks are appended following the transform of the chain
            .attr("y", 20) // Blocks are appended below the axis
            .attr("fill", Chain.getBlockColor(block))
            .on("click", () => {
                this.blockClickedSubject.next(block);
                window.location.hash = `index:${block.index}`;
            })
            .on("mouseover", function () {
                d3.select(this).style("cursor", "pointer");
            })
            .on("mouseout", function () {
                d3.select(this).style("cursor", "default");
            });
        console.log(
            d3.select("#" + Utils.bytes2String(block.hash)).attr("width")
        );
    }

    /**
     * Helper function to append arrows between two blocks
     * @param xTrans horizontal position where the block should be appended
     * @param skipBlockToIndex ending point of the arrow
     * @param skipBlockFrom starting point of the arrow
     * @param svgBlocks the svg where the block are appended
     * @param height the y coordinate where the arrow is appended on the blocks
     * @author Sophia Artioli <sophia.artioli@epfl.ch>
     */
    private async appendArrows(
        xTrans: number,
        skipBlockToIndex: number,
        skipBlockFrom: SkipBlock,
        svgBlocks: any,
        height: number
    ) {
        if (height == 0) {
            // Consecutive blocks
            const line = svgBlocks.append("line");
            line.attr("x1", xTrans + Chain.blockWidth)
                .attr("y1", Chain.blockHeight / 2 + Chain.axisPadding)
                .attr("x2", xTrans + Chain.blockWidth + Chain.blockPadding)
                .attr("y2", Chain.blockHeight / 2 + Chain.axisPadding)
                .attr("stroke-width", 2)
                .attr("stroke", "#808080");
        } else {
            var tooltip = d3.select(".tooltip");
            // Blocks that are minimum two indexes away
            const line = svgBlocks.append("line");
            // Starting point of the arrow: Right edge of the block
            line.attr("x1", xTrans + Chain.blockWidth)
                .attr(
                    "x2",
                    xTrans -
                        (skipBlockFrom.index - skipBlockToIndex) *
                            (Chain.blockWidth + Chain.blockPadding) -
                        Chain.blockPadding +
                        2
                ) // Arrows are appended to each level of height
                .attr(
                    "y1",
                    Chain.axisPadding +
                        Chain.svgHeight / this.maxHeightBlock +
                        height * (Chain.svgHeight / this.maxHeightBlock)
                ) // Ending point of the arrow: left-edge of the block
                .attr(
                    "y2",
                    Chain.axisPadding +
                        Chain.svgHeight / this.maxHeightBlock +
                        height * (Chain.svgHeight / this.maxHeightBlock)
                )
                .attr(
                    "marker-end",
                    "url(#" +
                        skipBlockToIndex.toString() +
                        "-" +
                        height.toString() +
                        ")"
                )
                .attr("stroke-width", 2.8)
                .attr("stroke", "#A0A0A0");
            // Enables translation to the block the arrow is pointing to
            const self = this;
            var timeout: NodeJS.Timeout;
            line.on("click", function () {
                clearTimeout(timeout);
                timeout = setTimeout(async function () {
                    Utils.translateOnChain(
                        skipBlockToIndex,
                        self.initialBlock.index
                    );

                    let block = await Utils.getBlockByIndex(
                        self.initialBlock.hash,
                        skipBlockToIndex,
                        self.roster
                    );
                    self.blockClickedSubject.next(block);
                }, 300);
            }).on("dblclick", function () {
                clearTimeout(timeout);

                Utils.translateOnChain(
                    skipBlockFrom.index,
                    self.initialBlock.index
                );
                self.blockClickedSubject.next(skipBlockFrom);
            });

            // Arrow head
            const triangle = svgBlocks.append("svg:defs").append("svg:marker");
            triangle
                .attr(
                    "id",
                    skipBlockToIndex.toString() + "-" + height.toString()
                ) // Markers have to have different id's otherwise they will not change color on hover
                .attr("refX", 9.4)
                .attr("refY", 6.5)
                .attr("markerWidth", 17)
                .attr("markerHeight", 15)
                .attr("strokeWidth", 5)
                .attr("fill", "#A0A0A0")
                .attr("markerUnits", "userSpaceOnUse") // Makes width of stroke independant from path
                .attr("orient", "auto-start-reverse")
                .append("path")
                .attr("d", "M 0 0 L 19 7 L 0 14 z");

            // Arrows change color on hover
            triangle.on("mouseover", function () {
                d3.select(this).style("stroke", "var(--selected-colour");
                triangle.style("fill", "var(--selected-colour");
                d3.select(this).style("cursor", "pointer");
            });
            line.on("mouseover", function () {
                d3.select(this).style("stroke", "var(--selected-colour");
                triangle.style("fill", "var(--selected-colour");
                d3.select(this).style("cursor", "pointer");

                tooltip.transition().duration(200).style("opacity", 1);
                tooltip
                    .html(
                        `From block ${skipBlockFrom.index} to ${skipBlockToIndex}`
                    )
                    .style(
                        "left",
                        d3.event.x - parseInt(tooltip.style("width")) / 2 + "px"
                    )
                    .style("top", d3.event.y - 30 + "px");
            });

            triangle.on("mouseout", () => {
                line.style("stroke", "#A0A0A0");
                triangle.style("fill", "#A0A0A0");
                line.style("cursor", "default");
            });
            line.on("mouseout", () => {
                line.style("stroke", "#A0A0A0");
                triangle.style("fill", "#A0A0A0");
                line.style("cursor", "default");
                tooltip
                    .transition()
                    .duration(100)
                    .style("opacity", 0)
                    .style("pointer-events", "none");
            });
            line.on("mousemove", () => {
                tooltip
                    .html(
                        `From block ${skipBlockFrom.index} to ${skipBlockToIndex}`
                    )
                    .style(
                        "left",
                        d3.event.x - parseInt(tooltip.style("width")) / 2 + "px"
                    )
                    .style("top", d3.event.y - 30 + "px");
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
        let index = skipBlockTo.index;
        let mult = 1;
        for (let i = 0; i < skipBlockTo.height; i++) {
            if (index + mult <= this.lastAddedBlock.index) {
                // We do not draw arrows that point to non-existing blocks
                this.appendArrows(
                    xTranslate,
                    index + mult,
                    skipBlockTo,
                    svgBlocks,
                    i
                );
            } else if (
                index + mult <= this.lastAddedBlock.index &&
                skipBlockTo.forwardLinks.length < i
            ) {
                // If there are less forward links than the height of the block and they are not pointing to non-existent blocks, forward links are missing.
                this.flash.display(
                    Flash.flashType.WARNING,
                    `Missing forward link ${i} on block ${index}`
                );
            }
            mult *= skipBlockTo.baseHeight;
        }
    }

    /**
     * Helper for displayBlocks: appends a text element in a block.
     * @param xTranslate horizontal position where the text should be displayed
     * @param gcircle the svg container for the circles
     * @param block: skipBlock
     * @author Sophia Artioli <sophia.artioli@epfl.ch>
     */
    private appendCircleInBlock(
        xTranslate: number,
        gcircle: any,
        block: SkipBlock
    ) {
        const self = this;
        var txAccepted = Utils.getTransactionRatio(block)[0];
        var txRefused = Utils.getTransactionRatio(block)[1];
        var xAccepted = xTranslate + 15;
        var xRefused = xTranslate + Chain.blockWidth - 15;
        var tooltip = d3.select(".tooltip");
        gcircle
            .append("circle")
            .attr("cx", xAccepted)
            .attr("r", 4)
            .attr("stroke", "#b3ffb3")
            .attr("fill-opacity", 0)
            .attr("uk-tooltip", `${txAccepted} accepted transactions`)
            .on("mouseover", function () {
                d3.select(this).style("stroke", "#00cc00");
            })
            .on("mouseout", function () {
                d3.select(this).style("stroke", "#b3ffb3");
            });

        const blocky = blockies.create({
            seed: Utils.bytes2String(block.hash),
        });
        d3.select(".blockies")
            .append("svg:image")
            .attr("xlink:href", blocky.toDataURL())
            .attr("src", blocky.toDataURL())
            .attr("uk-tooltip", `hash:${Utils.bytes2String(block.hash)}`)
            .attr("x", xTranslate + 30)
            .attr("y", -4)
            .attr("width", 9)
            .attr("height", 9)
            .attr("opacity", 0.6)
            .attr("text", Utils.getTransactionRatio(block)[1])
            .attr("dx", 40)
            .on("click", function () {
                Utils.copyToClipBoard(
                    Utils.bytes2String(block.hash),
                    self.flash
                );
            })
            .on("mouseover", function () {
                d3.select(this).style("cursor", "pointer");
                tooltip.transition().duration(200).style("opacity", 1);
                tooltip
                    .html(`Block hash: ${Utils.bytes2String(block.hash)}`)
                    .style(
                        "left",
                        d3.event.x - parseInt(tooltip.style("width")) / 2 + "px"
                    )
                    .style("top", d3.event.y - 30 + "px");
            })
            .on("mouseout", function () {
                d3.select(this).style("cursor", "default");
                tooltip
                    .transition()
                    .duration(100)
                    .style("opacity", 0)
                    .style("pointer-events", "none");
            })
            .on("mousemove", () => {
                tooltip

                    .html(`Block hash: ${Utils.bytes2String(block.hash)}`)

                    .style(
                        "left",
                        d3.event.x - parseInt(tooltip.style("width")) / 2 + "px"
                    )
                    .style("top", d3.event.y - 30 + "px");
            });

        gcircle
            .append("circle")
            .attr("cx", xRefused)
            .attr("r", 4)
            .attr("stroke", "#EF5959")
            .attr("fill-opacity", 0)
            .attr("uk-tooltip", `${txRefused} rejected transactions`)
            .on("mouseover", function () {
                d3.select(this).style("stroke", "#d11515");
            })
            .on("mouseout", function () {
                d3.select(this).style("stroke", "#EF5959");
            });
    }
}
