import { Instruction } from "@dedis/cothority/byzcoin";
import { DataBody } from "@dedis/cothority/byzcoin/proto";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Observable } from "rxjs";
import { throttleTime } from "rxjs/operators";

import { Browsing } from "./browsing";
import { Flash } from "./flash";

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
 * @class DetailBlock
 */
export class DetailBlock {
  // Observable for the clicked block
  skipBclickedObs: Observable<SkipBlock>;
  clickedBlock: SkipBlock;
  colorBlock: string;
  colorClickedBlock: string;

  // Observable that notifies the updated blocks of blocksDiagram
  loadedSkipBObs: Observable<SkipBlock[]>;

  flash: Flash;
  browsing: Browsing;
  hashHighligh: SkipBlock[];

  // progress bar
  progressBarContainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  progressBar: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  textBar: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  loadContainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  progressBarItem: HTMLElement;

  /**
   * Creates an instance of DetailBlock.
   * @param {Observable<SkipBlock>} skipBclickedObs : Observable for the clicked block
   * @param {Browsing} browsing
   * @param {Flash} flash
   * @param {Observable<SkipBlock[]>} loadedSkipBObs : Observable that notifies
   *                              the updated blocks of blocksDiagram
   * @memberof DetailBlock
   */
  constructor(
    skipBclickedObs: Observable<SkipBlock>,
    browsing: Browsing,
    flash: Flash,
    loadedSkipBObs: Observable<SkipBlock[]>
  ) {
    const self = this;

    this.skipBclickedObs = skipBclickedObs;
    this.skipBclickedObs.subscribe({
      next: this.listTransaction.bind(this),
    });
    this.clickedBlock = null;
    this.colorBlock = "#4772D8"; // must be set differently when we will choose the colors
    this.colorClickedBlock = "#0040D4"; // must be set differently when we will choose the colors

    this.loadedSkipBObs = loadedSkipBObs;
    this.loadedSkipBObs.subscribe({
      next: (value) => {
        self.highlightBlocks(this.hashHighligh);
      },
    });

    this.flash = flash;
    this.browsing = browsing;
    this.hashHighligh = [];

    this.progressBarContainer = undefined;
    this.progressBar = undefined;
    this.textBar = undefined;
    this.loadContainer = undefined;
    this.progressBarItem = undefined;
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
    // (re)set the color of the clickedBlock
    if (this.clickedBlock !== block) {
      if (this.clickedBlock != null) {
        const blockSVG = d3.select(
          `[id = "${this.clickedBlock.hash.toString("hex")}"]`
        );
        blockSVG.attr("fill", this.colorBlock);
      }

      this.clickedBlock = block;
      d3.select(`[id = "${block.hash.toString("hex")}"]`).attr(
        "fill",
        this.colorClickedBlock
      );
    }
    const self = this;
    const transactionContainer = d3.select(".block-detail-container");
    transactionContainer
      .attr("id", "transactionContainer")
      .text("")
      .append("p")
      .text(`Block ${block.index}, Hash: ${block.hash.toString("hex")}`);

    const ulTransaction = transactionContainer.append("ul");
    ulTransaction.attr("uk-accordion", "");
    ulTransaction.attr("multiple", "true");
    ulTransaction.attr("class", "clickable-detail-block");
    const body = DataBody.decode(block.payload);

    // transactions of the block
    body.txResults.forEach((transaction, i) => {
      const accepted: string = transaction.accepted
        ? "Accepted"
        : "Not accepted";
      const liTransaction = ulTransaction.append("li");
      liTransaction.attr("class", "uk-open");
      const aTransaction = liTransaction.append("a");
      let totalInstruction = 0;
      transaction.clientTransaction.instructions.forEach((_, __) => {
        totalInstruction++;
      });
      let s = "";
      if (totalInstruction > 2) {
        s = "s";
      }
      aTransaction
        .attr("class", "uk-accordion-title")
        .attr("href", "#")
        .html(
          `<b>Transaction</b> ${i} ${accepted}, show ${totalInstruction} instruction${s}:`
        );
      const divTransaction = liTransaction.append("div");
      divTransaction.attr("class", "uk-accordion-content");

      const ulInstruction = divTransaction.append("ul");
      ulInstruction.attr("uk-accordion", "");
      // instructions of the transaction
      transaction.clientTransaction.instructions.forEach((instruction, j) => {
        let args = null;
        const liInstruction = ulInstruction.append("li");
        liInstruction.attr("style", "padding-left:15px");
        const aInstruction = liInstruction.append("a");
        aInstruction.attr("class", "uk-accordion-title").attr("href", "#");

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
          .text(`Instance ID: ${instruction.instanceID.toString("hex")}`);
        divInstruction.append("p").text("Arguments:");
        // Args of the instruction
        const ulArgs = divInstruction.append("ul");
        ulArgs.attr("uk-accordion", "");
        args.forEach((arg, i) => {
          const liArgs = ulArgs.append("li");
          const aArgs = liArgs.append("a");
          aArgs.attr("class", "uk-accordion-title").attr("href", "#");
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
          .on("click", function () {
            const conf = confirm(
              `Do you really want to browse the whole blockchain with the instance ID: ${instruction.instanceID.toString(
                "hex"
              )}? \nThis may take a while!`
            );
            if (conf) {
              self.createLoadingScreen();
              const subjects = self.browsing.getInstructionSubject(instruction);
              subjects[0].subscribe({
                next: self.printDataBrowsing.bind(self),
              });
              // throttleTime: ignores the values for the 100 first ms
              subjects[1].pipe(throttleTime(100)).subscribe({
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
                }, // tslint:disable-next-line
                complete: self.doneLoading,
              });
            } else {
              self.flash.display(Flash.flashType.INFO, "Browsing cancelled");
            }
          });
      });
    });
    // Details of the blocks (Verifier, backlinks, forwardlinks)
    const liDetails = ulTransaction.append("li");
    liDetails.attr("class", "uk-open");
    const aDetails = liDetails.append("a");
    aDetails
      .attr("class", "uk-accordion-title")
      .attr("href", "#")
      .html("<b>Block details</b>");

    const divDetails = liDetails.append("div");
    divDetails.attr("class", "uk-accordion-content");

    // Verifier details
    const ulVerifier = divDetails.append("ul");
    ulVerifier.attr("uk-accordion", "");
    const liVerifier = ulVerifier.append("li");
    const aVerifier = liVerifier.append("a");
    aVerifier
      .attr("class", "uk-accordion-title")
      .attr("href", "#")
      .text(`Verifiers: ${block.verifiers.length}`);
    const divVerifier = liVerifier.append("div");
    divVerifier.attr("class", "uk-accordion-content");
    block.verifiers.forEach((uid, j) => {
      divVerifier
        .append("p")
        .text(` Verifier: ${j} , ID: ${uid.toString("hex")}`);
    });

    // BackLink details
    const ulBackLink = divDetails.append("ul");
    ulBackLink.attr("uk-accordion", "");
    const liBackLink = ulBackLink.append("li");
    const aBackLink = liBackLink.append("a");
    aBackLink
      .attr("class", "uk-accordion-title")
      .attr("href", "#")
      .text(`BackLinks: ${block.backlinks.length}`);
    const divBackLink = liBackLink.append("div");
    divBackLink.attr("class", "uk-accordion-content");
    block.backlinks.forEach((value, j) => {
      divBackLink
        .append("p")
        .text(`Backlink: ${j}, Value: ${value.toString("hex")}`);
    });

    // ForwardLink
    const ulForwardLink = divDetails.append("ul");
    ulForwardLink.attr("uk-accordion", "");
    const liForwardLink = ulForwardLink.append("li");
    const aForwardLink = liForwardLink.append("a");
    aForwardLink
      .attr("class", "uk-accordion-title")
      .attr("href", "#")
      .text(`ForwardLinks: ${block.forwardLinks.length}`);
    const divForwardLink = liForwardLink.append("div");
    divForwardLink.attr("class", "uk-accordion-content");
    block.forwardLinks.forEach((fl, j) => {
      divForwardLink.append("p").text(`From: ${fl.from.toString("hex")}`);
      divForwardLink.append("p").text(`Hash: ${fl.hash().toString("hex")}`);
      divForwardLink
        .append("p")
        .text(`signature: ${fl.signature.sig.toString("hex")}`);
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
        `Summary of the instance: ${tuple[1][0].instanceID.toString("hex")}`
      );
    const ulInstructionB = browseContainer.append("ul");
    ulInstructionB.attr("uk-accordion", "");
    ulInstructionB.attr("multiple", "true");

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
        blocki.hash.toString("hex") === this.clickedBlock.hash.toString("hex")
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
        .text(`Hash of instanceID is: ${instruction.hash().toString("hex")}`);
      divInstructionB.append("p").text(`contractID: ${contractID}`);
      divInstructionB
        .append("p")
        .text(`In the block: ${blocki.hash.toString("hex")}`);
      divInstructionB.append("p").text("Arguments: ");
      const ulArgsB = divInstructionB.append("ul");
      ulArgsB.attr("uk-accordion", "");
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
      const blockSVG = d3.select(`[id = "${blocks[i].hash.toString("hex")}"]`);
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
      const blockSVG = d3.select(`[id = "${blocks[i].hash.toString("hex")}"]`);
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
    const divLoad = this.loadContainer.append("div").attr("class", "div-load");
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
      .attr("class", "cancelButton")
      .attr("id", "cancelButton")
      .text("Abort research")
      // tslint:disable-next-line
      .on("click", function () {
        const conf = confirm("Are you sure you want to abort the browse?");
        if (conf) {
          self.browsing.abort = true;
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
        `${percentage}% --- block parsed: ${seenBlocks}/ ${totalBlocks} and instances found: ${nbInstanceFound}`
      );
      this.progressBarItem.style.width = percentage + "%";
    } else {
      this.textBar.text(
        `???%  --  Seen blocks: ${seenBlocks}/ Total blocks: ???. Nombre of instances found: ${nbInstanceFound}`
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
