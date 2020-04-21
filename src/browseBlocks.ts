import { Roster, WebSocketAdapter } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { WebSocketConnection } from "@dedis/cothority/network/connection";
import { ByzCoinRPC, Instruction, Argument } from "@dedis/cothority/byzcoin";
import {
  PaginateResponse,
  PaginateRequest,
} from "@dedis/cothority/byzcoin/proto/stream";
import { Subject } from "rxjs";
import * as d3 from "d3";

export class BrowseBlocks {
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
  lastBlockLoadedIndex: number;

  // TODO
  temp: number

  constructor(roster: Roster) {
    // SVG properties
    this.svgWidth = window.innerWidth;
    this.svgHeight = 400;
    let self = this;

    // Blocks UI properties
    this.blockPadding = 10;
    this.blockWidth = 300;
    this.blockHeight = 300;

    // Colors
    this.textColor = "black";
    this.blockColor = "#236ddb";
    this.validColor = "#0cf01b";
    this.invalidColor = "#ed0e19";

    // Blockchain properties
    this.roster = roster;
    this.subjectBrowse = new Subject<[number, SkipBlock[]]>();
    this.pageSizeNb = 15;
    this.numPagesNb = 1;
    this.nbBlocksLoaded = 0;
    this.lastBlockLoadedIndex = -1;

    this.svgBlocks = d3
      .select(".blocks")
      .attr("width", this.svgWidth)
      .attr("height", this.svgHeight)
      .call(
        d3.zoom().on("zoom", function () {
          self.svgBlocks.attr("transform", d3.event.transform);
          let x = d3.event.transform.x; // horizontal position
          let zoomLevel = d3.event.transform.k;

          let xMax =
            self.nbBlocksLoaded * (self.blockWidth + self.blockPadding);
          xMax -= self.svgWidth + self.blockWidth;
          xMax *= -zoomLevel;

          if (x < xMax) {
            // TODO lock zoom
            //self.svgBlocks.attr("transform", undefined) // TODO

            self.getNextBlocks(
              lastBlockID,
              self.pageSizeNb,
              self.numPagesNb,
              self.subjectBrowse
            );
          }
        })
      )
      .append("g");

    let lastBlockID: string;
    this.subjectBrowse.subscribe({
      // i: page number
      next: ([i, skipBlocks]) => {
        console.log("i: " + i);
        if (i == this.numPagesNb - 1) {
          lastBlockID = skipBlocks[skipBlocks.length - 1].hash.toString("hex");

          this.displayBlocks(skipBlocks, this.svgBlocks, this.blockColor);

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

    this.temp = 1;
  }

  main() {
    let firstBlockID =
      "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";

    this.getNextBlocks(
      firstBlockID,
      this.pageSizeNb,
      this.numPagesNb,
      this.subjectBrowse
    );
  }

  placeTextInBlock(pos: number): number {
    return 25 + pos * 30;
  }

  loaderAnimation(svgBlocks: any) {
    svgBlocks
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

  appendTextInBlock(
    svgBlocks: any,
    xTranslate: number,
    block: SkipBlock,
    textID: number,
    text: string,
    textColor: string
  ) {
    svgBlocks
      .append("text")
      .attr("x", xTranslate + 5)
      .attr("y", this.placeTextInBlock(textID))
      .text(text)
      .attr("font-family", "sans-serif")
      .attr("font-size", "18px")
      .attr("fill", textColor);
  }

  /**
   *
   * @param {*} listBlocks list of blocks
   * @param {*} svgBlocks svg class that will contain the blocks
   * @param {*} blockColor color of the blocks
   */
  displayBlocks(listBlocks: SkipBlock[], svgBlocks: any, blockColor: string) {
    for (let i = 0; i < listBlocks.length; ++i, ++this.nbBlocksLoaded) {
      // x position where to start to display blocks
      const xTranslate =
        (this.blockWidth + this.blockPadding) * this.nbBlocksLoaded;
      
      let block = listBlocks[i];

      if(this.temp == 0) {
        this.temp = 1;
        --this.nbBlocksLoaded
        
      } else {

      this.lastBlockLoadedIndex = block.index
      

      console.log("display block number " + block.index);

      svgBlocks
        .append("rect") // for each block, append it inside the svg container
        .attr("width", this.blockWidth)
        .attr("height", this.blockHeight)
        .attr("y", 25)
        .attr("transform", function (d: any) {
          let translate = [xTranslate, 0];
          return "translate(" + translate + ")";
        })
        .attr("fill", blockColor);

      // Index
      this.appendTextInBlock(
        svgBlocks,
        xTranslate,
        block,
        1,
        "index: " + block.index,
        this.textColor
      );

      // Validity
      svgBlocks
        .append("text")
        .attr("x", xTranslate + 5)
        .attr("y", this.placeTextInBlock(2))
        .text(function (d: any) {
          let str = "";
          if (true) {
            //block.valid == 1) {
            str = "true";
          } else {
            str = "false";
          }
          return "valid: " + str;
        })
        .attr("font-family", "sans-serif")
        .attr("font-size", "18px")
        .attr("fill", function (d: any) {
          if (true) {
            //block.valid == 1) {
            return this.validColor;
          } else return this.invalidColor;
        });

      // Date
      svgBlocks
        .append("text")
        .attr("x", xTranslate + 5)
        .attr("y", this.placeTextInBlock(3))
        .text(function (d: any) {
          return "date: 3"; // + block.date
        })
        .attr("font-family", "sans-serif")
        .attr("font-size", "18px")
        .attr("fill", this.textColor);

      // Hash
      svgBlocks
        .append("text")
        .attr("x", xTranslate + 5)
        .attr("y", this.placeTextInBlock(4))
        .text(function (d: any) {
          let hash = block.hash.toString("hex");
          return "hash: " + hash.slice(0, 6) + "...";
        })
        .attr("font-family", "sans-serif")
        .attr("font-size", "18px")
        .attr("fill", this.textColor);
      }
    }
    this.temp = 0;
  }

  hex2Bytes(hex: string) {
    if (!hex) {
      return Buffer.allocUnsafe(0);
    }

    return Buffer.from(hex, "hex");
  }

  getNextBlocks(
    nextBlockID: string,
    pageSizeNb: number,
    numPagesNb: number,
    subjectBrowse: Subject<[number, SkipBlock[]]>
  ) {
    console.log("next id " + nextBlockID);
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
            this.handlePageResponse(data, ws, subjectBrowse);
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

  handlePageResponse(
    data: PaginateResponse,
    localws: WebSocketAdapter,
    subjectBrowse: Subject<[number, SkipBlock[]]>
  ) {
    if (data.errorcode != 0) {
      console.log(
        `got an error with code ${data.errorcode} : ${data.errortext}`
      );
      return 1;
    }
    if (localws !== undefined) {
      this.ws = localws;
    }
    subjectBrowse.next([data.pagenumber, data.blocks]);
    return 0;
  }

  /***** Utils *****/
  // Source: https://stackoverflow.com/a/1152508
  getRandomColor() {
    return (
      "#" + (0x1000000 + Math.random() * 0xffffff).toString(16).substr(1, 6)
    );
  }
}
