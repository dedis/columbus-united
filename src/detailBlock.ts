import { SkipBlock } from "@dedis/cothority/skipchain";
import { DataBody } from "@dedis/cothority/byzcoin/proto";
import { Observable } from "rxjs";
import * as d3 from "d3";
import { Instruction } from "@dedis/cothority/byzcoin";
import { Browsing } from "./browsing";

export class DetailBlock {
  myObservable: Observable<SkipBlock>;
  mycontainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  instructionObserver: Browsing;
  container: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  clickedBlock: SkipBlock;
  constructor(observerSkip: Observable<SkipBlock>, observerInstru: Browsing) {
    this.mycontainer = d3
      .select("body")
      .append("div")
      .attr("class", "blocksDetailcontainer");
    this.container = d3.select("body").append("div").attr("class", "container");
    this.myObservable = observerSkip;
    this.myObservable.subscribe({
      next: this.listTransaction.bind(this),
    });
    this.instructionObserver = observerInstru;
    this.clickedBlock = null;
  }

  private listTransaction(block: SkipBlock) {
    this.clickedBlock = block;
    let self = this;
    this.mycontainer.text(
      "Block " + block.index + " Hash: " + block.hash.toString("hex")
    );
    const body = DataBody.decode(block.payload);
    body.txResults.forEach((transaction, i) => {
      let accepted: string = transaction.accepted ? "Accepted" : "Not accepted";
      this.mycontainer
        .append("button")
        .attr("class", "oneDetailButton")
        .text("Transaction " + i + " " + accepted);
      let textContainer = this.mycontainer
        .append("div")
        .attr("class", "oneDetailText");

      transaction.clientTransaction.instructions.forEach((instruction, j) => {
        let args = null;
        if (instruction.spawn !== null) {
          textContainer
            .append("button")
            .attr("class", "oneDetailButton")
            .text(
              "Spawn instruction " +
                j +
                ", name of contract: " +
                instruction.spawn.contractID
            );
          args = instruction.spawn.args;
        } else if (instruction.invoke !== null) {
          textContainer
            .append("button")
            .attr("class", "oneDetailButton")
            .text(
              "Invoke instruction " +
                j +
                ", name of contract: " +
                instruction.invoke.contractID
            );
          args = instruction.invoke.args;
        } else if (instruction.delete !== null) {
          textContainer
            .append("button")
            .attr("class", "oneDetailButton")
            .text(
              "Delete instruction " +
                j +
                ", name of contract: " +
                instruction.delete.contractID
            );
        }
        let textI = textContainer.append("div").attr("class", "oneDetailText");
        textI.append("p").text("Hash: " + instruction.hash().toString("hex"));
        textI
          .append("p")
          .text("Instance ID: " + instruction.instanceID.toString("hex"));
        let i = 0;
        args.forEach((arg, _) => {
          textI
            .append("button")
            .attr("class", "oneDetailButton")
            .text(i + ") " + arg.name);
          let argsDetailsN = textI.append("div").attr("class", "oneDetailText");
          argsDetailsN.append("p").text("" + arg.value);
          i++;
        });

        textI.append("p").text();
        textI
          .append("button")
          .attr("class", "oneDetailButton")
          .text("Search for all instance of this ID in the blockchain")
          .on("click", function () {
            self.instructionObserver
              .getInstructionObserver(instruction)
              .subscribe({
                next: self.printDataBrowsing.bind(self),
              });
          });
      });
    });

    this.mycontainer
      .append("button")
      .attr("class", "oneDetailButton")
      .text("Block details");
    let details = this.mycontainer.append("div").attr("class", "oneDetailText");

    details
      .append("button")
      .attr("class", "oneDetailButton")
      .text("Verifiers: " + block.verifiers.length);
    let verifiersContainer = details
      .append("div")
      .attr("class", "oneDetailText");

    block.verifiers.forEach((uid, j) => {
      verifiersContainer
        .append("p")
        .text("Verifier: " + j + " ID: " + uid.toString("hex"));
    });

    details
      .append("button")
      .attr("class", "oneDetailButton")
      .text("Backlinks: " + block.backlinks.length);
    let backLinksContainer = details
      .append("div")
      .attr("class", "oneDetailText");
    block.backlinks.forEach((value, j) => {
      backLinksContainer
        .append("p")
        .text("Backlink: " + j + " Value: " + value.toString("hex"));
    });

    details
      .append("button")
      .attr("class", "oneDetailButton")
      .text("ForwardLinks: " + block.forwardLinks.length);
    let forwardsContainer = details
      .append("div")
      .attr("class", "oneDetailText");
    block.forwardLinks.forEach((fl, j) => {
      forwardsContainer
        .append("p")
        .text(
          "From: " +
            fl.from.toString("hex") +
            " Hash: " +
            fl.hash().toString("hex")
        );
      forwardsContainer
        .append("p")
        .text("signature: + " + fl.signature.sig.toString("hex"));
    });

    var acc1 = document.getElementsByClassName("oneDetailButton");
    this.addClickListener(acc1);
  }
  private addClickListener(acc: HTMLCollectionOf<Element>) {
    for (let i = 0; i < acc.length; i++) {
      acc[i].addEventListener("click", function () {
        this.classList.toggle("active");
        var panel = this.nextElementSibling;
        if (panel.style.display === "block") {
          panel.style.display = "none";
        } else {
          panel.style.display = "block";
        }
      });
    }
  }

  private printDataBrowsing(tuple: [string[], Instruction[]]) {
    this.container.text(
      "Summary of the instance: " + tuple[1][0].instanceID.toString("hex")
    );
    for (let i = 0; i < tuple[0].length; i++) {
      let instruction = tuple[1][i];
      let button = null;
      let args = null;
      let args_list: d3.Selection<
        HTMLParagraphElement,
        unknown,
        HTMLElement,
        any
      > = null;
      if (instruction.spawn !== null) {
        button = this.container
          .append("button")
          .attr("class", "oneDetailButton")
          .text(
            "Spawn with instanceID: " +
              instruction.instanceID.toString("hex") +
              ", and Hash is: " +
              instruction.hash().toString("hex")
          );
        let textContainer = this.container
          .append("div")
          .attr("class", "oneDetailText");
        textContainer
          .append("p")
          .text("ContractID: " + instruction.spawn.contractID);
        textContainer
          .append("button")
          .attr("class", "oneDetailButton")
          .text("args are:");
        let argsDetails = textContainer
          .append("div")
          .attr("class", "oneDetailText");
        args_list = argsDetails.append("p");
        args = instruction.spawn.args;
      } else if (instruction.invoke !== null) {
        button = this.container
          .append("button")
          .attr("class", "oneDetailButton")
          .text(
            "Invoke with instanceID: " +
              instruction.instanceID.toString("hex") +
              ", and Hash is: " +
              instruction.hash().toString("hex")
          );
        let textContainer = this.container
          .append("div")
          .attr("class", "oneDetailText");
        textContainer
          .append("p")
          .text("ContractID: " + instruction.invoke.contractID);
        textContainer
          .append("button")
          .attr("class", "oneDetailButton")
          .text("args are:");
        let argsDetails = textContainer
          .append("div")
          .attr("class", "oneDetailText");
        args_list = argsDetails.append("p");
        args = instruction.invoke.args;
      } else if (instruction.delete !== null) {
        button = this.container
          .append("button")
          .attr("class", "oneDetailButton")
          .text(
            "Delete with instanceID: " +
              instruction.instanceID.toString("hex") +
              ", and Hash is: " +
              instruction.hash().toString("hex")
          );
        let textContainer = this.container
          .append("div")
          .attr("class", "oneDetailText");
        textContainer
          .append("p")
          .text("ContractID: " + instruction.delete.contractID);
      }
      let arg_num: number = 0;
      args.forEach((arg, _) => {
        args_list
          .append("button")
          .attr("class", "oneDetailButton")
          .text(arg_num + ") " + arg.name);
        let argsDetailsN = args_list
          .append("div")
          .attr("class", "oneDetailText");
        argsDetailsN.append("p").text("" + arg.value);
        arg_num++;
      });
      if (tuple[0][i] == this.clickedBlock.hash.toString("hex")) {
        button.attr("class", "oneDetailButton");
      }
    }
    let acc1 = document.getElementsByClassName("oneDetailButton");

    this.addClickListener(acc1);
  }
}
