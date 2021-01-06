import { DataBody } from "@dedis/cothority/byzcoin/proto";
import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { SkipchainRPC } from "@dedis/cothority/skipchain";
import { Subject } from "rxjs";

import * as d3 from "d3";

import * as blockies from "blockies-ts";
import { map } from "rxjs/operators";

import { Chain } from "./chain";
import { Flash } from "./flash";
import { TotalBlock } from "./totalBlock";
import { Utils } from "./utils";

/**
 * Class for the last added block of the chain
 *
 * @author Sophia Artioli <sophia.artioli@epfl.ch>
 *
 */
export class LastAddedBlock {
    readonly lastBlockHeight = 176;
    readonly lastBlockWidth = 200;
    readonly svgHeight = 200;

    // Flash is a utility class to display flash messages in the view.
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

        // Main SVG caneva that contains the last added block
        const svgLast = d3
            .select("#last-container")
            .attr("height", this.svgHeight);

       // We fetch the last block
       new SkipchainRPC(roster).getLatestBlock(initialBlock.hash, false, true).then(
        (resp) => {this.displayLastAddedBlock(resp,svgLast,resp.hash,blockClickedSubject);
            blockClickedSubject.next(resp);
        }
    );
    }
    /**
     * Helper function to display on hand information on the last added block
     * We display: # validated tx, # rejected tx, roster hash and participating conodes, block index and hash
     * @param lastBlock
     * @param svgLast
     * @param block
     */
    lastAddedBlockInfo(lastBlock: SkipBlock, svgLast: any, block: SkipBlock) {
        // validated transactions
        const accepted = svgLast
            .append("g")
            .attr("class", "gaccepted")
            .attr("uk-tooltip", `Validated transactions`);

        accepted
            .append("rect")
            .attr("x", 65)
            .attr("y", 74)
            .attr("width", 21)
            .attr("height", 19)
            .attr("fill-opacity", "0");

        accepted
            .append("image")
            .attr("width", 20)
            .attr("height", 20)
            .attr("x", 44)
            .attr("y", 75)
            .attr("href", "assets/information-button-green.svg");

        // text for number of validated tx
        accepted
            .append("text")
            .attr("x", 73)
            .attr("y", 90)
            .text(this.getTransactionRatio(lastBlock)[0].toString()) // add number of validated transactions
            .attr("font-family", "Arial")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .attr("fill", "#65E1A7")
            .attr("pointer-events", "none");

        // rejected transactions
        const rejected = svgLast
            .append("g")
            .attr("class", "grefused")
            .attr("uk-tooltip", `Rejected transactions`);

        rejected
            .append("rect")
            .attr("x", 65)
            .attr("y", 104)
            .attr("width", 21)
            .attr("height", 19)
            .attr("fill-opacity", "0")
            .attr("uk-tooltip", `Rejected transactions`);

        rejected
            .append("image")
            .attr("width", 20)
            .attr("height", 20)
            .attr("x", 44)
            .attr("y", 104)
            .attr("href", "assets/information-button-red.svg");

        // text for number of rejected tx
        rejected
            .append("text")
            .attr("x", 74)
            .attr("y", 120)
            .text(this.getTransactionRatio(lastBlock)[1].toString()) // add number of rejected transactions
            .attr("font-family", "Arial")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .attr("fill", "#EF5959")
            .attr("pointer-events", "none");

        // Roster
        // Get list of participating conodes in the roster
        const descList: string[] = [];
        for (let i = 0; i < block.roster.list.length; i++) {
            descList[i] = block.roster.list[i].description;
        }
        // tooltip for list of participating conodes in the roster
        const roster = svgLast
            .append("g")
            .attr("class", "groster")
            .attr("uk-tooltip", descList.join("<br/>"));

        roster
            .append("text")
            .text("Roster")
            .attr("x", 48)
            .attr("y", 157)
            .attr("font-family", "Arial")
            .attr("font-size", "16px")
            .attr("fill", "#ffffff")
            .attr("pointer-events", "none");

        roster
            .append("rect")
            .attr("x", 43)
            .attr("y", 137)
            .attr("width", 58)
            .attr("height", 27)
            .attr("fill", "#1a8cff")
            .attr("fill-opacity", "0.5")
            .attr("rx", "7px");

        // blockie to illustrate hash of the roster
        const blockie = blockies.create({
            seed: lastBlock.hash.toString("hex"),
        });

        const imBlockies = svgLast
            .append("svg:image")
            .attr("xlink:href", blockie.toDataURL())
            .attr("x", 114)
            .attr("y", 143)
            .attr("width", 18)
            .attr("height", 18)
            .attr("uk-tooltip", block.hash.toString("hex"));

        const self = this;
        // blockie made clickable to copy to clipboard
        // tslint:disable-next-line:only-arrow-functions
        imBlockies.on("click", () =>
            Utils.copyToClipBoard(block.hash.toString("hex"), self.flash)
        );
    }

    /**
     * Display the last added block of the chain
     * @param lastBlock the last added block of the blockchain
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
        svgLast
            .append("rect")
            .attr("id", hashLast.toString("hex"))
            .attr("width", this.lastBlockWidth)
            .attr("height", this.lastBlockHeight)
            .attr("x", 20)
            .attr("y", 20)
            .style("filter", "url(#drop-shadow)")
            .attr("fill", Chain.getBlockColor(lastBlock))
            .on("click", () => {
                // tslint:disable-next-line:no-unused-expression
                blockClickedSubject.next(lastBlock);
            })
            .on("mouseover", function () {
                d3.select(this).style("cursor", "pointer");
            })
            .on("mouseout", function () {
                d3.select(this).style("cursor", "default");
            });

        // shadow filter for last added block
        const defs = svgLast.append("defs");

        // create filter with id #drop-shadow
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

        // translate output of Gaussian blur to the right and downwards with 2px
        // store result in offsetBlur
        filter
            .append("feOffset")
            .attr("in", "blur")
            .attr("dx", 2)
            .attr("dy", 2)
            .attr("result", "offsetBlur");

        // overlay original SourceGraphic over translated blurred opacity by using
        // feMerge filter. Order of specifying inputs is important!
        const feMerge = filter.append("feMerge");

        feMerge.append("feMergeNode").attr("in", "offsetBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        const gtextLast = svgLast.append("g").attr("class", "gtext");

        // add text on top of last added block
        gtextLast
            .append("text")
            .attr("x", 72)
            .attr("y", 14)
            .text("Last added")
            .attr("font-family", "Arial")
            .attr("font-size", "17px")
            .attr("fill", "#808080")
            .attr("pointer-events", "none");

        // block index text on last added block
        gtextLast
            .append("text")
            .attr("x", 63)
            .attr("y", 57)
            .text("Block " + lastBlock.index.toString())
            .attr("font-family", "Arial")
            .attr("font-size", "17px")
            .attr("fill", "#ffffff")
            .attr("pointer-events", "none");

        // tooltip for block hash on top of block index
        const self = this;
        gtextLast
            .append("rect")
            .attr("x", 63)
            .attr("y", 40)
            .attr("width", 120)
            .attr("height", 19)
            .attr("fill-opacity", "0")
            .attr("uk-tooltip", Utils.bytes2String(lastBlock.hash))
            .on("click", () => {
                Utils.copyToClipBoard(
                    lastBlock.hash.toString("hex"),
                    self.flash
                );
            });

        this.lastAddedBlockInfo(lastBlock, svgLast, lastBlock);

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
