import { Roster } from "@dedis/cothority/network";
import { SkipchainRPC } from "@dedis/cothority/skipchain";
import { SkipBlock } from "@dedis/cothority/skipchain/skipblock";
import * as d3 from "d3";
import { Block } from "./block";
import { Chain } from "./chain";
import { Flash } from "./flash";
import { Lifecycle } from "./lifecycle";
import { getRosterStr } from "./roster";
import { TotalBlock } from "./totalBlock";
import { Utils } from "./utils";
import { DataBody, DataHeader } from "@dedis/cothority/byzcoin/proto";

import "uikit";
import "./stylesheets/style.scss";
import { Subject } from "rxjs";
import { drag } from "d3";



export function searchBar(
    roster: Roster,
    flash: Flash,
    blockSubject: Subject<SkipBlock>,
    hashBlock0: string
    ) 

{

    d3.select("#search-input").on("keypress", function() {
        if(d3.event.keyCode === 13){
            var input = d3.select("#search-input").property("value");
            searchRequest(input,roster,flash,blockSubject,hashBlock0);
       
        }
      });

    d3.select("#submit-button").on("click", async function () {
        var input = d3.select("#search-input").property("value");
        searchRequest(input,roster,flash,blockSubject,hashBlock0);
        
    });
}


async function searchRequest(input:any,roster:Roster,flash:Flash,blockSubject: Subject<SkipBlock>, hashBlock0: string){
    if (input.length > 10) {
        try {
            let hi = await Utils.getBlock(
                Buffer.from(input, "hex"),
                roster
            );

            flash.display(
                Flash.flashType.INFO,
                "Valid search for block index: " + hi.index.toString()
            );

            blockSubject.next(hi);
        } catch (error) {
            // try transactions
            flash.display(Flash.flashType.ERROR, "Block does not exist");
        }
    } else {
        try {
            let block = await Utils.getBlockByIndex(
                Utils.hex2Bytes(hashBlock0),
                parseInt(input, 10),
                roster
            );
            let blockByIndex = block.index;
            flash.display(
                Flash.flashType.INFO,
                "Valid search for block index: " + blockByIndex.toString()
            );
            blockSubject.next(block);
        } catch (error) {
            // try transactions
            flash.display(Flash.flashType.ERROR, "Block does not exist");
        }
    }


}