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
    this.container = d3.select("body").append("div").attr("id", "container")
    this.myObservable = observerSkip
    this.myObservable.subscribe({
      next:
        this.listTransaction2.bind(this)

    })
    this.instructionObserver = observerInstru
  }


  private printmyData(tuple: [string[], Instruction[]]) {
    for (let i = 0; i < tuple[0].length; i++) {
      var detailsHTML = this.container.append("details")
      detailsHTML.attr("class", "detailsParent")
      let instruction = tuple[1][i]

      if (instruction.spawn !== null) {
        detailsHTML.append("summary").text("Spawn with instanceID: " + instruction.instanceID.toString("hex") + ", and Hash is: " + instruction.hash().toString("hex"))
        detailsHTML.append("p").text("ContractID: " + instruction.spawn.contractID)
        var argsDetails = detailsHTML.append("details").attr("class", "detailsChild1")
        argsDetails.append("summary").text("args are:")
        var my_list = argsDetails.append("ul")
        instruction.spawn.args.forEach((arg, _) => {
          my_list.append("li").text("Arg name : " + arg.name)
          my_list.append("li").text("Arg value : " + arg.value)
        });
      }
      else if (instruction.invoke !== null) {
        detailsHTML.append("summary").text("Invoke with instanceID: " + instruction.instanceID.toString("hex") + ", and Hash is: " + instruction.hash().toString("hex"))
        detailsHTML.append("p").text("ContractID: " + instruction.invoke.contractID)
        var argsDetails = detailsHTML.append("details").attr("class", "detailsChild1")
        argsDetails.append("summary").text("args are:")
        var my_list = argsDetails.append("ul")
        instruction.invoke.args.forEach((arg, _) => {
          my_list.append("li").text("Arg name : " + arg.name)
          my_list.append("li").text("Arg value : " + arg.value)
        });
      }
      else if (instruction.delete !== null) {
        detailsHTML.append("summary").text("Delete with instanceID: " + instruction.instanceID.toString("hex") + ", and Hash is: " + instruction.hash().toString("hex"))
        detailsHTML.append("p").text("ContractID: " + instruction.delete.contractID)
      }
    }
    // Fetch all the details element.
    const detailsParent = document.querySelectorAll(".detailsParent");

    // Add the onclick listeners.
    detailsParent.forEach((targetDetail) => {
      targetDetail.addEventListener("click", () => {
        // Close all the details that are not targetDetail.
        detailsParent.forEach((detail) => {
          if (detail !== targetDetail) {
            detail.removeAttribute("open");
          }
        });
      });
    });

    // Fetch all the details element.
    const detailsChild1 = document.querySelectorAll(".detailsChild1");

    // Add the onclick listeners.
    detailsChild1.forEach((targetDetail) => {
      targetDetail.addEventListener("click", () => {
        // Close all the details that are not targetDetail.
        detailsChild1.forEach((detail) => {

          if (detail !== targetDetail) {
            detail.removeAttribute("open");
          }
        });
      });
    });
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
            next: self.printmyData.bind(self)
          })
        })

      })
    })
    var acc1 = document.getElementsByClassName("oneDetailT");
    var acc2 = document.getElementsByClassName("oneDetailI")
    var i;

    for (i = 0; i < acc1.length; i++) {
      acc1[i].addEventListener("click", function () {
        this.classList.toggle("active");
        var panel = this.nextElementSibling;
        if (panel.style.display === "block") {
          panel.style.display = "none";
        } else {
          panel.style.display = "block";
        }
      });
    }
    for (i = 0; i < acc2.length; i++) {
      acc2[i].addEventListener("click", function () {
        this.classList.toggle("active");
        var panel = this.nextElementSibling;
        if (panel.style.display === "block") {
          panel.style.display = "none";
        } else {
          panel.style.display = "block";
        }
      });
    }


    /*let observerB = mybrowse.browseClick
observerB.subscribe(){
  next: createTemplate
}*/
  }

}


/**
blocksDiagram.getBlockObserver().subscribe({
next: (skipBlock) => {
console.log("blabla")
}
});
*/

/*

 listTransaction(block: SkipBlock){
   blocksDiagram.getBlockObserver().subscribe({
     next: (skipBlock) => {
       const body = DataBody.decode(block.payload)
       body.txResults.forEach((transaction, i) => {
         console.log("******************")
         console.log("transaction : "+transaction)
         console.log("numéro: "+i)
         })
     }
   }
 });

*/