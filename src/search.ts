import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain/skipblock";
import * as d3 from "d3";
import { Flash } from "./flash";
import { Utils } from "./utils";
import "uikit";
import "./stylesheets/style.scss";
import { Subject } from "rxjs";
import { Chain } from "./chain";
import { sayHi, startColumbus } from ".";
import { DataBody, DataHeader } from "@dedis/cothority/byzcoin/proto";
import {
    PaginateRequest,
    PaginateResponse,
} from "@dedis/cothority/byzcoin/proto/stream";

export function searchBar(
    roster: Roster,
    flash: Flash,
    blockSubject: Subject<SkipBlock>,
    hashBlock0: string,
    chain: Chain,
    i: number
) {
    d3.select("#search-input").on("keypress", function () {
        if (d3.event.keyCode === 13) {
            var input = d3.select("#search-input").property("value");
            searchRequest(
                input,
                roster,
                flash,
                blockSubject,
                hashBlock0,
                chain,
                i
            );
        }
    });

    d3.select("#submit-button").on("click", async function () {
        var input = d3.select("#search-input").property("value");
        searchRequest(input, roster, flash, blockSubject, hashBlock0, chain, i);
    });
}

async function searchRequest(
    input: any,
    roster: Roster,
    flash: Flash,
    blockSubject: Subject<SkipBlock>,
    hashBlock0: string,
    chain: Chain,
    i: number
) {
    if (input.length > 10) {
        try {
            ++i;
            let hi = await Utils.getBlock(Buffer.from(input, "hex"), roster);

            flash.display(
                Flash.flashType.INFO,
                "Valid search for block index: " + hi.index.toString()
            );

           let newChain = new Chain(roster,flash,hi);
          // chain = newChain; 

            //  blockSubject.next(hi);
            //  chain.subjectBrowse.next([chain.nbPages,ch,false])
            //  startColumbus(hi,roster,flash,i);
            //   let plouf = { x: -10, y: 0, k: 1 };

            //   chain.subject.next(plouf);
            //  chain.getNextBlocks(Utils.bytes2String(hi.hash),chain.pageSize,chain.nbPages,chain.subjectBrowse,false);
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
