// A chunk is an autonomous part of the chain that will update itself when the
// user drags to one of its edge. It will checks its neighbor and try not to
// load blocks that would overlap.
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

export class Chunk {
    readonly maxHeightBlock = 8;

    pageSize =50;

    static firtPass= true;
    roster: Roster;
    flash: Flash;
    leftNeighbor: Chunk;
    rightNeighbor: Chunk;
    initialBlock: SkipBlock;

    leftBlock: SkipBlock;
    rightBlock: SkipBlock;

    gblocks: any;
    garrow: any;

    // Those are the perimeter, set before blocks are loaded
    left: number;
    right: number;

    nbPages = 1;

    isLoadingLeft = true; // the first load will then set them to false
    isLoadingRight = true;

    // this subject is called when new blocks are loaded
    subjectBrowse = new Subject<[number, SkipBlock[], boolean]>();
    newBlocksSubject: Subject<SkipBlock[]>;
    blockClickedSubject: Subject<SkipBlock>;

    loadedFirst = false;

    // This subject is called when the user zoom/drag the chain
    chainSubject: Subject<any>;

    lastTransform = { x: 0, y: 0, k: 1 };

    id: number; // for debug purpose, to identity chunks

    // container that contains the left and right loaders
    gloader: d3.Selection<SVGElement, {}, HTMLElement, any>;

    totalLoaded: number;
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
        garrow:any
    ) {
        this.totalLoaded = 0;
        this.chainSubject = chainSubject;
        this.leftNeighbor = leftNei;
        this.rightNeighbor = rightNei;
        this.id = left;
        this.lastTransform = transform;
        this.newBlocksSubject = newBlocksSubject;
        this.blockClickedSubject = blockClickedSubject;
        this.ws = ws;
        this.initialBlock = initialBlock;
        this.garrow = garrow;
        this.gblocks = gblocks;

        this.roster = roster;
        this.flash = flash;

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
                    console.log("RIGH"+ this.rightBlock.index);
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
            Chain.blockWidth + Chain.blockPadding,
            Chain.svgWidth
        );
        console.log(bounds);

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
            let hashNextBlockRight:any ;
            try{
            hashNextBlockRight = Utils.getRightBlockHash(lastBlockRight);
            }catch{
                this.flash.display(Flash.flashType.WARNING,"End of blockchain");
            }

            this.loadRight(transform, gloader, hashNextBlockRight);

            return true;
        }

        return false;
    }

    loadLeft(transform: any, gloader: any, blockHash: any) {
        // In case we are reaching the beginning of the chain, we should not
        // load more blocks than available.
        let numblocks = this.pageSize;
        if (this.left - this.pageSize <= 0) {
            numblocks = this.left;
        }

        this.left -= numblocks;

        this.addLoader(
            true,
            gloader,

            this.leftBlock.index * Chain.unitBlockAndPaddingWidth +
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
        this.right += this.pageSize;

        this.addLoader(
            false,
            gloader,
            this.rightBlock.index * Chain.unitBlockAndPaddingWidth +
                Chain.blockPadding +
                Chain.blockWidth / 2,
            transform.k
        );
        console.log(Chunk.firtPass);
            if(Chunk.firtPass){

        setTimeout(() => {
            this.getNextBlocks(
                blockHash,
                1, // Since we are very close to the end, we send smaller paginate requests
                this.nbPages,
                this.subjectBrowse,
                false
            );
        }, 800);
     
    }else {
        setTimeout(() => {
            this.getNextBlocks(
                blockHash,
                this.pageSize, // Since we are very close to the end, we send smaller paginate requests
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
        // tslint:disable-next-line
        for (let i = 0; i < listBlocks.length; ++i) {
            const block = listBlocks[i];

            let xTranslateBlock: number;
            if (backwards) {
                xTranslateBlock =
                    (numblocks - 1 - i) * Chain.unitBlockAndPaddingWidth;
            } else {
                xTranslateBlock =
                    (numblocks + i) * Chain.unitBlockAndPaddingWidth;
            }

            // Append the block inside the svg container
            this.appendBlock(xTranslateBlock, block, gblocks);
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
                    this.ws = undefined;
                },
                error: (err: Error) => {
                    this.flash.display(Flash.flashType.ERROR, `error: ${err}`);
                    this.ws = undefined;
                },
                next: ([data, ws]) => {
                    if (data.errorcode != 0) {
                        console.log(data.errorcode)
                        if(data.errorcode == 5 || data.errorcode == 4){
                        
                            return 0;
                         }else {
                        
                        this.flash.display(
                            Flash.flashType.ERROR,
                            `got an error with code ${data.errorcode} : ${data.errortext}`
                        );
                        return 1;
                        }
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

    private loadInitial(left: number) {

        Utils.getBlockByIndex(this.initialBlock.hash, left, this.roster).then(
            (block: SkipBlock) => {
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
            }
        );
    }

    private setSubjectBrowse() {
        this.subjectBrowse.subscribe({
            complete: () => {
                this.flash.display(
                    Flash.flashType.INFO,
                    "End of the blockchain"
                );
            },
            error: (err: any) => {
                if (err === 1) {
                    // To reset the websocket, create a new handler for the next
                    // function (of getNextBlock)
                    this.ws = undefined;
                } else {
                    this.flash.display(Flash.flashType.ERROR, `Error: ${err}`);
                }
                this.isLoadingLeft = false;
                this.isLoadingRight = false;
            },
            next: ([i, skipBlocks, backward]) => {
                // i is the page number
                this.totalLoaded += skipBlocks.length;
                this.loadedInfo.innerText = `${this.totalLoaded}`;
                let isLastPage = false;
                // tslint:disable-next-line
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
                    this.displayBlocks(
                        skipBlocks,
                        false,
                        this.gblocks,
                        this.garrow,
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
     * Helper for displayBlocks: appends a block to the blockchain and adds it to
     * the subscriber list.
     * @param xTranslate horizontal position where the block should be appended
     * @param block the block to append
     */
    private appendBlock(xTranslate: number, block: SkipBlock, svgBlocks: any) {
        svgBlocks
            .append("rect")
            .attr("id", Utils.bytes2String(block.hash))
            .attr("width", Chain.blockWidth)
            .attr(
                "height",
                block.height * (Chain.svgHeight / this.maxHeightBlock)
            )
            .attr("x", xTranslate)
            .attr("y", 20)
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
            const line = svgBlocks.append("line");
            line
                .attr("x1", xTrans)
                .attr("y1", Chain.blockHeight / 2 + Chain.axisPadding)
                .attr("x2", xTrans - Chain.blockPadding)
                .attr("y2", Chain.blockHeight / 2 + Chain.axisPadding)
                .attr("stroke-width", 2)
                .attr("stroke", "#808080");
        } else {
            const line = svgBlocks.append("line");
            line.attr(
                "x1",
                xTrans -
                    (skipBlockTo.index - skipBlockFrom.index) *
                        (Chain.blockWidth + Chain.blockPadding) +
                    Chain.blockWidth
            )
                .attr(
                    "y1",
                    Chain.axisPadding +
                        Chain.svgHeight / this.maxHeightBlock +
                        height * (Chain.svgHeight / this.maxHeightBlock)
                )

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
                .on("click", () => {
                    Utils.translateOnChain(
                        skipBlockTo,
                        this.initialBlock,
                        this.blockClickedSubject
                    );
                });

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
                   Utils.translateOnChain(skipBlockTo,this.initialBlock,this.blockClickedSubject);
                    this.blockClickedSubject.next(skipBlockTo);
                });
                
            // FIXME can't change the colour of the svg markers like this. Only option I see
            // is to create anover triangle and witch when needed
                triangle.on("mouseover",
                    function () {
                        d3.select(this).style("stroke", "var(--selected-colour");
                        triangle.attr("stroke", "var(--selected-colour");
                   
                });
                line.on("mouseover",
                    function () {
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
        for (let i = 0; i < skipBlockTo.backlinks.length; i++) {
            Utils.getBlock(
                skipBlockTo.backlinks[i],
                this.roster
            ).then((skipBlockFrom)=>{
                this.appendArrows(
                    xTranslate,
                    skipBlockFrom,
                    skipBlockTo,
                    svgBlocks,
                    i
            );})

        }
    }

    /**
     * Helper for displayBlocks: appends a text element in a block.
     * @param xTranslate horizontal position where the text should be displayed
     * @param textIndex index of the text in the block
     * @param text text to display
     * @param textColor color of the text
     * @author Sophia Artioli <sophia.artioli@epfl.ch>
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
            .attr("cx", xTranslate + Chain.blockWidth - 35)
            .attr("cy", 40)
            .attr("r", 6)
            .attr("fill", "#EF5959");
    }
}