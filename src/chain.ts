import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import { DataBody, DataHeader } from "@dedis/cothority/byzcoin/proto";
import {
    PaginateRequest,
    PaginateResponse,
} from "@dedis/cothority/byzcoin/proto/stream";
import { Roster, WebSocketAdapter } from "@dedis/cothority/network";
import { WebSocketConnection } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";

import * as d3 from "d3";
import { merge, Subject } from "rxjs";

import {
    buffer,
    last,
    map,
    takeLast,
    throttleTime,
    count,
    tap,
    mapTo,
    flatMap,
    skip,
} from "rxjs/operators";
import { SkipchainRPC } from "@dedis/cothority/skipchain";
import * as blockies from "blockies-ts";

import { Flash } from "./flash";
import { TotalBlock } from "./totalBlock";
import { Utils } from "./utils";
import { group, timeHours } from "d3";
import { sayHi } from ".";

export class Chain {
    // Go to https://color.adobe.com/create/color-wheel with this base color to
    // find the palet of colors.
    static readonly blockColor = { r: 23, v: 73, b: 179 }; // #D9BA82

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
    readonly blockHeight = 50;
    readonly blockWidth = 100;

    readonly lastHeight = 176;

    readonly lastWidth = 200;
    readonly svgWidth = window.innerWidth; //1039;
    readonly svgHeight = 200;
    readonly unitBlockAndPaddingWidth = this.blockPadding + this.blockWidth;

    // Recomended pageSize / nbPages: 80 / 50
    readonly pageSize = 50;
    readonly nbPages = 1; // Only works for 1 page. Overflow not verified if multiple pages...

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

    lastSubject = new Subject();

    // Flash is a utiliy class to display flash messages in the view.
    flash: Flash;

    // initialBlockIndex is the initial block index, which is used to compute the
    // number of blocks loaded to the left and to the right.
    initialBlockIndex: number;

    initalBlock: SkipBlock;

    constructor(roster: Roster, flash: Flash, initialBlock: SkipBlock) {
        const self = this;

        // Blockchain properties
        this.roster = roster;

        // Blocks observation
        this.flash = flash;

        this.initalBlock = initialBlock;

        this.initialBlockIndex = initialBlock.index;

        let lastBlockLeft = initialBlock;
        let lastBlockRight = initialBlock;

        // to keep track of current requested operations. If we are already loading
        // blocks on the left, then we shouldn't make another same request. Note
        // that this is a very poor exclusion mechanism.
        let isLoadingLeft = false;
        let isLoadingRight = false;

        //Main SVG caneva that contains the last added block
        const last = d3
            .select("#last-container")
            .attr("height", this.svgHeight)
            .attr("z-index", -1);

        // Main SVG caneva that contains the chain
        const svg = d3.select("#svg-container").attr("height", this.svgHeight);

        // this group will contain the blocks
        const gblocks = svg.append("g").attr("class", "gblocks");

        const garrow = gblocks.append("g").attr("class", "garrow");

        // this group will contain the text. We need two separate groups because the
        // transform on the text group should not change the scale to keep the text
        // readable
        const gcircle = svg.append("g").attr("class", "gtext");

        // this group will contain the left and right loaders that display a spinner
        // when new blocks are being added
        const gloader = svg.append("g").attr("class", "gloader");

        // this subject will be notified when the main SVG caneva in moved by the
        // user
        const subject = new Subject();
        this.lastSubject = subject;

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
            .scaleExtent([0.0001, 1.4])
            .on("zoom", () => {
                subject.next(d3.event.transform);
            });
        svg.call(zoom);

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
                const transformString =
                    "translate(" +
                    transform.x +
                    "," +
                    "0) scale(" +
                    transform.k +
                    "," +
                    "1" +
                    ")";
                gblocks.attr("transform", transformString);
                // Standard transformation on the text since we need to keep the
                // original scale
                //  gblocks.selectAll("circle").attr("r",transform.k*5);

                gcircle.selectAll("circle").attr("transform", transformString);

                //  console.log("text"+ gtext.selectAll("circle").attr("height").toString());
                //gtext.attr("r", transform.k*100);
                // Update the text size
                // if (transform.k < 1) {
                //     gtext
                //         .selectAll("text")
                //         .attr("font-size", 1 + transform.k + "em");
                // }
                // Update the loader. We want to keep them at their original
                // scale so we only translate them
                gloader.attr("transform", transform);
                // resize the loaders to always have a relative scale of 1
                gloader
                    .selectAll("svg")
                    .attr("transform", `scale(${1 / transform.k})`);
            },
        });

        // Handler to check if new blocks need to be loaded. We check every 300ms.
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
                    this.ws = undefined;
                } else {
                    this.flash.display(Flash.flashType.ERROR, `Error: ${err}`);
                }
                isLoadingLeft = false;
                isLoadingRight = false;
            },
            next: ([i, skipBlocks, backward]) => {
                // i is the page number
                let isLastPage = false;
                // tslint:disable-next-line
                if (i == this.nbPages - 1) {
                    isLastPage = true;
                }

                this.totalLoaded += skipBlocks.length;
                this.loadedInfo.innerText = `${this.totalLoaded}`;

                // If this is the first series of blocks, set the hash of the left first block
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
                        garrow,
                        gcircle,
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

                    this.displayBlocks(
                        skipBlocks,
                        false,
                        gblocks,
                        garrow,
                        gcircle,
                        nb
                    );

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

        //Get last added block of the chain
        let lastBlock = new TotalBlock(this.roster, initialBlock);
        lastBlock
            .getTotalBlock()
            .pipe(
                map((s: SkipBlock) =>
                    this.displayLastAddedBlock(s, last, s.hash)
                )
            )
            .subscribe();

        // let sb = d3.select(".topnav").on("keyup").call(this.search())
    }

    // search() {
    //     console.log("dgknsfd");

    // }

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
     * Display the last added block of the chain
     * @param lastBlock the last added block of the blockchain
     * @param svgLast the svg container that should welcome the block
     * @param hashLast the hash of the last added block
     *
     */

    private displayLastAddedBlock(
        lastBlock: SkipBlock,
        svgLast: any,
        hashLast: Buffer
    ) {
        svgLast
            .append("rect")
            .attr("id", hashLast.toString("hex"))
            .attr("width", this.lastWidth)
            .attr("height", this.lastHeight)
            .attr("x", 20)
            .attr("y", 20)

            .style("filter", "url(#drop-shadow)")
            .attr("fill", Chain.getBlockColor(lastBlock))
            .on("click", () => {
                this.blockClickedSubject.next(lastBlock);
            });

        //shadow filter for last added blcok
        var defs = svgLast.append("defs");

        // create filter with id #drop-shadow
        // height=130% so that the shadow is not clipped
        var filter = defs
            .append("filter")
            .attr("id", "drop-shadow")
            .attr("height", "130%");

        // SourceAlpha refers to opacity of graphic that this filter will be applied to
        // convolve that with a Gaussian with standard deviation 3 and store result
        // in blur
        filter
            .append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 3)
            .attr("result", "blur");

        // translate output of Gaussian blur to the right and downwards with 2px
        // store result in offsetBlur
        filter
            .append("feOffset")
            .attr("in", "blur")
            .attr("dx", 2)
            .attr("dy", 2)
            .attr("result", "offsetBlur");

        // overlay original SourceGraphic over translated blurred opacity by using
        // feMerge filter. Order of specifying inputs is important!
        var feMerge = filter.append("feMerge");

        feMerge.append("feMergeNode").attr("in", "offsetBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        const gtextLast = svgLast.append("g").attr("class", "gtext");

        //add text on top of last added block
        gtextLast
            .append("text")
            .attr("x", 72)
            .attr("y", 14)
            .text("Last added")
            .attr("font-family", "Arial")
            .attr("font-size", "17px")
            .attr("fill", "#808080")
            .attr("pointer-events", "none");

        gtextLast
            .append("text")
            .attr("x", 63)
            .attr("y", 57)
            .text("Block " + lastBlock.index.toString())
            .attr("font-family", "Arial")
            .attr("font-size", "17px")
            .attr("fill", "#ffffff")
            .attr("pointer-events", "none");
        // .attr("font-weight", "bold")

        gtextLast
            .append("rect")
            .attr("x", 63)
            .attr("y", 40)
            .attr("width", 120)
            .attr("height", 19)
            .attr("fill-opacity", "0")
            .attr("uk-tooltip", Utils.bytes2String(lastBlock.hash));

        this.lastAddedBlockInfo(lastBlock, svgLast, lastBlock);
    }

    lastAddedBlockInfo(lastBlock: SkipBlock, svgLast: any, block: SkipBlock) {
        //validated transactions number
        var accepted = svgLast
            .append("g")
            .attr("class", "gaccepted")
            .attr("uk-tooltip", `Validated transactions`);

        accepted
            .append("rect")
            .attr("x", 65)
            .attr("y", 74)
            .attr("width", 21)
            .attr("fill-opacity", "0")
            .attr("height", 19);

        accepted
            .append("image")
            .attr("width", 20)
            .attr("height", 20)
            .attr("x", 44)
            .attr("y", 75)
            .attr("href", "information-button.svg");

        //text for number of validated tx
        accepted
            .append("text")
            .attr("class", "gaccepted")
            .attr("x", 73)
            .attr("y", 90)
            .text(this.getTransactionRatio(lastBlock)[0].toString()) //add number of validated transacitons
            .attr("font-family", "Arial")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .attr("fill", "#65E1A7")
            .attr("pointer-events", "none");

        var rejected = svgLast
            .append("g")
            .attr("class", "grefused")
            .attr("uk-tooltip", `Rejected transactions`);

        rejected
            .append("rect")
            .attr("x", 65)
            .attr("y", 104)
            .attr("width", 21)
            .attr("fill-opacity", "0")
            .attr("height", 19)
            .attr("uk-tooltip", `Rejected transactions`);

        rejected
            .append("image")
            .attr("width", 20)
            .attr("height", 20)
            .attr("x", 44)
            .attr("y", 104)
            .attr("href", "information-button-2.svg");

        //text for number of validated tx
        rejected
            .append("text")
            .attr("x", 74)
            .attr("y", 120)
            .text(this.getTransactionRatio(lastBlock)[1].toString()) //add number of validated transacitons
            .attr("font-family", "Arial")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .attr("fill", "#EF5959")
            .attr("pointer-events", "none");

        //Roster

        let descList: Array<String> = [];
        for (let i = 0; i < block.roster.list.length; i++) {
            descList[i] = block.roster.list[i].description;
        }

        var roster1 = svgLast
            .append("g")
            .attr("class", "groster")
            .attr("uk-tooltip", descList.join("<br/>"));

        //     roster1.
        //   append("image")
        //   .attr('width', 14)
        //   .attr('height', 14)
        //   .attr("x", 33)
        //   .attr("y", 138)
        //   .attr("href", "information-button-3.svg");

        roster1
            .append("rect")
            .attr("x", 43)
            .attr("y", 137)
            .attr("width", 58)
            .attr("height", 27)
            .attr("fill", "#1a8cff")
            .attr("fill-opacity", "0.5")
            .attr("rx", "7px");

        roster1
            .append("text")
            .text("Roster")
            .attr("x", 48)
            .attr("y", 157)
            .attr("font-family", "Arial")
            .attr("font-size", "16px")
            .attr("fill", "#ffffff")
            .attr("pointer-events", "none");

        const blockie = blockies.create({
            seed: lastBlock.hash.toString("hex"),
        });

        var imBlockies = svgLast
            .append("svg:image")
            .attr("xlink:href", blockie.toDataURL())
            .attr("x", 114)
            .attr("y", 143)
            .attr("width", 18)
            //  .attr("class","groster")
            .attr("height", 18)
            .attr("uk-tooltip", block.hash.toString("hex"));

        imBlockies.on("click", function () {
            Utils.copyToClipBoard(block.hash.toString("hex"), this.flash);
        });
    }

    getTransactionRatio(block: SkipBlock): [Number, Number] {
        let accepted = 0;
        let rejected = 0;

        const body = DataBody.decode(block.payload);
        body.txResults.forEach((transaction, i) => {
            if (transaction.accepted) {
                accepted++;
            } else {
                rejected++;
            }
        });
        console.log(Utils.bytes2String(block.roster.id));
        block.roster.list.forEach((x) => console.log(x.description));
        return [accepted, rejected];
    }

    //coin
    //config
    //darc
    //credential
    //longtermsecret
    //calypsoread

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
            }, 250);

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
            }, 250);

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
        garrow: any,
        gcircle: any,
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

            this.getToAndFrom(xTranslateBlock, block, garrow);
            this.appendCircleInBlock(xTranslateBlock, gcircle);
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
        //console.log("yoooo "+block.height + " vs  "+ block.forwardLinks.length);
        svgBlocks
            .append("rect")
            .attr("id", block.hash.toString("hex"))
            .attr("width", this.blockWidth)

            .attr("height", block.height * 40)

            .attr("x", xTranslate)
            .attr("y", 20)
            .attr("fill", Chain.getBlockColor(block))
            .on("click", () => {
                this.blockClickedSubject.next(block);
            });
    }

    private async appendArrows(
        xTrans: number,
        skipFrom: SkipBlock,
        iTo: number,
        block: SkipBlock,
        svgBlocks: any,
        factor: number
    ) {
        let y: number;
 

        if (iTo - skipFrom.index == 1) {
            svgBlocks
                .append("line")
                .attr("id", skipFrom.index)
                .attr("x1", xTrans)
                .attr("y1", 15 + this.blockHeight / 2)
                .attr("x2", xTrans - this.blockPadding)
                .attr("y2", 15 + this.blockHeight / 2)
                .attr("stroke-width", 2)
                .attr("stroke", "grey");
        } else {

            svgBlocks
                .append("line")
                .attr("x2", xTrans - this.blockPadding)
                .attr("y1", 40 + factor * 38)
                .attr(
                    "x1",
                    xTrans -
                        (iTo - skipFrom.index) *
                            (this.blockWidth + this.blockPadding) +
                        this.blockWidth
                )

                .attr("y2", 40 + factor * 38)
                .attr("stroke-width", 2)
                .attr("stroke", "grey")
                .attr("marker-end", "url(#triangle)")
                .on("click", () => {
                    this.blockClickedSubject.next(block);
                });

            svgBlocks
                .append("svg:defs")
                .append("svg:marker")
                .attr("id", "triangle")

                .attr("refX", 5.5)
                .attr("refY", 4.5)
                .attr("markerWidth", 15)
                .attr("markerHeight", 15)
                .attr("orient", "auto-start-reverse")
                .append("path")
                .attr("d", "M 0 0 L 10 5 L 0 10 z")
                .on("click", () => {
                    this.blockClickedSubject.next(block);
                })
                .style("fill", "grey");
        }
    }

    private async getToAndFrom(
        xTranslate: number,
        block: SkipBlock,
        svgBlocks: any
    ) {
        let indexTo: number;
        indexTo = block.index;
       
        for (let i = 0; i < block.backlinks.length; i++) {

            let skipFrom = await Utils.getBlock(
                block.backlinks[i],
                this.roster
            );

            this.appendArrows(
                xTranslate,
                skipFrom,
                indexTo,
                block,
                svgBlocks,
                i
            );
        }
    }

    /**
     * Helper for displayBlocks: appends a text element in a block.
     * @param xTranslate horizontal position where the text should be displayed
     * @param textIndex index of the text in the block
     * @param text text to display
     * @param textColor color of the text
     */
    private appendCircleInBlock(
        xTranslate: number,
        // textIndex: { index: number },
        //text: string,
        //textColor: string,
        gtext: any
    ) {
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
