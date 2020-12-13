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
import { zoom } from "d3";
import { select } from "d3";
import { ChainConfig } from "@dedis/cothority/byzcoin";
import { flatMap, last, switchMap, takeUntil } from "rxjs/operators";

let arrayBlock = new Array<SkipBlock>();

let activate = false;

let subject = new Subject();

export function getActivate(): boolean {
    return this.activate;
}
export function getSubj() {
    return this.activate;
}
export function setActivate() {
    this.activate = false;
}
export function getBlock() {
    return this.arrayBlock[0];
}
export function searchBar(
    roster: Roster,
    flash: Flash,
    blockSubject: Subject<SkipBlock>,
    hashBlock0: string,
    chain: Chain,
    initialBlock: SkipBlock
) {
    d3.select("#search-input").on("keypress", function () {
        if (d3.event.keyCode === 13) {
            var input = d3.select("#search-input").property("value");
            const search_mode = d3.select("#search-mode").property("value");
            searchRequest(
                input,
                roster,
                flash,
                blockSubject,
                hashBlock0,
                chain,
                search_mode,
                initialBlock
            );
        }
    });

    d3.select("#submit-button").on("click", async function () {
        var input = d3.select("#search-input").property("value");
        const search_mode = d3.select("#search-mode").property("value");
        searchRequest(
            input,
            roster,
            flash,
            blockSubject,
            hashBlock0,
            chain,
            search_mode,
            initialBlock
        );
    });
}

async function searchRequest(
    input: any,
    roster: Roster,
    flash: Flash,
    blockSubject: Subject<SkipBlock>,
    hashBlock0: string,
    chain: Chain,
    search_mode: string,
    initialBlock: SkipBlock
) {
    if (search_mode == "hash") {
        try {
            let block = await Utils.getBlock(Buffer.from(input, "hex"), roster);
            Utils.scrollOnChain(roster, hashBlock0, block, initialBlock, chain);

            flash.display(
                Flash.flashType.INFO,
                "Valid search for block index: " + block.index.toString()
            );

        } catch (error) {
            flash.display(Flash.flashType.ERROR, "Block does not exist");
        }
    } else if (search_mode == "id") {
    } else {
        try {
            let block = await Utils.getBlockByIndex(
                Utils.hex2Bytes(hashBlock0),
                parseInt(input, 10) - 1, //using subjectBrowse shows one block too far
                roster
            );
            Utils.scrollOnChain(roster, hashBlock0, block, initialBlock, chain);
            flash.display(
                Flash.flashType.INFO,
                "Valid search for block index: " + (block.index + 1).toString()
            );
        } catch (error) {
            flash.display(Flash.flashType.ERROR, "Block does not exist");
        }
    }
}
