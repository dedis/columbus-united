import { Instruction } from "@dedis/cothority/byzcoin";
import { DataBody } from "@dedis/cothority/byzcoin/proto";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Observable } from "rxjs";
import { throttleTime } from "rxjs/operators";

import { Chain } from "./chain";
import { Flash } from "./flash";
import { Lifecycle } from "./lifecycle";

/**
 * Create the interface under the blockchain. It displays
 * the two containers for the details of the clicked block
 * and for the result of the browsing for one instance.
 * It will also highlights some blocks in the blockchain.
 * It also handles the loading screen with the progress bar
 * to be updated.
 *
 * @author Julien von Felten <julien.vonfelten@epfl.ch>
 *
 * @export
 * @class Block
 */
export class Block {
    // Observable for the clicked block
    skipBclickedObs: Observable<SkipBlock>;
    clickedBlock: SkipBlock;
    colorClickedBlock: string;

    // Observable that notifies the updated blocks of blocksDiagram
    loadedSkipBObs: Observable<SkipBlock[]>;

    flash: Flash;
    lifecycle: Lifecycle;
    hashHighligh: SkipBlock[];

    // progress bar
    progressBarContainer: d3.Selection<
        HTMLDivElement,
        unknown,
        HTMLElement,
        any
    >;
    progressBar: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
    textBar: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
    loadContainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
    progressBarItem: HTMLElement;

    /**
     * Creates an instance of DetailBlock.
     * @param {Observable<SkipBlock>} skipBclickedObs : Observable for the clicked
     * block. We need this observable to know when a user has clicked on a block,
     * and then display the details of that block.
     * @param {Browsing} browsing
     * @param {Flash} flash
     * @param {Observable<SkipBlock[]>} loadedSkipBObs : Observable that is
     * notified when new blocks are loaded. This is necessary when we highlights
     * the blocks of an instance lifecycle, because if new blocks are added, some
     * may need to be highlighted.
     * @memberof DetailBlock
     */
    constructor(
        skipBclickedObs: Observable<SkipBlock>,
        lifecycle: Lifecycle,
        flash: Flash,
        loadedSkipBObs: Observable<SkipBlock[]>
    ) {
        const self = this;

        this.skipBclickedObs = skipBclickedObs;
        this.skipBclickedObs.subscribe({
            next: this.listTransaction.bind(this),
        });

        this.clickedBlock = null;
        this.colorClickedBlock = "#006fff";

        this.loadedSkipBObs = loadedSkipBObs;

        this.flash = flash;
        this.lifecycle = lifecycle;
        this.hashHighligh = [];

        this.progressBarContainer = undefined;
        this.progressBar = undefined;
        this.textBar = undefined;
        this.loadContainer = undefined;
        this.progressBarItem = undefined;
    }

    /**
     * This function should be called once. It listens on new block clicks and
     * update the view accordingly, ie. by displaying the block info.
     */
    startListen() {
        const self = this;

        this.loadedSkipBObs.subscribe({
            next: (value) => {
                self.highlightBlocks(this.hashHighligh);
            },
        });
    }

    /**
     * Display the list of all the transactions inside the clicked block.
     * It is triggered on click by the blocksDiagram class which notifies the
     * skipBclickedObs observable. It also displays the details of the block
     * (verifiers, backlinks, forwardlinks).
     * A browse button to search for the instanceID of the instruction is also
     * displayed
     *
     * @private
     * @param {SkipBlock} block : the clicked block
     * @memberof DetailBlock
     */
    private listTransaction(block: SkipBlock) {
        //SECTION Reseting and init
        // (re)set the color of the clickedBlock
        if (this.clickedBlock !== block) {
            if (this.clickedBlock != null) {
                const blockSVG = d3.select(
                    `[id = "${this.clickedBlock.hash.toString("hex")}"]`
                );
                blockSVG.attr("fill", Chain.getBlockColor(this.clickedBlock));
            }

            this.clickedBlock = block;
            d3.select(`[id = "${block.hash.toString("hex")}"]`).attr(
                "fill",
                this.colorClickedBlock
            );
        }
        const self = this;

        //Left column of the UI, displays all the block details
        const block_detail_container = d3.select(".block-detail-container");
        block_detail_container
            .attr("id", "block_detail_container")
            .text("")
            .append("p");
        //Right column of the UI, displays all the transactions of a block and their details
        const transaction_detail_container = d3.select(".browse-container");
        transaction_detail_container
            .attr("id", "block_detail_container")
            .text("")
            .append("p");


        //!SECTION

        //SECTION Block details
        //Big wrapper for all of the Block details
        const ulBlockDetail = block_detail_container.append("ul");
        //ulBlockDetail.attr("uk-accordion", "");
        //ulBlockDetail.attr("background-color", "#006fff");
        ulBlockDetail.attr("multiple", "true");
        ulBlockDetail.attr("class", "clickable-detail-block");

        // Details of the blocks (Verifier, backlinks, forwardlinks) are wrapped in this card
        const blockCard = ulBlockDetail.append("div");
        blockCard
            .attr("class", "uk-card uk-card-default")
            .attr("id", "detail-window");

        //The header of the card is used to display the block index and it's hash
        const blockCardHeader = blockCard.append("div");
        blockCardHeader.attr("class", "uk-card-header  uk-padding-small");


        //TODO Give titles like this an ID and handle the styling in the css
        const blockCardHeaderTitle = blockCardHeader.append("h3");
        blockCardHeaderTitle
            .style("font-weight", "700")
            .attr("margin-top", "5px")
            .text(`Block ${block.index}`)
            .style("color", "#666");
        const blockCardHeaderHash = blockCardHeader.append("p");
        blockCardHeaderHash.text(`Hash: ${block.hash.toString("hex")}`);

        //The Body of the card is wrapping all of the Accordions
        const blockCardBody = blockCard.append("div");
        blockCardBody.attr("class", "uk-card-body uk-padding-small");

        //TODO Give titles like this an ID and handle the styling in the css
        const blockCardBodyTitle = blockCardBody.append("h3");
        blockCardBodyTitle
            .text("Block details")
            .style("font-weight", "700")
            .style("color", "#666")
            .style("font-size", "1.3em");
        const divDetails = blockCardBody.append("div");
        divDetails.attr("class", "uk-accordion-content");

        //ANCHOR Verifier details
        const ulVerifier = divDetails.append("ul");
        ulVerifier.attr("uk-accordion", "");
        const liVerifier = ulVerifier.append("li");
        const aVerifier = liVerifier.append("a");
        aVerifier
            .attr("class", "uk-accordion-title")
            .text(`Verifiers: ${block.verifiers.length}`);
        const divVerifier = liVerifier.append("div");
        divVerifier.attr("class", "uk-accordion-content");
        block.verifiers.forEach((uid, j) => {
            divVerifier
                .append("p")
                .text(` Verifier ${j} , ID: ${uid.toString("hex")}`);
        });

        //ANCHOR BackLink details
        const ulBackLink = divDetails.append("ul");
        ulBackLink.attr("uk-accordion", "");
        const liBackLink = ulBackLink.append("li");
        const aBackLink = liBackLink.append("a");
        aBackLink
            .attr("class", "uk-accordion-title")
            .text(`BackLinks: ${block.backlinks.length}`);
        const divBackLink = liBackLink.append("div");
        divBackLink.attr("class", "uk-accordion-content");
        block.backlinks.forEach((value, j) => {
            divBackLink
                .append("p")
                .text(`Backlink ${j} Value: ${value.toString("hex")}`);
        });

        //ANCHOR ForwardLink
        const ulForwardLink = divDetails.append("ul");
        ulForwardLink.attr("uk-accordion", "");
        const liForwardLink = ulForwardLink.append("li");
        const aForwardLink = liForwardLink.append("a");
        aForwardLink
            .attr("class", "uk-accordion-title")
            .text(`ForwardLinks: ${block.forwardLinks.length}`);

        const divForwardLink = liForwardLink.append("div");
        divForwardLink.attr("class", "uk-accordion-content");
        block.forwardLinks.forEach((fl, j) => {
            divForwardLink.append("p").text(`To: ${fl.to.toString("hex")}`);
            divForwardLink
                .append("p")
                .text(`Hash: ${fl.hash().toString("hex")}`);
            divForwardLink
                .append("p")
                .text(`signature: ${fl.signature.sig.toString("hex")}`);
        });
        //!SECTION
        //SECTION Transaction details
        const ulTransaction = transaction_detail_container.append("ul");


        //This card simply hold the title of the section in its header, and lists all transactions
        //in its body
        const transactionCard = ulTransaction.append("div");
        transactionCard
            .attr("class", "uk-card uk-card-default")
            .attr("id", "detail-window");

        const transactionCardHeader = transactionCard.append("div");
        transactionCardHeader.attr("class", "uk-card-header uk-padding-small");
        const transactionCardHeaderTitle = transactionCardHeader.append("h3");
        transactionCardHeaderTitle
            .style("font-weight", "700")
            .attr("margin-top", "5px")
            .text(`Transaction details`)
            .style("color", "#666");

        const transactionCardBody = transactionCard.append("div");
        transactionCardBody.attr("class", "uk-card-body uk-padding-small");

        // ulTransaction.attr("uk-accordion", "");
        // ulTransaction.attr("background-color = #006fff");
        // ulTransaction.attr("multiple", "true");
        // ulTransaction.attr("class", "clickable-detail-block");
        const body = DataBody.decode(block.payload);

        
        body.txResults.forEach((transaction, i) => {
            const accepted: string = transaction.accepted
                ? "Accepted"
                : "Not accepted";
            const liTransaction = transactionCardBody.append("ul");
            liTransaction.attr("id", "detail-window");
            liTransaction.attr("class", "uk-open");
            const transactionTitle = liTransaction.append("h3");
            let totalInstruction = 0;
            transaction.clientTransaction.instructions.forEach((_, __) => {
                totalInstruction++;
            });
            let s = "";
            if (totalInstruction > 2) {
                s = "s";
            }
            //TODO Give titles like this an ID and handle the styling in the css
            transactionTitle
                .html(
                    `<b>Transaction ${i}</b> ${accepted}, show ${totalInstruction} instruction${s}:`
                )
                .style("font", "Monospace")
                .style("color", "#666")
                .style("font-size", "1.3em");

            const divTransaction = liTransaction.append("div");
            divTransaction.attr("class", "uk-accordion-content");

            const ulInstruction = divTransaction.append("ul");
            ulInstruction.attr("uk-accordion", "");
            // instructions of the transaction
            transaction.clientTransaction.instructions.forEach(
                (instruction, j) => {
                    let args = null;
                    const liInstruction = ulInstruction.append("li");
                    liInstruction.attr("style", "padding-left:15px");
                    const aInstruction = liInstruction.append("a");
                    aInstruction
                        .attr("class", "uk-accordion-title")

                    //TODO Maybe modularize this as it's gonna be very heavy
                    if (instruction.type === Instruction.typeSpawn) {
                        aInstruction.text(
                            `Spawn instruction ${j}, name of contract: ${instruction.spawn.contractID}`
                        );
                        args = instruction.spawn.args;
                    } else if (instruction.type === Instruction.typeInvoke) {
                        aInstruction.text(
                            `Invoke instruction ${j}, name of contract: ${instruction.invoke.contractID}`
                        );
                        args = instruction.invoke.args;
                    } else if (instruction.type === Instruction.typeDelete) {
                        aInstruction.text(
                            `Delete instruction ${j}, name of contract:${instruction.delete.contractID}`
                        );
                    }

                    const divInstruction = liInstruction.append("div");
                    divInstruction
                        .attr("class", "uk-accordion-content")
                        .attr("style", "padding-left:15px");
                    // Detail of one instruction
                    divInstruction
                        .append("p")
                        .text(`Hash:${instruction.hash().toString("hex")}`);
                    divInstruction
                        .append("p")
                        .text(
                            `Instance ID: ${instruction.instanceID.toString(
                                "hex"
                            )}`
                        );
                    divInstruction.append("p").text("Arguments:");
                    // Args of the instruction
                    const ulArgs = divInstruction.append("ul");
                    ulArgs.attr("uk-accordion", "");
                    // tslint:disable-next-line
                    args.forEach((arg, i) => {
                        const liArgs = ulArgs.append("li");
                        const aArgs = liArgs.append("a");
                        aArgs
                            .attr("class", "uk-accordion-title")

                            .attr("href", "#");
                        aArgs.text(`${i}: ${arg.name}`);
                        const divArgs = liArgs.append("div");
                        divArgs.attr("class", "uk-accordion-content");
                        divArgs.append("p").text(`${arg.value}`);
                    });
                    // Search button
                    const searchInstance = divInstruction.append("button");
                    searchInstance
                        .attr("id", "buttonBrowse")
                        .attr(
                            "class",
                            "uk-button uk-button-default uk-padding-remove-right uk-padding-remove-left"
                        )
                        .attr("style", "border:none")
                        .text(
                            `Search for all instance with the ID: "${instruction.instanceID.toString(
                                "hex"
                            )}"`
                        )
                        // Confirmation and start browsing on click
                        // tslint:disable-next-line
                        .on("click", function () {
                            const conf = confirm(
                                `Do you really want to browse the whole blockchain with the instance ID: ${instruction.instanceID.toString(
                                    "hex"
                                )}? \nThis may take a while!`
                            );
                            if (conf) {
                                self.createLoadingScreen();
                                const subjects = self.lifecycle.getInstructionSubject(
                                    instruction
                                );
                                subjects[0].subscribe({
                                    next: self.printDataBrowsing.bind(self),
                                });
                                // throttleTime: ignores the values for the 100 first ms
                                subjects[1].pipe(throttleTime(100)).subscribe({
                                    complete: self.doneLoading,
                                    next: ([
                                        percentage,
                                        seenBlock,
                                        totalBlock,
                                        nbInstanceFound,
                                    ]) => {
                                        self.updateLoadingScreen(
                                            percentage,
                                            seenBlock,
                                            totalBlock,
                                            nbInstanceFound
                                        );
                                    },
                                });
                            } else {
                                self.flash.display(
                                    Flash.flashType.INFO,
                                    "Browsing cancelled"
                                );
                            }
                        });
                }
            );//!SECTION

        });
    }

    /**
     * Displays the result of the browsing, highlights the
     * blocks found.
     *
     * @private
     * @param {[SkipBlock[], Instruction[]]} tuple : value of the observable
     *                              browsing.getInstructionSubject function
     * @memberof DetailBlock
     */
    private printDataBrowsing(tuple: [SkipBlock[], Instruction[]]) {
        // removes previous highlighted blocks
        this.removeHighlighBlocks(this.hashHighligh);

        const browseContainer = d3.select(".browse-container");
        browseContainer
            .attr("id", "browseContainer")
            .text("")
            .append("p")
            .text(
                `Summary of the evolution of the instance: ${tuple[1][0].instanceID.toString(
                    "hex"
                )}`
            );
        const ulInstructionB = browseContainer.append("ul");
        ulInstructionB.attr("uk-accordion", "");
        ulInstructionB.attr("multiple", "true");
        ulInstructionB.attr("class", "clickable-detail-block");
        for (let i = 0; i < tuple[1].length; i++) {
            const blocki = tuple[0][i];
            const instruction = tuple[1][i];
            const liInstructionB = ulInstructionB.append("li");
            const aInstructionB = liInstructionB.append("a");
            aInstructionB.attr("class", "uk-accordion-title").attr("href", "#");

            let args = null;
            let contractID = "";
            if (instruction.type === Instruction.typeSpawn) {
                aInstructionB
                    .attr("id", `buttonInstance${i}`)
                    .text(`${i}: Spawn in the block ${blocki.index}`);
                args = instruction.spawn.args;
                contractID = instruction.spawn.contractID;
            } else if (instruction.type === Instruction.typeInvoke) {
                aInstructionB
                    .attr("id", `buttonInstance${i}`)
                    .text(`${i}: Invoke in the block ${blocki.index}`);
                args = instruction.invoke.args;
                contractID = instruction.invoke.contractID;
            } else if (instruction.type === Instruction.typeDelete) {
                aInstructionB
                    .attr("id", `buttonInstance${i}`)
                    .text(`${i}: Delete in the block ${blocki.index}`);
                contractID = instruction.delete.contractID;
            }
            // Add an highlight of the instance which was browsed
            if (
                blocki.hash.toString("hex") ===
                this.clickedBlock.hash.toString("hex")
            ) {
                aInstructionB.style("background-color", "red");
            }
            // Detail of each instruction
            const divInstructionB = liInstructionB.append("div");
            divInstructionB.attr(
                "class",
                "uk-accordion-content uk-padding-small uk-padding-remove-top uk-padding-remove-right uk-padding-remove-bottom"
            );
            divInstructionB
                .append("p")
                .text(
                    `Hash of instanceID is: ${instruction
                        .hash()
                        .toString("hex")}`
                );
            divInstructionB.append("p").text(`contractID: ${contractID}`);
            divInstructionB
                .append("p")
                .text(`In the block: ${blocki.hash.toString("hex")}`);
            divInstructionB.append("p").text("Arguments: ");
            const ulArgsB = divInstructionB.append("ul");
            ulArgsB.attr("uk-accordion", "");
            // tslint:disable-next-line
            args.forEach((arg, i) => {
                const liArgsB = ulArgsB.append("li");
                const aArgsB = liArgsB.append("a");
                aArgsB
                    .attr("class", "uk-accordion-title")
                    .attr("href", "#")
                    .text(`${i}: ${arg.name}`);
                const divArgsB = liArgsB.append("div");
                divArgsB.attr(
                    "class",
                    "uk-accordion-content uk-padding-small uk-padding-remove-top uk-padding-remove-right uk-padding-remove-bottom"
                );
                divArgsB.append("p").text(`${arg.value}`);
            });
        }
        // Highlights the blocks in the blockchain
        this.highlightBlocks(tuple[0]);
        this.hashHighligh = tuple[0];
    }

    /**
     * Highlights the blocks in the blockchain
     *
     * @private
     * @param {string[]} blocks : the blocks to be highlighted
     * @memberof DetailBlock
     */
    private highlightBlocks(blocks: SkipBlock[]) {
        for (let i = 0; i < blocks.length; i++) {
            const blockSVG = d3.select(
                `[id = "${blocks[i].hash.toString("hex")}"]`
            );
            const button = d3.select(`#buttonInstance${i}`);
            if (!blockSVG.empty()) {
                blockSVG.attr("stroke", "red").attr("stroke-width", 5);
            } // tslint:disable-next-line
            button.on("mouseover", function () {
                blockSVG.attr("stroke", "red").attr("stroke-width", 10);
            }); // tslint:disable-next-line
            button.on("mouseout", function () {
                blockSVG.attr("stroke", "red").attr("stroke-width", 5);
            });
        }
    }
    /**
     * Removes the highlights of the blocks in the blockchain
     *
     * @private
     * @param {string[]} blocks : the blocks to remove the highlight
     * @memberof DetailBlock
     */
    private removeHighlighBlocks(blocks: SkipBlock[]) {
        for (let i = 0; i < blocks.length; i++) {
            const blockSVG = d3.select(
                `[id = "${blocks[i].hash.toString("hex")}"]`
            );
            const button = d3.select(`#buttonInstance${i}`);
            if (!blockSVG.empty()) {
                blockSVG.attr("stroke", "red").attr("stroke-width", 0);
            } // tslint:disable-next-line
            button.on("mouseover", function () {
                blockSVG.attr("stroke", "green").attr("stroke-width", 0);
            }); // tslint:disable-next-line
            button.on("mouseout", function () {
                blockSVG.attr("stroke", "red").attr("stroke-width", 0);
            });
        }
    }

    /**
     * Creates the loading screen
     *
     * @private
     * @memberof DetailBlock
     */
    private createLoadingScreen() {
        const self = this;
        this.loadContainer = d3
            .select("body")
            .append("div")
            .attr("class", "load-container");
        this.loadContainer
            .append("div")
            .attr("class", "logo") // tslint:disable-next-line
            .on("click", function () {
                window.open("https://www.epfl.ch/labs/dedis/");
            });
        const divLoad = this.loadContainer
            .append("div")
            .attr("class", "div-load");
        divLoad.append("div").attr("class", "loader");

        this.progressBarContainer = this.loadContainer
            .append("div")
            .attr("id", "progress-bar-container");

        this.progressBar = this.progressBarContainer
            .append("div")
            .attr("id", "progress-bar");
        this.textBar = this.progressBarContainer
            .append("div")
            .attr("id", "text-bar")
            .text(`???% --- block parsed: ??? / ??? and instances found: ???`);

        this.loadContainer
            .append("button")
            .attr("class", "cancel-button")
            .attr("id", "cancel-button")
            .text("Abort research")
            // tslint:disable-next-line
            .on("click", function () {
                const conf = confirm(
                    "Are you sure you want to abort the browse?"
                );
                if (conf) {
                    self.lifecycle.abort = true;
                }
            });
        this.progressBarItem = document.getElementById("progress-bar");
    }

    /**
     * Called at each percent by the subject. It updates the loading screen
     *
     * @private
     * @param {number} percentage
     * @param {number} seenBlocks
     * @param {number} totalBlocks
     * @param {number} nbInstanceFound
     * @memberof DetailBlock
     */
    private updateLoadingScreen(
        percentage: number,
        seenBlocks: number,
        totalBlocks: number,
        nbInstanceFound: number
    ) {
        if (totalBlocks > 0) {
            this.textBar.text(
                `${percentage}% --- blocks parsed: ${seenBlocks}/ ${totalBlocks} and instances found: ${nbInstanceFound}`
            );
            this.progressBarItem.style.width = percentage + "%";
        } else {
            this.textBar.text(
                `???%  --  Seen blocks: ${seenBlocks}/ Total blocks: ???. Number of instances found: ${nbInstanceFound}`
            );
        }
    }
    /**
     * Removes the loading screen
     *
     * @private
     * @memberof DetailBlock
     */
    private doneLoading() {
        d3.select(".load-container").remove();
    }
}
