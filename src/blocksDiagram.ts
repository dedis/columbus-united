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

export class BlocksDiagram {
  // SVG properties
  svgWidth: number;
  svgHeight: number;
  svgBlocks: any;

  // Blocks UI properties
  blockPadding: number; // size of the space between blocks
  blockWidth: number;
  blockHeight: number;

  // Colors
  randomBlocksColor: boolean;
  textColor: string;
  blockColor: string;
  validColor: string;
  invalidColor: string;

  // Blockchain properties
  roster: Roster;
  ws: WebSocketAdapter;
  subjectBrowse: Subject<[number, SkipBlock[]]>;
  pageSizeNb: number; // number of blocks in a page
  numPagesNb: number; // number of pages
  nbBlocksLoaded: number;
  initialBlockIndex: number;

  // Blocks observation
  subscriberList: Array<Subscriber<SkipBlock>>;
  updateObserver = new Subject<SkipBlock[]>();
  constructor(roster: Roster) {
    // SVG properties
    this.svgWidth = window.innerWidth;
    this.svgHeight = 400;
    const self = this;

    // Blocks UI properties
    this.blockPadding = 10;
    this.blockWidth = 300;
    this.blockHeight = 300;

    // Colors
    this.randomBlocksColor = true;
    this.textColor = "black";
    this.blockColor = "#4772D8";

    // Blockchain properties
    this.roster = roster;
    this.subjectBrowse = new Subject<[number, SkipBlock[]]>();
    this.pageSizeNb = 15;
    this.numPagesNb = 1;
    this.nbBlocksLoaded = 0;

    // Blocks observation
    this.subscriberList = [];
    // Blocks navigation properties
    let indexLastBlockRight = this.initialBlockIndex;
    let hashLastBlockRight = "";
    let hashLastBlockRightBeforeUpdate = "";

    // SVG containing the blockchain
    this.svgBlocks = d3
      .select(".blocks")
      .attr("width", this.svgWidth)
      .attr("height", this.svgHeight)
      .call(
        d3
          .zoom()
          .on("zoom", () => {
            self.svgBlocks.attr("transform", d3.event.transform);
            // Horizontal position of the leftmost block
            const x = -d3.event.transform.x;
            const zoomLevel = d3.event.transform.k;

            const sizeBlockOnScreen =
              (self.blockWidth + self.blockPadding) * zoomLevel;

            // Load blocks to the right
            const indexRightBlockOnScreen =
              self.initialBlockIndex + (x + self.svgWidth) / sizeBlockOnScreen;

            if (indexRightBlockOnScreen > indexLastBlockRight - 10) {
              if (!(hashLastBlockRight === hashLastBlockRightBeforeUpdate)) {
                hashLastBlockRightBeforeUpdate = hashLastBlockRight;

                self.getNextBlocks(
                  hashLastBlockRight,
                  self.pageSizeNb,
                  self.numPagesNb,
                  self.subjectBrowse
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
        console.error("End of blockchain");
        console.error("closed");
      },
      error: (err: any) => {
        console.error("error: ", err);
        if (err === 1) {
          console.error("Browse recall: " + 1);
          // To reset the websocket, create a new handler for the next function
          // (of getnextblock)
          this.ws = undefined;
        }
      },
      next: ([i, skipBlocks]) => {
        // tslint:disable-next-line
        if (i == this.numPagesNb - 1) {
          const index = skipBlocks[skipBlocks.length - 1].index - 1;
          const hash = skipBlocks[skipBlocks.length - 1].hash.toString("hex");

          if (index >= this.initialBlockIndex) {
            // Loading blocks to the right
            indexLastBlockRight = index;
            hashLastBlockRight = hash;
            this.displayBlocks(skipBlocks);
          } else {
            // Loading blocks to the left
          }
        }
      },
    });
  }

  /**
   * Load the initial blocks.
   */
  loadInitialBlocks() {
    const hashBlock0 =
      "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";
    const hashBlock126 =
      "940406333443363ce0635218d1286bfbe7e22bb56910c26b92117dc7497ff086";

    this.initialBlockIndex = 0;
    const initialBlockHash = hashBlock0;

    this.getNextBlocks(
      initialBlockHash,
      this.pageSizeNb,
      this.numPagesNb,
      this.subjectBrowse
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

  isUpdatedObserver():Subject<SkipBlock[]>{
    return this.updateObserver
  }

  /**
   * Append the given blocks to the blockchain.
   * @param listBlocks list of blocks to append
   */
  private displayBlocks(listBlocks: SkipBlock[]) {
    // Determine the color of the blocks
    let blockColor: string;
    if (this.randomBlocksColor) {
      blockColor = this.getRandomColor();
    } else {
      blockColor = this.blockColor;
    }

    // Iterate over the blocks to append them
    for (let i = 0; i < listBlocks.length - 1; ++i, ++this.nbBlocksLoaded) {
      // x position where to start to display blocks
      const xTranslateBlock =
        (this.blockWidth + this.blockPadding) * this.nbBlocksLoaded + 10;
      const xTranslateText = xTranslateBlock + 5;

      const block = listBlocks[i];

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
      const hash = block.hash.toString("hex");
      this.appendTextInBlock(
        xTranslateText,
        textIndex,
        "hash: " + hash.slice(0, 22) + "...",
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
    }
    this.updateObserver.next(listBlocks)
    //TODO next?
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
      .attr("y", 25)
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
      .attr("y", 25 + (textIndex.index + 1) * 30)
      .text(text)
      .attr("font-family", "sans-serif")
      .attr("font-size", "18px")
      .attr("fill", textColor);
    ++textIndex.index;
  }

  /**
   * Requests blocks to the blockchain.
   * @param nextBlockID hash of the first block of the next blocks to get
   * @param pageSizeNb number of blocks in a page
   * @param numPagesNb number of pages to request
   * @param subjectBrowse observable to get the blocks from the blockchain
   */
  private getNextBlocks(
    nextBlockID: string,
    pageSizeNb: number,
    numPagesNb: number,
    subjectBrowse: Subject<[number, SkipBlock[]]>
  ) {
    let bid: Buffer;

    try {
      bid = this.hex2Bytes(nextBlockID);
    } catch (error) {
      console.error("failed to parse the block ID: ", error);
      return;
    }

    let conn: WebSocketConnection;
    try {
      conn = new WebSocketConnection(
        this.roster.list[0].getWebSocketAddress(),
        ByzCoinRPC.serviceName
      );
    } catch (error) {
      console.error("error creating conn: ", error);
      return;
    }

    if (this.ws !== undefined) {
      const message = new PaginateRequest({
        backward: false,
        numpages: numPagesNb,
        pagesize: pageSizeNb,
        startid: bid,
      });

      const messageByte = Buffer.from(message.$type.encode(message).finish());
      this.ws.send(messageByte); // fetch next block
    } else {
      conn
        .sendStream<PaginateResponse>( // fetch next block
          new PaginateRequest({
            backward: false,
            numpages: numPagesNb,
            pagesize: pageSizeNb,
            startid: bid,
          }),
          PaginateResponse
        )
        .subscribe({
          // ws callback "onMessage":
          complete: () => {
            console.error("closed");
          },
          error: (err: Error) => {
            console.error("error: ", err);
            this.ws = undefined;
          },
          next: ([data, ws]) => {
            // tslint:disable-next-line
            if (data.errorcode != 0) {
              console.error(
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
   * Converter from hex string to bytes.
   * @param hex string to convert
   */
  private hex2Bytes(hex: string) {
    if (!hex) {
      return Buffer.allocUnsafe(0);
    }

    return Buffer.from(hex, "hex");
  }

  /**
   * Generate a random color in HEX format
   * Source: https://stackoverflow.com/a/1152508
   */
  private getRandomColor() {
    return (
      "#" + (0x1000000 + Math.random() * 0xffffff).toString(16).substr(1, 6)
    );
  }
}
