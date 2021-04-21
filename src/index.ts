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
import * as introJS from "intro.js";

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
    "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";
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
    initIntro();

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

                if (initialBlockIndex < 0) {
                    // The block index should not be smaller than 0

                    flash.display(
                        Flash.flashType.ERROR,
                        "index of initial block cannot be negative, specified index is " +
                            initialBlockIndex
                    );
                }

                if (initialBlockIndex > last.index) {
                    // The block index should not be higher than the last added block
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
                // If it is negative, there a less blocks than the view can permit
                // The initial block is 0
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
    Utils.translateOnChain(initialBlock.index, genesisBlock.index);

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

function initIntro() {
    document.getElementById("step1").addEventListener("click", function () {
        const intro = introJS.default();
        intro.setOptions({ skipLabel: "Skip", tooltipPosition: "left" });

        intro.setOptions({
            steps: [
                {
                    element: document.getElementById("step1"),
                    intro:
                        "Welcome to our guided tour through the Columbus Blockchain Explorer! \n You can use the keyboard to naviguate <-> and quit the tour by clicking anywhere on the page. Let's start !",
                    position: "bottom",
                },
                {
                    element: document.getElementById("svg-container"),
                    intro:
                        'Here we have a visualization of the <a href="https://github.com/dedis/cothority/tree/master/byzcoin" target="_blank">Byzcoin</a> Blockchain. You can browse through it, by click and dragging. You also can zoom in and out by scrolling up and down.',
                    position: "bottom-middle-aligned",
                },
                {
                    element: document.getElementById("svg-container"),
                    intro:
                        'Click on a block ! You\'ll be able to check the block details + all the transactions contained in it further down on the page. The arrows remind us that this is not just a simple blockchain, but a <a href="https://github.com/dedis/cothority/tree/master/skipchain" target="_blank">SkipChain</a> ! They allow to traverse short or long distances in a more efficient way. Click on the arrows to move forward, double click to move backwards in the chain.',
                    position: "bottom-right-aligned",
                },
                {
                    element: document.getElementById("search-input"),
                    intro:
                        "The search bar can be used to browse for a particular block using its block id or hash. You can also search for an instance by using its ID, the summary of its evolution is loaded when scrolling down on the page.",
                    position: "bottom",
                },
                {
                    element: document.getElementById("search-mode"),
                    intro:
                        'You can select different search modes : <i>"Search by xxx"</i> for a block index/hash or instance specific search, <i>"Automatic search"</i> combines all the methods. ',
                },
                {
                    element: document.getElementById("last-container"),
                    intro:
                        'This part displays the details of the last added blocks, more items will soon be visible here too. The square blockies <img src ="assets/blockie_example.png"/> represent block hashes, click on it to copy it to your clipboard!',
                    position: "left",
                },
                {
                    element: document.getElementById("step5"),
                    intro:
                        'Here you find the additional details about the selected block. We use <i>round</i> blockies for user IDs (again click on it to copy the ID) <img src="assets/user_Id_blockie.png"/>. The Forward and Back links are the arrows you cans see on the skipchain, and point to different blocks. By clicking on <i>"Block xxxx"</i> you\'ll be redirected to its details. ',
                    position: "top",
                },
                {
                    element: document.getElementById("step6"),
                    intro:
                        "In the transaction details, you can witness which instances have been used and browse there past history with the search bar. Instances can be seen as contracts and can be <i>Spawned</i> (created), <i>Invoked</i> (modified), or <i>Deleted</i>, checking it's history shows you how the contract has evolved.",
                    position: "top",
                },
                {
                    element: document.getElementById("step7"),
                    intro: "Congrats we are done ! Happy exploring :-)",
                    position: "top",
                },
            ],
        });

        intro.start();
    });
}
