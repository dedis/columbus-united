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

// This is the genesis block, which is also the skipchain identifier
const hashBlock0 =
    "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";
// The roster configuration, parsed as a string
const rosterStr = getRosterStr();

/**
 *
 * Main file that creates the different objects and subjects.
 *
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

    // Load the first block
    const indexString = window.location.hash.split(":")[1];

    // Change here the first block to display by default if the user does not input a block index in the url
    // The default block is #118750 because forward links from this point onwards are broken
    const initialBlockIndex =
        // tslint:disable-next-line:radix
        indexString != null ? parseInt(indexString) : 118750;

    // The block index should not be smaller than 0
    if (initialBlockIndex < 0) {
        flash.display(
            Flash.flashType.ERROR,
            "index of initial block cannot be negative, specified index is " +
                initialBlockIndex
        );
    }

    // Block indexes higher that 118750 do not give the proper last added block of the chain
    // Block #118800 fetches as last block 119685 (which is incorrect)
    // Forward links from this point are broken
    if (initialBlockIndex > 118750) {
        flash.display(
            Flash.flashType.ERROR,
            "Forward links from block index '118750' are broken " +
                initialBlockIndex
        );
    }

    // Load the first block at the provided index, and start the visualization
    // once we got that block and the promise resolves
    const scRPC = new SkipchainRPC(roster);
    scRPC
        .getSkipBlockByIndex(Utils.hex2Bytes(hashBlock0), initialBlockIndex)
        .then(
            (blockReply) => {
                scRPC
                    .getSkipBlockByIndex(Utils.hex2Bytes(hashBlock0), 0)
                    .then((genesis) => {
                        startColumbus(
                            genesis.skipblock,
                            blockReply.skipblock,
                            roster,
                            flash
                        );
                    });
            },
            (e) => {
                flash.display(
                    Flash.flashType.ERROR,
                    "Unable to find initial block with index " +
                        initialBlockIndex +
                        ": " +
                        e
                );
            }
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
    // The chain is loaded at block 0 and then moved to the desired place.
    const chain = new Chain(roster, flash, genesisBlock);

    // The translation is started to trigger the load
    Utils.translateOnChain(initialBlock, genesisBlock, chain.blockClickedSubject);

    
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
        chain.getNewBlocksSubject
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
