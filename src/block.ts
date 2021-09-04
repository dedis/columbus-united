import { Instruction } from "@dedis/cothority/byzcoin";
import { DataBody } from "@dedis/cothority/byzcoin/proto";
import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Observable, Subject } from "rxjs";
import { throttleTime } from "rxjs/operators";
import { Chain } from "./chain";
import { Flash } from "./flash";
import { InstructionChain } from "./instructionChain";
import { Lifecycle } from "./lifecycle";
import { Utils } from "./utils";
import * as blockies from "blockies-ts";

/**
 * the two containers for the details of the clicked block
 * and for the result of the browsing for one instance.
 * It will also highlights some blocks in the blockchain.
 * It also handles the loading screen with the progress bar
 * to be updated.
 *
 * @author Lucas Trognon <lucas.trognon@epfl.ch>
 * @author Julien von Felten <julien.vonfelten@epfl.ch>
 * @author Rosa José Sara <rosa.josesara@epfl.ch>
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

    // Subject that will be called when a query is launched
    querySubject: [Subject<[SkipBlock[], Instruction[]]>, Subject<number[]>];

    /**
     * Creates an instance of DetailBlock.
     * @param {Subject<SkipBlock>} skipBclickedSubject : Observable for the clicked
     * block. We need this observable to know when a user has clicked on a block,
     * and then display the details of that block.
     * @param {Lifecycle} lifecycle
     * @param {Flash} flash
     * @param {Observable<SkipBlock[]>} loadedSkipBObs : Observable that is
     * notified when new blocks are loaded. This is necessary when we highlights
     * the blocks of an instance lifecycle, because if new blocks are added, some
     * may need to be highlighted.
     * @param {Roster} roster : The associated roster
     * @memberof DetailBlock
     */
    constructor(
        skipBclickedSubject: Subject<SkipBlock>,
        lifecycle: Lifecycle,
        flash: Flash,
        loadedSkipBObs: Observable<SkipBlock[]>,
        roster: Roster
    ) {
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
            next: () => {
                self.highlightBlocks(this.hashHighligh);
            },
        });
    }
    setSearch() {
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

        //Big wrapper for all of the Block details
        const ulBlockDetail = block_detail_container.append("ul");
        ulBlockDetail.attr("multiple", "true");
        ulBlockDetail.attr("class", "clickable-detail-block");

        // Details of the blocks (Verifier, backlinks, forwardlinks) are wrapped in this card
        const blockCard = ulBlockDetail
            .append("div")
            .attr("style", "outline: groove rgba(204, 204, 204, 0.3);");
        blockCard
            .attr("class", "uk-card uk-card-default")
            .attr("id", "detail-window");

        // Header of the card used to display the block index and it's hash
        const blockCardHeader = blockCard.append("div");
        blockCardHeader.attr("class", "uk-card-header  uk-padding-small");

        const blockCardHeaderTitle = blockCardHeader.append("h3");
        blockCardHeaderTitle
            .attr("class", "block-card-content")
            .text(`Block ${block.index}`);

        const blockCardHeaderDetails = blockCardHeader.append("span");

        blockCardHeaderDetails.attr("class", "block-card-header-details");

        //Tooltip for definition of what is a hash
        const hashParagraph = blockCardHeaderDetails.append("p");
        hashParagraph
            .append("svg")
            .attr("width", "20")
            .attr("height", "20")
            .append("image")
            .attr("x", "10%")
            .attr("y", "17%")
            .attr("width", "12")
            .attr("height", "12")
            .attr("href", "assets/information-button-gray.svg")
            .attr(
                "uk-tooltip",
                `The hash of a block is a hexadecimal number, which uniquely identifies the block. It is linked to the previous blocks; which allows to ensure that there aren't any fraudulent transactions and modifications to the blockchain.`
            );

        hashParagraph
            .append("text")
            .text(`Hash : ${block.hash.toString("hex")}`);

        blockCardHeaderDetails
            .append("p")
            .text(`Validated on the ${Utils.getTimeString(block)}`);

        const heightParagraph = blockCardHeaderDetails.append("p");
        heightParagraph
            .append("svg")
            .attr("width", "20")
            .attr("height", "20")
            .append("image")
            .attr("x", "10%")
            .attr("y", "17%")
            .attr("width", "12")
            .attr("height", "12")
            .attr("href", "assets/information-button-gray.svg")
            .attr(
                "uk-tooltip",
                `Determines how many forward and backward links the block contains.`
            );

        heightParagraph.append("text").text(`Height : ${block.height}`);

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
        const ulVerifier = divDetails.append("ul"); // Accordion containing all the verifiers of a block
        ulVerifier.attr("uk-accordion", "");
        const liVerifier = ulVerifier.append("li");
        const aVerifier = liVerifier.append("a");

        aVerifier
            .attr("class", "uk-accordion-title")
            .append("svg")
            .attr("width", "20")
            .attr("height", "20")
            .append("image")
            .attr("x", "10%")
            .attr("y", "17%")
            .attr("width", "12")
            .attr("height", "12")
            .attr("href", "assets/information-button-gray.svg")
            .attr(
                "uk-tooltip",
                `Before a new block is added. A number of verifiers assert that the information contained in it is correct.`
            );

        aVerifier.append("text").text(`Verifiers : ${block.verifiers.length}`);
        const divVerifier = liVerifier.append("div");
        divVerifier.attr("class", "uk-accordion-content"); // Content on the accordion
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
            .append("svg")
            .attr("width", "20")
            .attr("height", "20")
            .append("image")
            .attr("x", "10%")
            .attr("y", "17%")
            .attr("width", "12")
            .attr("height", "12")
            .attr("href", "assets/information-button-gray.svg")
            .attr(
                "uk-tooltip",
                "Backward links are cryptographic hashes of past blocks."
            );
        aBackLink.append("text").text(`Back Links : ${block.backlinks.length}`);
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
                        (await Utils.getBlock(value, self.roster)).index,
                        block.index
                    );
                })
                .attr("uk-tooltip", `${value.toString("hex")}`);
            Utils.clickable(divBackLinkBadge);
        });

        // ForwardLink
        const ulForwardLink = divDetails.append("ul");
        ulForwardLink.attr("uk-accordion", "");
        const liForwardLink = ulForwardLink.append("li");
        const aForwardLink = liForwardLink.append("a");
        aForwardLink
            .attr("class", "uk-accordion-title")
            .append("svg")
            .attr("width", "20")
            .attr("height", "20")
            .append("image")
            .attr("x", "10%")
            .attr("y", "17%")
            .attr("width", "12")
            .attr("height", "12")
            .attr("href", "assets/information-button-gray.svg")
            .attr(
                "uk-tooltip",
                " Forward links are cryptographic signatures of future blocks."
            );
        aForwardLink
            .append("text")
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
                        await (
                            await Utils.getBlock(fl.to, self.roster)
                        ).index,
                        block.index
                    );
                })
                .attr("uk-tooltip", `${fl.to.toString("hex")}`);
            Utils.clickable(divForwardLinkBadge);

            // Because forward links need to be verified, signatures are rendered as well
            // Here a tooltip is created to display all the data needed
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

        const ulRoster = divDetails.append("ul"); // accordion containing all the verifiers of a block
        ulRoster.attr("uk-accordion", "");
        const liRoster = ulRoster.append("li");
        const aRoster = liRoster.append("a");

        aRoster
            .attr("class", "uk-accordion-title")
            .append("svg")
            .attr("width", "20")
            .attr("height", "20")
            .append("image")
            .attr("x", "10%")
            .attr("y", "17%")
            .attr("width", "12")
            .attr("height", "12")
            .attr("href", "assets/information-button-gray.svg")
            .attr(
                "uk-tooltip",
                `The roster is a set of server nodes that validate the transactions of a block.`
            );

        aRoster
            .append("text")
            .text(`Roster nodes: ${block.roster.list.length}`);
        const divRoster = liRoster
            .append("div")
            .attr("class", "uk-accordion-content");

        const pRoster = divRoster.append("p");

        // List of participating conodes in the roster
        const descList: string[] = [];
        const addressList: string[] = [];
        for (let i = 0; i < block.roster.list.length; i++) {
            descList[i] = block.roster.list[i].description;
            addressList[i] = block.roster.list[i].address;
        }

        // Roster group

        // List the roster's node

        let left = 1;
        descList.forEach((node, i) => {
            pRoster
                .append("span")
                .attr("class", "uk-badge")
                .attr("style", "margin: 5px 4px;font-size : 0.875rem;")
                .attr("uk-tooltip", "Address: " + addressList[i])
                .text(node);

            left += 1;
        });

        // Transaction details
        const ulTransaction = transaction_detail_container.append("ul");

        // This card simply hold the title of the section in its header, and lists all transactions
        // in its body
        const transactionCard = ulTransaction
            .append("div")
            .attr("style", "outline: groove rgba(204, 204, 204, 0.3);");
        transactionCard
            .attr("class", "uk-card uk-card-default")
            .attr("id", "detail-window");

        const transactionCardHeader = transactionCard.append("div");
        transactionCardHeader.attr("class", "uk-card-header uk-padding-small");
        transactionCardHeader
            .append("h3")
            .html(Utils.downloadIconScript())
            .attr("class", "download-icon-1")
            .on("click", function () {
                // Auto click on a element, trigger the file download
                const blobConfig = BTexportDataBlob(block);
                // Convert Blob to URL
                const blobUrl = URL.createObjectURL(blobConfig);

                // Create an a element with blob URL
                const anchor = document.createElement("a");
                anchor.href = blobUrl;
                anchor.target = "_blank";
                anchor.download = `block_${block.index}_data.json`;
                anchor.click();
                URL.revokeObjectURL(blobUrl);
            });

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
            // Transaction displaying
            transaction.clientTransaction.instructions.forEach(
                (instruction) => {
                    // This variable helps us keep tracks whether or not we should display
                    //the instruction is a coin transaction between two users.

                    var coin_invoked = false;
                    let args = null;
                    let commandName = null;
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
                        aInstruction
                            .append("svg")
                            .attr("width", "20")
                            .attr("height", "20")
                            .append("image")
                            .attr("x", "10%")
                            .attr("y", "17%")
                            .attr("width", "12")
                            .attr("height", "12")
                            .attr("href", "assets/information-button-gray.svg")
                            .attr(
                                "uk-tooltip",
                                "A new instance of a contract is created."
                            );
                        aInstruction
                            .append("text")
                            .text(`Spawned : ${contractName}`);
                    } else if (instruction.type === Instruction.typeInvoke) {
                        commandName = instruction.invoke.command;
                        const contractName =
                            instruction.invoke.contractID
                                .charAt(0)
                                .toUpperCase() +
                            instruction.invoke.contractID.slice(1);
                        aInstruction
                            .append("svg")
                            .attr("width", "20")
                            .attr("height", "20")
                            .append("image")
                            .attr("x", "10%")
                            .attr("y", "17%")
                            .attr("width", "12")
                            .attr("height", "12")
                            .attr("href", "assets/information-button-gray.svg")
                            .attr(
                                "uk-tooltip",
                                "A function (or command) is executed on the smart contract."
                            );
                        aInstruction
                            .append("text")
                            .text(`Invoked : ${contractName}`);
                        args = instruction.invoke.args;

                        coin_invoked =
                            contractName == "Coin" && args.length > 1;
                    } else if (instruction.type === Instruction.typeDelete) {
                        const contractName =
                            instruction.delete.contractID
                                .charAt(0)
                                .toUpperCase() +
                            instruction.delete.contractID.slice(1);
                        aInstruction
                            .append("svg")
                            .attr("width", "20")
                            .attr("height", "20")
                            .append("image")
                            .attr("x", "10%")
                            .attr("y", "17%")
                            .attr("width", "12")
                            .attr("height", "12")
                            .attr("href", "assets/information-button-gray.svg")
                            .attr(
                                "uk-tooltip",
                                "The instance of the contract is deleted from the ledger."
                            );
                        aInstruction
                            .append("text")
                            .text(`Deleted : ${contractName}`);
                    }

                    const divInstruction = liInstruction.append("div");

                    divInstruction.attr("class", "uk-accordion-content");
                    // Detail of one instruction
                    const pInstruction = divInstruction
                        .append("p")
                        .style("font-family", "monospace");

                    pInstruction
                        .append("svg")
                        .attr("width", "20")
                        .attr("height", "20")
                        .append("image")
                        .attr("x", "10%")
                        .attr("y", "17%")
                        .attr("width", "12")
                        .attr("height", "12")
                        .attr("href", "assets/information-button-gray.svg")
                        .attr(
                            "uk-tooltip",
                            "Unique hexadecimal identifier that is generated whenever a new transaction is executed."
                        );

                    pInstruction
                        .append("text")
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

                    // only added in case of invoke
                    if (commandName != null && commandName != "transfer") {
                        divInstruction
                            .append("p")
                            .text(`Command: ${commandName}`);
                    }

                    // Browse button
                    const searchInstance = divInstruction.append("li");
                    searchInstance
                        .append("span")
                        .attr("class", "search-text")
                        .text(" Search for ");

                    const numberTag = searchInstance
                        .append("span")
                        .append("form")
                        .style("display", "inline");

                    numberTag
                        .append("input")
                        .attr("type", "number")
                        .attr("min", "1")
                        .attr("max", "50000")
                        .attr("id", "queryNumber")
                        .attr("class", "search-value uk-input");

                    const directionTag = numberTag
                        .append("span")
                        .append("form")
                        .style("display", "inline");

                    const directionSelect = directionTag
                        .append("select")
                        .attr("value", "0")
                        .attr("height", "20px")
                        .attr("class", "search-value uk-select");

                    directionSelect
                        .append("option")
                        .attr("value", "0")
                        .text("previous");

                    directionSelect
                        .append("option")
                        .attr("value", "1")
                        .text("next");

                    directionSelect
                        .append("option")
                        .attr("value", "-1")
                        .text("first");

                    directionTag
                        .append("span")
                        .text(" instructions related to this instance ")
                        .style("display", "block");

                    // Search button
                    const searchButton = searchInstance
                        .append("div")
                        .attr("class", "search-button")
                        .append("button");
                    searchButton
                        .attr("class", "uk-button uk-button-default")
                        .text(` Search `);

                    // extract user selection information
                    var chosenQueryNumber = 0;
                    numberTag.on("change", function () {
                        chosenQueryNumber = parseInt(
                            (<HTMLInputElement>(
                                document.getElementById("queryNumber")
                            )).value
                        );
                    });

                    // directionQuery -> backward search
                    var directionQuery = true;
                    var startWithFirstBlock = false;
                    directionSelect.on("change", function () {
                        var query = parseInt(
                            this.options[this.selectedIndex].value
                        );
                        // searched for previous instructions
                        directionQuery = query == 0;
                        //if first we need to start from the first block and not the current clicked block
                        if (query == -1) {
                            startWithFirstBlock = true;
                        }
                    });

                    //if the search button is clicked without any query number selected
                    // a search for the 10 previous instruction will be launched
                    searchButton.on("click", function () {
                        if (chosenQueryNumber != 0) {
                            self.launchQuery(
                                chosenQueryNumber,
                                instruction.instanceID.toString("hex"),
                                directionQuery,
                                startWithFirstBlock
                            );
                        } else {
                            self.launchQuery(
                                10,
                                instruction.instanceID.toString("hex"),
                                directionQuery,
                                startWithFirstBlock
                            );
                        }
                        //scroll to the bottom of the page
                        window.scrollTo(0, document.body.scrollHeight);
                    });
                }
            );
        });
    }

    /**
     * Launches a query for all instructions that are related to an instance ID
     * @public
     * @param {number} chosenQuery : The number of results we want to display
     * @param instanceID : InstanceID of the searched instructions
     * @param direction : Searching for the last or previous blocks
     * @param fromFirstBlock: True if the query is requested from the first block of the chain
     * @memberof DetailBlock
     */

    public launchQuery(
        chosenQuery: number,
        instanceID: string,
        direction: boolean,
        fromFirstBlock: boolean
    ) {
        const self = this;

        const clickedBlockHash = this.clickedBlock.hash
            .toString("hex")
            .valueOf();
        this.querySubject = self.lifecycle.getInstructionSubject(
            instanceID,
            chosenQuery,
            clickedBlockHash,
            direction,
            fromFirstBlock
        );
        self.createLoadingScreen();
        this.querySubject[0].subscribe({
            next: self.printDataBrowsing.bind(self),
        });
        this.querySubject[1].pipe(throttleTime(100)).subscribe({
            complete: self.doneLoading,
            next: ([, seenBlock, totalBlock, nbInstanceFound]) => {
                const rate = Math.round((nbInstanceFound / chosenQuery) * 100);
                self.updateLoadingScreen(
                    rate,
                    seenBlock,
                    totalBlock,
                    nbInstanceFound,
                    chosenQuery
                );
            },
        });
    }

    /**
     * Displays the result of the browsing, highlights the
     * blocks found.
     *
     * @private
     * @param {[SkipBlock[], Instruction[]]} tuple : value of the observable
     browsing.getInstructionSubject function
     * @memberof DetailBlock
     */
    private printDataBrowsing(tuple: [SkipBlock[], Instruction[]]) {
        // Removes previous highlighted blocks
        this.removeHighlighBlocks(this.hashHighligh);
        const self = this;
        // Creates the container for the query results
        const queryContainer = d3.select(".query-answer");
        queryContainer.text("");
        queryContainer.attr("class", "query-answer uk-card uk-card-default");
        // Creates the header used to display the instance ID and the "clear results" button
        const queryHeader = queryContainer.append("p");
        const summaryText = queryHeader
            .attr("id", "query-header")
            .append("div")
            .text(`Evolution of the instance:`)
            .style("padding-left", "450");
        const blocky = blockies.create({
            seed: tuple[1][0].instanceID.toString("hex"),
        });
        summaryText
            .append("object")
            .attr("type", "image/svg+xml")
            .attr("width", 20)
            .attr("height", 20)
            .attr("data", blocky.toDataURL())
            .attr("uk-tooltip", tuple[0][0].hash.toString("hex"))
            .on("click", function () {
                Utils.copyToClipBoard(
                    tuple[1][0].instanceID.toString("hex"),
                    self.flash
                );
            })
            .on("mouseover", function () {
                d3.select(this).style("cursor", "pointer");
            })
            .on("mouseout", function () {
                d3.select(this).style("cursor", "default");
            });

        // Display the download icon
        queryHeader
            .append("div")
            .html(Utils.downloadIconScript())
            .attr("class", "download-icon-2")

            .on("click", function () {
                // Auto click on a element, trigger the file download
                const blobConfig = ISexportDataBlob(tuple);
                // Convert Blob to URL
                const blobUrl = URL.createObjectURL(blobConfig);

                // Create an a element with blob URL
                const anchor = document.createElement("a");
                anchor.href = blobUrl;
                anchor.target = "_blank";
                anchor.download = `instance_search_data.json`;
                anchor.click();

                URL.revokeObjectURL(blobUrl);
            });

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
        const queryCardContainer = queryContainer.append("div");
        queryCardContainer
            .attr("id", "query-card-container")
            .attr("multiple", "true")
            .attr("class", "uk-flex");

        // Creates the instance tracker interface(instruction chain)
        new InstructionChain(this.roster, this.flash, tuple);

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
    //

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
     * Loading screen
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
        const divLoad = this.loadContainer
            .append("div")
            .attr("class", "div-load");
        divLoad.append("h3")
            .html(`<svg id="svg-spinner" xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 48 48">
                  <circle cx="24" cy="4" r="4" fill="#1749b3"/>
                  <circle cx="12.19" cy="7.86" r="3.7" fill="#2552b3"/>
                  <circle cx="5.02" cy="17.68" r="3.4" fill="#365eb3"/>
                  <circle cx="5.02" cy="30.32" r="3.1" fill="#4064b3"/>
                  <circle cx="12.19" cy="40.14" r="2.8" fill="#5271b3"/>
                  <circle cx="24" cy="44" r="2.5" fill="#627cb3"/>
                  <circle cx="35.81" cy="40.14" r="2.2" fill="#7086b3"/>
                  <circle cx="42.98" cy="30.32" r="1.9" fill="#8593b3"/>
                  <circle cx="42.98" cy="17.68" r="1.6" fill="#a7b7da"/>
                  <circle cx="35.81" cy="7.86" r="1.3" fill="#c8ddf0"/>
                </svg>`);
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
            .text(`instructions found: -`);

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
                    self.querySubject[1].complete();
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
     * @param {number} queryNumber
     * @memberof DetailBlock
     */
    private updateLoadingScreen(
        percentage: number,
        seenBlocks: number,
        totalBlocks: number,
        nbInstanceFound: number,
        queryNumber: number
    ) {
        if (nbInstanceFound > 0) {
            this.textBar.text(
                `${percentage}% of instructions found: ${nbInstanceFound}/${queryNumber}`
            );
            this.progressBarItem.style.width = percentage + "%";
        } else {
            this.textBar.text(`instructions found: ${nbInstanceFound}`);
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

/**
 * @author Rosa José Sara
 * Create the Blob that will be used to create the JSON file
 * for the block data exportation
 * @returns a Blob object
 *
 * @param block
 */
function BTexportDataBlob(block: SkipBlock) {
    var transactionData = new Array();
    const body = DataBody.decode(block.payload);
    body.txResults.forEach((transaction) => {
        var instructionData = new Array();
        transaction.clientTransaction.instructions.forEach((instruction) => {
            var argsData = new Array();
            instruction.beautify().args.forEach((arg) => {
                const argsEntries = {
                    name: arg.name,
                    value: arg.value,
                };
                argsData.push(argsEntries);
            });

            let contract = "";
            let action = "";
            if (instruction.type === Instruction.typeSpawn) {
                contract =
                    instruction.spawn.contractID.charAt(0).toUpperCase() +
                    instruction.spawn.contractID.slice(1);
                action = `Spawned:${contract}`;
            } else if (instruction.type === Instruction.typeInvoke) {
                contract =
                    instruction.invoke.contractID.charAt(0).toUpperCase() +
                    instruction.invoke.contractID.slice(1);
                action = `Invoked:${contract}`;
            } else if (instruction.type === Instruction.typeDelete) {
                action = "Deleted";
                contract =
                    instruction.delete.contractID.charAt(0).toUpperCase() +
                    instruction.delete.contractID.slice(1);
            }

            const instructionEntries = {
                instanceID: instruction.instanceID.toString("hex"),
                contract: contract,
                action: action,
                args: argsData,
            };
            instructionData.push(instructionEntries);
        });
        const transactionEntries = {
            accepted: transaction.accepted,
            instructions: instructionData,
        };

        transactionData.push(transactionEntries);
    });

    const previousBlockHash = Utils.bytes2String(block.backlinks[0]);
    var blockData = {
        index: block.index,
        previousBlockIndex: previousBlockHash,
        hash: block.hash.toString("hex"),
        height: block.height,
        transactions: transactionData,
    };
    const json = { Block: blockData };
    // Convert object to Blob
    return new Blob([JSON.stringify(json)], {
        type: "text/json;charset=utf-8",
    });
}

/**
 * @author Rosa José Sara
 * Create the Blob that will be used to create the JSON file
 * for the instance instruction data exportation
 * @param tuple value of the observable obtain from the query
 * @returns a Blob object
 *
 */
function ISexportDataBlob(tuple: [SkipBlock[], Instruction[]]) {
    var instructionData = new Array();
    var blocksData = new Array();
    var currentBlock = tuple[0][0];
    for (let i = 0; i < tuple[1].length; i++) {
        const blocki = tuple[0][i];
        const instruction = tuple[1][i];
        if (currentBlock.index != blocki.index) {
            const blockEntries = {
                "block index": currentBlock.index,
                instructions: instructionData,
            };
            blocksData.push(blockEntries);
            instructionData = new Array();
            currentBlock = blocki;
        }

        var argsData = new Array();
        instruction.beautify().args.forEach((arg) => {
            const argEntries = {
                name: arg.name,
                value: arg.value,
            };
            argsData.push(argEntries);
        });

        let contractID = "";
        let action = "";
        if (instruction.type === Instruction.typeSpawn) {
            contractID =
                instruction.spawn.contractID.charAt(0).toUpperCase() +
                instruction.spawn.contractID.slice(1);
            action = `Spawned:${contractID}`;
        } else if (instruction.type === Instruction.typeInvoke) {
            contractID =
                instruction.invoke.contractID.charAt(0).toUpperCase() +
                instruction.invoke.contractID.slice(1);
            action = `Invoked:${contractID}`;
        } else if (instruction.type === Instruction.typeDelete) {
            action = "Deleted";
            contractID =
                instruction.delete.contractID.charAt(0).toUpperCase() +
                instruction.delete.contractID.slice(1);
        }

        const instructionEntries = {
            contract: contractID,
            action: action,
            args: argsData,
        };
        instructionData.push(instructionEntries);
    }

    //add last instruction set
    const blockEntries = {
        "block index": currentBlock.index,
        instructions: instructionData,
    };
    blocksData.push(blockEntries);

    const json = {
        "instance browsed": tuple[1][0].instanceID.toString("hex"),
        "instructions found by block": blocksData,
    };
    // Convert object to Blob
    return new Blob([JSON.stringify(json)], {
        type: "text/json;charset=utf-8",
    });
}
