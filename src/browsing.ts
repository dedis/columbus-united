import { ByzCoinRPC, Instruction } from "@dedis/cothority/byzcoin";
import { DataBody } from "@dedis/cothority/byzcoin/proto";
import { PaginateRequest, PaginateResponse } from "@dedis/cothority/byzcoin/proto/stream";
import { Roster, WebSocketAdapter } from "@dedis/cothority/network";
import { WebSocketConnection } from "@dedis/cothority/network/connection";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Subject } from "rxjs";
import { Warning } from './warning';

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

         warning: Warning;
         constructor(roster: Roster, warning:Warning) {
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
           this.warning = warning;
           this.firstBlockIDStart =
             "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";
         }

         getInstructionSubject(
           instance: Instruction
         ): [Subject<[string[], Instruction[]]>, Subject<number>] {
           const subjectInstruction = new Subject<[string[], Instruction[]]>();
           const subjectProgress = new Subject<number>();
           this.ws = undefined;
           this.nextIDB = "";
           this.seenBlocks = 0;
           this.instanceSearch = instance;
           this.contractID = this.instanceSearch.instanceID.toString("hex");
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

         private browse(
           pageSizeB: number,
           numPagesB: number,
           firstBlockID: string,
           subjectInstruction: Subject<[string[], Instruction[]]>,
           subjectProgress: Subject<number>,
           hashB: string[],
           instructionB: Instruction[]
         ) {
           const subjectBrowse = new Subject<[number, SkipBlock]>();
           let pageDone = 0;
           subjectBrowse.subscribe({
             complete: () => {
               this.warning.displaying(3, `End of the browsing of the instance ID: ${this.contractID}`)
               subjectInstruction.next([hashB, instructionB]);
             },
             error: (data: PaginateResponse) => {
               if (data.errorcode == 5) {
                 this.ws = undefined;
                 this.warning.displaying(3, `error code ${data.errorcode} : ${data.errortext}`)

                 this.browse(
                   1,
                   1,
                   this.nextIDB,
                   subjectInstruction,
                   subjectProgress,
                   hashB,
                   instructionB
                 );
               }else{
                 this.warning.displaying(1, `error code ${data.errorcode} : ${data.errortext}`)
               }
             },
             next: ([i, skipBlock]) => {
               const body = DataBody.decode(skipBlock.payload);
               body.txResults.forEach((transaction, _) => {
                 transaction.clientTransaction.instructions.forEach(
                   (instruction, j) => {
                     if (instruction.type === Instruction.typeSpawn) {
                       if (
                         instruction.deriveId("").toString("hex") ===
                         this.contractID
                       ) {
                         hashB.push(skipBlock.hash.toString("hex"));
                         instructionB.push(instruction);
                       }
                     } else if (
                       instruction.instanceID.toString("hex") ===
                       this.contractID
                     ) {
                       hashB.push(skipBlock.hash.toString("hex"));
                       instructionB.push(instruction);
                     }
                   }
                 );
               });
               if (i === pageSizeB) {
                 pageDone++;
                 if (pageDone === numPagesB) {
                   if (skipBlock.forwardLinks.length !== 0) {
                     this.nextIDB = skipBlock.forwardLinks[0].to.toString(
                       "hex"
                     );
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
           });
           this.getNextBlocks(
             firstBlockID,
             pageSizeB,
             numPagesB,
             subjectBrowse,
             subjectProgress
           );
           return subjectBrowse;
         }

         private getNextBlocks(
           nextID: string,
           pageSizeNB: number,
           numPagesNB: number,
           subjectBrowse: Subject<[number, SkipBlock]>,
           subjectProgress: Subject<number>
         ) {
           let bid: Buffer;
           try {
             bid = this.hex2Bytes(nextID);
           } catch (error) {
             this.warning.displaying(1, `failed to parse the block ID: ${error}`)
             return;
           }
           try {
             var conn = new WebSocketConnection(
               this.roster.list[0].getWebSocketAddress(),
               ByzCoinRPC.serviceName
             );
           } catch (error) {
            this.warning.displaying(1, `error creating conn: ${error}`)
             return;
           }
           if (this.ws !== undefined) {
             const message = new PaginateRequest({
               startid: bid,
               pagesize: pageSizeNB,
               numpages: numPagesNB,
               backward: false,
             });

             const messageByte = Buffer.from(
               message.$type.encode(message).finish()
             );
             this.ws.send(messageByte); // fetch next block
           } else {
             conn
               .sendStream<PaginateResponse>( // fetch next block
                 new PaginateRequest({
                   startid: bid,
                   pagesize: pageSizeNB,
                   numpages: numPagesNB,
                   backward: false,
                 }),
                 PaginateResponse
               )
               .subscribe({
                 complete: () => {
                  this.warning.displaying(3, "closed")
                },
                 error: (err: Error) => {
                  this.warning.displaying(1, `error: ${err}`)
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

         private handlePageResponse(
           data: PaginateResponse,
           localws: WebSocketAdapter,
           subjectBrowse: Subject<[number, SkipBlock]>,
           subjectProgress: Subject<number>
         ) {
           if (data.errorcode != 0) {
             return 1;
           }
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

         private seenBlocksNotify(i: number, subjectProgress: Subject<number>) {
           if (i % ~~(0.01 * this.totalBlocks) == 0) {
             const percent: number = ~~((i / this.totalBlocks) * 100);
             subjectProgress.next(percent);
           }
         }

         private hex2Bytes(hex: string) {
           if (!hex) {
             return Buffer.allocUnsafe(0);
           }

           return Buffer.from(hex, "hex");
         }
       }
