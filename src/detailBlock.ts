import { Instruction } from "@dedis/cothority/byzcoin";
import { DataBody } from "@dedis/cothority/byzcoin/proto";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Observable } from "rxjs";
import { throttleTime } from "rxjs/operators";

import { Browsing } from "./browsing";
import { Flash } from "./flash";

export class DetailBlock {
  skipbObservable: Observable<SkipBlock>;
  browsing: Browsing;
  clickedBlock: SkipBlock;
  progressBarContainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  progressBar: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  textBar: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  hashHighligh: string[];
  updateObserver: Observable<SkipBlock[]>;
  colorBlock: string;
  colorClickedBlock: string;
  loadContainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  flash: Flash;
  progressBarItem: HTMLElement;

  constructor(
    observerSkip: Observable<SkipBlock>,
    subjectInstru: Browsing,
    flash: Flash,
    updateObserver: Observable<SkipBlock[]>
  ) {
    const self = this;
    this.skipbObservable = observerSkip;
    this.skipbObservable.subscribe({
      next: this.listTransaction.bind(this),
    });
    this.browsing = subjectInstru;
    this.clickedBlock = null;

    this.progressBarContainer = undefined;
    this.progressBar = undefined;
    this.textBar = undefined;
    this.hashHighligh = [];
    this.updateObserver = updateObserver;
    this.updateObserver.subscribe({
      next: (value) => {
        self.highlightBlocks(this.hashHighligh);
      },
    });
    this.colorBlock = "#1b6f8a"; // must be set differently when we will choose the colors
    this.colorClickedBlock = "#a6f8b2"; // must be set differently when we will choose the colors
    this.flash = flash;
    this.loadContainer = undefined;
    this.progressBarItem = undefined;
  }

  private listTransaction(block: SkipBlock) {
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
    const transactionContainer = d3.select(".blockDetailcontainer");
    transactionContainer
      .attr("id", "transactionContainer")
      .text("")
      .append("p")
      .text(`Block ${block.index}, Hash: ${block.hash.toString("hex")}`);

    const ulTransaction = transactionContainer.append("ul");
    ulTransaction.attr("uk-accordion", "");
    ulTransaction.attr("multiple", "true");
    const body = DataBody.decode(block.payload);
    body.txResults.forEach((transaction, i) => {
      const accepted: string = transaction.accepted
        ? "Accepted"
        : "Not accepted";
      const liTransaction = ulTransaction.append("li");
      const aTransaction = liTransaction.append("a");
      let totalInstruction = 0;
      transaction.clientTransaction.instructions.forEach((_, __) => {
        totalInstruction++;
      });

      aTransaction
        .attr("class", "uk-accordion-title")
        .attr("href", "#")
        .text(
          `\u22B3 Transaction ${i} ${accepted}, #instructions: ${totalInstruction}`
        );

      const divTransaction = liTransaction.append("div");
      divTransaction.attr("class", "uk-accordion-content");
      const ulInstruction = divTransaction.append("ul");
      ulInstruction.attr("uk-accordion", "");

      transaction.clientTransaction.instructions.forEach((instruction, j) => {
        let args = null;
        const liInstruction = ulInstruction.append("li");
        const aInstruction = liInstruction.append("a");
        aInstruction.attr("class", "uk-accordion-title").attr("href", "#");

        if (instruction.type === Instruction.typeSpawn) {
          aInstruction.text(
            `\u2022 Spawn instruction ${j}, name of contract: ${instruction.spawn.contractID}`
          );
          args = instruction.spawn.args;
        } else if (instruction.type === Instruction.typeInvoke) {
          aInstruction.text(
            `\u2022 Invoke instruction ${j}, name of contract: ${instruction.invoke.contractID}`
          );
          args = instruction.invoke.args;
        } else if (instruction.type === Instruction.typeDelete) {
          aInstruction.text(
            `\u2022 Delete instruction ${j}, name of contract:${instruction.delete.contractID}`
          );
        }

        const divInstruction = liInstruction.append("div");
        divInstruction.attr("class", "uk-accordion-content");
        divInstruction
          .append("p")
          .text(`Hash:${instruction.hash().toString("hex")}`);
        divInstruction
          .append("p")
          .text(`Instance ID: ${instruction.instanceID.toString("hex")}`);
        const ulArgs = divInstruction.append("ul");
        ulArgs.attr("uk-accordion", "");
        args.forEach((arg, i) => {
          const liArgs = ulArgs.append("li");
          const aArgs = liArgs.append("a");
          aArgs.attr("class", "uk-accordion-title").attr("href", "#");
          aArgs.text(`${i}) ${arg.name}`);
          const divArgs = liArgs.append("div");
          divArgs.attr("class", "uk-accordion-content");
          divArgs.append("p").text(`${arg.value}`);
        });
        const searchInstance = divInstruction.append("button");
        searchInstance
          .attr("id", "buttonBrowse")
          .attr("class", "uk-button uk-button-default")
          .text(
            `Search for all instance with the ID: "${instruction.instanceID.toString(
              "hex"
            )}" in the blockchain`
          )
          .on("click", function () {
            const conf = confirm(
              `Do you really want to browse the whole blockchain with the instance ID: ${instruction.instanceID.toString(
                "hex"
              )}? \nThis may take a while!`
            );
            if (conf) {
              self.createProgressBar();
              const subjects = self.browsing.getInstructionSubject(instruction);
              subjects[0].subscribe({
                next: self.printDataBrowsing.bind(self),
              });
              subjects[1].pipe(throttleTime(100)).subscribe({
                next: ([
                  percentage,
                  seenBlock,
                  totalBlock,
                  nbInstanceFound,
                ]) => {
                  self.updateProgressBar(
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

    const liDetails = ulTransaction.append("li");
    const aDetails = liDetails.append("a");
    aDetails
      .attr("class", "uk-accordion-title")
      .attr("href", "#")
      .text("Block details");

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
      .text(`\u2022 Verifiers: ${block.verifiers.length}`);
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
      .text(`\u2022 BackLinks: ${block.backlinks.length}`);
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
      .text(`\u2022 ForwardLinks: ${block.forwardLinks.length}`);
    const divForwardLink = liForwardLink.append("div");
    divForwardLink.attr("class", "uk-accordion-content");
    block.forwardLinks.forEach((fl, j) => {
      divForwardLink.append("p").text(`From: ${fl.from.toString("hex")}`);
      divForwardLink.append("p").text(`Hash: ${fl.hash().toString("hex")}`);
      divForwardLink
        .append("p")
        .text(
          `signature: ${fl.signature.sig
            .toString("hex")
            .slice(0, fl.hash().toString("hex").length - 6)}`
        );
      divForwardLink
        .append("p")
        .text(
          `${fl.signature.sig
            .toString("hex")
            .slice(fl.hash().toString("hex").length - 6)}`
        );
    });
  }

  private printDataBrowsing(tuple: [string[], Instruction[]]) {
    const browseContainer = d3.select(".container");
    this.removeHighlighBlocks(this.hashHighligh);

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
      const instruction = tuple[1][i];
      const liInstructionB = ulInstructionB.append("li");
      const aInstructionB = liInstructionB.append("a");
      aInstructionB.attr("class", "uk-accordion-title").attr("href", "#");
      let contractID = "";
      let args = null;
      if (instruction.type === Instruction.typeSpawn) {
        aInstructionB
          .attr("id", `buttonInstance${i}`)
          .text(
            `${i}) Spawn: Hash of instanceID is: ${instruction
              .hash()
              .toString("hex")}`
          );
        contractID = `ContractID: ${instruction.spawn.contractID}`;
        args = instruction.spawn.args;
      } else if (instruction.type === Instruction.typeInvoke) {
        aInstructionB
          .attr("id", `buttonInstance${i}`)
          .text(
            `${i}) Invoke: Hash of instanceID is: ${instruction
              .hash()
              .toString("hex")}`
          );
        contractID = `ContractID: ${instruction.invoke.contractID}`;
        args = instruction.invoke.args;
      } else if (instruction.type === Instruction.typeDelete) {
        aInstructionB
          .attr("id", `buttonInstance${i}`)
          .text(
            `${i}) Delete: Hash of instanceID is: ${instruction
              .hash()
              .toString("hex")}`
          );
        contractID = `ContractID: ${instruction.delete.contractID}`;
      }
      if (tuple[0][i] === this.clickedBlock.hash.toString("hex")) {
        aInstructionB.style("background-color", "red");
      }
      const divInstructionB = liInstructionB.append("div");
      divInstructionB.attr("class", "uk-accordion-content");
      divInstructionB.append("p").text(`In the block: ${tuple[0][i]}`);
      divInstructionB.append("p").text(contractID);

      const ulDetailB = divInstructionB.append("ul");
      ulDetailB.attr("uk-accordion", "");
      const liDetailB = ulDetailB.append("li");
      const aDetailB = liDetailB.append("a");
      aDetailB
        .attr("class", "uk-accordion-title")
        .attr("href", "#")
        .text("Click to see the arguments");
      const divDetailB = liDetailB.append("div");
      divDetailB.attr("class", "uk-accordion-content");
      let totalArgs = 0;
      args.forEach((_, __) => {
        totalArgs++;
      });
      divDetailB.append("p").text(`Total number of arguments: ${totalArgs}`);
      const ulArgsB = divDetailB.append("ul");
      ulArgsB.attr("uk-accordion", "");
      args.forEach((arg, i) => {
        const liArgsB = ulArgsB.append("li");
        const aArgsB = liArgsB.append("a");
        aArgsB
          .attr("class", "uk-accordion-title")
          .attr("href", "#")
          .text(`${i}) ${arg.name}`);
        const divArgsB = liArgsB.append("div");
        divArgsB.attr("class", "uk-accordion-content");
        divArgsB.append("p").text(`${arg.value}`);
      });
    }
    this.highlightBlocks(tuple[0]);
    this.hashHighligh = tuple[0];
  }

  private highlightBlocks(hashs: string[]) {
    for (let i = 0; i < hashs.length; i++) {
      const blockSVG = d3.select(`[id = "${hashs[i]}"]`);
      const button = d3.select(`#buttonInstance${i}`);
      if (!blockSVG.empty()) {
        blockSVG.attr("stroke", "red").attr("stroke-width", 5);
      } // tslint:disable-next-line
      button.on("mouseover", function () {
        blockSVG.attr("stroke", "green").attr("stroke-width", 15);
      }); // tslint:disable-next-line
      button.on("mouseout", function () {
        blockSVG.attr("stroke", "red").attr("stroke-width", 5);
      });
    }
  }

  private removeHighlighBlocks(hashs: string[]) {
    for (let i = 0; i < hashs.length; i++) {
      const blockSVG = d3.select(`[id = "${hashs[i]}"]`);
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

  private createProgressBar() {
    const self = this;
    this.loadContainer = d3
      .select("body")
      .append("div")
      .attr("class", "loadContainer");
    this.loadContainer
      .append("div")
      .attr("class", "logo") // tslint:disable-next-line
      .on("click", function () {
        window.open("https://www.epfl.ch/labs/dedis/");
      });
    const divLoad = this.loadContainer.append("div").attr("class", "divLoad");
    divLoad.append("div").attr("class", "loader");

    this.progressBarContainer = this.loadContainer
      .append("div")
      .attr("id", "progressBarContainer");

    this.progressBar = this.progressBarContainer
      .append("div")
      .attr("id", "progressBar");
    this.textBar = this.progressBarContainer
      .append("div")
      .attr("id", "textBar")
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
    this.progressBarItem = document.getElementById("progressBar");
  }
  private updateProgressBar(
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
  private doneLoading() {
    d3.select(".loadContainer").remove();
  }
}
