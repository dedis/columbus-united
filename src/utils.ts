import { DataHeader } from "@dedis/cothority/byzcoin/proto";
import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { SkipchainRPC } from "@dedis/cothority/skipchain";
import * as blockies from "blockies-ts";
import * as d3 from "d3";
import { line } from "d3";
import { Subject } from "rxjs";
import { Chain } from "./chain";
import { Flash } from "./flash";

export class Utils {
    /**
     * Convert bytes to string.
     * @param b buffer to convert
     */
    static bytes2String(b: Buffer): string {
        return b.toString("hex");
    }

    /**
     * Convert string to bytes.
     * @param hex string to convert
     */
    static hex2Bytes(hex: string) {
        if (!hex) {
            return Buffer.allocUnsafe(0);
        }

        return Buffer.from(hex, "hex");
    }

    /**
     * Generate a random color in HEX format.
     * Source: https://stackoverflow.com/a/1152508
     */
    static getRandomColor() {
        return (
            "#" +
            (0x1000000 + Math.random() * 0xffffff).toString(16).substr(1, 6)
        );
    }

    /**
     * Get the hash of the previous (left) block.
     * @param block block of which we want the hash of the left block
     */
    static getLeftBlockHash(block: SkipBlock): string {
        return this.bytes2String(block.backlinks[0]);
    }

    /**
     * Get the hash of the next (right) block.
     * @param block block of which we want the hash of the right block
     */
    static getRightBlockHash(block: SkipBlock): string {
        return this.bytes2String(block.forwardLinks[0].to);
    }

    /**
     * @author Sophia Artioli (sophia.artioli@epfl.ch)
     *
     * Get the skipBlock by its hash and roster
     * @param hash the hash the requested block
     * @param roster roster that validated the block
     */
    static async getBlock(hash: Buffer, roster: Roster): Promise<SkipBlock> {
        return await new Promise<SkipBlock>((resolve, reject) => {
            new SkipchainRPC(roster)
                .getSkipBlock(hash)
                .then((skipblock) => resolve(skipblock))
                .catch((e) => {
                    reject(e);
                });
        });
    }

    /**
     * @author Sophia Artioli (sophia.artioli@epfl.ch)
     *
     * Gets the skipBlock by its hash and roster
     * @param genesis hash of the first block of the chain
     * @param index the index of the requested block
     * @param roster roster that validated the block
     */
    static async getBlockByIndex(
        genesis: Buffer,
        index: number,
        roster: Roster
    ): Promise<SkipBlock> {
        return await new Promise<SkipBlock>((resolve, reject) => {
            new SkipchainRPC(roster)
                .getSkipBlockByIndex(genesis, index)
                .then((skipblock) => resolve(skipblock.skipblock))
                .catch((e) => {
                    reject(e);
                });
        });
    }

    /**
     *
     * @author Lucas Trognon (lucas.trognon@epfl.ch)
     * Formats and outputs the date at which a block was validated
     * @param block block of which we want the validation time
     */
    static getTimeString(block: SkipBlock): string {
        const timestamp = Number(DataHeader.decode(block.data).timestamp);
        const date = new Date(timestamp / 1000_000);
        const hours = date.getHours();
        const minutes = "0" + date.getMinutes();
        const seconds = "0" + date.getSeconds();

        return (
            date.toISOString().slice(0, 10) +
            " at " +
            hours +
            ":" +
            minutes.substr(-2) +
            ":" +
            seconds.substr(-2)
        );
    }

    static trigger(id: string): void {
        alert(id);
    }

    /**
     * @author Lucas Trognon (lucas.trognon@epfl.ch)
     * Takes a string and copies it to clipboard, notify it has been done afterwards.
     * To work with all browsers, this needs to be called after an event generated by a user (a click for instance)
     * @param str string to copy to clipboard
     * @param flash flash used to display a notification on
     */
    static copyToClipBoard(str: string, flash: Flash): void {
        const dummy = document.createElement("textarea");
        dummy.value = str;
        document.body.appendChild(dummy);
        dummy.select();
        document.execCommand("copy");
        document.body.removeChild(dummy);
        flash.display(Flash.flashType.INFO, "Copied to clipboard");
    }

    /**
     * @author Sophia Artioli (sophia.artioli@epfl.ch)
     *
     * Translates the chain to the given block.
     * @param goalBlock
     * @param initialBlock
     * @param blockClickedSubject
     */
    static async translateOnChain(goalBlock: number, initialBlock: number) {
        // translate the chain to wanted coordinates
        const newZoom = d3.zoomIdentity
            .translate(
                (initialBlock - goalBlock) * Chain.unitBlockAndPaddingWidth +
                    0.2 -
                    initialBlock * Chain.unitBlockAndPaddingWidth,
                0
            )
            .scale(1);

        /**
         * Adds an animation and then calls the transformation
         * @author Lucas Trognon (lucas.trognon@epfl.ch)
         */
        d3.select("#svg-container")
            .transition()
            .delay(200)
            .duration(1000)
            .call(Chain.zoom.transform, newZoom);
    }

    /**
     * @author Noémien Kocher (noémien.kocher@epfl.ch)
     *
     * Converts a transform to the corresponding block index.
     * @param transform d3 transformation
     * @param blockWidth width of a block, with the padding included
     * @param chainWidth the width of the chain
     */
    static transformToIndexes(
        transform: any,
        blockWidth: number,
        chainWidth: number
    ): { left: number; right: number } {
        const x = -transform.x;
        const zoomLevel = transform.k;

        const leftBlockIndex = x / (blockWidth * zoomLevel);
        const rightBlockIndex =
            chainWidth / (blockWidth * zoomLevel) + leftBlockIndex;

        return { left: Math.max(0, leftBlockIndex), right: rightBlockIndex };
    }

    /**
     *  @author Lucas Trognon (lucas.trognon@epfl.ch)
     *
     * Adds a clickable squared blocky image to a d3 selection. Should be used to represent an object.
     * @param line d3 selection
     * @param hash seed for the blocky
     * @param flash flash object used for the copy to clipboard notification.
     * */

    static addHashBlocky(
        line: d3.Selection<HTMLElement, unknown, HTMLElement, any>,
        hash: string,
        flash: Flash
    ) {
        const blocky = blockies.create({ seed: hash });
        line.append("img")
            .attr("class", "uk-img")
            .attr("src", blocky.toDataURL())
            .attr("uk-tooltip", ` ${hash}`)
            .on("click", function () {
                Utils.copyToClipBoard(hash, flash);
            })
            .on("mouseover", function () {
                d3.select(this).style("cursor", "pointer");
            })
            .on("mouseout", function () {
                d3.select(this).style("cursor", "default");
            });
    }

    /**
     * @author Lucas Trognon (lucas.trognon@epfl.ch)
     *
     *
     * Adds a clickable rounded blocky image to a d3 selection. Should be used to represent a user.
     * @param line d3 selection
     * @param hash seed for the blocky
     * @param flash flash object used for the copy to clipboard notification.
     */
    static addIDBlocky(
        line: d3.Selection<HTMLElement, unknown, HTMLElement, any>,
        hash: string,
        flash: Flash
    ) {
        const blocky = blockies.create({ seed: hash });
        line.append("img")
            .attr("class", "uk-img clip-blocky")
            .attr("src", blocky.toDataURL())
            .attr("uk-tooltip", ` ${hash}`)
            .on("click", function () {
                Utils.copyToClipBoard(hash, flash);
            })
            .on("mouseover", function () {
                d3.select(this).style("cursor", "pointer");
            })
            .on("mouseout", function () {
                d3.select(this).style("cursor", "default");
            });
    }
    /**
     * @author Lucas Trognon (lucas.trognon@epfl.ch)
     * Changes the pointer dynamically when the user hover an element to indicate it is interactive
     * @param item d3 Selection, preferably of a clickable field.
     */
    static clickable(
        item: d3.Selection<HTMLElement, unknown, HTMLElement, any>
    ) {
        item.on("mouseover", function () {
            d3.select(this).style("cursor", "pointer");
        }).on("mouseout", function () {
            d3.select(this).style("cursor", "default");
        });
    }
}
