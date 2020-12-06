import { DataBody, DataHeader } from "@dedis/cothority/byzcoin/proto";
import { Roster, WebSocketAdapter } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";

import * as d3 from "d3";
import {  Subject } from "rxjs";

import {
    map,

} from "rxjs/operators";
import * as blockies from "blockies-ts";

import { Flash } from "./flash";
import { TotalBlock } from "./totalBlock";
import { Utils } from "./utils";
import { Chain } from "./chain";


export class LastAddedBlock {
    readonly lastHeight = 176;
    readonly lastWidth = 200;
    readonly svgHeight = 200;

    lastSubject = new Subject();

    chain: Chain;

    

    constructor(roster: Roster, flash: Flash, initialBlock: SkipBlock,chain: Chain ){
        
        this.chain = chain;
        //Main SVG caneva that contains the last added block

        const last = d3
            .select("#last-container")
            .attr("height", this.svgHeight)
            .attr("z-index", -1);


        let lastBlock = new TotalBlock(roster, initialBlock);
        lastBlock
            .getTotalBlock()
            .pipe(
                map((s: SkipBlock) =>
                    this.displayLastAddedBlock(s, last, s.hash)
                )
            )
            .subscribe();

    }

    /**
     * Display the last added block of the chain
     * @param lastBlock the last added block of the blockchain
     * @param svgLast the svg container that should welcome the block
     * @param hashLast the hash of the last added block
     *
     */

    private displayLastAddedBlock(
        lastBlock: SkipBlock,
        svgLast: any,
        hashLast: Buffer
    ) {

        svgLast
            .append("rect")
            .attr("id", hashLast.toString("hex"))
            .attr("width", this.lastWidth)
            .attr("height", this.lastHeight)
            .attr("x", 20)
            .attr("y", 20)

            .style("filter", "url(#drop-shadow)")
            .attr("fill", Chain.getBlockColor(lastBlock))
            .on("click", () => { 
               this.chain.getBlockClickedSubject().next(lastBlock);
            });

        //shadow filter for last addedss blcok
        var defs = svgLast.append("defs");

        // create filter with id #drop-shadow
        // height=130% so that the shadow is not clipped
        var filter = defs
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
        var feMerge = filter.append("feMerge");

        feMerge.append("feMergeNode").attr("in", "offsetBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        const gtextLast = svgLast.append("g").attr("class", "gtext");

        //add text on top of last added block
        gtextLast
            .append("text")
            .attr("x", 72)
            .attr("y", 14)
            .text("Last added")
            .attr("font-family", "Arial")
            .attr("font-size", "17px")
            .attr("fill", "#808080")
            .attr("pointer-events", "none");

        gtextLast
            .append("text")
            .attr("x", 63)
            .attr("y", 57)
            .text("Block " + lastBlock.index.toString())
            .attr("font-family", "Arial")
            .attr("font-size", "17px")
            .attr("fill", "#ffffff")
            .attr("pointer-events", "none");
        // .attr("font-weight", "bold")

        gtextLast
            .append("rect")
            .attr("x", 63)
            .attr("y", 40)
            .attr("width", 120)
            .attr("height", 19)
            .attr("fill-opacity", "0")
            .attr("uk-tooltip", Utils.bytes2String(lastBlock.hash));

        this.lastAddedBlockInfo(lastBlock, svgLast, lastBlock);
    }

    lastAddedBlockInfo(lastBlock: SkipBlock, svgLast: any, block: SkipBlock) {
        //validated transactions number
        var accepted = svgLast
            .append("g")
            .attr("class", "gaccepted")
            .attr("uk-tooltip", `Validated transactions`);

        accepted
            .append("rect")
            .attr("x", 65)
            .attr("y", 74)
            .attr("width", 21)
            .attr("fill-opacity", "0")
            .attr("height", 19);

        accepted
            .append("image")
            .attr("width", 20)
            .attr("height", 20)
            .attr("x", 44)
            .attr("y", 75)
            .attr("href", "assets/information-button-green.svg");

        //text for number of validated tx
        accepted
            .append("text")
            .attr("class", "gaccepted")
            .attr("x", 73)
            .attr("y", 90)
            .text(this.getTransactionRatio(lastBlock)[0].toString()) //add number of validated transacitons
            .attr("font-family", "Arial")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .attr("fill", "#65E1A7")
            .attr("pointer-events", "none");

        var rejected = svgLast
            .append("g")
            .attr("class", "grefused")
            .attr("uk-tooltip", `Rejected transactions`);

        rejected
            .append("rect")
            .attr("x", 65)
            .attr("y", 104)
            .attr("width", 21)
            .attr("fill-opacity", "0")
            .attr("height", 19)
            .attr("uk-tooltip", `Rejected transactions`);

        rejected
            .append("image")
            .attr("width", 20)
            .attr("height", 20)
            .attr("x", 44)
            .attr("y", 104)
            .attr("href", "assets/information-button-red.svg");

        //text for number of validated tx
        rejected
            .append("text")
            .attr("x", 74)
            .attr("y", 120)
            .text(this.getTransactionRatio(lastBlock)[1].toString()) //add number of validated transacitons
            .attr("font-family", "Arial")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .attr("fill", "#EF5959")
            .attr("pointer-events", "none");

        //Roster

        let descList: Array<String> = [];
        for (let i = 0; i < block.roster.list.length; i++) {
            descList[i] = block.roster.list[i].description;
        }

        var roster1 = svgLast
            .append("g")
            .attr("class", "groster")
            .attr("uk-tooltip", descList.join("<br/>"));


        roster1
            .append("rect")
            .attr("x", 43)
            .attr("y", 137)
            .attr("width", 58)
            .attr("height", 27)
            .attr("fill", "#1a8cff")
            .attr("fill-opacity", "0.5")
            .attr("rx", "7px");

        roster1
            .append("text")
            .text("Roster")
            .attr("x", 48)
            .attr("y", 157)
            .attr("font-family", "Arial")
            .attr("font-size", "16px")
            .attr("fill", "#ffffff")
            .attr("pointer-events", "none");

        const blockie = blockies.create({
            seed: lastBlock.hash.toString("hex"),
        });

        var imBlockies = svgLast
            .append("svg:image")
            .attr("xlink:href", blockie.toDataURL())
            .attr("x", 114)
            .attr("y", 143)
            .attr("width", 18)
            .attr("height", 18)
            .attr("uk-tooltip", block.hash.toString("hex"));

        imBlockies.on("click", function () {
            Utils.copyToClipBoard(block.hash.toString("hex"), this.flash);
        });
    }

    getTransactionRatio(block: SkipBlock): [Number, Number] {
        let accepted = 0;
        let rejected = 0;

        const body = DataBody.decode(block.payload);
        body.txResults.forEach((transaction, i) => {
            if (transaction.accepted) {
                accepted++;
            } else {
                rejected++;
            }
        });
        
        return [accepted, rejected];
    }







}