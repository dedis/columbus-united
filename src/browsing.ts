import { ByzCoinRPC, Instruction } from '@dedis/cothority/byzcoin';
import { DataBody } from '@dedis/cothority/byzcoin/proto';
import { PaginateRequest, PaginateResponse } from '@dedis/cothority/byzcoin/proto/stream';
import { Roster, WebSocketAdapter } from '@dedis/cothority/network';
import { WebSocketConnection } from '@dedis/cothority/network/connection';
import { SkipBlock } from '@dedis/cothority/skipchain';
import * as d3 from 'd3';
import { Subject } from 'rxjs';

export class Browsing {
  roster: Roster;
  ws: WebSocketAdapter;
  pageSize: number;
  numPages: number;
  nextIDB: string;
  totalBlocks: number;
  seenBlocks: number;
  contractID: string;
  instanceSearch: Instruction;

  myProgress: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  myBar: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  barText: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  firstBlockIDStart: string;

  constructor(roster: Roster) {
    this.roster = roster;

    this.pageSize = 15;
    this.numPages = 15;

    this.nextIDB = "";
    this.totalBlocks = 36650;
    this.seenBlocks = 0;

    this.contractID = "";
    this.instanceSearch = null;

    this.myProgress = undefined;
    this.myBar = undefined;
    this.barText = undefined;
    this.firstBlockIDStart =
      "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";
  }

  public getInstructionObserver(
    instance: Instruction
  ): [Subject<[string[], Instruction[]]>, Subject<number>] {
    const subjectInstruction = new Subject<[string[], Instruction[]]>();
    const subjectProgress = new Subject<number>();
    this.ws = undefined;
    this.nextIDB = "";
    this.seenBlocks = 0;
    this.instanceSearch = instance;
    this.contractID = this.instanceSearch.instanceID.toString("hex");
    let firstBlockIDStart =
      "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";
    this.browse(this.pageSize, this.numPages, firstBlockIDStart, subjectInstruction, subjectProgress, [], []);
    return [subjectInstruction, subjectProgress]
  }

  private browse(
    pageSizeB: number,
    numPagesB: number,
    firstBlockID: string,
    subjectInstruction: Subject<[string[], Instruction[]]>,
    subjectProgress: Subject<number>,
    hashB: string[],
    instructionB: Instruction[]
  ) {
    var subjectBrowse = new Subject<[number, SkipBlock]>();
    var pageDone = 0;
    subjectBrowse.subscribe({
      next: ([i, skipBlock]) => {
        const body = DataBody.decode(skipBlock.payload);
        body.txResults.forEach((transaction, i) => {
          transaction.clientTransaction.instructions.forEach(
            (instruction, j) => {
              if (instruction.type === Instruction.typeSpawn) {
                if (
                  instruction.deriveId("").toString("hex") === this.contractID
                ) {
                  hashB.push(skipBlock.hash.toString("hex"));
                  instructionB.push(instruction);
                }
              } else if (
                instruction.instanceID.toString("hex") === this.contractID
              ) {
                hashB.push(skipBlock.hash.toString("hex"));
                instructionB.push(instruction);
              }
            }
          );
        });
        if (i == pageSizeB) {
          pageDone++;
          if (pageDone == numPagesB) {
            if (skipBlock.forwardLinks.length != 0 ) {
              this.nextIDB = skipBlock.forwardLinks[0].to.toString("hex");
              pageDone = 0;
              this.getNextBlocks(
                this.nextIDB,
                pageSizeB,
                numPagesB,
                subjectBrowse,
                subjectProgress
              );
            } else {
              subjectBrowse.complete();
            }
          }
        }
      },
      complete: () => {
        console.log("Fin de la Blockchain");
        console.log("closed");
        subjectInstruction.next([hashB, instructionB]);
      },
      error: (err: any) => {
        console.log("error: ", err);
        if (err === 1) {
          console.log("Browse recall: " + 1);
          this.ws = undefined; //To reset the websocket, create a new handler for the next function (of getnextblock)
          this.browse(
            1,
            1,
            this.nextIDB,
            subjectInstruction,
            subjectProgress,
            hashB,
            instructionB
          );
        }
      },
    });
    this.getNextBlocks(firstBlockID, pageSizeB, numPagesB, subjectBrowse, subjectProgress);
    return subjectBrowse;
  }

  private getNextBlocks(
    nextID: string,
    pageSizeNB: number,
    numPagesNB: number,
    subjectBrowse: Subject<[number, SkipBlock]>, 
    subjectProgress: Subject<number>
  ) {
    var bid: Buffer;
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
            var ret = this.handlePageResponse(data, ws, subjectBrowse, subjectProgress);
            if (ret == 1) {
              console.log("Error Handling with a return 1");
              subjectBrowse.error(1);
            }
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

  private handlePageResponse(
    data: PaginateResponse,
    localws: WebSocketAdapter,
    subjectBrowse: Subject<[number, SkipBlock]>,
    subjectProgress: Subject<number>
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
    var runCount = 0;
    for (var i = 0; i < data.blocks.length; i++) {
      this.seenBlocks++;
      console.log("seenblocks: "+this.seenBlocks)
      //this.updateProgressBar(this.seenBlocks, subjectProgress);
      runCount++;
      var block = data.blocks[i];
      subjectBrowse.next([runCount, block]);
    }
    return 0;
  }

  /*private updateProgressBar(i: number, subjectProgress: Subject<number>) {

    if(i % (0.01*this.totalBlocks) == 0){
      console.log("Tu es dans le if "+ i)
      let percent : number = ~~((i / this.totalBlocks) * 100)
      subjectProgress.next(percent)
    }
  }
*/
  private hex2Bytes(hex: string) {
    if (!hex) {
      return Buffer.allocUnsafe(0);
    }

    return Buffer.from(hex, "hex");
  }
}
