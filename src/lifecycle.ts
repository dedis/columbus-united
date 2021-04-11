import { ByzCoinRPC, Instruction } from "@dedis/cothority/byzcoin";
import { DataBody } from "@dedis/cothority/byzcoin/proto";
import {
    PaginateRequest,
    PaginateResponse,
} from "@dedis/cothority/byzcoin/proto/stream";
import { Roster, WebSocketAdapter } from "@dedis/cothority/network";
import { WebSocketConnection } from "@dedis/cothority/network";
import { ForwardLink, SkipBlock } from "@dedis/cothority/skipchain";
import { Observable, Subject } from "rxjs";
import { finalize, take } from "rxjs/operators";

import { Flash } from "./flash";
import { TotalBlock } from "./totalBlock";
import { Utils } from "./utils";

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
 * @author Lucas Trognon <lucas.trognon@epfl.ch>
 * @export
 * @class Lifecycle
 */
export class Lifecycle {
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
    firstBlockIDStart: string;

    abort: boolean;
    flash: Flash;

    /**
     * Creates an instance of Browsing.
     * @param {Roster} roster
     * @param {Flash} flash
     * @param {TotalBlock} totalBlock
     * @param {string} initialBlockHash
     * @memberof Browsing
     */
    constructor(
        roster: Roster,
        flash: Flash,
        totalBlock: TotalBlock,
        initialBlockHash: string
    ) {
        this.roster = roster;

        this.pageSize = 10;
        this.numPages = 1;
        this.totatBlockNumber = -1;
        this.totalBlocks = totalBlock;
        this.seenBlocks = 0;
        this.nbInstanceFound = 0;

        this.nextIDB = "";
        this.contractID = "";
        this.firstBlockIDStart = initialBlockHash;

        this.flash = flash;
        this.abort = false;
    }
    /**
     * This method is the start of the browsing from the first block. It
     * will (re)sets all the parameters needed to start a new browsing.
     * It will return a tuple with two Subjects:
     * 1) Subject of tuple with the blocks and instructions of the
     * instruction given as parameter.
     * 2) Subject of array of numbers corresponding of: the percent of
     * the progress,the number of blocks seen, the totat number of blocks,
     * the number of instance found: used to update the loading screen.
     *
     * @param {Instruction} instance : the instruction that we wish to search
     *                                in the blockchain
     *
     * @returns {[Subject<[SkipBlock[], Instruction[]]>, Subject<number[]>]}:
     * @memberof Browsing
     */
    getInstructionSubject(
        instanceID: string,
        maxNumberOfBlocks: number = -1,
        initHash: string //Added
    ): [Subject<[SkipBlock[], Instruction[]]>, Subject<number[]>] {
        const self = this;

        const subjectInstruction = new Subject<[SkipBlock[], Instruction[]]>();
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

        this.contractID = instanceID;

        this.abort = false;

        //modified -> recherche all ! recherche nombre 
        if(maxNumberOfBlocks == -1){
            this.browse(
                this.pageSize,
                this.numPages,
                this.firstBlockIDStart, //modified
                subjectInstruction,
                subjectProgress,
                [],
                [],
                maxNumberOfBlocks,
                false //direction of the search, backward= true -> forward = false
            );

        } else {
            this.browse(
                this.pageSize,
                this.numPages,
                initHash, //modified
                subjectInstruction,
                subjectProgress,
                [],
                [],
                maxNumberOfBlocks,
                true
            );

        }
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
     * @param {Subject<[SkipBlock[], Instruction[]]>} subjectInstruction : Subject
     *                                            for the instruction
     * @param {Subject<number[]>} subjectProgress : Subject for the loading
     * @param {SkipBlock[]} skipBlocksSubject : Accumulator for the subjectInstruction
     * @param {Instruction[]} instructionB : Accumulator for the subjectInstruction
     * @param {number} maxNumberOfBlocks : Max number of blocks requested
     * @memberof Browsing
     */
    private browse(
        pageSizeB: number,
        numPagesB: number,
        firstBlockID: string,
        subjectInstruction: Subject<[SkipBlock[], Instruction[]]>,
        subjectProgress: Subject<number[]>,
        skipBlocksSubject: SkipBlock[],
        instructionB: Instruction[],
        maxNumberOfBlocks: number,
        direction: boolean //added search direction
    ) {
        const subjectBrowse = new Subject<[number, SkipBlock]>();
        const transactionFound = new Subject<number>();
        let pageDone = 0;
        subjectBrowse.subscribe({
            complete: () => {
                this.flash.display(
                    Flash.flashType.INFO,
                    `End of the browsing of the instance ID: ${this.contractID}`
                );
                subjectInstruction.next([skipBlocksSubject, instructionB]);
            },

            error: (data: PaginateResponse) => {
                // tslint:disable-next-line
                if (data.errorcode == 5) {
                    // if errorcode is 5: too many blocks requested => rebrowse with less blocks
                    this.ws = undefined;
                    this.browse(
                        1,
                        1,
                        this.nextIDB,
                        subjectInstruction,
                        subjectProgress,
                        skipBlocksSubject,
                        instructionB,
                        maxNumberOfBlocks,
                        direction
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
                            if (
                                Utils.bytes2String(instruction.instanceID) ===
                                this.contractID //modified
                            ) {
                                // get the hashes and instruction corresponding to the input instruction
                                this.nbInstanceFound++;
                                //transactionFound.next(this.nbInstanceFound);

                                if (
                                    this.nbInstanceFound <= maxNumberOfBlocks && //modified
                                    !this.abort
                                ) {
                                    skipBlocksSubject.push(skipBlock);
                                    instructionB.push(instruction);

                                    console.log(
                                        "Instance found : ",
                                        this.nbInstanceFound,
                                        " out of ",
                                        maxNumberOfBlocks
                                    );
                                }
                                // else{
                                //     subjectBrowse.complete();
                                //     subjectProgress.complete();
                                //     subjectInstruction.complete();
                                // }
                                transactionFound.next(this.nbInstanceFound);
                            }
                        }
                    );
                });
                if (i === pageSizeB) {
                    pageDone++;
                    if (pageDone >= numPagesB) {
                        // condition to end the browsing
                        if ( // added skipBlock.backlinks.length !=0
                            (skipBlock.forwardLinks.length !== 0 || skipBlock.backlinks.length !=0) &&
                            !this.abort
                        ) {
                            this.nextIDB = (maxNumberOfBlocks!= -1) ? Utils.bytes2String(
                                skipBlock.backlinks[0] //modified was .to
                            ) : Utils.bytes2String(
                                skipBlock.forwardLinks[0].to); //was modified
                            
                            pageDone = 0;
                            this.getNextBlocks(
                                this.nextIDB,
                                pageSizeB,
                                numPagesB,
                                subjectBrowse,
                                subjectProgress,
                                direction
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
        if (maxNumberOfBlocks > 0) {
            transactionFound
                .pipe(
                    take(maxNumberOfBlocks),
                    finalize(() => {
                        this.abort = true;
                    })
                )
                .subscribe();
        }
        this.getNextBlocks(
            firstBlockID,
            pageSizeB,
            numPagesB,
            subjectBrowse,
            subjectProgress,
            direction
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
        subjectProgress: Subject<number[]>,
        direction: boolean //direction search
    ) {
        let bid: Buffer;
        try {
            bid = Utils.hex2Bytes(nextID);
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

                pagesize: pageSizeNB, // tslint:disable-next-line
                numpages: numPagesNB,
                backward: direction, // modifed was false
            });

            const messageByte = Buffer.from(
                message.$type.encode(message).finish()
            );
            this.ws.send(messageByte); // fetch next block
        } else {
            // create a new websocket connection to be faster for the next requests
            conn.sendStream<PaginateResponse>( // fetch next block
                new PaginateRequest({
                    startid: bid,

                    pagesize: pageSizeNB, // tslint:disable-next-line
                    numpages: numPagesNB,
                    backward: direction, //modified was false
                }),
                PaginateResponse
            ).subscribe({
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
}
