// A chunk is an autonomous part of the chain that will update itself when the
// user drags to one of its edge. It will checks its neighbor and try not to
// load blocks that would overlap.

import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import {
    PaginateRequest,
    PaginateResponse,
} from "@dedis/cothority/byzcoin/proto/stream";
import {
    WebSocketAdapter,
    WebSocketConnection,
} from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Numeric } from "d3";
import { Subject } from "rxjs";
import { debounceTime, throttleTime } from "rxjs/operators";
import { Chain } from "./chain";
import { Flash } from "./flash";
import { Utils } from "./utils";

export class Chunk {
    leftNeighbor: Chunk;
    rightNeighbor: Chunk;

    leftBlock: SkipBlock;
    rightBlock: SkipBlock;

    // Those are the perimeter, set before blocks are loaded
    left: number;
    right: number;

    nbPages = 1;

    isLoadingLeft = true; // the first load will then set them to false
    isLoadingRight = true;

    chain: Chain; // this is bad, we should remove this dep

    // this subject is called when new blocks are loaded
    subjectBrowse = new Subject<[number, SkipBlock[], boolean]>();

    loadedFirst = false;

    // This subject is called when the user zoom/drag the chain
    chainSubject: Subject<any>;

    lastTransform = { x: 0, y: 0, k: 1 };

    id: number; // for debug purpose, to identity chunks

    // container that contains the left and right loaders
    gloader: d3.Selection<SVGElement, {}, HTMLElement, any>;

    // The websocket used to talk to the blockchain. We keep it to re-use it
    // between the different calls instead of creating a new connection each
    // time. Each chunk creates a ws connections because we need to have
    // different callbacks for each of them.
    ws: WebSocketAdapter;

    constructor(
        chainSubject: Subject<any>,
        leftNei: Chunk,
        rightNei: Chunk,
        left: number,
        right: number,
        chain: Chain,
        transform: any
    ) {
        this.chainSubject = chainSubject;
        this.leftNeighbor = leftNei;
        this.rightNeighbor = rightNei;
        this.chain = chain;
        this.id = left;
        this.lastTransform = transform;

        this.left = left;
        this.right = right;

        this.chainSubject.subscribe((transform: any) => {
            this.lastTransform = transform;
        });

        const svg = d3.select("#svg-container");

        // this group will contain the left and right loaders that display a
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

        this.loadInitial(left, transform);
    }

    private loadInitial(left: number, transform: any) {
        Utils.getBlockByIndex(
            this.chain.initialBlock.hash,
            left,
            this.chain.roster
        ).then((block: SkipBlock) => {
            this.leftBlock = block;
            this.rightBlock = block;

            if (left != 0) {
                this.loadLeft(
                    this.lastTransform,
                    this.gloader,
                    Utils.getLeftBlockHash(block)
                );
            } else {
                this.isLoadingLeft = false;
            }

            this.loadRight(
                this.lastTransform,
                this.gloader,
                Utils.bytes2String(block.hash)
            );
        });
    }

    private setSubjectBrowse() {
        this.subjectBrowse.subscribe({
            complete: () => {
                this.chain.flash.display(
                    Flash.flashType.INFO,
                    "End of the blockchain"
                );
            },
            error: (err: any) => {
                if (err === 1) {
                    // To reset the websocket, create a new handler for the next
                    // function (of getNextBlock)
                    this.chain.ws = undefined;
                } else {
                    this.chain.flash.display(
                        Flash.flashType.ERROR,
                        `Error: ${err}`
                    );
                }
                this.isLoadingLeft = false;
                this.isLoadingRight = false;
            },
            next: ([i, skipBlocks, backward]) => {
                // i is the page number
                let isLastPage = false;
                // tslint:disable-next-line
                if (i == this.nbPages - 1) {
                    isLastPage = true;
                }

                if (backward) {
                    // Load blocks to the left
                    this.chain.displayBlocks(
                        skipBlocks,
                        true,
                        this.chain.gblocks,
                        this.chain.garrow,
                        this.chain.gcircle,
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

                    this.chain.displayBlocks(
                        skipBlocks,
                        false,
                        this.chain.gblocks,
                        this.chain.garrow,
                        this.chain.gcircle,
                        this.rightBlock.index
                    );

                    this.rightBlock = skipBlocks[skipBlocks.length - 1];

                    // tslint:disable-next-line
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
            this.chain.blockWidth + this.chain.blockPadding,
            this.chain.svgWidth
        );

        console.log(this.id, "check and load left, bounds", bounds, "this.leftblock index", this.leftBlock.index)

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
     * @param lastBlockLeft the last block loaded to the right
     * @param gloader the svg container that should welcome the loader
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
            this.chain.blockWidth + this.chain.blockPadding,
            this.chain.svgWidth
        );

        console.log(this.id, "check and load right, bounds", bounds, "this.rightblock index", this.rightBlock.index)

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

            const hashNextBlockRight = Utils.getRightBlockHash(lastBlockRight);

            this.loadRight(transform, gloader, hashNextBlockRight);

            return true;
        }

        return false;
    }

    loadLeft(transform: any, gloader: any, blockHash: any) {
        // In case we are reaching the beginning of the chain, we should not
        // load more blocks than available.
        let numblocks = this.chain.pageSize;
        if (this.left - this.chain.pageSize <= 0) {
            numblocks = this.left;
        }

        this.left -= numblocks;

        this.addLoader(
            true,
            gloader,

            this.leftBlock.index * this.chain.unitBlockAndPaddingWidth +
                this.chain.blockPadding +
                this.chain.blockWidth / 2,
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
        this.right += this.chain.pageSize;

        this.addLoader(
            false,
            gloader,
            this.rightBlock.index * this.chain.unitBlockAndPaddingWidth +
                this.chain.blockPadding +
                this.chain.blockWidth / 2,
            transform.k
        );

        setTimeout(() => {
            this.getNextBlocks(
                blockHash,
                this.chain.pageSize,
                this.nbPages,
                this.subjectBrowse,
                false
            );
        }, 800);
    }

    /**
     * Create a loader.
     * @param backwards true for a left loader, false for a right loader
     * @param zoomLevel zoom of the blocks (needed to compute the position of
     *                  the loader)
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
            .attr("y", this.chain.blockHeight / 2 - 30)
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
            this.chain.flash.display(
                Flash.flashType.ERROR,
                `failed to parse the block ID: ${error}`
            );
            return;
        }

        let conn: WebSocketConnection;
        try {
            conn = new WebSocketConnection(
                this.chain.roster.list[0].getWebSocketAddress(),
                ByzCoinRPC.serviceName
            );
        } catch (error) {
            this.chain.flash.display(
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
                    this.chain.flash.display(Flash.flashType.ERROR, "closed");
                    this.ws = undefined;
                },
                error: (err: Error) => {
                    this.chain.flash.display(
                        Flash.flashType.ERROR,
                        `error: ${err}`
                    );
                    this.ws = undefined;
                },
                next: ([data, ws]) => {
                    // tslint:disable-next-line
                    if (data.errorcode != 0) {
                        this.chain.flash.display(
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
