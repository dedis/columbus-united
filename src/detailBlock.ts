import { Instruction } from "@dedis/cothority/byzcoin";
import { DataBody } from "@dedis/cothority/byzcoin/proto";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Observable } from "rxjs";

import { Browsing } from "./browsing";
import { Flash } from "./flash";

export class DetailBlock {
  skipbObservable: Observable<SkipBlock>;
  transactionContainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  browsing: Browsing;
  browseContainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  clickedBlock: SkipBlock;
  progressBarContainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  progressBar: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  textBar: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  loadContainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  flash: Flash;

  constructor(
    observerSkip: Observable<SkipBlock>,
    subjectInstru: Browsing,
    flash: Flash
  ) {
    this.transactionContainer = d3
      .select("body")
      .append("div")
      .attr("class", "blocksDetailcontainer");
    this.browseContainer = d3
      .select("body")
      .append("div")
      .attr("class", "container");
    this.skipbObservable = observerSkip;
    this.skipbObservable.subscribe({
      next: this.listTransaction.bind(this),
    });
    this.browsing = subjectInstru;
    this.clickedBlock = null;

    this.progressBarContainer = undefined;
    this.progressBar = undefined;
    this.textBar = undefined;
    this.flash = flash;
    this.loadContainer = undefined;
  }

  private listTransaction(block: SkipBlock) {
    this.clickedBlock = block;
    const self = this;
    this.transactionContainer.text(
      `Block ${block.index}, Hash: ${block.hash.toString("hex")}`
    );
    const body = DataBody.decode(block.payload);
    body.txResults.forEach((transaction, i) => {
      const accepted: string = transaction.accepted
        ? "Accepted"
        : "Not accepted";
      this.transactionContainer
        .append("button")
        .attr("class", "oneDetailButton")
        .attr("id", "buttonTransaction")
        .text(`Transaction ${i} ${accepted}`);
      const textContainer = this.transactionContainer
        .append("div")
        .attr("class", "oneDetailText");

      transaction.clientTransaction.instructions.forEach((instruction, j) => {
        let args = null;
        if (instruction.type === Instruction.typeSpawn) {
          textContainer
            .append("button")
            .attr("class", "oneDetailButton")
            .attr("id", "buttonInstruction")
            .text(
              `Spawn instruction ${j}, name of contract: ${instruction.spawn.contractID}`
            );
          args = instruction.spawn.args;
        } else if (instruction.type === Instruction.typeInvoke) {
          textContainer
            .append("button")
            .attr("class", "oneDetailButton")
            .attr("id", "buttonInstruction")
            .text(
              `Invoke instruction ${j}, name of contract: ${instruction.invoke.contractID}`
            );
          args = instruction.invoke.args;
        } else if (instruction.type === Instruction.typeDelete) {
          textContainer
            .append("button")
            .attr("class", "oneDetailButton")
            .attr("id", "buttonInstruction")
            .text(
              `Delete instruction ${j}, name of contract:${instruction.delete.contractID}`
            );
        }
        const textInstruction = textContainer
          .append("div")
          .attr("class", "oneDetailText");
        textInstruction
          .append("p")
          .text(`Hash:${instruction.hash().toString("hex")}`);
        textInstruction
          .append("p")
          .text(`Instance ID: ${instruction.instanceID.toString("hex")}`);
        args.forEach((arg, i) => {
          textInstruction
            .append("button")
            .attr("class", "oneDetailButton")
            .attr("id", "buttonArgs")
            .text(`${i}) ${arg.name}`);
          const argsValue = textInstruction
            .append("div")
            .attr("class", "oneDetailText");
          argsValue.append("p").text(`${arg.value}`);
        });

        textInstruction
          .append("button")
          .attr("class", "oneDetailButton")
          .attr("id", "buttonBrowse")
          .text(`Search for all instance of this ID in the blockchain`)
          .on("click", function () {
            let conf = confirm(`Do you really want to browse the whole blockchain with the instance ID: ${instruction.instanceID.toString("hex")}? \nThis may take a while!`);
            if (conf) {
              self.createProgressBar();
              const subjects = self.browsing.getInstructionSubject(instruction);
              subjects[0].subscribe({
                next: self.printDataBrowsing.bind(self),
              });
              subjects[1].subscribe({
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
                },
                complete: self.doneLoading,
              });
            }else{
              self.flash.display(Flash.flashType.INFO, "Browsing cancelled")
            }
          });
      });
    });

    this.transactionContainer
      .append("button")
      .attr("class", "oneDetailButton")
      .attr("id", "buttonDetailBlock")
      .text(`Block details`);
    const detailsBlock = this.transactionContainer
      .append("div")
      .attr("class", "oneDetailText");
    detailsBlock
      .append("button")
      .attr("class", "oneDetailButton")
      .attr("id", "buttonVerifiers")
      .text(`Verifiers: ${block.verifiers.length}`);
    const verifiersContainer = detailsBlock
      .append("div")
      .attr("class", "oneDetailText");

    block.verifiers.forEach((uid, j) => {
      verifiersContainer
        .append("p")
        .text(`Verifier: ${j} , ID: ${uid.toString("hex")}`);
    });

    detailsBlock
      .append("button")
      .attr("class", "oneDetailButton")
      .attr("id", "buttonBacklinks")
      .text(`Backlinks: ${block.backlinks.length}`);
    const backLinksContainer = detailsBlock
      .append("div")
      .attr("class", "oneDetailText");
    block.backlinks.forEach((value, j) => {
      backLinksContainer
        .append("p")
        .text(`Backlink: ${j}, Value: ${value.toString("hex")}`);
    });

    detailsBlock
      .append("button")
      .attr("class", "oneDetailButton")
      .attr("id", "buttonForwardLinks")
      .text(`ForwardLinks:${block.forwardLinks.length}`);
    const forwardsContainer = detailsBlock
      .append("div")
      .attr("class", "oneDetailText");
    block.forwardLinks.forEach((fl, j) => {
      forwardsContainer
        .append("p")
        .text(
          `From: ${fl.from.toString("hex")}, Hash: ${fl.hash().toString("hex")}`
        );
      forwardsContainer
        .append("p")
        .text(`signature: ${fl.signature.sig.toString("hex")}`);
    });

    const acc1 = document.querySelectorAll(
      "[id=buttonTransaction], [id=buttonInstruction], [id=buttonArgs]"
    );
    const acc2 = document.querySelectorAll(
      "[id=buttonDetailBlock], [id=buttonVerifiers], [id=buttonBacklinks], [id=buttonForwardLinks]"
    );
    this.addClickListener(acc1);
    this.addClickListener(acc2);
  }
  private addClickListener(acc: NodeListOf<Element>) {
    for (const button of acc) {
      button.addEventListener("click", function () {
        this.classList.toggle("active");
        const panel = this.nextElementSibling;
        if (panel.style.display === "block") {
          panel.style.display = "none";
        } else {
          panel.style.display = "block";
        }
      });
    }
  }

  private printDataBrowsing(tuple: [string[], Instruction[]]) {
    this.browseContainer.text(
      `Summary of the instance: ${tuple[1][0].instanceID.toString("hex")}`
    );
    for (let i = 0; i < tuple[0].length; i++) {
      const instruction = tuple[1][i];
      let button = null;
      let args = null;
      let argsList: d3.Selection<
        HTMLParagraphElement,
        unknown,
        HTMLElement,
        any
      > = null;
      let textContainer = null;
      if (instruction.type === Instruction.typeSpawn) {
        button = this.browseContainer
          .append("button")
          .attr("class", "oneDetailButton")
          .attr("id", "buttonInstance")
          .text(
            `Spawn with instanceID: ${instruction.instanceID.toString(
              "hex"
            )}, and Hash is: ${instruction.hash().toString("hex")}`
          );
        textContainer = this.browseContainer
          .append("div")
          .attr("class", "oneDetailText");
        textContainer.append("p").text(`In the block: ${tuple[0][i]}`);
        textContainer
          .append("p")
          .text(`ContractID: ${instruction.spawn.contractID}`);
        args = instruction.spawn.args;
      } else if (instruction.type === Instruction.typeInvoke) {
        button = this.browseContainer
          .append("button")
          .attr("class", "oneDetailButton")
          .attr("id", "buttonInstance")
          .text(
            `Invoke with instanceID: ${instruction.instanceID.toString(
              "hex"
            )}, and Hash is: ${instruction.hash().toString("hex")}`
          );
        textContainer = this.browseContainer
          .append("div")
          .attr("class", "oneDetailText");
        textContainer.append("p").text(`In the block: ${tuple[0][i]}`);
        textContainer
          .append("p")
          .text(`ContractID: ${instruction.invoke.contractID}`);
        args = instruction.invoke.args;
      } else if (instruction.type === Instruction.typeDelete) {
        button = this.browseContainer
          .append("button")
          .attr("class", "oneDetailButton")
          .attr("id", "buttonInstance")
          .text(
            `Delete with instanceID: ${instruction.instanceID.toString(
              "hex"
            )}, and Hash is: ${instruction.hash().toString("hex")}`
          );
        const textContainer = this.browseContainer
          .append("div")
          .attr("class", "oneDetailText");
        textContainer
          .append("p")
          .text(`ContractID: ${instruction.delete.contractID}`);
      }
      textContainer
        .append("button")
        .attr("class", "oneDetailButton")
        .attr("id", "buttonInstanceArgs")
        .text(`args are:`);
      const argsDetails = textContainer
        .append("div")
        .attr("class", "oneDetailText");
      argsList = argsDetails.append("p");
      args.forEach((arg, i) => {
        argsList
          .append("button")
          .attr("class", "oneDetailButton")
          .attr("id", "buttonInstanceArg")
          .text(`${i}) ${arg.name}`);
        const argsValue = argsList.append("div").attr("class", "oneDetailText");
        argsValue.append("p").text(`${arg.value}`);
      });
      if (tuple[0][i] === this.clickedBlock.hash.toString("hex")) {
        button.style("background-color", "red");
      }
    }
    const acc1 = document.querySelectorAll(
      "[id=buttonInstance], [id=buttonInstanceArgs], [id=buttonInstanceArg]"
    );
    this.addClickListener(acc1);
  }

  private createProgressBar() {
    const self = this;
    this.loadContainer = d3
      .select("body")
      .append("div")
      .attr("class", "loadContainer")
      .text("CA LOAD");
    this.progressBarContainer = this.loadContainer
      .append("div")
      .attr("id", "progressBarContainer");
    this.progressBar = this.progressBarContainer
      .append("div")
      .attr("id", "progressBar");
    this.textBar = this.progressBar
      .append("div")
      .attr("id", "textBar")
      .text("0%");
    this.loadContainer.append("div").attr("class", "loader");
    this.loadContainer
      .append("button")
      .attr("id", "cancelButton")
      .text("ANNULATIOOOOOOOOOOOOOOOOOOOOOON")
      .on("click", function () {
        self.browsing.abort = true;
      });
  }
  private updateProgressBar(
    percentage: number,
    seenBlocks: number,
    totalBlocks: number,
    nbInstanceFound: number
  ) {
    this.textBar.text(
      `${percentage}%  --  Seen blocks: ${seenBlocks}/ Total blocks: ${totalBlocks}. Nombre of instances found: ${nbInstanceFound}`
    );
    document.getElementById("progressBar").style.width = percentage + "%";
  }
  private doneLoading() {
    d3.select(".loadContainer").remove();
  }
}
