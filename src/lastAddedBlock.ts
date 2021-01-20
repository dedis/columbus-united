import { DataBody } from "@dedis/cothority/byzcoin/proto";
import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { SkipchainRPC } from "@dedis/cothority/skipchain";
import * as blockies from "blockies-ts";
import * as d3 from "d3";
import { Subject } from "rxjs";
import { Chain } from "./chain";
import { Flash } from "./flash";
import { Utils } from "./utils";

/**
 * Class to build a dedicated space for the last added block of the chain
 *
 * @author Sophia Artioli <sophia.artioli@epfl.ch>
 *
 */
export class LastAddedBlock {

    readonly lastBlockHeight = 176;
    readonly lastBlockWidth = 200;
    readonly svgHeight = 200;

    // Flash is a utility class to display flash messages in the view
    flash: Flash;

    // The last added block of the chain
    lastBlock: SkipBlock;

    constructor(
        roster: Roster,
        flash: Flash,
        initialBlock: SkipBlock,
        blockClickedSubject: Subject<SkipBlock>
    ) {
        this.flash = flash;

        // Main SVG canvas that contains the last added block of the chain
        const svgLast = d3
            .select("#last-container")
            .attr("height", this.svgHeight);

        // Fetch the last block from the Cothority client
        new SkipchainRPC(roster)
            .getLatestBlock(initialBlock.hash, false, true)
            .then((resp) => {
                this.lastBlock = resp;
                this.displayLastAddedBlock(
                    resp,
                    svgLast,
                    resp.hash,
                    blockClickedSubject
                );
            });
    }

    /**
     * Display the last added block of the chain in the dedicated space
     * @param lastBlock the last added block of the chain
     * @param svgLast the svg container that should welcome the block
     * @param hashLast the hash of the last added block
     * @param blockClickedSubject the subject that is notified when a block is clicked
     */
    private displayLastAddedBlock(
        lastBlock: SkipBlock,
        svgLast: any,
        hashLast: Buffer,
        blockClickedSubject: Subject<SkipBlock>
    ) {
        /* Display of the last added block  */
        svgLast
            .append("rect")
            .attr("id", hashLast.toString("hex"))
            .attr("width", this.lastBlockWidth)
            .attr("height", this.lastBlockHeight)
            .attr("x", 0)
            .attr("y", 20)
            .style("filter", "url(#drop-shadow)")
            .attr("fill", Chain.getBlockColor(lastBlock))
            .on("click", () => {
                blockClickedSubject.next(lastBlock);
            })
            .on("mouseover", function() {
                // Pointer interaction
                d3.select(this).style("cursor", "pointer");
            })
            .on("mouseout", function() {
                d3.select(this).style("cursor", "default");
            });

        /* Shadow effect on the last added block */

        // Shadow filter
        const defs = svgLast.append("defs");

        // height=130% so that the shadow is not clipped
        const filter = defs
            .append("filter")
            .attr("id", "drop-shadow")
            .attr("height", "130%");

        // SourceAlpha refers to opacity of graphic that this filter will be applied to
        // convolve that with a Gaussian with standard deviation 3 and store result
        // in blur
        filter
            .append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 3)
            .attr("result", "blur");

        // Translate output of Gaussian blur to the right and downwards with 2px
        // store result in offsetBlur
        filter
            .append("feOffset")
            .attr("in", "blur")
            .attr("dx", 2)
            .attr("dy", 2)
            .attr("result", "offsetBlur");

        // Overlay original SourceGraphic over translated blurred opacity by using
        // feMerge filter
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "offsetBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        this.lastAddedBlockInfo(lastBlock, svgLast, lastBlock);
    }

    /**
     * Helper function to display on hand information on the last added block
     * Is displayed: Block index and hash, # validated tx, # rejected tx, roster hash and participating conodes
     * @param lastBlock
     * @param svgLast
     * @param block
     */
    private lastAddedBlockInfo(
        lastBlock: SkipBlock,
        svgLast: any,
        block: SkipBlock
    ) {
        /* Text on the last added block  */
        const gtextLast = svgLast.append("g").attr("class", "gtextLast");

        // Add text on top of last added block
        gtextLast
            .append("text")
            .attr("x", "50%")
            .attr("y", "8%")
            .text("Last added")
            .attr("text-anchor", "middle")
            .attr("font-family", "Arial")
            .attr("font-size", "17px")
            .attr("fill", "#808080")
            .attr("pointer-events", "none");

        // Display on the last block's index
        gtextLast
            .append("text")
            .attr("x", "50%")
            .attr("y", "28%")
            .attr("text-anchor", "middle")
            .text("Block " + lastBlock.index.toString())
            .attr("font-family", "Arial")
            .attr("font-size", "17px")
            .attr("fill", "#ffffff")
            .attr("pointer-events", "none");

        // Tooltip for block hash on top of block index
        gtextLast
            .append("rect")
            .attr("x", "25%")
            .attr("y", "20%")
            .attr("width", 110)
            .attr("height", 19)
            .attr("fill-opacity", "0")
            .attr("uk-tooltip", Utils.bytes2String(lastBlock.hash))
            .on("click", () => {
                Utils.copyToClipBoard(
                    lastBlock.hash.toString("hex"),
                    self.flash
                );
            });

        /* Transaction information display */

        // The svg group that will hold
        const transactions = svgLast.append("g").attr("class", "gtransactions");

        // Accepted transactions
        // Builds a rect beneath the transaction detail to make it hoverable for the tooltip
        transactions
            .append("rect")
            .attr("x", "20%")
            .attr("y", "37%")
            .attr("width", 21)
            .attr("height", 19)
            .attr("fill-opacity", "0")
            .attr("uk-tooltip", `Validated transactions`);

        // Displays the green information icon
        transactions
            .append("image")
            .attr("x", "10%")
            .attr("y", "37%")
            .attr("width", 20)
            .attr("height", 20)
            .attr("href", "assets/information-button-green.svg")
            .attr("uk-tooltip", `Validated transactions`);

        // Text for number of validated tx
        transactions
            .append("text")
            .attr("x", "25%")
            .attr("y", "45%")
            .text(this.getTransactionRatio(lastBlock)[0].toString()) // Number of validated transactions
            .attr("font-family", "Arial")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .attr("fill", "#65E1A7")
            .attr("pointer-events", "none");

        // Rejected transactions
        // Builds a rect beneath the transaction detail to make it hoverable for the tooltip
        transactions
            .append("rect")
            .attr("x", "20%")
            .attr("y", "52%")
            .attr("width", 21)
            .attr("height", 19)
            .attr("fill-opacity", "0")
            .attr("uk-tooltip", `Rejected transactions`);

        // Displays the red information svg icon
        transactions
            .append("image")
            .attr("x", "10%")
            .attr("y", "52%")
            .attr("width", 20)
            .attr("height", 20)
            .attr("href", "assets/information-button-red.svg")
            .attr("uk-tooltip", `Rejected transactions`);

        // Text for the number of rejected tx
        transactions
            .append("text")
            .attr("x", "25%")
            .attr("y", "60%")
            .text(this.getTransactionRatio(lastBlock)[1].toString()) // Number of rejected transactions
            .attr("font-family", "Arial")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .attr("fill", "#EF5959")
            .attr("pointer-events", "none");

        /* Roster */

        // List of participating conodes in the roster
        const descList: string[] = [];
        for (let i = 0; i < block.roster.list.length; i++) {
            descList[i] = block.roster.list[i].description;
        }

        // Roster group
        // Tooltip for list of participating conodes in the roster
        const roster = svgLast
            .append("g")
            .attr("class", "groster")
            .attr("uk-tooltip", descList.join("<br/>"));

        // Adds the "Roster" text
        roster
            .append("text")
            .text("Roster")
            .attr("x", "12%")
            .attr("y", "80%")
            .attr("font-family", "Arial")
            .attr("font-size", "16px")
            .attr("fill", "#ffffff")
            .attr("pointer-events", "none");

        // Adds the rectangle beneath the text to make it look clickable
        roster
            .append("rect")
            .attr("x", "10%")
            .attr("y", "70%")
            .attr("width", 58)
            .attr("height", 27)
            .attr("fill", "#1a8cff")
            .attr("fill-opacity", "0.5")
            .attr("rx", "7px");

        // Blockie to illustrate hash of the roster
        const blockie = blockies.create({
            seed: lastBlock.hash.toString("hex"),
        });

        const imBlockies = roster
            .append("svg:image")
            .attr("x", "45%")
            .attr("y", "72%")
            .attr("width", 18)
            .attr("height", 18)
            .attr("xlink:href", blockie.toDataURL())
            .attr("uk-tooltip", block.hash.toString("hex"));

        const self = this;
        // blockie made clickable to copy to clipboard
        imBlockies.on("click", () =>
            Utils.copyToClipBoard(block.hash.toString("hex"), self.flash)
        );
    }

    /**
     * Helper function to count the number of validated and rejected transactions
     * @param block the block from which we want the transactions
     */
    private getTransactionRatio(block: SkipBlock): [number, number] {
        let accepted = 0;
        let rejected = 0;
        const body = DataBody.decode(block.payload);
        body.txResults.forEach((transaction) => {
            if (transaction.accepted) {
                accepted++;
            } else {
                rejected++;
            }
        });
        return [accepted, rejected];
    }
}
