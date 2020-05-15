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
  hashHighligh: string[];
  updateObserver: Observable<SkipBlock[]>;
  colorBlock: string;
  colorClickedBlock: string;
  loadContainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  flash: Flash;
  constructor(
    observerSkip: Observable<SkipBlock>,
    subjectInstru: Browsing,
    flash: Flash,
    updateObserver: Observable<SkipBlock[]>
  ) {
    const self = this;
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
        // tslint:disable-next-line
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
          // tslint:disable-next-line
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
                }, // tslint:disable-next-line
                complete: self.doneLoading,
              });
            } else {
              self.flash.display(Flash.flashType.INFO, "Browsing cancelled");
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
      // tslint:disable-next-line
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
    this.removeHighlighBlocks(this.hashHighligh);
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
          .attr("id", `buttonInstance${i}`)
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
          .attr("id", `buttonInstance${i}`)
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
          .attr("id", `buttonInstance${i}`)
          .text(
            `Delete with instanceID: ${instruction.instanceID.toString(
              "hex"
            )}, and Hash is: ${instruction.hash().toString("hex")}`
          ); // tslint:disable-next-line
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
      // tslint:disable-next-line
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
      "[id^='buttonInstance'], [id=buttonInstanceArgs], [id=buttonInstanceArg]"
    );
    this.addClickListener(acc1);
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
  }
  private updateProgressBar(
    percentage: number,
    seenBlocks: number,
    totalBlocks: number,
    nbInstanceFound: number
  ) {
    if(totalBlocks > 0){
    this.textBar.text(
      `${percentage}% --- block parsed: ${seenBlocks}/ ${totalBlocks} and instances found: ${nbInstanceFound}`
    );
    document.getElementById("progressBar").style.width = percentage + "%";  //TODO: paramètre de classe
    }else{
      this.textBar.text(
        `???%  --  Seen blocks: ${seenBlocks}/ Total blocks: ???. Nombre of instances found: ${nbInstanceFound}`
      )
    }
  }
  private doneLoading() {
    d3.select(".loadContainer").remove();
  }
}
