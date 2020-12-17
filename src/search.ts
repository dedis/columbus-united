import { Roster } from "@dedis/cothority/network";
import * as d3 from "d3";
import { Flash } from "./flash";
import { Utils } from "./utils";
import "uikit";
import "./stylesheets/style.scss";

/**
 * File to launch requests when searching for a particular block or instance through the search bar
 * @param roster the roster
 * @param flash the flash class that handles the flash messages
 * @param hashBlock0 the hash of the genesis block
 */
export function searchBar(roster: Roster, flash: Flash, hashBlock0: string) {
    d3.select("#search-input").on("keypress", function () {
        if (d3.event.keyCode === 13) {
            var input = d3.select("#search-input").property("value");
            const search_mode = d3.select("#search-mode").property("value");
            searchRequest(input, roster, flash, hashBlock0, search_mode);
        }
    });

    d3.select("#submit-button").on("click", async function () {
        var input = d3.select("#search-input").property("value");
        const search_mode = d3.select("#search-mode").property("value");
        searchRequest(input, roster, flash, hashBlock0, search_mode);
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
    search_mode: string
) {
    if (search_mode == "hash") {
        try {
            let block = await Utils.getBlock(Buffer.from(input, "hex"), roster);
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
                parseInt(input, 10),
                roster
            );
            flash.display(
                Flash.flashType.INFO,
                "Valid search for block index: " + (block.index).toString()
            );
        } catch (error) {
            flash.display(Flash.flashType.ERROR, "Block does not exist");
        }
    }
}
