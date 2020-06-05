import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import { DataBody } from "@dedis/cothority/byzcoin/proto";
import {
  PaginateRequest,
  PaginateResponse,
} from "@dedis/cothority/byzcoin/proto/stream";
import { Roster, WebSocketAdapter } from "@dedis/cothority/network";
import { WebSocketConnection } from "@dedis/cothority/network/connection";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Observable, Subject, Subscriber } from "rxjs";

import { Flash } from "./flash";
import { Utils } from "./utils";

export class BlocksDiagram {
  // SVG properties
  svgWidth: number;
  svgHeight: number;
  svgBlocks: any;

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
  subjectBrowse: Subject<[number, SkipBlock[]]>;
  pageSize: number; // number of blocks in a page
  nbPages: number; // number of pages
  nbBlocksUpdate: number; // number of blocks fetched in each update

  // Blocks navigation properties
  initialBlock: SkipBlock;
  nbBlocksLoadedLeft: number;
  nbBlocksLoadedRight: number;

  // Blocks observation
  subscriberList: Array<Subscriber<SkipBlock>>;
  updateObserver = new Subject<SkipBlock[]>();

  flash: Flash;
  constructor(roster: Roster, flash: Flash, initialBlock: SkipBlock) {
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
    this.subjectBrowse = new Subject<[number, SkipBlock[]]>();
    this.pageSize = 15;
    this.nbPages = 1;
    this.nbBlocksUpdate = this.nbPages * this.pageSize;

    // Blocks observation
    this.subscriberList = [];
    this.flash = flash;

    // Blocks navigation properties
    this.initialBlock = initialBlock;
    this.nbBlocksLoadedLeft = 0;
    this.nbBlocksLoadedRight = 0;

    const initialBlockIndex = this.initialBlock.index;
    const initialBlockHash = Utils.bytes2String(this.initialBlock.hash);

    let indexNextBlockLeft = initialBlockIndex;
    let hashNextBlockLeft = initialBlockHash;
    let hashNextBlockLeftBeforeUpdate = "";

    let indexNextBlockRight = initialBlockIndex;
    let hashNextBlockRight = initialBlockHash;
    let hashNextBlockRightBeforeUpdate = "";

    // SVG containing the blockchain
    this.svgBlocks = d3
      .select(".blocks")
      .attr("width", this.svgWidth)
      .attr("height", this.svgHeight)
      .call(
        d3
          .zoom()
          .on("zoom", () => {
            const transform = d3.event.transform;
            self.svgBlocks.attr("transform", transform);

            // Horizontal position of the leftmost block
            const x = -transform.x;
            const zoomLevel = transform.k;

            const sizeBlockOnScreen =
              (self.blockWidth + self.blockPadding) * zoomLevel;

            const nbBlocksOnScreen = this.svgWidth / sizeBlockOnScreen;

            const nbLoadsNeeded = Math.ceil(
              nbBlocksOnScreen / this.nbBlocksUpdate
            );

            // Load blocks to the left
            const indexLeftBlockOnScreen =
              initialBlockIndex + x / sizeBlockOnScreen;

            // Check if an update is needed
            if (
              indexLeftBlockOnScreen <
              indexNextBlockLeft + nbBlocksOnScreen
            ) {
              if (hashNextBlockLeft !== hashNextBlockLeftBeforeUpdate) {
                hashNextBlockLeftBeforeUpdate = hashNextBlockLeft;

                if (!(indexNextBlockLeft < 0)) {
                  // Handle the case when we arrive at block 0: do not load
                  // below 0
                  let nbBlocksToLoad = self.pageSize;
                  const indexLastBlockLeft = indexNextBlockLeft + 1;
                  if (initialBlockIndex < self.pageSize) {
                    nbBlocksToLoad = initialBlockIndex;
                  } else if (indexLastBlockLeft - this.nbBlocksUpdate < 0) {
                    nbBlocksToLoad = indexLastBlockLeft;
                  }

                  this.loaderAnimation(true, zoomLevel);
                  
                  if (nbBlocksToLoad > 0) {
                    self.getNextBlocks(
                      hashNextBlockLeft,
                      nbBlocksToLoad,
                      self.nbPages,
                      self.subjectBrowse,
                      true
                    );
                  }
                  if(nbBlocksToLoad === 0) {
                    // We arrived at the end of the left side
                    this.destroyLoader(true);
                  }
                }
              }
            }

            // Load blocks to the right
            const indexRightBlockOnScreen =
              initialBlockIndex + (x + self.svgWidth) / sizeBlockOnScreen;

            // Check if an update is needed
            if (
              indexRightBlockOnScreen >
              indexNextBlockRight - nbBlocksOnScreen
            ) {
              if (hashNextBlockRight !== hashNextBlockRightBeforeUpdate) {
                hashNextBlockRightBeforeUpdate = hashNextBlockRight;

                this.loaderAnimation(false, zoomLevel);

                self.getNextBlocks(
                  hashNextBlockRight,
                  self.pageSize,
                  self.nbPages,
                  self.subjectBrowse,
                  false
                );
              }
            }
          })
          .scaleExtent([0.03, 3]) // Constraint the zoom
      )
      .append("g");

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
      },
      next: ([i, skipBlocks]) => {
        // i is the page number
        // tslint:disable-next-line
        if (i == this.nbPages - 1) {
          // If this is the first series of blocks, set the hash of the left first block
          const firstBlock = skipBlocks[0];
          if (firstBlock.index === initialBlockIndex) {
            hashNextBlockLeft = Utils.getLeftBlockHash(firstBlock);
          }

            const lastBlock = skipBlocks[skipBlocks.length - 1];
            const indexLastBlock = lastBlock.index;

          if (indexLastBlock < initialBlockIndex) {
            // Load blocks to the left
            indexNextBlockLeft = indexLastBlock - 1;
            hashNextBlockLeft = Utils.getLeftBlockHash(lastBlock);
            this.displayBlocks(skipBlocks, true, this.getBlockColor());
          } else {
            // Load blocks to the right
            indexNextBlockRight = indexLastBlock + 1;
            hashNextBlockRight = Utils.getRightBlockHash(lastBlock);
            this.displayBlocks(skipBlocks, false, this.getBlockColor());
          }
        }
    }});
  }

  /**
   * Load the initial blocks.
   */
  loadInitialBlocks() {
    this.getNextBlocks(
      Utils.bytes2String(this.initialBlock.hash),
      this.pageSize,
      this.nbPages,
      this.subjectBrowse,
      false
    );
  }

  /**
   * Returns an observable to observe the blocks.
   * Example use:
   * const blocksDiagram = new BlocksDiagram(roster);
   * blocksDiagram.getBlockObserver().subscribe({
   *   next: (skipBlock) => {
   *     // do things
   *   }
   * })
   */
  getBlockObserver(): Observable<SkipBlock> {
    return new Observable((sub) => {
      this.subscriberList.push(sub);
    });
  }

  isUpdatedObserver(): Subject<SkipBlock[]> {
    return this.updateObserver;
  }

  private loaderAnimation(backwards: boolean, zoomLevel: number) {
    this.destroyLoader(backwards);
    this.createLoader(backwards, zoomLevel);
  }

  private createLoader(backwards: boolean, zoomLevel: number) {
    let xTranslateBlock = this.getXTranslateBlock(backwards);
    const loaderId = this.getLoaderId(backwards);

    if (backwards) {
      xTranslateBlock =
        -1 * this.unitBlockAndPaddingWidth * zoomLevel * this.nbBlocksLoadedLeft;
    }

    this.svgBlocks
      .append("rect")
      .attr("id", loaderId)
      .attr("width", 0)
      .attr("height", this.blockHeight)
      .attr("transform", (d: any) => {
        const translate = [xTranslateBlock, 0];
        return "translate(" + translate + ")";
      })
      .attr("fill", this.getBlockColor());

    // Loader position
    let xStart: number;
    let xEnd: number;
    if (backwards) {
      // The left loader is too buggy so I remove it for now. The position
      // is wrong because of the zoom.
      /*
      xStart = xTranslateBlock;
      xEnd = xTranslateBlock - this.blockWidth;

      //repeatLeft();

      d3.select("#" + loaderId)
        .attr("x", xStart)
        .transition()
        .ease(d3.easeSin)
        .duration(this.loaderAnimationDuration)
        .attr("width", this.blockWidth)
        .attr("x", xEnd);
      */
    } else {
      repeatRight();
    }

    const blockWidth = this.blockWidth;
    const loaderAnimationDuration = this.loaderAnimationDuration
    /*
    function repeatLeft() {
      d3.select("#loaderLeft")
        .attr("x", xStart)
        .transition()
        .ease(d3.easeSin)
        .duration(loaderAnimationDuration)
        .attr("width", blockWidth)
        .attr("x", xEnd)
        .on("end", repeatLeft)
    }
    */
    function repeatRight() {
      d3.select("#loaderRight")
      .attr("width", 0)
      .transition()
      .ease(d3.easeSin)
      .duration(loaderAnimationDuration)
      .attr("width", blockWidth)
      .on("end", repeatRight)
    }
  }

  private destroyLoader(backwards: boolean) {
    d3.select("#" + this.getLoaderId(backwards)).remove();
  }

  private getLoaderId(backwards: boolean): string {
    return backwards ? "loaderLeft" : "loaderRight";
  }

  /**
   * x position where to start to display blocks.
   * @param backwards
   */
  private getXTranslateBlock(backwards: boolean): number {
    let xTranslateBlock: number;
    if (backwards) {
      // left
      xTranslateBlock =
        -1 * this.unitBlockAndPaddingWidth * this.nbBlocksLoadedLeft +
        this.blockPadding -
        this.unitBlockAndPaddingWidth;
    } else {
      // right
      xTranslateBlock =
        this.unitBlockAndPaddingWidth * this.nbBlocksLoadedRight +
        this.blockPadding;
    }

    return xTranslateBlock;
  }

  /**
   * Append the given blocks to the blockchain.
   * @param listBlocks list of blocks to append
   * @param backwards false for loading blocks to the right, true for loading
   * blocks to the left
   */
  private displayBlocks(
    listBlocks: SkipBlock[],
    backwards: boolean,
    blockColor: string
  ) {
    // Iterate over the blocks to append them
    for (let i = 0; i < listBlocks.length; ++i) {
      let xTranslateBlock = this.getXTranslateBlock(backwards);

      const xTranslateText = xTranslateBlock + this.textMargin;

      const block = listBlocks[i]

      // Append the block inside the svg container
      this.appendBlock(xTranslateBlock, blockColor, block);

      // Box the text index in an object to pass it by reference
      const textIndex = { index: 0 };

      // Index
      this.appendTextInBlock(
        xTranslateText,
        textIndex,
        "index: " + block.index,
        this.textColor
      );

      // Hash
      const hash = Utils.bytes2String(block.hash);
      this.appendTextInBlock(
        xTranslateText,
        textIndex,
        "hash: " + hash.slice(0, 8) + "...",
        this.textColor
      );

      // Number of transactions
      const body = DataBody.decode(block.payload);
      const nbTransactions = body.txResults.length;
      this.appendTextInBlock(
        xTranslateText,
        textIndex,
        "#transactions: " + nbTransactions,
        this.textColor
      );

      if (backwards) {
        // left
        ++this.nbBlocksLoadedLeft;
      } else {
        // right
        ++this.nbBlocksLoadedRight;
      }
    }
    this.updateObserver.next(listBlocks);
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
    block: SkipBlock
  ) {
    const self = this;
    this.svgBlocks
      .append("rect")
      .attr("id", block.hash.toString("hex"))
      .attr("width", this.blockWidth)
      .attr("height", this.blockHeight)
      .attr("transform", (d: any) => {
        const translate = [xTranslate, 0];
        return "translate(" + translate + ")";
      })
      .attr("fill", blockColor)
      .on("click", () => {
        self.subscriberList.forEach((sub) => {
          sub.next(block);
        });
      });
  }

  /**
   * Helper for displayBlocks: appends a text element in a block
   * @param xTranslate horizontal position where the text should be displayed
   * @param textIndex index of the text in the block
   * @param text text to display
   * @param textColor color of the text
   */
  private appendTextInBlock(
    xTranslate: number,
    textIndex: { index: number },
    text: string,
    textColor: string
  ) {
    this.svgBlocks
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
    subjectBrowse: Subject<[number, SkipBlock[]]>,
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
            subjectBrowse.next([data.pagenumber, data.blocks]);
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
  
  private computeBlocksHeight(): number {
    const windowHeight = window.innerHeight;
    if (windowHeight < 300) {
      return 150;
    } else {
      return 0.3 * windowHeight;
    }
  }
}
