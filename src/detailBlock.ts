import { SkipBlock } from '@dedis/cothority/skipchain';
import { DataBody } from '@dedis/cothority/byzcoin/proto';
import { Observable } from 'rxjs';
import * as d3 from 'd3';

export class DetailBlock {
  myObservable: Observable<SkipBlock>
  mycontainer :d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  constructor(observer: Observable<SkipBlock>/*, myBrose: Browsing*/) {
    this.mycontainer = d3.select("body").append("div").attr("class", "blocksDetailcontainer")
    this.myObservable = observer
    this.myObservable.subscribe({
      next:
        this.listTransaction2
      
    })
    

    
    //get observer depuis browse, puis next print la liste. 
  }

  private listTransaction2(block: SkipBlock) {
    this.mycontainer = d3.select("body").append("div").attr("class", "blocksDetailcontainer")
    const body = DataBody.decode(block.payload)
    body.txResults.forEach((transaction, i) => {
      let transactioni = this.mycontainer.append("button").attr("class", "oneDetail").text(transaction.clientTransaction.instructions[0].instanceID.toString("hex"))
 

      console.log("******************")
      console.log("transaction : " + transaction)
      console.log("numéro: " + i)
    })

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