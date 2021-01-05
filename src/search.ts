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
 * @param initialBlock the first block displayed at the load of the chain
 * @param hashBlock0 the hash of the genesis block
 * @param blockClickedSubject the subject notified each time a block is clicked on
 */
export function searchBar(roster: Roster, flash: Flash, initialBlock: SkipBlock, hashBlock0: string,
                          blockClickedSubject: Subject<SkipBlock>) {
    d3.select("#search-input").on("keypress", () => {
        if (d3.event.keyCode === 13) {
            const input = d3.select("#search-input").property("value");
            searchRequest(input, roster, flash, hashBlock0, initialBlock, blockClickedSubject);
        }
    });

    d3.select("#submit-button").on("click", async () => {
        const input = d3.select("#search-input").property("value");
        searchRequest(input, roster, flash, hashBlock0, initialBlock, blockClickedSubject);
    });
}
/**
 * Helper function to search for the blocks
 * @param input the input inserted by the user
 * @param roster the roster defining the blockchain nodes
 * @param flash the flash class that handles the flash messages
 * @param hashBlock0 the hash of the genesis block
 * @param initialBlock the first block displayed at the load of the chain
 * @param blockClickedSubject the subject notified each time a block is clicked on
 */
async function searchRequest(
    input: any,
    roster: Roster,
    flash: Flash,
    hashBlock0: string,
    initialBlock: SkipBlock,
    blockClickedSubject: Subject<SkipBlock>,
) {
    if (input.length < 32) {

        try {
            const block = await Utils.getBlockByIndex(
                Utils.hex2Bytes(hashBlock0),
                parseInt(input, 10),
                roster
            );
            flash.display(
                Flash.flashType.INFO,
                "Valid search for block index: " + block.index.toString()
            );
            await Utils.translateOnChain(block, initialBlock, blockClickedSubject);
            blockClickedSubject.next(block);
        } catch (error) {
            flash.display(Flash.flashType.ERROR, "Block does not exist");
        }
    } else {
        try {

            const block = await Utils.getBlock(Buffer.from(input, "hex"), roster);

            flash.display(
                Flash.flashType.INFO,
                "Valid search for block index: " + block.index.toString()
            );
            await Utils.translateOnChain(block, initialBlock, blockClickedSubject);
            blockClickedSubject.next(block);

        } catch (error) {

            flash.display(Flash.flashType.INFO, `Browsing the chain for instance ID : ${input}`);
           // block.launchQuery(50, input.toString())
        }
    }
}
