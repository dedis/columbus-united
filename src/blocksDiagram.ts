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

  // Blocks navigation properties
  hashBlock0: string;
  initialBlockIndex: number;
  initialBlockHash: string;
  nbBlocksLoadedLeft: number;
  nbBlocksLoadedRight: number;

  // Blocks observation
  subscriberList: Array<Subscriber<SkipBlock>>;

  subjectBrowseSearch: Subject<string>; // TODO clean

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
    this.pageSize = 15;
    this.nbPages = 1;

    // Blocks observation
    this.subscriberList = [];

    this.hashBlock0 =
      "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";
    const hashBlock126 =
      "940406333443363ce0635218d1286bfbe7e22bb56910c26b92117dc7497ff086";

    // Blocks navigation properties
    this.initialBlockIndex = 126;
    this.initialBlockHash = hashBlock126;
    this.nbBlocksLoadedLeft = 0;
    this.nbBlocksLoadedRight = 0;
    let indexLastBlockLeft = this.initialBlockIndex;
    let hashLastBlockLeft = this.initialBlockHash;
    let hashLastBlockLeftBeforeUpdate = "";
    let indexLastBlockRight = this.initialBlockIndex;
    let hashLastBlockRight = this.initialBlockHash;
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

            // Load blocks to the left
            const indexLeftBlockOnScreen =
              self.initialBlockIndex + x / sizeBlockOnScreen;

            if (indexLeftBlockOnScreen < indexLastBlockLeft + 10) {
              if (!(hashLastBlockLeft === hashLastBlockLeftBeforeUpdate)) {
                hashLastBlockLeftBeforeUpdate = hashLastBlockLeft;

                // Handle the case when we arrive at block 0: do not load
                // below 0
                console.log("indexLastBlockLeft" + indexLastBlockLeft);
                let nbBlocksToLoad = self.pageSize;
                if (indexLastBlockLeft - self.pageSize + 2 < 0) {
                  nbBlocksToLoad = indexLastBlockLeft;
                }
                console.log(
                  "nbblockstoload" +
                    nbBlocksToLoad +
                    " selfpagesize" +
                    self.pageSize
                );

                self.getNextBlocks(
                  hashLastBlockLeft,
                  nbBlocksToLoad,
                  self.nbPages,
                  self.subjectBrowse,
                  true
                );
              }
            }

            // Load blocks to the right
            const indexRightBlockOnScreen =
              self.initialBlockIndex + (x + self.svgWidth) / sizeBlockOnScreen;

            if (indexRightBlockOnScreen > indexLastBlockRight - 10) {
              if (!(hashLastBlockRight === hashLastBlockRightBeforeUpdate)) {
                hashLastBlockRightBeforeUpdate = hashLastBlockRight;
                self.getNextBlocks(
                  hashLastBlockRight,
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
      complete: () => {
        console.error("end of blockchain");
        console.error("closed");
      },
      error: (err: any) => {
        console.error("error: ", err);
        if (err === 1) {
          console.error("browse recall: " + 1);
          // To reset the websocket, create a new handler for the next function
          // (of getnextblock)
          this.ws = undefined;
        }
      },
      next: ([i, skipBlocks]) => {
        // i is the page number
        // tslint:disable-next-line
        if (i == this.nbPages - 1) {
          const lastBlock = skipBlocks[skipBlocks.length - 1];
          const index = lastBlock.index;
          const hash = Utils.bytes2String(lastBlock.hash);

          if (index < this.initialBlockIndex) {
            // Load blocks to the left
            indexLastBlockLeft = index + 1;
            hashLastBlockLeft = hash;
            this.displayBlocks(skipBlocks, true);
          } else {
            // Load blocks to the right
            indexLastBlockRight = index - 1;
            hashLastBlockRight = hash;
            this.displayBlocks(skipBlocks, false);
          }
        }
      },
    });

    this.subjectBrowseSearch = new Subject<string>();
  }

  /**
   * Load the initial blocks.
   */
  loadInitialBlocks() {
    /*
    this.getHashFromIndex(2)
    this.subjectBrowseSearch.subscribe({
         next: (hash) => {
           console.log("G TROUVE " + hash)
         }
       })
*/
    this.getNextBlocks(
      this.initialBlockHash,
      this.pageSize,
      this.nbPages,
      this.subjectBrowse,
      false
    );
    
    this.getNextBlocks(
      this.initialBlockHash,
      this.pageSize,
      this.nbPages,
      this.subjectBrowse,
      true
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

  listTransaction() {
    // console.log("salut?");
  }

  /**
   * Append the given blocks to the blockchain.
   * @param listBlocks list of blocks to append
   * @param backward false for loading blocks to the right, true for loading
   * blocks to the left
   */
  private displayBlocks(listBlocks: SkipBlock[], backward: boolean) {
    // Determine the color of the blocks
    let blockColor: string;
    if (this.randomBlocksColor) {
      blockColor = Utils.getRandomColor();
    } else {
      blockColor = this.blockColor;
    }

    if (backward) {
      console.log(
        "Load left blocks " +
          (listBlocks[0].index - this.pageSize + 2) +
          " to " +
          listBlocks[0].index
      );
      // Load blocks to the left
      // Iterate over the blocks to append them
      for (
        let i = 0;
        i < listBlocks.length - 1;
        ++i, ++this.nbBlocksLoadedLeft
      ) {
        // x position where to start to display blocks
        const xTranslateBlock =
          -1 * (this.blockWidth + this.blockPadding) * this.nbBlocksLoadedLeft +
          10;
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
        const hash = Utils.bytes2String(block.hash);
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
    } else {
      console.log(
        "Load right blocks " +
          listBlocks[0].index +
          " to " +
          (listBlocks[0].index + this.pageSize - 2)
      );
      // Load blocks to the right
      // Iterate over the blocks to append them
      for (
        let i = 0;
        i < listBlocks.length - 1;
        ++i, ++this.nbBlocksLoadedRight
      ) {
        // x position where to start to display blocks
        const xTranslateBlock =
          (this.blockWidth + this.blockPadding) * this.nbBlocksLoadedRight + 10;
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
        const hash = Utils.bytes2String(block.hash);
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
    }
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
        backward: backward,
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
            backward: backward,
            numpages: nbPages,
            pagesize: pageSize,
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

  private getHashFromIndex(index: number) {
    let found: boolean = false
    let hash: string = ""
    let hashNextBlock: string = this.hashBlock0
    let subjectBrowse1 = new Subject<[number, SkipBlock[]]>();
    let pageDone = 0;

    //let subs: Subscriber<string> = new Subscriber<string>();

    subjectBrowse1.subscribe({
      complete: () => {
        console.error("end of blockchain");
        console.error("closed");
      },
      error: (err: any) => {
        console.error("error: ", err);
        if (err === 1) {
          console.error("browse recall: " + 1);
          // To reset the websocket, create a new handler for the next function
          // (of getnextblock)
          this.ws = undefined;
        }
      },
      next: ([i, skipBlocks]) => {
        if(!found) {
          for (let block of skipBlocks) {
            //console.log("length " + skipBlocks.length);
            if (block.index == index) {
              hash =  Utils.bytes2String(block.hash);
              found = true
              //console.log("hash found " + hash)
              console.log("FOUND")

              this.subjectBrowseSearch.next(hash)
              return;
            }
            console.log("ind = " + block.index)
          }
          
          if (i == this.nbPages - 1) {
            pageDone++;
            if (pageDone == this.nbPages) {
              let lastBlock = skipBlocks[skipBlocks.length - 1]
              if (lastBlock.forwardLinks.length != 0) {
                hashNextBlock = Utils.bytes2String(lastBlock.forwardLinks[0].to);
                pageDone = 0;
                this.getNextBlocks(
                  hashNextBlock,
                  this.pageSize,
                  this.nbPages,
                  subjectBrowse1,
                  false
                );
              } else {
                subjectBrowse1.complete();
              }
            }
          }
        }
        
        
      },
    });


  this.getNextBlocks(
        hashNextBlock,
        this.pageSize,
        this.nbPages,
        subjectBrowse1,
        false
      );
    

  }

  //private subscribe TODO

}
