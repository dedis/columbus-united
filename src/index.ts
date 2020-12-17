import { Roster } from "@dedis/cothority/network";
import { SkipchainRPC } from "@dedis/cothority/skipchain";
import { SkipBlock } from "@dedis/cothority/skipchain/skipblock";
import { Block } from "./block";
import { Chain } from "./chain";
import { Flash } from "./flash";
import { Lifecycle } from "./lifecycle";
import { getRosterStr } from "./roster";
import { TotalBlock } from "./totalBlock";
import { LastAddedBlock } from "./lastAddedBlock";
import { Utils } from "./utils";
import "uikit";
import "./stylesheets/style.scss";
import { searchBar } from "./search";

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
    const initialBlockIndex = indexString != null ? parseInt(indexString) : 0;
    // Change here the first block to display
    //'6bacd57b248c94dc1e2372d62976d8986948f04d727254ffbc0220182f73ab67' block #110997 - problem with nextID
    //that block has no forwards link
    //block #110940 gives as last block 110997

    if (initialBlockIndex < 0) {
        flash.display(
            Flash.flashType.ERROR,
            "index of initial block cannot be negative, specified index is " +
                initialBlockIndex
        );
    }
    if (initialBlockIndex > 110948) {
        flash.display(
            Flash.flashType.ERROR,
            "Forward links from block index '110948' are broken" +
                initialBlockIndex
        );
    }
    let i = 1;
    // Load the first block at the provided index, and start the visualization
    // once we got that block and the promise resolves.
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
                    "unable to find initial block with index " +
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
    // We load the chain at block 0 and then move it to the desired place.
    const chain = new Chain(roster, flash, genesisBlock);

    //We initialise the search bar
    searchBar(
        roster,
        flash,
        hashBlock0
    );


    // The totalBlock utility class allows the browsing class to get the total
    // number of block in the chain. This class is stateful, it will keep each
    // time the last know block instead of browsing the entire chain each time.
    const totalBlock = new TotalBlock(roster, initialBlock);
    
    //initialise and get the last block on the chain space on canevas 
    const lastBlock= new LastAddedBlock(roster,flash,initialBlock,chain);
    // Create the browsing instance, which is used by the detailBlock class when a
    // user wants to get the lifecycle of an instance.
    const lifecycle = new Lifecycle(roster, flash, totalBlock, hashBlock0);

    // const selectedBlockSubject = new Subject();
    // selectedBlockSubject.subscribe(chain.getBlockClickedSubject());
    // window.addEventListener('hashchange', ()=>selectedBlockSubject.next()) //TODO
    // Set up the class that listens on blocks clicks and display their details
    // accordingly.

    new Block(
        chain.getBlockClickedSubject(),
        lifecycle,
        flash,
        chain.getNewblocksSubject()
    ).startListen();
}
