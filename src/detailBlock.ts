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
      next: this.listTransaction2.bind(this),
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

  private listTransaction2(block: SkipBlock) {
    const self = this;
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
    }/*
    const transactionContainer = d3.select(".blockDetailcontainer");
    transactionContainer
      .attr("id", "transactionContainer")
      .text("")
      .append("p")
      .text(`Block ${block.index}, Hash: ${block.hash.toString("hex")}`);
    const ulTransaction = transactionContainer.append("ul");
    ulTransaction.attr("uk-accordion", "").attr("multiple", "true");
    const body = DataBody.decode(block.payload);
    body.txResults.forEach((transaction, i) => {
      const accepted: string = transaction.accepted
        ? "Accepted"
        : "Not accepted";
      let totalInstruction = 0;
      transaction.clientTransaction.instructions.forEach((_, __) => {
        totalInstruction++;
      });
      const liTransaction = ulTransaction.append("li");
      const aTransaction = liTransaction.append("a");
      aTransaction
        .attr("class", "uk-accordion-title")
        .attr("href", "#")
        .text(
          `\u22B3 Transaction ${i} ${accepted}, #instructions: ${totalInstruction}`
        );
    });*/
    const transactionContainer = d3.select(".blockDetailcontainer");

    // This is an example using the uiukit library that will be removed	
    // in the next PR where the interface will be adapted using this library	
    const ul = d3.select("body").append("ul"); // 1: add first element to html	
    ul.attr("uk-accordion", ""); // add the attribute: <ul uk-accordion </u>	
    ul.attr("multiple", "true"); // Options can be added: to open multiple lines at the same time here for example	
    const li = ul.append("li"); // append li	
    const a = li.append("a"); // append a	
    a.attr("class", "uk-accordion-title").attr("href", "#").text("Item 1");	
    const div = li.append("div");	
    div.attr("class", "uk-accordion-content");	
    div	
      .append("p")	
      .text(	
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua"	
      );	

    const li2 = ul.append("li");	
    const a2 = li2.append("a");	
    a2.attr("class", "uk-accordion-title").attr("href", "#").text("Item 2");	
    const div2 = li2.append("div");	
    div2.attr("class", "uk-accordion-content");	
    div2	
      .append("p")	
      .text(	
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua"	
      );	





  }

  private listTransaction(block: SkipBlock) {
    // This is an example using the uiukit library that will be removed
    // in the next PR where the interface will be adapted using this library
    const ul = d3.select("body").append("ul"); // 1: add first element to html
    ul.attr("uk-accordion", ""); // add the attribute: <ul uk-accordion </u>
    ul.attr("multiple", "true"); // Options can be added: to open multiple lines at the same time here for example
    const li = ul.append("li"); // append li
    const a = li.append("a"); // append a
    a.attr("class", "uk-accordion-title").attr("href", "#").text("Item1");
    const div = li.append("div");
    div.attr("class", "uk-accordion-content");
    let newul = div.append("ul");
    newul
      .attr("uk-accordion", "")
      .attr("multiple", "true")
      .attr("class", ".uk-padding-small");
    let newli = newul.append("li");
    let newa = newli.append("a");
    newa.attr("class", "uk-accordion-title").attr("href", "#").text("Item1.1");
    let newdiv = newli.append("div");
    newdiv
      .attr("class", "uk-accordion-content")
      .attr("class", ".uk-padding-left-small");
    newdiv.append("p").text("c'est ouf si on voit ca");

    const li2 = ul.append("li"); // append li
    const a2 = li2.append("a"); // append a
    a2.attr("class", "uk-accordion-title").attr("href", "#").text("item 2");
    const div2 = li2.append("div");
    div2.attr("class", "uk-accordion-content");
    div2
      .append("p")
      .attr("class", ".uk-padding-left-small")
      .text("Text2 inside tiem 2");

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
    const transactionContainer = d3.select(".blockDetailcontainer");
    const self = this;
    transactionContainer
      .attr("id", "transactionContainer")
      .text("")
      .append("p")
      .text(
        // empty text must remains in order to redraw the transactionContainer at each click
        `Block ${block.index}, Hash: ${block.hash.toString("hex")}`
      );
    const body = DataBody.decode(block.payload);
    body.txResults.forEach((transaction, i) => {
      const accepted: string = transaction.accepted
        ? "Accepted"
        : "Not accepted";
      const buttonDetail1 = transactionContainer
        .append("button")
        .attr("class", "detailTransactionButton")
        .attr("id", "buttonTransaction");
      let totalInstruction = 0;
      transaction.clientTransaction.instructions.forEach((_, __) => {
        totalInstruction++;
      });
      buttonDetail1
        .append("p")
        .text(
          `\u22B3 Transaction ${i} ${accepted}, #instructions: ${totalInstruction}`
        );
      const textContainer = transactionContainer
        .append("div")
        .attr("class", "detailTransactionContainer");

      transaction.clientTransaction.instructions.forEach((instruction, j) => {
        let args = null;
        if (instruction.type === Instruction.typeSpawn) {
          const buttonDetail2 = textContainer
            .append("button")
            .attr("class", "detailInstructionButton")
            .attr("id", "buttonInstruction");
          buttonDetail2
            .append("p")
            .text(
              `\u2022 Spawn instruction ${j}, name of contract: ${instruction.spawn.contractID}`
            );
          args = instruction.spawn.args;
        } else if (instruction.type === Instruction.typeInvoke) {
          const buttonDetail3 = textContainer
            .append("button")
            .attr("class", "detailInstructionButton")
            .attr("id", "buttonInstruction");
          buttonDetail3
            .append("p")
            .text(
              `\u2022 Invoke instruction ${j}, name of contract: ${instruction.invoke.contractID}`
            );
          args = instruction.invoke.args;
        } else if (instruction.type === Instruction.typeDelete) {
          const buttonDetail4 = textContainer
            .append("button")
            .attr("class", "detailInstructionButton")
            .attr("id", "buttonInstruction");
          buttonDetail4
            .append("p")
            .text(
              `\u2022 Delete instruction ${j}, name of contract:${instruction.delete.contractID}`
            );
        }
        const textInstruction = textContainer
          .append("div")
          .attr("class", "detailInstructionContainer");
        textInstruction
          .append("p")
          .text(`Hash:${instruction.hash().toString("hex")}`);
        textInstruction
          .append("p")
          .text(`Instance ID: ${instruction.instanceID.toString("hex")}`);
        // tslint:disable-next-line
        args.forEach((arg, i) => {
          const buttonDetailA = textInstruction
            .append("button")
            .attr("class", "detailArgsButton")
            .attr("id", "buttonArgs");
          buttonDetailA.append("p").text(`${i}) ${arg.name}`);
          const argsValue = textInstruction
            .append("div")
            .attr("class", "detailArgsContainer");
          argsValue.append("p").text(`${arg.value}`);
        });

        const buttonDetailS = textInstruction
          .append("button")
          .attr("class", "startBrowseButton")
          .attr("id", "buttonBrowse")
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
        buttonDetailS
          .append("p")
          .text(
            `Search for all instance with the ID: "${instruction.instanceID.toString(
              "hex"
            )}" in the blockchain`
          );
      });
    });

    let buttonDetail = transactionContainer
      .append("button")
      .attr("class", "detailTransactionButton")
      .attr("id", "buttonDetailBlock");
    buttonDetail.append("p").text(`Block details`);
    const detailsBlock = transactionContainer
      .append("div")
      .attr("class", "detailTransactionContainer");
    buttonDetail = detailsBlock
      .append("button")
      .attr("class", "detailsBlockButton")
      .attr("id", "buttonVerifiers");
    buttonDetail
      .append("p")
      .text(`\u2022 Verifiers: ${block.verifiers.length}`);
    const verifiersContainer = detailsBlock
      .append("div")
      .attr("class", "detailsBlockContainer");

    block.verifiers.forEach((uid, j) => {
      verifiersContainer
        .append("p")
        .text(` Verifier: ${j} , ID: ${uid.toString("hex")}`);
    });

    buttonDetail = detailsBlock
      .append("button")
      .attr("class", "detailsBlockButton")
      .attr("id", "buttonBacklinks");
    buttonDetail
      .append("p")
      .text(`\u2022 Backlinks: ${block.backlinks.length}`);
    const backLinksContainer = detailsBlock
      .append("div")
      .attr("class", "detailsBlockContainer");
    block.backlinks.forEach((value, j) => {
      backLinksContainer
        .append("p")
        .text(`Backlink: ${j}, Value: ${value.toString("hex")}`);
    });

    buttonDetail = detailsBlock
      .append("button")
      .attr("class", "detailsBlockButton")
      .attr("id", "buttonForwardLinks");
    buttonDetail
      .append("p")
      .text(`\u2022 ForwardLinks:${block.forwardLinks.length}`);
    const forwardsContainer = detailsBlock
      .append("div")
      .attr("class", "detailsBlockContainer");
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
      "[id=buttonTransaction], [id=buttonInstruction]"
    );
    const acc2 = document.querySelectorAll(
      "[id=buttonArgs], [id=buttonDetailBlock], [id=buttonVerifiers], [id=buttonBacklinks], [id=buttonForwardLinks]"
    );
    this.addClickListenerOpen(acc1);
    this.addClickListenerClose(acc2);
  }
  private addClickListenerOpen(acc: NodeListOf<Element>) {
    for (const button of acc) {
      button.classList.toggle("active"); // tslint:disable-next-line
      button.addEventListener("click", function () {
        const panel = this.nextElementSibling;
        if (panel.style.display === "block") {
          panel.style.display = "none";
        } else {
          this.classList.toggle("active");
          panel.style.display = "block";
        }
      });
    }
  }

  private addClickListenerClose(acc: NodeListOf<Element>) {
    for (const button of acc) {
      // tslint:disable-next-line
      button.addEventListener("click", function () {
        button.classList.toggle("active");
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
    const browseContainer = d3.select(".container");
    browseContainer.attr("style", "opacity:100%");

    this.removeHighlighBlocks(this.hashHighligh);
    browseContainer
      .attr("id", "browseContainer")
      .text("")
      .append("p")
      .text(
        `Summary of the instance: ${tuple[1][0].instanceID.toString("hex")}`
      );
    for (let i = 0; i < tuple[0].length; i++) {
      const instruction = tuple[1][i];
      let button = null;
      let args = null;
      const argsList: d3.Selection<
        HTMLParagraphElement,
        unknown,
        HTMLElement,
        any
      > = null;
      let textContainer = null;
      if (instruction.type === Instruction.typeSpawn) {
        button = browseContainer
          .append("button")
          .attr("class", "detailInstanceButton")
          .attr("id", `buttonInstance${i}`);
        button
          .append("p")
          .text(
            `${i}) Spawn: Hash of instanceID is: ${instruction
              .hash()
              .toString("hex")}`
          );
        textContainer = browseContainer
          .append("div")
          .attr("class", "detailInstanceContainer");
        textContainer.append("p").text(`In the block: ${tuple[0][i]}`);
        textContainer
          .append("p")
          .text(`ContractID: ${instruction.spawn.contractID}`);
        args = instruction.spawn.args;
      } else if (instruction.type === Instruction.typeInvoke) {
        button = browseContainer
          .append("button")
          .attr("class", "detailInstanceButton")
          .attr("id", `buttonInstance${i}`);
        button
          .append("p")
          .text(
            `${i}) Invoke: Hash of instanceID is: ${instruction
              .hash()
              .toString("hex")}`
          );
        textContainer = browseContainer
          .append("div")
          .attr("class", "detailInstanceContainer");
        textContainer.append("p").text(`In the block: ${tuple[0][i]}`);
        textContainer
          .append("p")
          .text(`ContractID: ${instruction.invoke.contractID}`);
        args = instruction.invoke.args;
      } else if (instruction.type === Instruction.typeDelete) {
        button = browseContainer
          .append("button")
          .attr("class", "detailInstanceButton")
          .attr("id", `buttonInstance${i}`);
        button
          .append("p")
          .text(
            `${i}) Delete: Hash of instanceID is: ${instruction
              .hash()
              .toString("hex")}`
          ); // tslint:disable-next-line
        const textContainer = browseContainer
          .append("div")
          .attr("class", "detailInstanceContainer");
        textContainer
          .append("p")
          .text(`ContractID: ${instruction.delete.contractID}`);
      }
      if (tuple[0][i] === this.clickedBlock.hash.toString("hex")) {
        button.style("background-color", "red");
      }
      const buttonDetail = textContainer
        .append("button")
        .attr("class", "detailSeeArgsButton")
        .attr("id", "buttonInstanceArgs");
      buttonDetail.append("p").text(`Click to see the arguments`);
      const argsDetails = textContainer
        .append("div")
        .attr("class", "detailSeeArgsContainer");
      let totalArgs = 0;
      args.forEach((_, __) => {
        totalArgs++;
      });
      argsDetails.append("p").text(`Total number of arguments: ${totalArgs}`);
      // tslint:disable-next-line
      args.forEach((arg, i) => {
        const buttonDetailA = argsDetails
          .append("button")
          .attr("class", "detailInstanceArgsButton")
          .attr("id", "buttonInstanceArg");
        buttonDetailA.append("p").text(`${i}) ${arg.name}`);
        const argsValue = argsDetails
          .append("div")
          .attr("class", "detailInstanceArgsContainer");
        argsValue.append("p").text(`${arg.value}`);
      });
    }
    const acc1 = document.querySelectorAll(
      "[id^='buttonInstance'], [id=buttonInstanceArgs], [id=buttonInstanceArg]"
    );
    this.addClickListenerClose(acc1);
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
