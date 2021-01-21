import { Instruction } from "@dedis/cothority/byzcoin";
import { DataBody, DataHeader } from "@dedis/cothority/byzcoin/proto";
import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Observable, Subject } from "rxjs";
import { throttleTime } from "rxjs/operators";
import { event } from "d3-selection";
import { Chain } from "./chain";
import { Flash } from "./flash";
import { Lifecycle } from "./lifecycle";
import { Utils } from "./utils";

/**
 * Create the interface under the blockchain. It displays
 * the two containers for the details of the clicked block
 * and for the result of the browsing for one instance.
 * It will also highlights some blocks in the blockchain.
 * It also handles the loading screen with the progress bar
 * to be updated.
 *
 * @author Lucas Trognon <lucas.trognon@epfl.ch>
 *
 * @export
 * @class Block
 */
export class Block {
    // Observable for the clicked block
    skipBclickedSubject: Subject<SkipBlock>;

    clickedBlock: SkipBlock;
    colorClickedBlock: string;
    // Observable that notifies the updated blocks of blocksDiagram
    loadedSkipBObs: Observable<SkipBlock[]>;

    flash: Flash;
    lifecycle: Lifecycle;
    hashHighligh: SkipBlock[];

    roster: Roster;
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
     * @param {Observable<SkipBlock>} skipBclickedSubject : Observable for the clicked
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
        skipBclickedSubject: Subject<SkipBlock>,
        lifecycle: Lifecycle,
        flash: Flash,
        loadedSkipBObs: Observable<SkipBlock[]>,
        roster: Roster
    ) {
        const self = this;

        this.skipBclickedSubject = skipBclickedSubject;
        this.skipBclickedSubject.subscribe({
            next: this.listTransaction.bind(this),
        });

        this.clickedBlock = null;
        this.colorClickedBlock = "#006fff";

        this.roster = roster;

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
    setSearch(search: void) {
        throw new Error("Method not implemented.");
    }

    /**
     * Display the list of all the transactions inside the clicked block.
     * It is triggered on click by the blocksDiagram class which notifies the
     * skipBclickedSubject observable. It also displays the details of the block
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
        ulBlockDetail.attr("multiple", "true");
        ulBlockDetail.attr("class", "clickable-detail-block");

        // Details of the blocks (Verifier, backlinks, forwardlinks) are wrapped in this card
        const blockCard = ulBlockDetail.append("div");
        blockCard
            .attr("class", "uk-card uk-card-default")
            .attr("id", "detail-window");

        //ANCHOR Header of the card used to display the block index and it's hash
        const blockCardHeader = blockCard.append("div");
        blockCardHeader.attr("class", "uk-card-header  uk-padding-small");

        const blockCardHeaderTitle = blockCardHeader.append("h3");
        blockCardHeaderTitle
            .attr("class", "block-card-content")
            .text(`Block ${block.index}`);

        const blockCardHeaderDetails = blockCardHeader.append("span");

        blockCardHeaderDetails.attr("class", "block-card-header-details");
        blockCardHeaderDetails
            .append("p")
            .text(`Hash : ${block.hash.toString("hex")}`);
        blockCardHeaderDetails
            .append("p")
            .text(`Validated on the ${Utils.getTimeString(block)}`);
        blockCardHeaderDetails.append("p").text(`Height : ${block.height}`);

        //ANCHOR Body of the card wrapping all of the accordions
        const blockCardBody = blockCard.append("div");
        blockCardBody.attr("class", "uk-card-body uk-padding-small");

        const blockCardBodyTitle = blockCardBody.append("h3");
        blockCardBodyTitle
            .attr("class", "block-card-content")
            .text("Block details");

        const divDetails = blockCardBody.append("div");
        divDetails.attr("class", "uk-accordion-content");

        //ANCHOR Verifier details
        const ulVerifier = divDetails.append("ul"); // accordion containing all the verifiers of a block
        ulVerifier.attr("uk-accordion", "");
        const liVerifier = ulVerifier.append("li");
        const aVerifier = liVerifier.append("a");
        aVerifier
            .attr("class", "uk-accordion-title")
            .text(`Verifiers : ${block.verifiers.length}`);
        const divVerifier = liVerifier.append("div");
        divVerifier.attr("class", "uk-accordion-content"); // content on the accordion
        block.verifiers.forEach((uid, j) => {
            const verifierLine = divVerifier.append("p");
            verifierLine.text(` Verifier ${j} , ID:  `);
            Utils.addIDBlocky(verifierLine, uid.toString("hex"), self.flash);
        });

        //ANCHOR BackLink details
        const ulBackLink = divDetails.append("ul");
        ulBackLink.attr("uk-accordion", "");
        const liBackLink = ulBackLink.append("li");
        const aBackLink = liBackLink.append("a");
        aBackLink
            .attr("class", "uk-accordion-title")
            .text(`Back Links : ${block.backlinks.length}`);
        const divBackLink = liBackLink.append("div");
        divBackLink.attr("class", "uk-accordion-content");
        block.backlinks.forEach((value, j) => {
            // This equation is simply derived from the skipchain topology
            const blockIndex = block.index - Math.pow(block.baseHeight, j);

            // For each linked block, a clickable badge is created
            const divBackLinkBadge = divBackLink
                .append("p")
                .text(`Backlink ${j} to `)
                .append("span");

            divBackLinkBadge
                .attr("class", "uk-badge")
                .text(`Block ${blockIndex}`)
                .on("click", async function () {
                    Utils.translateOnChain(
                        await Utils.getBlock(value, self.roster),
                        block,
                        self.skipBclickedSubject
                    );
                })
                .attr("uk-tooltip", `${value.toString("hex")}`);
            Utils.clickable(divBackLinkBadge);
        });

        //ANCHOR ForwardLink
        const ulForwardLink = divDetails.append("ul");
        ulForwardLink.attr("uk-accordion", "");
        const liForwardLink = ulForwardLink.append("li");
        const aForwardLink = liForwardLink.append("a");
        aForwardLink
            .attr("class", "uk-accordion-title")
            .text(`Forward Links : ${block.forwardLinks.length}`);

        const divForwardLink = liForwardLink.append("div");
        divForwardLink.attr("class", "uk-accordion-content");
        block.forwardLinks.forEach((fl, j) => {
            // This equation is simply derived from the skipchain topology
            const blockIndex = block.index + Math.pow(block.baseHeight, j);

            // For each linked block, a clickable badge is created
            const divForwardLinkBadge = divForwardLink
                .append("p")
                .text(`Forward link ${j} to `)
                .append("span");

            divForwardLinkBadge
                .attr("class", "uk-badge")
                .text(`Block ${blockIndex}`)
                .on("click", async function () {
                    Utils.translateOnChain(
                        await Utils.getBlock(fl.to, self.roster),
                        block,
                        self.skipBclickedSubject
                    );
                })
                .attr("uk-tooltip", `${fl.to.toString("hex")}`);
            Utils.clickable(divForwardLinkBadge);

            // Because forward links need to be verified, signatures are rendered as well
            // Here a tooltip is created to sisplay all the data needed
            const lockIcon = divForwardLink.append("object");
            const lockContent = `<p>Hash : ${fl.hash().toString("hex")}</p>
            <p>signature: ${fl.signature.sig.toString("hex")}</p>`;

            lockIcon
                .attr("class", "white-icon")
                .attr("type", "image/svg+xml")
                .attr("data", "assets/signature.svg")

                .on("click", function () {
                    Utils.copyToClipBoard(lockContent, self.flash);
                });
            const linkDetails = divForwardLink.append("div");
            linkDetails
                .attr("uk-dropdown", "pos: right-center")
                .attr("id", "forwardlink-drop")
                .html(lockContent)
                .style("color", "var(--selected-colour)");
        });
        //!SECTION
        //SECTION Transaction details
        const ulTransaction = transaction_detail_container.append("ul");

        // This card simply hold the title of the section in its header, and lists all transactions
        // in its body
        const transactionCard = ulTransaction.append("div");
        transactionCard
            .attr("class", "uk-card uk-card-default")
            .attr("id", "detail-window");

        const transactionCardHeader = transactionCard.append("div");
        transactionCardHeader.attr("class", "uk-card-header uk-padding-small");
        const transactionCardHeaderTitle = transactionCardHeader.append("h3");
        transactionCardHeaderTitle
            .attr("class", "transaction-card-header-title")
            .text(`Transaction details`);

        const body = DataBody.decode(block.payload);

        const totalTransaction = body.txResults.length;

        transactionCardHeaderTitle
            .append("p")
            .text(
                `Total of ${totalTransaction} transaction` +
                    (totalTransaction > 1 ? "s" : "")
            )
            .style("margin-left", "10px");

        const transactionCardBody = transactionCard.append("div");
        transactionCardBody.attr("class", "uk-card-body uk-padding-small");

        body.txResults.forEach((transaction, i) => {
            const accepted: string = transaction.accepted
                ? "Accepted"
                : `<span id ="rejected">Rejected</span>`;

            const liTransaction = transactionCardBody.append("ul");
            liTransaction.attr("id", "detail-window").attr("class", "uk-open");
            const transactionTitle = liTransaction.append("h3");
            let totalInstruction = 0;

            // Each transaction may hold several instructions
            transaction.clientTransaction.instructions.forEach((_, __) => {
                totalInstruction++;
            });
            transactionTitle
                .attr("class", "transaction-title")
                .html(
                    `<b>Transaction ${i}</b> ${accepted}, show ${totalInstruction} instruction` +
                        (totalInstruction > 1 ? `s` : ``) +
                        `:`
                );

            const divTransaction = liTransaction.append("div");
            divTransaction.attr("class", "uk-accordion-content");

            const ulInstruction = divTransaction.append("ul");
            ulInstruction.attr("uk-accordion", "");
            // ANCHOR Transaction displaying
            transaction.clientTransaction.instructions.forEach(
                (instruction, j) => {
                    // This variable helps us keep tracks whether or not we should display
                    //the instruction is a coin transaction between two users.
                    var coin_invoked = false;
                    let args = null;
                    const liInstruction = ulInstruction.append("li");
                    liInstruction.attr("style", "padding-left:15px");
                    const aInstruction = liInstruction.append("a");
                    aInstruction.attr("class", "uk-accordion-title");

                    if (instruction.type === Instruction.typeSpawn) {
                        const contractName =
                            instruction.spawn.contractID
                                .charAt(0)
                                .toUpperCase() +
                            instruction.spawn.contractID.slice(1);
                        aInstruction.text(`Spawned : ${contractName}`);
                        args = instruction.spawn.args;
                    } else if (instruction.type === Instruction.typeInvoke) {
                        const contractName =
                            instruction.invoke.contractID
                                .charAt(0)
                                .toUpperCase() +
                            instruction.invoke.contractID.slice(1);
                        aInstruction.text(`Invoked : ${contractName}`);
                        args = instruction.invoke.args;

                        coin_invoked =
                            contractName == "Coin" && args.length > 1;
                    } else if (instruction.type === Instruction.typeDelete) {
                        const contractName =
                            instruction.delete.contractID
                                .charAt(0)
                                .toUpperCase() +
                            instruction.delete.contractID.slice(1);
                        aInstruction.text(`Deleted : ${contractName}`);
                    }

                    const divInstruction = liInstruction.append("div");

                    divInstruction.attr("class", "uk-accordion-content");
                    // Detail of one instruction
                    divInstruction
                        .append("p")
                        .style("font-family", "monospace")
                        .text(
                            `Transaction hash : ${instruction
                                .hash()
                                .toString("hex")}`
                        );

                    const hash = instruction.instanceID.toString("hex");
                    Utils.addHashBlocky(
                        divInstruction.append("p").text(`Instance ID : `),
                        hash,
                        self.flash
                    );

                    //TODO Create a beautifier for Columbus which formats each instruction
                    //in a customized way

                    if (!coin_invoked) {
                        if (instruction.signerCounter.length != 0) {
                            const userSignature = instruction.signerIdentities
                                .pop()
                                .toString()
                                .slice(8); //The 8 first characters are the same for all signers ID
                            const emmiterP = divInstruction
                                .append("p")
                                .text("Emmited by ");
                            Utils.addIDBlocky(
                                emmiterP,
                                userSignature,
                                self.flash
                            );
                        }
                        divInstruction.append("p").text("Arguments:");
                        // Args of the instruction
                        const ulArgs = divInstruction.append("ul");
                        ulArgs.attr("uk-accordion", "");
                        // tslint:disable-next-line
                        const beautifiedArgs = instruction.beautify().args;
                        beautifiedArgs.forEach((arg, i) => {
                            const liArgs = ulArgs.append("li");
                            const aArgs = liArgs.append("a");
                            aArgs
                                .attr("class", "uk-accordion-title")
                                .attr("href", "#");
                            aArgs.text(`${i} : ${arg.name}`);
                            const divArgs = liArgs.append("div");
                            divArgs.attr("class", "uk-accordion-content");
                            divArgs.append("p").text(`${arg.value}`);
                        });
                    } else {
                        const beautifiedArgs = instruction.beautify().args;
                        const userSignature = instruction.signerIdentities
                            .pop()
                            .toString()
                            .slice(8);
                        const destinationSignature = beautifiedArgs[1].value;

                        const line = divInstruction.append("p");
                        Utils.addIDBlocky(line, userSignature, self.flash);
                        line.append("span").text(
                            ` gave ${beautifiedArgs[0].value.split(" ")[0]}`
                        );
                        line.append("object")
                            .attr("class", "white-icon")
                            .attr("type", "image/svg+xml")
                            .attr("data", "assets/coin.svg")
                            .style("top", "11px");

                        line.append("span").text(" to ");
                        Utils.addIDBlocky(
                            line,
                            destinationSignature,
                            self.flash
                        );
                        if (beautifiedArgs.length == 3) {
                            divInstruction
                                .append("p")
                                .text(`Challenge : ${beautifiedArgs[2].value}`);
                        }
                    }
                    // Search button

                    //ANCHOR Browse button
                    const searchInstance = divInstruction.append("li");
                    searchInstance.attr("id", "button-browse");
                    const searchButton = searchInstance.append("button");
                    searchButton
                        .attr("class", "uk-button uk-button-default")
                        .text(`Search `);
                    searchInstance.append("span").text(" for ");

                    const formTag = searchInstance
                        .append("span")
                        .append("form")
                        .style("display", "inline");

                    //Dropdown menu to select the number of reults the tracker should return.
                    const formSelect = formTag
                        .append("select")
                        .attr("value", "10")
                        .attr("class", "uk-select");

                    formSelect
                        .append("option")
                        .attr("value", "-1")
                        .text("All instructions related to this instance");

                    formSelect
                        .append("option")
                        .attr("value", "100")
                        .text(
                            "The 100 first instructions related to this instance"
                        );

                    formSelect
                        .append("option")
                        .attr("value", "50")
                        .text(
                            "The 50 first instructions related to this instance"
                        );

                    formSelect
                        .append("option")
                        .attr("value", "10")
                        .text(
                            "The 10 first instructions related to this instance"
                        );

                    var chosenQuery = -1;

                    formSelect.on("change", function () {
                        chosenQuery = parseInt(
                            this.options[this.selectedIndex].value
                        );
                    });

                    searchButton
                        // Confirmation and start browsing on click
                        // tslint:disable-next-line
                        .on("click", function () {
                            self.launchQuery(
                                chosenQuery,
                                instruction.instanceID.toString("hex")
                            );
                        });
                }
            ); //!SECTION
        });
    }

    /**
     * SECTION Instance tracking
     * ANCHOR Query Launching
     * Launches a query for all instructions that are related to an instance ID
     * This method is called in search.ts at the moment, it could be refactored into something nicer
     * @public
     * @param {number} chosenQuery : The number of results we want to display
     * @param {string} instruction : The id of the instance we're interested in
     * @memberof DetailBlock
     */

    public launchQuery(chosenQuery: number, instanceID: string) {
        const self = this;
        self.createLoadingScreen();
        const subjects = self.lifecycle.getInstructionSubject(
            instanceID,
            chosenQuery
        );
        subjects[0].subscribe({
            next: self.printDataBrowsing.bind(self),
        });
        // throttleTime: ignores the values for the 100 first ms
        subjects[1].pipe(throttleTime(100)).subscribe({
            complete: self.doneLoading,
            next: ([percentage, seenBlock, totalBlock, nbInstanceFound]) => {
                console.log("updated");
                self.updateLoadingScreen(
                    percentage,
                    seenBlock,
                    totalBlock,
                    nbInstanceFound
                );
            },
        });
    }

    //
    /**
     * ANCHOR Query results rendering
     * Displays the result of the browsing, highlights the
     * blocks found.
     *
     * @private
     * @param {[SkipBlock[], Instruction[]]} tuple : value of the observable
     browsing.getInstructionSubject function
     * @memberof DetailBlock
     */
    private printDataBrowsing(tuple: [SkipBlock[], Instruction[]]) {
        //ANCHOR Display and styling
        // Removes previous highlighted blocks
        this.removeHighlighBlocks(this.hashHighligh);
        const self = this;
        // Creates the container for the query results
        const queryContainer = d3.select(".query-answer");
        queryContainer.text("");
        queryContainer.attr("class", "query-answer uk-card uk-card-default");
        // Creates the header used to display the instance ID and the "clear results" button
        const queryHeader = queryContainer.append("p");
        queryHeader
            .attr("id", "query-header")
            .append("div")
            .text(
                `Summary of the evolution of the instance: ${tuple[1][0].instanceID.toString(
                    "hex"
                )}`
            );

        // Clears the results of a previous query
        const closeButtonWrap = queryHeader.append("div");
        closeButtonWrap.attr("id", "clear-query-button");
        closeButtonWrap
            .append("button")
            .attr("class", "uk-close-large")
            .attr("type", "button")
            .attr("uk-close", "")
            .on("click", function () {
                const confir = confirm(
                    "Are you sure you want to clear the query results ?"
                );
                if (confir) {
                    self.removeHighlighBlocks(self.hashHighligh);
                    queryContainer.html("");
                }
            });

        // Creates a container in which we'll put the cards
        const queryCardContainer = queryContainer.append("ul");
        queryCardContainer
            .attr("id", "query-card-container")
            .attr("multiple", "true")
            .attr("class", "uk-flex");

        // Creates a card for each instruction, the header contains a title with references
        // to both the transaction hash and the block hash.
        // The body contains the arguments of the instruction
        for (let i = 0; i < tuple[1].length; i++) {
            const blocki = tuple[0][i];
            const instruction = tuple[1][i];
            const instructionCard = queryCardContainer.append("li");
            instructionCard
                .attr("class", "uk-card uk-card-default")
                .style("min-width", "350px");

            const instructionCardHeader = instructionCard.append("div");
            instructionCardHeader.attr(
                "class",
                "uk-card-header uk-padding-small"
            );

            const instructionCardBody = instructionCard.append("div");
            instructionCardBody;

            let contractID = "";
            instructionCard.attr("id", `buttonInstance${i}`);
            let verb = "";
            if (instruction.type === Instruction.typeSpawn) {
                contractID = instruction.spawn.contractID;
                verb = "Spawned";
            } else if (instruction.type === Instruction.typeInvoke) {
                verb = "Invoked";
                contractID = instruction.invoke.contractID;
            } else if (instruction.type === Instruction.typeDelete) {
                verb = "Deleted";
                contractID = instruction.delete.contractID;
            }

            instructionCardHeader
                .append("span")
                .attr("class", "uk-badge")
                .text(`${verb}`)
                .on("click", function () {
                    Utils.copyToClipBoard(
                        `${instruction.hash().toString("hex")}}`,
                        self.flash
                    );
                })
                .attr("uk-tooltip", `${instruction.hash().toString("hex")}`);

            instructionCardHeader
                .append("span")
                .text(` ${contractID} contract in `);

            //Creates a clickable badge to copy a hash to the clipboard
            const instructionCardHeaderBadge = instructionCardHeader.append(
                "span"
            );

            instructionCardHeaderBadge
                .attr("class", "uk-badge")
                .text(`Block ${blocki.index}`)
                .on("click", function () {
                    Utils.copyToClipBoard(
                        `${blocki.hash.toString("hex")}`,
                        self.flash
                    );
                })
                .attr("uk-tooltip", `${blocki.hash.toString("hex")}`);
            Utils.clickable(instructionCardHeaderBadge);

            // Add an highlight of the instance which was browsed
            if (
                blocki.hash.toString("hex") ===
                this.clickedBlock.hash.toString("hex")
            ) {
                instructionCard.style("outline", "1px red");
            }
            // Detail of each instruction
            const divInstructionB = instructionCardBody.append("div");
            divInstructionB.attr(
                "class",
                "uk-accordion-content uk-padding-small"
            );

            divInstructionB.append("p").text("Arguments: ");
            const ulArgsB = divInstructionB.append("ul");
            ulArgsB.attr("uk-accordion", "");
            // tslint:disable-next-line
            const beautifiedArgs = instruction.beautify();

            beautifiedArgs.args.forEach((arg, i) => {
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

        //ANCHOR Mouse events handling for clicking and dragging
        //Stores the current scroll position
        var pos = { left: 0, x: 0 };

        //Fires when the mouse is down and moved, refreshes the scroll position
        const mouseMoveHandler = function () {
            const dx = d3.event.clientX - pos.x;
            queryCardContainer.node().scrollLeft = pos.left - dx;
        };

        //Fires when the mouse is released.
        //Removes the move and up event handler and resets cursor properties.
        const mouseUpHandler = function () {
            queryCardContainer.style("cursor", "grab");
            queryCardContainer.node().style.removeProperty("user-select");
            queryCardContainer.on("mousemove", function (e) {});
            queryCardContainer.on("mouseup", null);
        };

        //When mousedown fires in query card container, we instantiate the other event listener
        queryCardContainer.on("mousedown", function (e) {
            queryCardContainer.style("cursor", "grabbing");
            queryCardContainer.style("user-select", "none");

            pos = {
                left: queryCardContainer.node().scrollLeft,
                x: d3.event.clientX,
            };
            queryCardContainer.on("mousemove", mouseMoveHandler);
            queryCardContainer.on("mouseup", mouseUpHandler);
        });

        document.addEventListener("mousemove", mouseMoveHandler);
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
     * ANCHOR Loading screen
     * Creates the loading screen
     *
     * @private
     * @memberof DetailBlock
     */
    private createLoadingScreen() {
        const self = this;
        this.loadContainer = d3
            .select(".query-answer")
            .append("div")
            .attr("class", "load-container");
        this.loadContainer
            .append("div")
            .append("div")
            .attr("class", "logo") // tslint:disable-next-line
            .on("click", function () {
                window.open("https://www.epfl.ch/labs/dedis/");
            });
        const divLoad = this.loadContainer
            .append("div")
            .attr("class", "div-load");
        divLoad
            .append("div")
            .attr("class", "spinner")
            .attr("uk-spinner", "ratio : 2")
            .style("color", "blue");

        this.progressBarContainer = this.loadContainer
            .append("div")
            .attr("id", "progress-bar-container");

        this.progressBar = this.progressBarContainer
            .append("div")
            .attr("id", "progress-bar")
            .style("width", "0");
        this.textBar = this.progressBarContainer
            .append("div")
            .attr("id", "text-bar")
            .text(`???% --- block parsed: ??? / ??? and instances found: ???`);

        this.progressBarContainer
            .append("button")
            .attr("class", "cancel-button")
            .attr("id", "cancel-button")
            .text("Abort search")
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
     *
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

    //!SECTION

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
