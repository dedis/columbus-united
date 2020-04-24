import { Roster, WebSocketAdapter } from '@dedis/cothority/network';
import { SkipBlock } from '@dedis/cothority/skipchain';
import { WebSocketConnection } from '@dedis/cothority/network/connection';
import { ByzCoinRPC, Instruction, Argument } from '@dedis/cothority/byzcoin';
import { PaginateResponse, PaginateRequest } from '@dedis/cothority/byzcoin/proto/stream';
import { Subject } from 'rxjs';
import { DataBody } from '@dedis/cothority/byzcoin/proto';
import * as d3 from 'd3';

export class Browsing {

    roster: Roster;
    ws: WebSocketAdapter;
    firstBlockIDStart: string;
    pageSize: number;
    numPages: number;
    nextIDB: string;
    totalBlocks: number;
    seenBlocks: number;
    matchfound: number;
    contractID: string;
    blocks: SkipBlock[];
    instanceSearch: Instruction;
    container: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
    myProgress: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
    myBar: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
    barText: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;

    constructor(roster: Roster) {
        this.roster = roster;
        this.firstBlockIDStart = "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3" //"a6ace9568618f63df1c77544fafc56037bf249e4749fb287ca82cc55edc008f8" 
        //DELETE contract: 30acb65139f5f9b479eaea33dae7ccf5704b3b0cf446dff1fb5d6b60b95caa59

        /* contract with many spawn : 860df9524de58df307554e65f0bd05cbcaffeb6925e41c2eb58fd1b4fb9a3853*/
        this.pageSize = 15 //combien de blocks je veux          Expliquer que 20/20 est bon car testé deja
        this.numPages = 15 //nombre de requete pour faire du streaming: 50 blocks, en 5 requete asynchrone. 
        //nombre de block total: pagesize * numpages
        this.nextIDB = ""
        this.totalBlocks = 36650
        this.seenBlocks = 0
        this.matchfound = 0

        this.contractID = ""
        this.blocks = []
        this.instanceSearch = null

        this.container = undefined
        this.myProgress = undefined
        this.myBar = undefined
        this.barText = undefined
    }


    sayHi1() {
        //container can be set up later on
        if (!this.roster) {
            console.log("Roster is undefined")
            return;
        }
        this.container = d3.select("body").append("div").attr("id", "container")
        document.getElementById("browse").addEventListener("click", this.browseClick.bind(this))
        console.log("1")
    }

    browseClick(this: Browsing) {
        console.log("2")

        console.log(this)
        this.container.selectAll("details").remove()
        this.ws = undefined
        this.nextIDB = ""
        this.seenBlocks = 0
        this.matchfound = 0
        this.contractID = ""
        this.blocks = []
        var inst = null
        this.createProgressBar()
        this.browse(this.pageSize, this.numPages, this.firstBlockIDStart, inst)
    }

    createProgressBar() {
        console.log("3")

        if (this.myProgress == undefined && this.myBar == undefined) {
            this.myProgress = d3.select("body").append("div").attr("id", "myProgress")
            this.myBar = this.myProgress.append("div").attr("id", "myBar")
            this.barText = this.myBar.append("div").attr("id", "barText").text("0%")
        } else {
            var myBarElement = document.getElementById("myBar")
            myBarElement.style.width = 1 + "%"
        }
    }

    updateProgressBar(i: number) {
        this.barText.text(((i / this.totalBlocks) * 100).toFixed(0) + "%")
        document.getElementById("myBar").style.width = (i / this.totalBlocks) * 100 + "%"
    }

    //Recursive to end the blockchain with any pagesize - numpages numbers : remove condition seenBlocks < 4000 to browse the whole blockchain
    browse(pageSizeB: number,
        numPagesB: number, firstBlockID: string, instance: Instruction) {
            console.log("4")

        this.instanceSearch = instance
        var subjectBrowse = new Subject<[number, SkipBlock]>();
        var pageDone = 0;
        this.contractID = (document.getElementById("contractID") as HTMLInputElement).value
        subjectBrowse.subscribe({
            next: ([i, skipBlock]) => {
                if (i == pageSizeB) {
                    pageDone++;
                    if (pageDone == numPagesB) {
                        if (skipBlock.forwardLinks.length != 0) {
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
            },
            error: (err: any) => {
                console.log("error: ", err);
                if (err === 1) {
                    console.log("Browse recall: " + 1)
                    this.ws = undefined //To reset the websocket, create a new handler for the next function (of getnextblock)
                    this.browse(1, 1, this.nextIDB, this.instanceSearch)
                }
            }
        });
        this.getNextBlocks(firstBlockID, pageSizeB, numPagesB, subjectBrowse);
        return subjectBrowse
    }

    getNextBlocks(
        nextID: string,
        pageSizeNB: number,
        numPagesNB: number,
        subjectBrowse: Subject<[number, SkipBlock]>) {
        var bid: Buffer;
        this.nextIDB = nextID
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

    handlePageResponse(data: PaginateResponse, localws: WebSocketAdapter, subjectBrowse: Subject<[number, SkipBlock]>) {
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
            const payload = block.payload
            const body = DataBody.decode(payload)
            body.txResults.forEach((transaction) => {
                transaction.clientTransaction.instructions.forEach((instruction) => {
                    if (instruction.instanceID.toString("hex") === this.contractID) {
                        console.log("*****************Contract match found*****************")
                        if (!this.blocks.includes(block)) {
                            this.instanceSearch = instruction
                            this.blocks.push(block)
                        }
                        this.printdataConsole(block, data.pagenumber)
                        this.printdataBox(block, data.pagenumber)
                    }
                })
            })
        }
        return 0;
    }

    //function not needed for the merge: printing data in the console. If not taken: remove the call in handlePageResponse
    printdataConsole(block: SkipBlock, pageNum: number) {
        const payload = block.payload
        const body = DataBody.decode(payload)
        console.log("- block: " + this.seenBlocks + ", page " + pageNum + ", hash: " + block.hash.toString(
            "hex"))
        body.txResults.forEach((transaction, i) => {
            console.log("\n-- Transaction: " + i)
            transaction.clientTransaction.instructions.forEach((instruction, j) => {
                console.log("\n--- Instruction " + j)
                console.log("\n---- Hash: " + instruction.hash().toString("hex"))
                console.log("\n---- Instance ID: " + instruction.instanceID.toString("hex"))
                if (instruction.spawn !== null) {
                    console.log("\n---- spawn")

                }
                if (instruction.invoke !== null) {
                    console.log("\n---- invoke")
                }
            });
        });
    }

    printdataBox(block: SkipBlock, pageNum: number) {

        var detailsHTML = this.container.append("details")
        detailsHTML.attr("class", "detailsParent")
        const payload = block.payload
        const body = DataBody.decode(payload)
        body.txResults.forEach((transaction, i) => {
            transaction.clientTransaction.instructions.forEach((instruction, j) => {

                if (instruction.spawn !== null) {
                    detailsHTML.append("summary").text("Spawn with instanceID: " + instruction.instanceID.toString("hex") + ", and Hash is: " + instruction.hash().toString("hex"))
                    detailsHTML.append("p").text("ContractID: " + instruction.spawn.contractID)
                    var argsDetails = detailsHTML.append("details").attr("class", "detailsChild1")
                    argsDetails.append("summary").text("args are:")
                    var my_list = argsDetails.append("ul")
                    instruction.spawn.args.forEach((arg, _) => {
                        my_list.append("li").text("Arg name : " + arg.name)
                        my_list.append("li").text("Arg value : " + arg.value)
                    });
                }
                else if (instruction.invoke !== null) {
                    detailsHTML.append("summary").text("Invoke with instanceID: " + instruction.instanceID.toString("hex") + ", and Hash is: " + instruction.hash().toString("hex"))
                    detailsHTML.append("p").text("ContractID: " + instruction.invoke.contractID)
                    var argsDetails = detailsHTML.append("details").attr("class", "detailsChild1")
                    argsDetails.append("summary").text("args are:")
                    var my_list = argsDetails.append("ul")
                    instruction.invoke.args.forEach((arg, _) => {
                        my_list.append("li").text("Arg name : " + arg.name)
                        my_list.append("li").text("Arg value : " + arg.value)
                    });
                }
                else if (instruction.delete !== null) {
                    detailsHTML.append("summary").text("Delete with instanceID: " + instruction.instanceID.toString("hex") + ", and Hash is: " + instruction.hash().toString("hex"))
                    detailsHTML.append("p").text("ContractID: " + instruction.delete.contractID)
                }

                var verifiersHTML = detailsHTML.append("details").attr("class", "detailsChild1")
                verifiersHTML.append("summary").text("Verifiers: " + block.verifiers.length)
                block.verifiers.forEach((uid, j) => {
                    verifiersHTML.append("p").text("Verifier: " + j + " ID: " + uid.toString("hex"))
                });

                var backlinkHTML = detailsHTML.append("details").attr("class", "detailsChild1")
                backlinkHTML.append("summary").text("Backlinks: " + block.backlinks.length)
                block.backlinks.forEach((value, j) => {
                    backlinkHTML.append("p").text("Backlink: " + j + " Value: " + value.toString("hex"))
                });

                var forwardlinkHTML = detailsHTML.append("details").attr("class", "detailsChild1")
                forwardlinkHTML.append("summary").text("ForwardLinks: " + block.forwardLinks.length)
                block.forwardLinks.forEach((fl, j) => {
                    forwardlinkHTML.append("p").text("ForwardLink: " + j)
                    forwardlinkHTML.append("p").text("From: " + fl.from.toString("hex") + " Hash: " + fl.hash().toString("hex"))
                    forwardlinkHTML.append("p").text("signature: + " + fl.signature.sig.toString("hex"))
                });
            })
        })

        // Fetch all the details element.
        const detailsParent = document.querySelectorAll(".detailsParent");

        // Add the onclick listeners.
        detailsParent.forEach((targetDetail) => {
            targetDetail.addEventListener("click", () => {
                // Close all the details that are not targetDetail.
                detailsParent.forEach((detail) => {
                    if (detail !== targetDetail) {
                        detail.removeAttribute("open");
                    }
                });
            });
        });

        // Fetch all the details element.
        const detailsChild1 = document.querySelectorAll(".detailsChild1");

        // Add the onclick listeners.
        detailsChild1.forEach((targetDetail) => {
            targetDetail.addEventListener("click", () => {
                // Close all the details that are not targetDetail.
                detailsChild1.forEach((detail) => {

                    if (detail !== targetDetail) {
                        detail.removeAttribute("open");
                    }
                });
            });
        });
    }


    hex2Bytes(hex: string) {
        if (!hex) {
            return Buffer.allocUnsafe(0);
        }

        return Buffer.from(hex, "hex");
    }
}