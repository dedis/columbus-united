import { SkipBlock } from '@dedis/cothority/skipchain';
import { DataBody } from '@dedis/cothority/byzcoin/proto';
import { Observable } from 'rxjs';
import * as d3 from 'd3';
import { Instruction } from '@dedis/cothority/byzcoin';
import { Browsing } from './browsing';

export class DetailBlock {
  myObservable: Observable<SkipBlock>
  mycontainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  instructionObserver : Browsing
  constructor(observerSkip: Observable<SkipBlock>, observerInstru: Browsing) {
    this.mycontainer = d3.select("body").append("div").attr("class", "blocksDetailcontainer")
    this.myObservable = observerSkip
    this.myObservable.subscribe({
      next:
        this.listTransaction2.bind(this)

    })
    this.instructionObserver = observerInstru




    //get observer depuis browse, puis next print la liste. 
  }


private printmyData(tuple:[string[], Instruction[]]){
  console.log(tuple)
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
        textI.append("button").text("Search for all instance of this ID in the blockchain").on("click", function(){
          self.instructionObserver.getInstructionObserver(instruction).subscribe({
            next: self.printmyData.bind(this)
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