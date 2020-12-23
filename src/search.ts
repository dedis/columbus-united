import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Subject } from "rxjs";
import "uikit";
import { Flash } from "./flash";
import "./stylesheets/style.scss";
import { Utils } from "./utils";

/**
 * File to launch requests when searching for a particular block or instance through the search bar
 * @param roster the roster
 * @param flash the flash class that handles the flash messages
 * @param hashBlock0 the hash of the genesis block
 */
export function searchBar(roster: Roster, flash: Flash, initialBlock: SkipBlock, hashBlock0: string,
                          blockClickedSubject: Subject<SkipBlock>) {
    d3.select("#search-input").on("keypress", () => {
        if (d3.event.keyCode === 13) {
            const input = d3.select("#search-input").property("value");
            const searchMode = d3.select("#search-mode").property("value");
            searchRequest(input, roster, flash, hashBlock0, initialBlock, blockClickedSubject, searchMode);
        }
    });

    d3.select("#submit-button").on("click", async () => {
        const input = d3.select("#search-input").property("value");
        const searchMode = d3.select("#search-mode").property("value");
        searchRequest(input, roster, flash, hashBlock0, initialBlock, blockClickedSubject, searchMode);
    });
}
/**
 * Helper function to search for the blocks
 * @param input the input inserted by the user
 * @param roster
 * @param flash
 * @param hashBlock0
 * @param search_mode the object searched for: hash, index, instance
 */
async function searchRequest(
    input: any,
    roster: Roster,
    flash: Flash,
    hashBlock0: string,
    initialBlock: SkipBlock,
    blockClickedSubject: Subject<SkipBlock>,
    searchMode: string
) {
    if (searchMode === "hash") {
        try {
            const block = await Utils.getBlock(Buffer.from(input, "hex"), roster);
            Utils.translateOnChain( block, initialBlock, blockClickedSubject );
            flash.display(
                Flash.flashType.INFO,
                "Valid search for block index: " + block.index.toString()
            );
        } catch (error) {
            flash.display(Flash.flashType.ERROR, "Block does not exist");
        }
    } else if (searchMode === "id") {

        try {
            const block = await Utils.getBlockByIndex(
                Utils.hex2Bytes(hashBlock0),
                parseInt(input, 10),
                roster
            );
            Utils.translateOnChain(block, initialBlock, blockClickedSubject );

            flash.display(
                Flash.flashType.INFO,
                "Valid search for block index: " + (block.index).toString()
            );
        } catch (error) {
            flash.display(Flash.flashType.ERROR, "Block does not exist");
        }
    }
}
