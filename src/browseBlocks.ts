import { Roster, WebSocketAdapter } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { WebSocketConnection } from "@dedis/cothority/network/connection";
import { ByzCoinRPC, Instruction, Argument } from "@dedis/cothority/byzcoin";
import {
  PaginateResponse,
  PaginateRequest,
} from "@dedis/cothority/byzcoin/proto/stream";
import { Subject } from "rxjs";
import { DataBody } from "@dedis/cothority/byzcoin/proto";
import { Observable } from "rxjs";
import * as d3 from "d3";
import { xml } from "d3";

export class BrowseBlocks {
  svgWidth: number;
  svgHeight: number;

  blockPadding: number;
  blockWidth: number;
  blockHeight: number;

  textColor: string;
  blockColor: string;
  validColor: string;
  invalidColor: string;

  nbBlocksLoaded: number;

  windowWidth: number;

  indexFirstBlockToDisplay: number;

  roster: Roster;
  ws: WebSocketAdapter;

  pageSizeNB: number;
  numPagesNB: number;

  subjectBrowse: Subject<[number, SkipBlock[]]>;

  listBlocks: SkipBlock[];

  svgBlocks: any;

  constructor(roster: Roster) {
    this.roster = roster;

    this.svgWidth = window.innerWidth;
    this.svgHeight = 400;

    this.blockPadding = 10;
    this.blockWidth = 300;
    this.blockHeight = 300;

    this.textColor = "black";
    this.blockColor = "#236ddb";
    this.validColor = "#0cf01b";
    this.invalidColor = "#ed0e19";

    this.nbBlocksLoaded = 0;

    this.windowWidth = window.screen.width;

    this.indexFirstBlockToDisplay = 0;

    this.pageSizeNB = 15;
    this.numPagesNB = 1;

    this.subjectBrowse = new Subject<[number, SkipBlock[]]>();
    let lastBlockID: string;

    let self = this;
    this.svgBlocks = d3
      .select(".blocks")
      .attr("width", this.svgWidth)
      .attr("height", this.svgHeight)
      .call(
        d3.zoom().on("zoom", function () {
          self.svgBlocks.attr("transform", d3.event.transform);
          console.log(
            "d3 x " + d3.event.transform.x + " d3 zoom " + d3.event.transform.k
          );
          let x = d3.event.transform.x;
          let zoom_level = d3.event.transform.k;

          let xMax =
            self.nbBlocksLoaded * (self.blockWidth + self.blockPadding);
          xMax -= self.windowWidth + self.blockWidth;
          xMax *= -zoom_level;
          console.log("X " + x + " XMAX " + xMax + " zoom level " + zoom_level);
          if (x < xMax) {
            console.log("onzoom getnextblocks");
            //lock zoom
            //self.svgBlocks.attr("transform", undefined) // TODO

            self.getNextBlocks(
              lastBlockID,
              self.pageSizeNB,
              self.numPagesNB,
              self.subjectBrowse
            );
          }
        })
      )
      .append("g");

    this.subjectBrowse.subscribe({
      next: ([i, skipBlocks]) => {
        console.log("i: " + i);
        // i : num page

        if (i == this.numPagesNB - 1) {
          lastBlockID = skipBlocks[skipBlocks.length - 1].hash.toString("hex");
          console.log("lastBlockID " + lastBlockID);

          // k is the zoom level
          this.displayBlocks(skipBlocks, this.svgBlocks, this.getRandomColor());

          //this.svgBlocks.attr("transform", d3.event.transform); // TODO
        }
      },
      complete: () => {
        console.log("Fin de la Blockchain");
        console.log("closed");
      },
      error: (err: any) => {
        console.log("error: ", err);
        if (err === 1) {
          console.log("Browse recall: " + 1);
          this.ws = undefined; //To reset the websocket, create a new handler for the next function (of getnextblock)
        }
      },
    });
  }

  main() {
    console.log("test main browseBlocks");
    let temp = 0;
    const self = this;

    let firstBlockID =
      "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";

    this.getNextBlocks(
      firstBlockID,
      this.pageSizeNB,
      this.numPagesNB,
      this.subjectBrowse
    );
  }

  placeText(pos: number): number {
    return 25 + pos * 30;
  }

  loaderAnimation(svgBlocks: any) {
    console.log("loader after block " + this.pageSizeNB); // TODO remove
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

  /**
   *
   * @param {*} todo list of blocks with their attributes
   * @param {*} svgBlocks svg class that will contain the blocks
   * @param {*} blockColor color of the blocks
   * @param {*} start index of the first block to display
   * @param {*} end index of the last block to display
   */

  displayBlocks(listBlocks: SkipBlock[], svgBlocks: any, blockColor: string) {
    for (let i = 0; i < listBlocks.length; ++i, ++this.nbBlocksLoaded) {
      const x_translate =
        (this.blockWidth + this.blockPadding) * (this.nbBlocksLoaded + 1);
      const block = listBlocks[i];
      console.log("display block number " + block.index); // TODO remove

      svgBlocks
        .append("rect") // for each block, append it inside the svg container
        .attr("width", this.blockWidth)
        .attr("height", this.blockHeight)
        .attr("y", 25)
        .attr("transform", function (d: any) {
          let translate = [x_translate, 0];
          return "translate(" + translate + ")";
        })
        .attr("fill", blockColor);

      svgBlocks
        .append("text")
        .attr("x", x_translate + 5)
        .attr("y", this.placeText(1))
        .text("block id: " + block.index)
        .attr("font-family", "sans-serif")
        .attr("font-size", "18px")
        .attr("fill", this.textColor);

      svgBlocks
        .append("text")
        .attr("x", x_translate + 5)
        .attr("y", this.placeText(2))
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

      svgBlocks
        .append("text")
        .attr("x", x_translate + 5)
        .attr("y", this.placeText(3))
        .text(function (d: any) {
          return "date: 3"; // + block.date;
        })
        .attr("font-family", "sans-serif")
        .attr("font-size", "18px")
        .attr("fill", this.textColor);

      svgBlocks
        .append("text")
        .attr("x", x_translate + 5)
        .attr("y", this.placeText(4))
        .text(function (d: any) {
          let hash = block.hash.toString("hex");
          return "hash: " + hash.slice(0, 6) + "...";
        })
        .attr("font-family", "sans-serif")
        .attr("font-size", "18px")
        .attr("fill", this.textColor);
    }
  }

  // Source: https://stackoverflow.com/a/1152508
  getRandomColor() {
    return (
      "#" + (0x1000000 + Math.random() * 0xffffff).toString(16).substr(1, 6)
    );
  }

  hex2Bytes(hex: string) {
    if (!hex) {
      return Buffer.allocUnsafe(0);
    }

    return Buffer.from(hex, "hex");
  }

  getNextBlocks(
    nextID: string,
    pageSizeNB: number,
    numPagesNB: number,
    subjectBrowse: Subject<[number, SkipBlock[]]>
  ) {
    console.log("next id " + nextID);
    var bid: Buffer;
    let nextIDB = nextID;

    try {
      bid = this.hex2Bytes(nextID);
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
        pagesize: pageSizeNB,
        numpages: numPagesNB,
        backward: false,
      });

      const messageByte = Buffer.from(message.$type.encode(message).finish());
      this.ws.send(messageByte); //fetch next block
    } else {
      conn
        .sendStream<PaginateResponse>( //fetch next block
          new PaginateRequest({
            startid: bid,
            pagesize: pageSizeNB,
            numpages: numPagesNB,
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
}
