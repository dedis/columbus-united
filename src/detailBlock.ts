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
      let accepted:string = transaction.accepted ? "Accepted" : "Not accepted"
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
            .text(i + ") Arg name: ");
          let argsDetailsN = textI.append("div").attr("class", "oneDetailText");
          argsDetailsN.append("p").text(arg.name);
          textI
            .append("button")
            .attr("class", "oneDetailButton")
            .text(i + ") Arg value: ");
          let argsDetailsV = textI.append("div").attr("class", "oneDetailText");
          argsDetailsV.append("p").text("" + arg.value);
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
    var acc1 = document.getElementsByClassName("oneDetailButton");
    this.addClickListener(acc1);

    var verifiersHTML = this.mycontainer
      .append("details")
      .attr("class", "detailsChild1");
    verifiersHTML
      .append("summary")
      .text("Verifiers: " + block.verifiers.length);
    block.verifiers.forEach((uid, j) => {
      verifiersHTML
        .append("p")
        .text("Verifier: " + j + " ID: " + uid.toString("hex"));
    });

    var backlinkHTML = this.mycontainer
      .append("details")
      .attr("class", "detailsChild1");
    backlinkHTML.append("summary").text("Backlinks: " + block.backlinks.length);
    block.backlinks.forEach((value, j) => {
      backlinkHTML
        .append("p")
        .text("Backlink: " + j + " Value: " + value.toString("hex"));
    });

    var forwardlinkHTML = this.mycontainer
      .append("details")
      .attr("class", "detailsChild1");
    forwardlinkHTML
      .append("summary")
      .text("ForwardLinks: " + block.forwardLinks.length);
    block.forwardLinks.forEach((fl, j) => {
      forwardlinkHTML.append("p").text("ForwardLink: " + j);
      forwardlinkHTML
        .append("p")
        .text(
          "From: " +
            fl.from.toString("hex") +
            " Hash: " +
            fl.hash().toString("hex")
        );
      forwardlinkHTML
        .append("p")
        .text("signature: + " + fl.signature.sig.toString("hex"));
    });
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
        let args_list = argsDetails.append("ul");
        instruction.spawn.args.forEach((arg, _) => {
          args_list.append("li").text("Arg name : " + arg.name);
          args_list.append("li").text("Arg value : " + arg.value);
        });
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
        let args_list = argsDetails.append("ul");
        instruction.invoke.args.forEach((arg, _) => {
          args_list.append("li").text("Arg name : " + arg.name);
          args_list.append("li").text("Arg value : " + arg.value);
        });
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
      if (tuple[0][i] == this.clickedBlock.hash.toString("hex")) {
        button.attr("class", "oneDetailButton");
      }
    }
    let acc1 = document.getElementsByClassName("oneDetailButton");

    this.addClickListener(acc1);
  }
  createButtonAndText(){
    
  }
}
