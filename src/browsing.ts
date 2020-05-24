import { ByzCoinRPC, Instruction } from "@dedis/cothority/byzcoin";
import { DataBody } from "@dedis/cothority/byzcoin/proto";
import {
  PaginateRequest,
  PaginateResponse,
} from "@dedis/cothority/byzcoin/proto/stream";
import { Roster, WebSocketAdapter } from "@dedis/cothority/network";
import { WebSocketConnection } from "@dedis/cothority/network/connection";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { Subject } from "rxjs";
import { Flash } from "./flash";
import { TotalBlock } from "./totalBlock";
/**
 * Create browsing which will browse the blockchain from the
 * first block to the last and gets the instructions that
 * contains the contractID given. It will notify through
 * Subjects:
 * 1) the hashes of the blocks and the instructions with
 * the contractID
 * 2) The percent of the progress,the number of blocks seen,
 * the totat number of blocks, the number of instance found
 *
 * @author Julien von Felten <julien.vonfelten@epfl.ch>
 * @export
 * @class Browsing
 */
export class Browsing {
  roster: Roster;
  ws: WebSocketAdapter;

  pageSize: number;
  numPages: number;
  totatBlockNumber: number;
  totalBlocks: TotalBlock;
  seenBlocks: number;
  nbInstanceFound: number;

  nextIDB: string;
  contractID: string;
  instanceSearch: Instruction;
  firstBlockIDStart: string;

  abort: boolean;
  flash: Flash;

  /**
   * Creates an instance of Browsing.
   * @param {Roster} roster
   * @param {Flash} flash
   * @param {TotalBlock} totalBlock
   * @memberof Browsing
   */
  constructor(roster: Roster, flash: Flash, totalBlock: TotalBlock) {
    this.roster = roster;

    this.pageSize = 15;
    this.numPages = 15;
    this.totatBlockNumber = -1;
    this.totalBlocks = totalBlock;
    this.seenBlocks = 0;
    this.nbInstanceFound = 0;

    this.nextIDB = "";
    this.contractID = "";
    this.instanceSearch = null;
    this.firstBlockIDStart =
      "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";

    this.flash = flash;
    this.abort = false;
  }
  /**
   * This method is the start of the browsing from the first block. It
   * will (re)sets all the parameters needed to start a new browsing.
   * It will return a tuple with two Subjects:
   * 1) Subject of tuple with the hashes and instructions of the
   * instruction given as parameter.
   * 2) Subject of array of numbers corresponding of: the percent of
   * the progress,the number of blocks seen, the totat number of blocks,
   * the number of instance found: used to update the loading screen.
   *
   * @param {Instruction} instance : the instruction that we wish to search
   *                                in the blockchain
   *
   * @returns {[Subject<[string[], Instruction[]]>, Subject<number[]>]}:
   * @memberof Browsing
   */
  getInstructionSubject(
    instance: Instruction
  ): [Subject<[string[], Instruction[]]>, Subject<number[]>] {
    const self = this;
    const subjectInstruction = new Subject<[string[], Instruction[]]>();
    const subjectProgress = new Subject<number[]>();

    this.ws = undefined;

    this.totalBlocks.getTotalBlock().subscribe({
      next: (skipblock) => {
        self.totatBlockNumber = skipblock.index;
      },
    });
    this.seenBlocks = 0;
    this.nbInstanceFound = 0;

    this.nextIDB = "";
    this.contractID = this.instanceSearch.instanceID.toString("hex");
    this.instanceSearch = instance;

    this.abort = false;

    this.browse(
      this.pageSize,
      this.numPages,
      this.firstBlockIDStart,
      subjectInstruction,
      subjectProgress,
      [],
      []
    );
    return [subjectInstruction, subjectProgress];
  }

  /**
   * This function is the core of the class: it will browse from firstBlockID
   * until it receives an error. Then it will recusively browse from the error
   * to the end with pageSize and numPages equal to 1. It will notify all the subjects.
   *
   * @private
   * @param {number} pageSizeB : Number of blocks inside one page
   * @param {number} numPagesB : Number of pages requested
   * @param {string} firstBlockID : hash of the start of browsing
   * @param {Subject<[string[], Instruction[]]>} subjectInstruction : Subject
   *                                            for the instruction
   * @param {Subject<number[]>} subjectProgress : Subject for the loading
   * @param {string[]} hashB : Accumulator for the subjectInstruction
   * @param {Instruction[]} instructionB : Accumulator for the subjectInstruction
   * @memberof Browsing
   */
  private browse(
    pageSizeB: number,
    numPagesB: number,
    firstBlockID: string,
    subjectInstruction: Subject<[string[], Instruction[]]>,
    subjectProgress: Subject<number[]>,
    hashB: string[],
    instructionB: Instruction[]
  ) {
    const subjectBrowse = new Subject<[number, SkipBlock]>();
    let pageDone = 0;
    subjectBrowse.subscribe({
      complete: () => {
        this.flash.display(
          Flash.flashType.INFO,
          `End of the browsing of the instance ID: ${this.contractID}`
        );
        subjectInstruction.next([hashB, instructionB]);
      },

      error: (data: PaginateResponse) => {
        // tslint:disable-next-line
        if (data.errorcode == 5) {
          // if errorcode is 5: too many blocks requested => rebrowse with less blocks
          this.ws = undefined;
          this.flash.display(
            Flash.flashType.INFO,
            `error code ${data.errorcode} : ${data.errortext}`
          );
          this.browse(
            1,
            1,
            this.nextIDB,
            subjectInstruction,
            subjectProgress,
            hashB,
            instructionB
          );
        } else {
          this.flash.display(
            Flash.flashType.ERROR,
            `error code ${data.errorcode} : ${data.errortext}`
          );
        }
      },

      next: ([i, skipBlock]) => {
        const body = DataBody.decode(skipBlock.payload);
        body.txResults.forEach((transaction, _) => {
          transaction.clientTransaction.instructions.forEach(
            // tslint:disable-next-line
            (instruction, _) => {
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
                // get the hashes and instruction corresponding to the input instruction
                this.nbInstanceFound++;
                hashB.push(skipBlock.hash.toString("hex"));
                instructionB.push(instruction);
              }
            }
          );
        });

        if (i === pageSizeB) {
          pageDone++;
          if (pageDone === numPagesB) {
            // condition to end the browsing
            if (skipBlock.forwardLinks.length !== 0 && !this.abort) {
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
              // complete all subjects at the end of the browsing
              subjectBrowse.complete();
              subjectProgress.complete();
              subjectInstruction.complete();
            }
          }
        }
      },
    });
    this.getNextBlocks(
      firstBlockID,
      pageSizeB,
      numPagesB,
      subjectBrowse,
      subjectProgress
    );
  }
  /**
   * Request the (pageSizeNB * numPagesNB) next blocks from nextID
   * and notify the subjectBrowse
   *
   * @private
   * @param {string} nextID
   * @param {number} pageSizeNB
   * @param {number} numPagesNB
   * @param {Subject<[number, SkipBlock]>} subjectBrowse
   * @param {Subject<number[]>} subjectProgress
   * @returns : only if an error occur
   * @memberof Browsing
   */
  private getNextBlocks(
    nextID: string,
    pageSizeNB: number,
    numPagesNB: number,
    subjectBrowse: Subject<[number, SkipBlock]>,
    subjectProgress: Subject<number[]>
  ) {
    let bid: Buffer;
    try {
      bid = this.hex2Bytes(nextID);
    } catch (error) {
      this.flash.display(
        Flash.flashType.ERROR,
        `failed to parse the block ID: ${error}`
      );
      return;
    }

    try {
      // tslint:disable-next-line
      var conn = new WebSocketConnection(
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
        startid: bid,
        // tslint:disable-next-line
        pagesize: pageSizeNB,
        numpages: numPagesNB,
        backward: false,
      });

      const messageByte = Buffer.from(message.$type.encode(message).finish());
      this.ws.send(messageByte); // fetch next block
    } else {
      // create a new websocket connection to be faster for the next requests
      conn
        .sendStream<PaginateResponse>( // fetch next block
          new PaginateRequest({
            startid: bid,
            // tslint:disable-next-line
            pagesize: pageSizeNB,
            numpages: numPagesNB,
            backward: false,
          }),
          PaginateResponse
        )
        .subscribe({
          complete: () => {
            this.flash.display(Flash.flashType.INFO, "closed");
          },
          error: (err: Error) => {
            this.flash.display(Flash.flashType.ERROR, `error: ${err}`);
            this.ws = undefined;
          },
          // ws callback "onMessage":
          next: ([data, ws]) => {
            const ret = this.handlePageResponse(
              data,
              ws,
              subjectBrowse,
              subjectProgress
            );
            if (ret === 1) {
              subjectBrowse.error(data);
            }
          },
        });
    }
  }

  /**
   * Handle the PaginateResponse of the PaginateRequest
   * to split the blocks and notify the subjectBrowse
   * of each block. It also notify the progress
   * to the subjectProgress
   *
   * @private
   * @param {PaginateResponse} data
   * @param {WebSocketAdapter} localws
   * @param {Subject<[number, SkipBlock]>} subjectBrowse
   * @param {Subject<number[]>} subjectProgress
   * @returns
   * @memberof Browsing
   */
  private handlePageResponse(
    data: PaginateResponse,
    localws: WebSocketAdapter,
    subjectBrowse: Subject<[number, SkipBlock]>,
    subjectProgress: Subject<number[]>
  ) {
    // tslint:disable-next-line
    if (data.errorcode != 0) {
      return 1;
    }
    // Update the websocket to be faster for the next requests
    if (localws !== undefined) {
      this.ws = localws;
    }
    let runCount = 0;
    for (const block of data.blocks) {
      this.seenBlocks++;
      this.seenBlocksNotify(this.seenBlocks, subjectProgress);
      runCount++;
      subjectBrowse.next([runCount, block]);
    }
    return 0;
  }

  /**
   * Notify with the different numbers (the percent of
   * the progress,the number of blocks seen, the totat number of blocks,
   * the number of instance found: used to update the loading screen)
   * to the subjectProgress. It will only notify 100 times for each percent
   * thanks to a blackmagic condition
   * (i % ~~(0.01 * this.totatBlockNumber) == 0)
   *
   * @private
   * @param {number} i : the number of block seen
   * @param {Subject<number[]>} subjectProgress
   * @memberof Browsing
   */
  private seenBlocksNotify(i: number, subjectProgress: Subject<number[]>) {
    if (
      this.totatBlockNumber > 0 && // tslint:disable-next-line
      i % ~~(0.01 * this.totatBlockNumber) == 0
    ) {
      // tslint:disable-next-line
      const percent: number = ~~((i / this.totatBlockNumber) * 100);
      subjectProgress.next([
        percent,
        this.seenBlocks,
        this.totatBlockNumber,
        this.nbInstanceFound,
      ]);
    } else if (this.totatBlockNumber < 0) {
      subjectProgress.next([
        0,
        this.seenBlocks,
        this.totatBlockNumber,
        this.nbInstanceFound,
      ]);
    }
  }

  private hex2Bytes(hex: string) {
    if (!hex) {
      return Buffer.allocUnsafe(0);
    }

    return Buffer.from(hex, "hex");
  }
}
