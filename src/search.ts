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
import { select } from 'd3';
import { Block } from './block';

export function searchBar(
    roster: Roster,
    flash: Flash,
    blockSubject: Subject<SkipBlock>,
    hashBlock0: string,
    i: number,
    block : Block
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
                i,
                block
            );
            
        }
    });

    d3.select("#submit-button").on("click", function () {
        console.log("click")
        var input = d3.select("#search-input").property("value");
        searchRequest(input, roster, flash, blockSubject, hashBlock0, i, block);
    });
}

async function searchRequest(
    input: any,
    roster: Roster,
    flash: Flash,
    blockSubject: Subject<SkipBlock>,
    hashBlock0: string,
    i: number,
    block : Block
) {
    console.log(`input : ${input}\n length ${input.length}`);
    if (input.length<32)
    {
    
        try {
            let block = await Utils.getBlockByIndex(
                Utils.hex2Bytes(hashBlock0),
                parseInt(input,10),
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
    else{
        try {
            ++i;
            let block = await Utils.getBlock(Buffer.from(input, "hex"), roster);

            flash.display(
                Flash.flashType.INFO,
                "Valid search for block index: " + block.index.toString()
            );
            blockSubject.next(block);

        //let newChain = new Chain(roster,flash,blockAnswered);
        // chain = newChain; 

            //  blockSubject.next(hi);
            //  chain.subjectBrowse.next([chain.nbPages,ch,false])
            //  startColumbus(hi,roster,flash,i);
            //   let plouf = { x: -10, y: 0, k: 1 };

            //   chain.subject.next(plouf);
            //  chain.getNextBlocks(Utils.bytes2String(hi.hash),chain.pageSize,chain.nbPages,chain.subjectBrowse,false);
        } catch (error) {
            // try transactions
            console.log(error)
            flash.display(Flash.flashType.INFO, `Browsing the chain for instance ID : ${input}`);
            block.launchQuery(50, input.toString())
        }
    }
}
