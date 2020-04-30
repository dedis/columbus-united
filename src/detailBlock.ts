import { SkipBlock } from '@dedis/cothority/skipchain';
import { DataBody } from '@dedis/cothority/byzcoin/proto';
import { Observable } from 'rxjs';
import * as d3 from 'd3';
import { Instruction } from '@dedis/cothority/byzcoin';
import { Browsing } from './browsing';

export class DetailBlock {
  myObservable: Observable<SkipBlock>
  mycontainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  instructionObserver: Browsing
  container: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  constructor(observerSkip: Observable<SkipBlock>, observerInstru: Browsing) {
    this.mycontainer = d3.select("body").append("div").attr("class", "blocksDetailcontainer")
    this.container = d3.select("body").append("div").attr("class", "container")
    this.myObservable = observerSkip
    this.myObservable.subscribe({
      next:
        this.listTransaction2.bind(this)

    })
    this.instructionObserver = observerInstru
  }




  //Check with block 63!
  private listTransaction2(block: SkipBlock) {
    let self = this
    this.mycontainer.text("Block Hash: " + block.hash.toString("hex"))
    const body = DataBody.decode(block.payload)
    body.txResults.forEach((transaction, i) => {
      console.log("Transaction: " + i)
      this.mycontainer.append("button").attr("class", "oneDetailT").text("Transaction " + i)
      let textContainer = this.mycontainer.append("div").attr("class", "detailTransaction")

      transaction.clientTransaction.instructions.forEach((instruction, j) => {
        console.log("Instruction: " + j)

        textContainer.append("button").attr("class", "oneDetailI").text("Instruction " + j)
        let textI = textContainer.append("div").attr("class", "detailInstruction")
        textI.append("p").text("Hash: " + instruction.hash().toString("hex"))
        textI.append("p").text("Instance ID: " + instruction.instanceID.toString("hex"))
        textI.append("button").attr("class", "searchInstance").text("Search for all instance of this ID in the blockchain").on("click", function () {
          self.instructionObserver.getInstructionObserver(instruction).subscribe({
            next: self.printmyData1.bind(self)
          })
        })

      })
    })
    var acc1 = document.getElementsByClassName("oneDetailT");
    var acc2 = document.getElementsByClassName("oneDetailI")
    this.addClickListener(acc1)
    this.addClickListener(acc2)

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

  private printmyData1(tuple: [string[], Instruction[]]) {
    this.container.text("Summary of the instance: " + tuple[1][0].instanceID.toString("hex"))
    for (let i = 0; i < tuple[0].length; i++) {
      let instruction = tuple[1][i]
      if (instruction.spawn !== null) {
        this.container.append("button").attr("class", "oneDetailI2")
          .text("Spawn with instanceID: " + instruction.instanceID.toString("hex") + ", and Hash is: " + instruction.hash().toString("hex"))
        let textContainer = this.container.append("div").attr("class", "detailInstructionB")
        textContainer.append("p").text("ContractID: "+instruction.spawn.contractID)
        textContainer.append("button").attr("class", "oneDetailI3").text("args are:")
        let argsDetails = textContainer.append("div").attr("class", "detailInstructionB1")
        let args_list = argsDetails.append("ul")
        instruction.spawn.args.forEach((arg, _) => {
          args_list.append("li").text("Arg name : " + arg.name)
          args_list.append("li").text("Arg value : " + arg.value)
        })
      } else if (instruction.invoke !== null) {
        this.container.append("button").attr("class", "oneDetailI2")
          .text("Invoke with instanceID: " + instruction.instanceID.toString("hex") + ", and Hash is: " + instruction.hash().toString("hex"))
          let textContainer = this.container.append("div").attr("class", "detailInstructionB")
          textContainer.append("p").text("ContractID: "+instruction.invoke.contractID)
          textContainer.append("button").attr("class", "oneDetailI3").text("args are:")
          let argsDetails = textContainer.append("div").attr("class", "detailInstructionB1")
          let args_list = argsDetails.append("ul")
          instruction.invoke.args.forEach((arg, _) => {
            args_list.append("li").text("Arg name : " + arg.name)
            args_list.append("li").text("Arg value : " + arg.value)
          })
      } else if (instruction.delete !== null) {
        this.container.append("button").attr("class", "oneDetailI2")
          .text("Delete with instanceID: " + instruction.instanceID.toString("hex") + ", and Hash is: " + instruction.hash().toString("hex"))
        let textContainer = this.container.append("div").attr("class", "detailInstructionB")
        textContainer.append("p").text("ContractID: " + instruction.delete.contractID)
      }
    }
    let acc1 = document.getElementsByClassName("oneDetailI2")
    let acc2 = document.getElementsByClassName("oneDetailI3")
    this.addClickListener(acc1)
    this.addClickListener(acc2)

  }

}