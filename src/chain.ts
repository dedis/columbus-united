import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import { DataBody, DataHeader } from "@dedis/cothority/byzcoin/proto";
import {
  PaginateRequest,
  PaginateResponse,
} from "@dedis/cothority/byzcoin/proto/stream";
import { Roster, WebSocketAdapter } from "@dedis/cothority/network";
import { WebSocketConnection } from "@dedis/cothority/network/connection";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Subject } from "rxjs";
import { throttleTime, last } from "rxjs/operators";

import { Flash } from "./flash";
import { Utils } from "./utils";

export class Chain {
  // SVG properties
  svgWidth: number;
  svgHeight: number;

  // Blocks UI properties
  blockPadding: number; // size of the space between blocks
  blockWidth: number;
  blockHeight: number;
  // Margin between the left of the screen and the initial block
  initialBlockMargin: number;
  // Margin between the left of the block and the left of the text in the block
  textMargin: number;
  unitBlockAndPaddingWidth: number;
  loaderAnimationDuration: number; // duration of the loader in ms

  // Colors
  randomBlocksColor: boolean;
  textColor: string;
  blockColor: string;

  // Blockchain properties
  roster: Roster;
  ws: WebSocketAdapter;
  subjectBrowse = new Subject<[number, SkipBlock[], boolean]>();
  pageSize: number; // number of blocks in a page
  nbPages: number; // number of pages


  // This subject is notified each time a block is clicked
  blockClickedSubject = new Subject<SkipBlock>();

  // This subject is notified when a new series of block has been added to the
  // view
  newblocksSubject = new Subject<SkipBlock[]>();

  // Error management
  flash: Flash;

  initialBlockIndex: number;

  constructor(roster: Roster, flash: Flash, initialBlock: SkipBlock) {
    // Height of the blocks (dynamic according to the size of the window)
    const blocksHeight = this.computeBlocksHeight();

    // SVG properties
    this.svgWidth = window.innerWidth;
    this.svgHeight = blocksHeight;
    const self = this;

    // Blocks UI properties
    this.blockPadding = 10;
    this.blockWidth = blocksHeight;
    this.blockHeight = blocksHeight;
    this.initialBlockMargin = this.blockPadding;
    this.textMargin = 5;
    this.unitBlockAndPaddingWidth = this.blockWidth + this.blockPadding;
    this.loaderAnimationDuration = 1000;

    // Colors
    this.randomBlocksColor = false;
    this.textColor = "black";
    this.blockColor = "#4772D8";

    // Blockchain properties
    this.roster = roster;
    this.pageSize = 15;
    this.nbPages = 1;

    // Blocks observation
    this.flash = flash;

    this.initialBlockIndex = initialBlock.index;

    let lastBlockLeft = initialBlock;
    let lastBlockRight = initialBlock;

    // to keep track of current requested operations. If we are already loading
    // blocks on the left, then we shouldn't make another same request.
    let isLoadingLeft = false;
    let isLoadingRight = false;

    // Main SVG caneva that contains the chain
    const svg = d3
      .select("#svg-container")
      .attr("viewBox", `0, 0, ${this.svgWidth}, ${this.svgHeight}`);

    // this group will contain the blocks
    const gblocks = svg.append("g");

    // this group will contain the text. We need two separate groups because the
    // transform on the text group should not change the scale to keep the text readable
    const gtext = svg.append("g");

    // this subject will be notified when the main SVG caneva in moved by the
    // user
    const subject = new Subject();

    // the number of block the window can display at normal scale. Used to
    // define the domain the xScale
    var numblocks = this.svgWidth / (this.blockWidth + this.blockPadding);

    var lastTransform = {x: 0, y: 0, k: 1}

    // the xScale displays the block index and allows the user to quickly see
    // where he is in the chain
    var xScale = d3
      .scaleLinear()
      .domain([initialBlock.index, initialBlock.index + numblocks])
      .range([0, this.svgWidth]);

    var xAxis = d3
      .axisBottom(xScale)
      .ticks(numblocks)
      .tickFormat(d3.format("d"));

    var xAxisDraw = svg
      .insert("g", ":first-child")
      .attr("class", "x axis")
      .call(xAxis);

    // Update the subject when the view is dragged and zoomed in-out
    const zoom = d3
      .zoom()
      .extent([
        [0, 0],
        [this.svgWidth, this.svgHeight],
      ])
      .scaleExtent([0.001, 8])
      .on("zoom", () => {
        subject.next(d3.event.transform);
      });
    svg.call(zoom);

    // Handler to update the view (drag the view, zoom in-out)
    subject.subscribe({
      next: (transform: any) => {
        lastTransform = transform
        // This line disables translate to the left
        // transform.x = Math.min(0, transform.x);

        // Disable translation up/down
        transform.y = 0;

        // Update the scale
        var xScaleNew = transform.rescaleX(xScale);
        xAxis.scale(xScaleNew);
        xAxisDraw.call(xAxis);

        // Horizontal only transformation on the blocks
        var transformString =
          "translate(" + transform.x + "," + "0) scale(" + transform.k + ",1)";
        gblocks.attr("transform", transformString);

        // Standard transformation on the text since we need to keep the
        // original scale
        gtext.attr("transform", transform);
        // Update the text size
        if (transform.k < 1) {
          gtext.selectAll("text").attr("font-size", 1 + transform.k + "em");
        }
      },
    });

    // Handler to check if new blocks need to be leaded. We check every 500ms.
    subject.pipe(throttleTime(500)).subscribe({
      next: (transform: any) => {
        if (!isLoadingLeft) {
          const isLoading = this.checkAndLoadLeft(
            transform,
            lastBlockLeft,
            gtext
          );
          if (isLoading) {
            isLoadingLeft = true;
          }
        }

        if (!isLoadingRight) {
          const isLoading = this.checkAndLoadRight(
            transform,
            lastBlockRight,
            gtext
          );
          if (isLoading) {
            isLoadingRight = true;
          }
        }
      },
    });

    // Subscriber to the blockchain server
    this.subjectBrowse.subscribe({
      // i is the page number
      complete: () => {
        this.flash.display(Flash.flashType.INFO, "End of the blockchain");
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
        console.log("subject browse activated", backward, i == this.nbPages -1, skipBlocks.length)
        // i is the page number
        // tslint:disable-next-line
        if (i == this.nbPages - 1) {
          // If this is the first series of blocks, set the hash of the left first block
          const firstBlock = skipBlocks[0];
          if (firstBlock.index === this.initialBlockIndex) {
            lastBlockLeft = firstBlock;
          }

          const lastBlock = skipBlocks[skipBlocks.length - 1];

          if (backward) {
            console.log("calling display:", this.initialBlockIndex - lastBlockLeft.index)
            // Load blocks to the left
            this.displayBlocks(
              skipBlocks,
              true,
              this.getBlockColor(),
              gblocks,
              gtext,
              lastBlockLeft.index - this.initialBlockIndex
            );

            lastBlockLeft = lastBlock
            
            d3.selectAll(".left-loader").remove();
            const loadMore = this.checkAndLoadLeft(lastTransform, lastBlockLeft, gtext)
            if (!loadMore) {
              isLoadingLeft = false;
            }
          } else {
            // Load blocks to the right
            this.displayBlocks(
              skipBlocks,
              false,
              this.getBlockColor(),
              gblocks,
              gtext,
              lastBlockRight.index - this.initialBlockIndex
            );

            lastBlockRight = lastBlock

            d3.selectAll(".right-loader").remove();
            const loadMore = this.checkAndLoadRight(lastTransform, lastBlockRight, gtext)
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

  checkAndLoadLeft(
    transform: any,
    lastBlockLeft: SkipBlock,
    gtext: any
  ): boolean {
    const self = this;

    // x represents to x-axis translation of the caneva. If the block width
    // is 100 and x = -100, then it means the user dragged one block from
    // the initial block on the left.
    const x = -transform.x;
    const zoomLevel = transform.k;

    const nbBlocksLoadedLeft = this.initialBlockIndex - lastBlockLeft.index

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
    console.log("this.initialBlockIndex - nbBlocksLoadedLeft", this.initialBlockIndex - nbBlocksLoadedLeft)
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

      this.addLoader(true, zoomLevel, gtext, -nbBlocksLoadedLeft);

      const hashNextBlockLeft = Utils.getLeftBlockHash(lastBlockLeft)

      console.log("getting next blocks on the left", nbBlocksToLoad, hashNextBlockLeft)
      setTimeout(function () {
        self.getNextBlocks(
          hashNextBlockLeft,
          nbBlocksToLoad,
          self.nbPages,
          self.subjectBrowse,
          true
        );
      }, 2000);

      return true;
    }

    return false;
  }

  checkAndLoadRight(
    transform: any,
    lastBlockRight: SkipBlock,
    gtext: any
  ): boolean {
    const self = this;

    // x represents to x-axis translation of the caneva. If the block width
    // is 100 and x = -100, then it means the user dragged one block from
    // the initial block on the left.
    const x = -transform.x;
    const zoomLevel = transform.k;

    const nbBlocksLoadedRight = lastBlockRight.index - this.initialBlockIndex

    const rightBlockX =
      nbBlocksLoadedRight *
      (this.blockWidth + this.blockPadding) *
      zoomLevel;

    // Check if we need to load blocks on the right. (x + this.svgWidth)
    // represents the actual rightmost x coordinate on the svg caneva. +50
    // is to allow a margin before loading a new block, because we want to
    // allow a bit of blank space before triggering the load.
    if (x + this.svgWidth > rightBlockX + 50) {

      const hashNextBlockRight = Utils.getRightBlockHash(lastBlockRight)

      console.log("getting next blocks on the right", hashNextBlockRight)

      this.addLoader(false, zoomLevel, gtext, nbBlocksLoadedRight);
      setTimeout(function () {
        self.getNextBlocks(
          hashNextBlockRight,
          self.pageSize,
          self.nbPages,
          self.subjectBrowse,
          false
        );
      }, 2000);

      return true;
    }

    return false;
  }

  /**
   * Returns an observable to observe the blocks.
   * Example use:
   * getBlockClickedSubject().subscribe({
   *   next: (skipBlock) => {
   *     // do things
   *   }
   * })
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
  private addLoader(backwards: boolean, zoomLevel: number, gtext: any, numblocks: number) {

    let xTranslateBlock: number
    if(backwards) {
      xTranslateBlock = (numblocks - 1) * (this.unitBlockAndPaddingWidth) + this.blockPadding
    } else {
      xTranslateBlock = (numblocks) * (this.unitBlockAndPaddingWidth) + this.blockPadding
    }

    let className = "right-loader";
    let offset = -400;

    if (backwards) {
      className = "left-loader";
      offset = -400;
    }

    gtext
      .append("g")
      .attr("transform", `translate(${xTranslateBlock + offset}, 100)`)
      .attr("class", className)
      .append("svg")
      .attr("class", "spinner")
      .attr("viewBox", "0, 0, 50, 50")
      .append("circle")
      .attr("cx", 25)
      .attr("cy", 25)
      .attr("r", 20)
      .attr("fill", "none")
      .attr("stroke-width", "5");
  }

  /**
   * Append the given blocks to the blockchain.
   * @param listBlocks list of blocks to append
   * @param backwards  false for loading blocks to the right, true for loading
   *                   blocks to the left
   * @param blockColor wanted color of the blocks
   * @param numblocks the number of blocks loaded from the initial block. In the
   * case of a backward loading, this number should be negative. -10 means we
   * already loaded 10 blocks on the left from the initial block.
   */
  private displayBlocks(
    listBlocks: SkipBlock[],
    backwards: boolean,
    blockColor: string,
    gblocks: any,
    gtext: any,
    numblocks: number
  ) {
    // Iterate over the blocks to append them
    // tslint:disable-next-line
    for (let i = 0; i < listBlocks.length; ++i) {
      const block = listBlocks[i];

      let xTranslateBlock: number
      if(backwards) {
        xTranslateBlock = (numblocks - 1 - i) * (this.unitBlockAndPaddingWidth) + this.blockPadding
      } else {
        xTranslateBlock = (numblocks + i) * (this.unitBlockAndPaddingWidth) + this.blockPadding
      }

      const xTranslateText = xTranslateBlock + this.textMargin;

      // Append the block inside the svg container
      this.appendBlock(xTranslateBlock, blockColor, block, gblocks);

      // Box the text index in an object to pass it by reference
      const textIndex = { index: 0 };

      // Index
      this.appendTextInBlock(
        xTranslateText,
        textIndex,
        "index: " + block.index,
        this.textColor,
        gtext
      );

      // Hash
      const hash = Utils.bytes2String(block.hash);
      this.appendTextInBlock(
        xTranslateText,
        textIndex,
        "hash: " + hash.slice(0, 8) + "...",
        this.textColor,
        gtext
      );

      // Number of transactions
      const body = DataBody.decode(block.payload);
      const nbTransactions = body.txResults.length;
      this.appendTextInBlock(
        xTranslateText,
        textIndex,
        "#transactions: " + nbTransactions,
        this.textColor,
        gtext
      );

      const header = DataHeader.decode(block.data);
      // console.log(">>>>>>>> timestamp:", header.timestamp.toNumber());
      this.appendTextInBlock(
        xTranslateText,
        textIndex,
        "T: " + header.timestamp.toString(),
        this.textColor,
        gtext
      );
    }
    this.newblocksSubject.next(listBlocks);
  }

  /**
   * Helper for displayBlocks: appends a block to the blockchain and adds it to
   * the subscriber list.
   * @param xTranslate horizontal position where the block should be appended
   * @param blockColor color of the blocks
   * @param block the block to append
   */
  private appendBlock(
    xTranslate: number,
    blockColor: string,
    block: SkipBlock,
    svgBlocks: any
  ) {
    const self = this;
    svgBlocks
      .append("rect")
      .attr("id", block.hash.toString("hex"))
      .attr("width", this.blockWidth)
      .attr("height", this.blockHeight)
      .attr("x", xTranslate)
      .attr("y", 20)
      .attr("fill", blockColor)
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

      const messageByte = Buffer.from(message.$type.encode(message).finish());
      this.ws.send(messageByte); // fetch next block
    } else {
      conn
        .sendStream<PaginateResponse>( // fetch next block
          new PaginateRequest({
            backward,
            numpages: nbPages,
            pagesize: pageSize,
            startid: bid,
          }),
          PaginateResponse
        )
        .subscribe({
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
            subjectBrowse.next([data.pagenumber, data.blocks, data.backward]);
            return 0;
          },
        });
    }
  }

  /**
   * Determine the color of the blocks.
   */
  private getBlockColor(): string {
    if (this.randomBlocksColor) {
      return Utils.getRandomColor();
    } else {
      return this.blockColor;
    }
  }

  /**
   * Compute the height of the blocks according to the size of the window.
   */
  private computeBlocksHeight(): number {
    const windowHeight = window.innerHeight;
    if (windowHeight < 300) {
      return 150;
    } else {
      return 0.3 * windowHeight;
    }
  }
}
