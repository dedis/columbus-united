import { ByzCoinRPC } from '@dedis/cothority/byzcoin';
import { DataBody } from '@dedis/cothority/byzcoin/proto';
import { PaginateRequest, PaginateResponse } from '@dedis/cothority/byzcoin/proto/stream';
import { Roster, WebSocketAdapter, WebSocketConnection } from '@dedis/cothority/network';
import { SkipBlock } from '@dedis/cothority/skipchain';
import * as d3 from 'd3';
import { merge, Subject } from 'rxjs';
import { count, filter, repeat, takeWhile, throttleTime } from 'rxjs/operators';

import { Flash } from './flash';
import { Utils } from './utils';

export class Chain {
    // Go to https://color.adobe.com/create/color-wheel with this base color to
    // find the palet of colors.
    static readonly blockColor = { r: 23, v: 73, b: 179 }; // #D9BA82 //TODO Find nicer color palette

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

    readonly blockPadding = 10;
    readonly textMargin = 5;
    readonly blockHeight = 200;
    readonly blockWidth = 200;
    readonly svgWidth = window.innerWidth;
    readonly svgHeight = 200;
    readonly unitBlockAndPaddingWidth = this.blockPadding + this.blockWidth;

    // Recomended pageSize / nbPages: 80 / 50
    readonly pageSize = 20;
    readonly nbPages = 1; //FIXME Only works for 1 page. Overflow not verified if multiple pages...

    readonly textColor = "black";
    readonly loadedInfo = document.getElementById("loaded-blocks");
    totalLoaded = 0;

    // The roster defines the blockchain nodes
    roster: Roster;

    // The websocket used to talk to the blockchain. We keep it to re-use it
    // between the different calls instead of creating a new connection each time.
    ws: WebSocketAdapter;

    // This subject is notified each time a new page containing new blocks has
    // been loaded from the cothority client.
    subjectBrowse = new Subject<[number, SkipBlock[], boolean]>();

    // This subject is notified each time a block is clicked.
    blockClickedSubject = new Subject<SkipBlock>();

    // This subject is notified when a new series of block has been added to the
    // view.
    newblocksSubject = new Subject<SkipBlock[]>();

    // Flash is a utiliy class to display flash messages in the view.
    flash: Flash;

    // initialBlockIndex is the initial block index, which is used to compute the
    // number of blocks loaded to the left and to the right.
    initialBlockIndex: number;

    constructor(roster: Roster, flash: Flash, initialBlock: SkipBlock) {
        const self = this;

        // Blockchain properties
        this.roster = roster;

        // Blocks observation
        this.flash = flash;

        this.initialBlockIndex = initialBlock.index;

        let lastBlockLeft = initialBlock;
        let lastBlockRight = initialBlock;
        let transformCounter = 0;

        // to keep track of current requested operations. If we are already loading
        // blocks on the left, then we shouldn't make another same request. Note
        // that this is a very poor exclusion mechanism.
        let isLoadingLeft = false;
        let isLoadingRight = false;

        // Main SVG caneva that contains the chain
        const svg = d3
            .select("#svg-container")
            .attr("height", this.blockHeight);

        // this group will contain the blocks
        const gblocks = svg.append("g").attr("class", "gblocks");

        // this group will contain the text. We need two separate groups because the
        // transform on the text group should not change the scale to keep the text
        // readable
        const gtext = svg.append("g").attr("class", "gtext");

        // this group will contain the left and right loaders that display a spinner
        // when new blocks are being added
        const gloader = svg.append("g").attr("class", "gloader");

        // this subject will be notified when the main SVG caneva in moved by the
        // user
        const subject = new Subject();

        //ASSIGNMENT 3 : Observable notified each time any subject is notified
        const notifications = merge(
            subject,
            this.newblocksSubject,
            this.blockClickedSubject,
            this.subjectBrowse
        );
        notifications.subscribe((x) => console.log("Subject updated"));

        // the number of block the window can display at normal scale. Used to
        // define the domain the xScale
        const numblocks = this.svgWidth / (this.blockWidth + this.blockPadding);

        let lastTransform = { x: 0, y: 0, k: 1 };
        // the xScale displays the block index and allows the user to quickly see
        // where he is in the chain
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

        // Update the subject when the view is dragged and zoomed in-out
        const zoom = d3
            .zoom()
            .extent([
                [0, 0],
                [this.svgWidth, this.svgHeight],
            ])
            .scaleExtent([0.0001, 4])
            .on("zoom", () => {
                subject.next(d3.event.transform);
            });
        svg.call(zoom);

        ///ASSIGNEMNT 3 : counting number of transforms during loading

        const transformWhileLoading = subject.pipe(
            takeWhile((x) => isLoadingLeft || isLoadingRight),
            count(),
            repeat(),
            filter((x) => x != 0)
        );
        transformWhileLoading.subscribe((x) =>
            console.log("Times updated while loading " + x)
        );

        // Handler to update the view (drag the view, zoom in-out). We subscribe to
        // the subject, which will notify us each time the view is dragged and
        // zommed in-out by the user.

        subject.subscribe({
            next: (transform: any) => {
                lastTransform = transform;
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
                //ASSIGNMENT 1
                const transformString =
                    "translate(" +
                    transform.x +
                    "," +
                    "0) scale(" +
                    transform.k +
                    "," +
                    transform.k +
                    ")";
                gblocks.attr("transform", transformString);

                // Standard transformation on the text since we need to keep the
                // original scale
                gtext.attr("transform", transform);
                // Update the text size
                if (transform.k < 1) {
                    gtext
                        .selectAll("text")
                        .attr("font-size", 1 + transform.k + "em");
                }

                // Update the loader. We want to keep them at their original
                // scale so we only translate them
                gloader.attr("transform", transform);
                // resize the loaders to always have a relative scale of 1
                gloader
                    .selectAll("svg")
                    .attr("transform", `scale(${1 / transform.k})`);

                //ASSIGNMENT 3 : counting number of transform while loading (), witness testing
                //TODO : Determine wether this version or the other one is the correct one
                if (isLoadingLeft || isLoadingRight) {
                    transformCounter++;
                } else {
                    if (transformCounter != 0) {
                        console.log(
                            "Number of transform during update : " +
                                transformCounter
                        );
                    }
                    transformCounter = 0;
                }
            },
        });

        // Handler to check if new blocks need to be loaded. We check every 300ms.
        //TODO Lower timer
        //REVIEW Seems really cumbersome...
        subject.pipe(throttleTime(200)).subscribe({
            next: (transform: any) => {
                if (!isLoadingLeft) {
                    isLoadingLeft = true;
                    const isLoading = this.checkAndLoadLeft(
                        transform,
                        lastBlockLeft,
                        gloader
                    );
                    if (!isLoading) {
                        isLoadingLeft = false;
                    }
                }

                if (!isLoadingRight) {
                    isLoadingRight = true;
                    const isLoading = this.checkAndLoadRight(
                        transform,
                        lastBlockRight,
                        gloader
                    );
                    if (!isLoading) {
                        isLoadingRight = false;
                    }
                }
            },
        });

        // Subscriber to the blockchain server
        this.subjectBrowse.subscribe({
            complete: () => {
                this.flash.display(
                    Flash.flashType.INFO,
                    "End of the blockchain"
                );
            },
            error: (err: any) => {
                if (err === 1) {
                    // To reset the websocket, create a new handler for the next function
                    // (of getnextblock)
                    this.ws = undefined; //REVIEW Is it still WIP ?
                } else {
                    this.flash.display(Flash.flashType.ERROR, `Error: ${err}`);
                }
                isLoadingLeft = false;
                isLoadingRight = false;
            },
            next: ([i, skipBlocks, backward]) => {
                //REVIEW where is all this coming from
                // i is the page number
                let isLastPage = false;
                // tslint:disable-next-line
                if (i == this.nbPages - 1) {
                    //FIXME Something ain't right here... nb page is init at 1...
                    isLastPage = true;
                }

                this.totalLoaded += skipBlocks.length;
                this.loadedInfo.innerText = `${this.totalLoaded}`;

                // If this is the first series of blocks, set the hash of the left first block
                //FIXME Cumbersome init...
                const firstBlock = skipBlocks[0];
                if (firstBlock.index === this.initialBlockIndex) {
                    lastBlockLeft = firstBlock;
                }

                const lastBlock = skipBlocks[skipBlocks.length - 1];

                if (backward) {
                    // Load blocks to the left
                    this.displayBlocks(
                        skipBlocks,
                        true,
                        gblocks,
                        gtext,
                        lastBlockLeft.index - this.initialBlockIndex
                    );

                    lastBlockLeft = lastBlock;

                    if (isLastPage) {
                        d3.selectAll(".left-loader").remove();
                        const loadMore = this.checkAndLoadLeft(
                            lastTransform,
                            lastBlockLeft,
                            gloader
                        );
                        if (!loadMore) {
                            isLoadingLeft = false;
                        }
                    }
                } else {
                    // Load blocks to the right

                    // in the case we haven't loaded any blocks yet we can't use the
                    // formula "lastBlockRight.index - this.initialBlockIndex + 1" since
                    // it would equal to one, but the result should be 0.
                    let nb: number;
                    if (lastBlockRight.index === this.initialBlockIndex) {
                        nb = 0;
                    } else {
                        nb = lastBlockRight.index - this.initialBlockIndex + 1;
                    }

                    this.displayBlocks(skipBlocks, false, gblocks, gtext, nb);

                    lastBlockRight = lastBlock;

                    // tslint:disable-next-line
                    if (isLastPage) {
                        d3.selectAll(".right-loader").remove();
                        const loadMore = this.checkAndLoadRight(
                            lastTransform,
                            lastBlockRight,
                            gloader
                        );
                        if (!loadMore) {
                            isLoadingRight = false;
                        }
                    }
                }
            },
        });
    }

    /**
     * Load the initial blocks.
     */
    loadInitialBlocks(initialBlockHash: Buffer) {
        this.getNextBlocks(
            Utils.bytes2String(initialBlockHash),
            this.pageSize,
            this.nbPages,
            this.subjectBrowse,
            false
        );
    }

    /**
     * Check if new blocks need to be loaded to the left and load them if
     * necessary.
     * @param transform the transform object that contain the x,y,k
     * transformations
     * @param lastBlockLeft the last block loaded to the left
     * @param gloader the svg container that should welcome the loader
     * @returns a boolean that tells if a request to load new blocks has been sent
     */
    checkAndLoadLeft(
        transform: any,
        lastBlockLeft: SkipBlock,
        gloader: any
    ): boolean {
        const self = this;

        // x represents the x-axis translation of the caneva. If the block width
        // is 100 and x = -100, then it means the user dragged one block from
        // the initial block on the left.
        const x = -transform.x;
        const zoomLevel = transform.k;

        const nbBlocksLoadedLeft = this.initialBlockIndex - lastBlockLeft.index;

        const leftBlockX =
            nbBlocksLoadedLeft *
            (this.blockWidth + this.blockPadding) *
            -1 *
            zoomLevel;

        // Check if we need to load blocks on the left. We check that we haven't
        // yet loaded all the possible blocks from the left and that the user
        // has moved enought to the left. The -50 is to give a small margin
        // because we want to let the user drag a bit before we trigger the
        // load.
        if (
            this.initialBlockIndex - nbBlocksLoadedLeft > 0 &&
            x < leftBlockX - 50
        ) {
            let nbBlocksToLoad = self.pageSize;
            // In the case there are less remaining blocks than the page size we
            // load all the remaining blocks. If we are currently at block 3 and
            // the page size is 10, we must then load only 3 blocks: [0, 1, 2]
            nbBlocksToLoad = Math.min(
                nbBlocksToLoad,
                this.initialBlockIndex - nbBlocksLoadedLeft
            );

            this.addLoader(
                true,
                gloader,
                -(nbBlocksLoadedLeft + 1) * this.unitBlockAndPaddingWidth +
                    this.blockPadding +
                    this.blockWidth / 2,
                transform.k
            );

            const hashNextBlockLeft = Utils.getLeftBlockHash(lastBlockLeft);

            setTimeout(() => {
                self.getNextBlocks(
                    hashNextBlockLeft,
                    nbBlocksToLoad,
                    self.nbPages,
                    self.subjectBrowse,
                    true
                );
            }, 250); //FIXME reduce me

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
     * @returns a boolean that tells if a request to load new blocks has been sent
     */
    checkAndLoadRight(
        transform: any,
        lastBlockRight: SkipBlock,
        gloader: any
    ): boolean {
        const self = this;

        // x represents to x-axis translation of the caneva. If the block width
        // is 100 and x = -100, then it means the user dragged one block from
        // the initial block on the left.
        const x = -transform.x;
        const zoomLevel = transform.k;

        const nbBlocksLoadedRight =
            lastBlockRight.index - this.initialBlockIndex + 1;

        const rightBlockX =
            nbBlocksLoadedRight *
            (this.blockWidth + this.blockPadding) *
            zoomLevel;

        // Check if we need to load blocks on the right. (x + this.svgWidth)
        // represents the actual rightmost x coordinate on the svg caneva. +50
        // is to allow a margin before loading a new block, because we want to
        // allow a bit of blank space before triggering the load.
        if (x + this.svgWidth > rightBlockX + 50) {
            const hashNextBlockRight = Utils.getRightBlockHash(lastBlockRight);

            this.addLoader(
                false,
                gloader,
                nbBlocksLoadedRight * this.unitBlockAndPaddingWidth +
                    this.blockPadding +
                    this.blockWidth / 2,
                transform.k
            );
            setTimeout(() => {
                self.getNextBlocks(
                    hashNextBlockRight,
                    self.pageSize,
                    self.nbPages,
                    self.subjectBrowse,
                    false
                );
            }, 250); //FIXME Reduce loading time

            return true;
        }

        return false;
    }

    /**
     * Returns an observable to observe the blocks.
     * Example use:
     * ```getBlockClickedSubject().subscribe({
     *   next: (skipBlock) => {
     *     // do things
     *   }
     * })```
     */
    getBlockClickedSubject(): Subject<SkipBlock> {
        return this.blockClickedSubject;
    }

    getNewblocksSubject(): Subject<SkipBlock[]> {
        return this.newblocksSubject;
    }

    /**
     * Create a loader.
     * @param backwards true for a left loader, false for a right loader
     * @param zoomLevel zoom of the blocks (needed to compute the position of
     *                  the loader)
     */
    private addLoader(
        backwards: boolean,
        gloader: any,
        xPos: number,
        k: number
    ) {
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
            .attr("y", this.blockHeight / 2 - 30)
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
     * Append the given blocks to the blockchain.
     * @param listBlocks list of blocks to append
     * @param backwards  false for loading blocks to the right, true for loading
     *                   blocks to the left
     * @param numblocks the number of blocks loaded from the initial block. In the
     * case of a backward loading, this number should be negative. -10 means we
     * already loaded 10 blocks on the left from the initial block.
     */
    private displayBlocks(
        listBlocks: SkipBlock[],
        backwards: boolean,
        gblocks: any,
        gtext: any,
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

            const xTranslateText = xTranslateBlock + this.textMargin;

            // Append the block inside the svg container
            this.appendBlock(xTranslateBlock, block, gblocks);

            // Displaying text has a lot of impact on performances. We need to
            // think either how to optimze it or drop the display of text on
            // each block. For now we drop it.

            // // Box the text index in an object to pass it by reference
            // const textIndex = { index: 0 };

            // // Index
            // this.appendTextInBlock(
            //     xTranslateText,
            //     textIndex,
            //     "index: " + block.index,
            //     this.textColor,
            //     gtext
            // );

            // // Hash
            // const hash = Utils.bytes2String(block.hash);
            // this.appendTextInBlock(
            //     xTranslateText,
            //     textIndex,
            //     "hash: " + hash.slice(0, 8) + "...",
            //     this.textColor,
            //     gtext
            // );

            // // Number of transactions
            // const body = DataBody.decode(block.payload);
            // const nbTransactions = body.txResults.length;
            // this.appendTextInBlock(
            //     xTranslateText,
            //     textIndex,
            //     "#transactions: " + nbTransactions,
            //     this.textColor,
            //     gtext
            // );

            // const header = DataHeader.decode(block.data);
            // // console.log(">>>>>>>> timestamp:", header.timestamp.toNumber());
            // this.appendTextInBlock(
            //     xTranslateText,
            //     textIndex,
            //     "T: " + header.timestamp.toString(),
            //     this.textColor,
            //     gtext
            // );
        }
        this.newblocksSubject.next(listBlocks);
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
            .attr("id", block.hash.toString("hex"))
            .attr("width", this.blockWidth)
            .attr("height", this.blockHeight)
            .attr("x", xTranslate)
            .attr("y", 20)
            .attr("fill", Chain.getBlockColor(block))
            .on("click", () => {
                this.blockClickedSubject.next(block);
            });
    }

    /**
     * Helper for displayBlocks: appends a text element in a block.
     * @param xTranslate horizontal position where the text should be displayed
     * @param textIndex index of the text in the block
     * @param text text to display
     * @param textColor color of the text
     */
    private appendTextInBlock(
        xTranslate: number,
        textIndex: { index: number },
        text: string,
        textColor: string,
        gtext: any
    ) {
        gtext
            .append("text")
            .attr("x", xTranslate)
            .attr("y", (textIndex.index + 1) * 30)
            .text(text)
            .attr("font-family", "sans-serif")
            .attr("font-size", "18px")
            .attr("fill", textColor);
        ++textIndex.index;
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
    private getNextBlocks(
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
                },
                error: (err: Error) => {
                    this.flash.display(Flash.flashType.ERROR, `error: ${err}`);
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
