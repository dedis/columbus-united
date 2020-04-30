import { Roster, WebSocketAdapter } from '@dedis/cothority/network';
import { SkipBlock } from '@dedis/cothority/skipchain';
import { WebSocketConnection } from '@dedis/cothority/network/connection';
import { ByzCoinRPC, Instruction, Argument } from '@dedis/cothority/byzcoin';
import { PaginateResponse, PaginateRequest } from '@dedis/cothority/byzcoin/proto/stream';
import { Subject, Observable, Subscriber } from 'rxjs';
import { DataBody } from '@dedis/cothority/byzcoin/proto';
import * as d3 from 'd3';

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

    constructor(roster: Roster) {
        this.roster = roster;

        this.pageSize = 15
        this.numPages = 15

        this.nextIDB = ""
        this.totalBlocks = 36650
        this.seenBlocks = 0

        this.contractID = ""
        this.instanceSearch = null

        this.myProgress = undefined
        this.myBar = undefined
        this.barText = undefined
    }

    public getInstructionObserver(instance: Instruction): Observable<[string[], Instruction[]]> {
        return new Observable((sub) => {
            this.createProgressBar()
            this.ws = undefined
            this.nextIDB = ""
            this.seenBlocks = 0
            this.instanceSearch = instance
            this.contractID = this.instanceSearch.instanceID.toString("hex")
            let firstBlockIDStart = "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3"
            this.browse(this.pageSize, this.numPages, firstBlockIDStart, sub, [], [])
        })
    }

    private browse(pageSizeB: number,
        numPagesB: number, firstBlockID: string, subscriberInstruction: Subscriber<[string[], Instruction[]]>, hashB: string[], instructionB: Instruction[]) {

        var subjectBrowse = new Subject<[number, SkipBlock]>();
        var pageDone = 0;
        subjectBrowse.subscribe({
            next: ([i, skipBlock]) => {
                const body = DataBody.decode(skipBlock.payload)
                body.txResults.forEach((transaction, i) => {
                    transaction.clientTransaction.instructions.forEach((instruction, j) => {
                        if (instruction.spawn !== null) {
                            if (instruction.deriveId("").toString("hex") === this.contractID) {
                                hashB.push(skipBlock.hash.toString("hex"))
                                instructionB.push(instruction)
                            }
                        } else if (instruction.instanceID.toString("hex") === this.contractID) {
                            hashB.push(skipBlock.hash.toString("hex"))
                            instructionB.push(instruction)
                        }
                    });
                });
                if (i == pageSizeB) {
                    pageDone++;
                    if (pageDone == numPagesB) {
                        if (skipBlock.forwardLinks.length != 0 && this.seenBlocks < 1000) {
                            this.nextIDB = skipBlock.forwardLinks[0].to.toString("hex");
                            pageDone = 0;
                            this.getNextBlocks(this.nextIDB, pageSizeB, numPagesB, subjectBrowse);

                        } else {
                            subjectBrowse.complete()
                        }
                    }
                }
            },
            complete: () => {
                console.log("Fin de la Blockchain")
                console.log("closed")
                subscriberInstruction.next([hashB, instructionB])
            },
            error: (err: any) => {
                console.log("error: ", err);
                if (err === 1) {
                    console.log("Browse recall: " + 1)
                    this.ws = undefined //To reset the websocket, create a new handler for the next function (of getnextblock)
                    this.browse(1, 1, this.nextIDB, subscriberInstruction, hashB, instructionB)
                }
            }
        });
        this.getNextBlocks(firstBlockID, pageSizeB, numPagesB, subjectBrowse);
        return subjectBrowse
    }

    private getNextBlocks(
        nextID: string,
        pageSizeNB: number,
        numPagesNB: number,
        subjectBrowse: Subject<[number, SkipBlock]>) {
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
                backward: false
            });

            const messageByte = Buffer.from(message.$type.encode(message).finish());
            this.ws.send(messageByte);  //fetch next block

        } else {
            conn.sendStream<PaginateResponse>(  //fetch next block
                new PaginateRequest({
                    startid: bid,
                    pagesize: pageSizeNB,
                    numpages: numPagesNB,
                    backward: false
                }),
                PaginateResponse).subscribe({
                    // ws callback "onMessage":
                    next: ([data, ws]) => {
                        var ret = this.handlePageResponse(data, ws, subjectBrowse)
                        if (ret == 1) {
                            console.log("Error Handling with a return 1")
                            subjectBrowse.error(1)
                        }
                    },
                    complete: () => {
                        console.log("closed");
                    },
                    error: (err: Error) => {
                        console.log("error: ", err);
                        this.ws = undefined;
                    }
                });
        }
    }

    private handlePageResponse(data: PaginateResponse, localws: WebSocketAdapter, subjectBrowse: Subject<[number, SkipBlock]>) {
        if (data.errorcode != 0) {
            console.log(
                `got an error with code ${data.errorcode} : ${data.errortext}`
            );
            return 1;
        }
        if (localws !== undefined) {
            this.ws = localws
        }
        var runCount = 0;
        for (var i = 0; i < data.blocks.length; i++) {
            this.seenBlocks++
            this.updateProgressBar(this.seenBlocks)
            runCount++;
            var block = data.blocks[i]
            subjectBrowse.next([runCount, block]);
        }
        return 0;
    }

    private createProgressBar() {
        if (this.myProgress == undefined && this.myBar == undefined) {
            this.myProgress = d3.select("body").append("div").attr("id", "myProgress")
            this.myBar = this.myProgress.append("div").attr("id", "myBar")
            this.barText = this.myBar.append("div").attr("id", "barText").text("0%")
        } else {
            var myBarElement = document.getElementById("myBar")
            myBarElement.style.width = 1 + "%"
        }
    }

    private updateProgressBar(i: number) {
        this.barText.text(((i / this.totalBlocks) * 100).toFixed(0) + "%")
        document.getElementById("myBar").style.width = (i / this.totalBlocks) * 100 + "%"
    }

    private hex2Bytes(hex: string) {
        if (!hex) {
            return Buffer.allocUnsafe(0);
        }

        return Buffer.from(hex, "hex");
    }
}