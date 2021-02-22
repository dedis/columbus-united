import { Roster } from "@dedis/cothority/network";
import { SkipchainRPC } from "@dedis/cothority/skipchain";
import { SkipBlock } from "@dedis/cothority/skipchain/skipblock";
import "uikit";
import { Block } from "./block";
import { Chain } from "./chain";
import { Flash } from "./flash";
import { Lifecycle } from "./lifecycle";
import { getRosterStr } from "./roster";
import { searchBar } from "./search";
import "./stylesheets/style.scss";
import { TotalBlock } from "./totalBlock";
import { Utils } from "./utils";
import * as d3 from "d3";

/*
   ___              _                     _
  / __|    ___     | |    _  _    _ __   | |__    _  _     ___
 | (__    / _ \    | |   | +| |  | '  \  | '_ \  | +| |   (_-<
  \___|   \___/   _|_|_   \_,_|  |_|_|_| |_.__/   \_,_|   /__/_
_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|_|"""""|
"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'"`-0-0-'
 */

// This is the genesis block, which is also the Skipchain identifier
const hashBlock0 =
    "afd8da15a057bce78ac87c315dc838c7eab15925af37367e74603a8792bf95bf";
// The roster configuration, parsed as a string
const rosterStr = getRosterStr();

/**
 *
 * Main file that creates the different objects and subjects.
 * Starts the visualization
 * @author Sophia Artioli <sophia.artioli@epfl.ch>
 * @author Lucas Trognon <lucas.trognon@epfl.ch>
 * @author Anthony Iozzia <anthony.iozzia@epfl.ch>
 * @author Julien von Felten <julien.vonfelten@epfl.ch>
 * @author Noémien Kocher <noemien.kocher@epfl.ch>
 *
 * @export
 * @returns : only in case of an error
 */
export function sayHi() {
    // Create the roster
    const roster = Roster.fromTOML(rosterStr);

    // Create the flash class that will handle the flash messages
    const flash = new Flash();
    if (!roster) {
        flash.display(Flash.flashType.ERROR, "Roster is undefined");
        return;
    }

    let initialBlockIndex: number;

    const scRPC = new SkipchainRPC(roster);
    new SkipchainRPC(roster)
        .getLatestBlock(Utils.hex2Bytes(hashBlock0), false, true)
        .then((last) => {
            // skipBlock of the last added block of the chain

            // Url input from the user
            const indexString = window.location.hash.split(":")[1];

            if (indexString != null) {
                // A block index is inputted
                initialBlockIndex = parseInt(indexString, 10);
                // The block index should not be smaller than 0
                if (initialBlockIndex < 0) {
                    flash.display(
                        Flash.flashType.ERROR,
                        "index of initial block cannot be negative, specified index is " +
                            initialBlockIndex
                    );
                }

                // The block index should not be higher than the last added block
                if (initialBlockIndex > last.index) {
                    flash.display(
                        Flash.flashType.ERROR,
                        "index of initial block cannot be higher than the last added block of the chain, specified index is " +
                            initialBlockIndex
                    );
                    // Set initial index at last added block of the chain
                    initialBlockIndex = last.index - Chain.numBlocks;
                }
            } else {
                // The user does not input a block index in the url

                // Size of container that welcoms the blocks
                const containerSize = parseInt(
                    d3.select("#svg-container").style("width")
                );

                // Display the correct amount of blocks to fit the end of the chain
                initialBlockIndex =
                    last.index -
                    containerSize / (Chain.blockWidth + Chain.blockPadding);
            }

            if (initialBlockIndex < 0) {
                // The block index should not be smaller than 0
                initialBlockIndex = 0;
            }
        })
        .then(() => {
            scRPC
                .getSkipBlockByIndex(Utils.hex2Bytes(hashBlock0), 0)
                .then((genesis) => {
                    scRPC
                        .getSkipBlockByIndex(
                            Utils.hex2Bytes(hashBlock0),
                            initialBlockIndex
                        )
                        .then((initialBlock) => {
                            // Start the visualization
                            startColumbus(
                                genesis.skipblock,
                                initialBlock.skipblock,
                                roster,
                                flash
                            );
                        });
                });
        })
        .catch((e) =>
            flash.display(
                Flash.flashType.ERROR,
                `Unable to start visualization: ${e}`
            )
        );
}

/**
 * startColumbus starts the visualization
 *
 * @param genesisBlock the genesis block of the skipchain
 * @param initialBlock the first block that will be displayed
 * @param roster the roster
 * @param flash the flash class that handles the flash messages
 */
export function startColumbus(
    genesisBlock: SkipBlock,
    initialBlock: SkipBlock,
    roster: Roster,
    flash: Flash
) {
    // The chain is loaded at block 0 and then moved to the desired place
    const chain = new Chain(roster, flash, genesisBlock);

    // The translation is done to the initialBlock
    Utils.translateOnChain(
        initialBlock,
        genesisBlock,
        chain.blockClickedSubject
    );

    // The totalBlock utility class allows the browsing class to get the total
    // number of block in the chain. This class is stateful, it will keep each
    // time the last know block instead of browsing the entire chain each time.
    const totalBlock = new TotalBlock(roster, initialBlock);

    // Create the browsing instance, which is used by the detailBlock class when a
    // user wants to get the lifecycle of an instance.
    const lifecycle = new Lifecycle(roster, flash, totalBlock, hashBlock0);

    // Set up the class that listens on blocks clicks and display their details
    // accordingly.
    const block = new Block(
        chain.getBlockClickedSubject,
        lifecycle,
        flash,
        chain.getNewBlocksSubject,
        roster
    );
    block.startListen();

    // The blockchain properties are given to the search bar
    searchBar(
        roster,
        flash,
        initialBlock,
        hashBlock0,
        chain.blockClickedSubject,
        block
    );
}
