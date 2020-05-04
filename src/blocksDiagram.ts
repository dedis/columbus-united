import { Roster, WebSocketAdapter } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { WebSocketConnection } from "@dedis/cothority/network/connection";
import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import {
  PaginateRequest,
  PaginateResponse,
} from "@dedis/cothority/byzcoin/proto/stream";
import { Observable, Subject, Subscriber } from "rxjs";
import * as d3 from "d3";
import { zoom } from "d3";

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

  subscriberList: Subscriber<SkipBlock>[];

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
    this.textColor = "black";
    this.blockColor = "#4772D8";
    this.validColor = "#8FD250";
    this.invalidColor = "#FF503F";

    // Blockchain properties
    this.roster = roster;
    this.subjectBrowse = new Subject<[number, SkipBlock[]]>();
    this.pageSizeNb = 15;
    this.numPagesNb = 1;
    this.nbBlocksLoaded = 0;

    this.subscriberList = [];

    let indexLastBlockLeft = this.initialBlockIndex;
    let hashLastBlockLeft = "";
    let hashLastBlockLeftBeforeUpdate = "";

    let indexLastBlockRight = this.initialBlockIndex;
    let hashLastBlockRight = "";
    let hashLastBlockRightBeforeUpdate = "";

    this.svgBlocks = d3
      .select(".blocks")
      .attr("width", this.svgWidth)
      .attr("height", this.svgHeight)
      .call(
        d3
          .zoom()
          .on("zoom", function () {
            self.svgBlocks.attr("transform", d3.event.transform);
            const x = -d3.event.transform.x; // horizontal position of the leftmost block
            const zoomLevel = d3.event.transform.k;

            const sizeBlockOnScreen =
              (self.blockWidth + self.blockPadding) * zoomLevel;

            // Load blocks to the left
            const hashBlockToLoadLeft = hashLastBlockLeft; // TODO how to find hash

            const indexLeftBlockOnScreen =
              self.initialBlockIndex + x / sizeBlockOnScreen;

            if (indexLeftBlockOnScreen < indexLastBlockLeft) {
              if (!(hashLastBlockLeft === hashLastBlockLeftBeforeUpdate)) {
                hashLastBlockLeftBeforeUpdate = hashLastBlockLeft;
                // self.loaderAnimation();
                self.getNextBlocks(
                  hashBlockToLoadLeft,
                  self.pageSizeNb,
                  self.numPagesNb,
                  self.subjectBrowse
                );
                // destroy loader
              }
            }

            // Load blocks to the right
            const indexRightBlockOnScreen =
              self.initialBlockIndex + (x + self.svgWidth) / sizeBlockOnScreen;

            if (indexRightBlockOnScreen > indexLastBlockRight) {
              if (!(hashLastBlockRight === hashLastBlockRightBeforeUpdate)) {
                hashLastBlockRightBeforeUpdate = hashLastBlockRight;
                // self.loaderAnimation();
                self.getNextBlocks(
                  hashLastBlockRight,
                  self.pageSizeNb,
                  self.numPagesNb,
                  self.subjectBrowse
                );
                // destroy loader
              }
            }
            /*
            console.log(
              //" | x = " +
              //Math.round(x * 100) / 100 +
              " | zoom = " +
                Math.round(zoomLevel * 100) / 100 +
                " | indexLastBlockLeft = " +
                indexLastBlockLeft +
                //" | nbBlocksOnScreen = " +
                //Math.round(nbBlocksOnScreen * 100) / 100 +
                " | indexLeftBlockOnScreen = " +
                Math.round(indexLeftBlockOnScreen * 100) / 100
            ); // TODO debug msg
*/
          })
          .scaleExtent([0.25, 3]) // Block zoom
      )
      .append("g");

    // TODO debug
    //let temp = d3.select(".blocksContainer").attr("viewBox", "0,0,150,420")

    this.subjectBrowse.subscribe({
      // i: page number
      next: ([i, skipBlocks]) => {
        if (i == this.numPagesNb - 1) {
          let index = skipBlocks[skipBlocks.length - 1].index - 1;
          let hash = skipBlocks[skipBlocks.length - 1].hash.toString("hex");

          if (index >= this.initialBlockIndex) {
            indexLastBlockRight = index;
            hashLastBlockRight = hash;
          } else {
            indexLastBlockLeft = index;
            hashLastBlockLeft = hash;
          }

          /* TODO loader
          setTimeout(() => {
            this.displayBlocks(skipBlocks, this.getRandomColor())
          }, 3000);
          
*/
          this.displayBlocks(skipBlocks, this.getRandomColor());
          // TODO unlock zoom
          //this.svgBlocks.attr("transform", d3.event.transform);
        }
      },
      complete: () => {
        console.log("End of blockchain");
        console.log("closed");
      },
      error: (err: any) => {
        console.log("error: ", err);
        if (err === 1) {
          console.log("Browse recall: " + 1);
          this.ws = undefined; // To reset the websocket, create a new handler for the next function (of getnextblock)
        }
      },
    });
  }

  public loadInitialBlocks() {
    let hashBlock0 =
      "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";
    let hashBlock126 =
      "940406333443363ce0635218d1286bfbe7e22bb56910c26b92117dc7497ff086";

    this.initialBlockIndex = 126;
    let initialBlockHash = hashBlock126;

    this.getNextBlocks(
      initialBlockHash,
      this.pageSizeNb,
      this.numPagesNb,
      this.subjectBrowse
    );
  }

  /**
   * Append the blocks in the svg
   * @param {*} listBlocks list of blocks to display
   * @param {*} blockColor color of the blocks
   */
  displayBlocks(listBlocks: SkipBlock[], blockColor: string) {
    console.log(
      "Loading blocks " +
        listBlocks[0].index +
        " to " +
        (listBlocks[0].index + 13)
    ); // TODO debug msg
    //console.log("Hash: " + listBlocks[0].hash.toString("hex")) // TODO debug msg
    for (let i = 0; i < listBlocks.length - 1; ++i, ++this.nbBlocksLoaded) {
      // x position where to start to display blocks
      const xTranslateBlock =
        (this.blockWidth + this.blockPadding) * this.nbBlocksLoaded + 10;
      const xTranslateText = xTranslateBlock + 5;

      let block = listBlocks[i];

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

      // Validity
      // TODO how to find validity of block? for now, random
      let validityStr;
      let validityColor;
      if (Math.random() >= 0.25) {
        validityStr = "valid";
        validityColor = this.validColor;
      } else {
        validityStr = "invalid";
        validityColor = this.invalidColor;
      }
      this.appendTextInBlock(
        xTranslateText,
        textIndex,
        validityStr,
        validityColor
      );
    }
  }

  // helper for displayBlocks
  private appendBlock(
    xTranslate: number,
    blockColor: string,
    block: SkipBlock
  ) {
    let self = this;
    this.svgBlocks
      .append("rect")
      .attr("width", this.blockWidth)
      .attr("height", this.blockHeight)
      .attr("y", 25)
      .attr("transform", function (d: any) {
        let translate = [xTranslate, 0];
        return "translate(" + translate + ")";
      })
      .attr("fill", blockColor)
      .on("click", function () {
        console.log("Clicked block " + block.index); // TODO debug msg
        self.subscriberList.forEach((sub) => {
          sub.next(block);
        });
      });
  }

  /**
   blocksDiagram.getBlockObserver().subscribe({
    next: (skipBlock) => {
      console.log("blabla")
    }
  });
   */
  public getBlockObserver(): Observable<SkipBlock> {
    return new Observable((sub) => {
      this.subscriberList.push(sub);
    });
  }

  // helper for displayBlocks
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

  // TODO this function is not used yet
  /*
  loaderAnimation() {
    this.svgBlocks
      .append("rect")
      .attr("width", this.blockWidth)
      .attr("height", this.blockHeight)
      .attr("y", 25)
      .attr("transform", function (d: string) {
        let translate = [
          (this.lastBlockIndex + 1) * (this.blockWidth + this.blockPadding),
          0,
        ];
        return "translate(" + translate + ")";
      })
      .attr("fill", this.getRandomColor());
  }
  */

  /***** Backend *****/
  private getNextBlocks(
    nextBlockID: string,
    pageSizeNb: number,
    numPagesNb: number,
    subjectBrowse: Subject<[number, SkipBlock[]]>
  ) {
    var bid: Buffer;
    let nextIDB = nextBlockID;

    try {
      bid = this.hex2Bytes(nextBlockID);
    } catch (error) {
      console.log("failed to parse the block ID: ", error);
      return;
    }

    try {
      var conn = new WebSocketConnection(
        this.roster.list[0].getWebSocketAddress(),
        ByzCoinRPC.serviceName
      );
    } catch (error) {
      console.log("error creating conn: ", error);
      return;
    }

    if (this.ws !== undefined) {
      const message = new PaginateRequest({
        startid: bid,
        pagesize: pageSizeNb,
        numpages: numPagesNb,
        backward: false,
      });

      const messageByte = Buffer.from(message.$type.encode(message).finish());
      this.ws.send(messageByte); // fetch next block
    } else {
      conn
        .sendStream<PaginateResponse>( // fetch next block
          new PaginateRequest({
            startid: bid,
            pagesize: pageSizeNb,
            numpages: numPagesNb,
            backward: false,
          }),
          PaginateResponse
        )
        .subscribe({
          // ws callback "onMessage":
          next: ([data, ws]) => {
            if (data.errorcode != 0) {
              console.log(
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
          complete: () => {
            console.log("closed");
          },
          error: (err: Error) => {
            console.log("error: ", err);
            this.ws = undefined;
          },
        });
    }
  }

  private hex2Bytes(hex: string) {
    if (!hex) {
      return Buffer.allocUnsafe(0);
    }

    return Buffer.from(hex, "hex");
  }

  /***** Utils *****/
  // Source: https://stackoverflow.com/a/1152508
  private getRandomColor() {
    return (
      "#" + (0x1000000 + Math.random() * 0xffffff).toString(16).substr(1, 6)
    );
  }
}
