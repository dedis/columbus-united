import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import {
    PaginateRequest,
    PaginateResponse,
} from "@dedis/cothority/byzcoin/proto/stream";
import { Roster } from "@dedis/cothority/network";
import { WebSocketConnection } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { Observable } from "rxjs";
import { DataHeader } from '@dedis/cothority/byzcoin/proto';
import { SkipchainRPC } from "@dedis/cothority/skipchain";
import { Flash } from './flash';
import * as blockies from "blockies-ts";
import * as d3 from "d3";

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
     * Gets the block index by it's hash and roster
     * @param hash block of which we want the index
     * @param roster roster that validated the block
     */
    static async getBlockIndex(hash: Buffer, roster:Roster): Promise<number> {
        return await new Promise<number>((resolve, reject) => {
            new SkipchainRPC(roster)
            .getSkipBlock(hash)
            .then((skipblock) => resolve(skipblock.index)
            ).catch( e => reject(e));
        })
    }

     /**
     * Gets the block by it's hash and roster
     * @param hash block of which we want the index
     * @param roster roster that validated the block
     */
    static async getBlock(hash: Buffer, roster:Roster): Promise<SkipBlock> {
        return await new Promise<SkipBlock>((resolve, reject) => {
            new SkipchainRPC(roster)
            .getSkipBlock(hash)
            .then((skipblock) => resolve(skipblock)
            ).catch( e => reject(e));
        })
    }

     /**
     * Gets the block by it's hash and roster
     * @param hash block of which we want the index
     * @param roster roster that validated the block
     */
    static async getBlockByIndex(genesis: Buffer, index :number, roster:Roster): Promise<SkipBlock> {
        return await new Promise<SkipBlock>((resolve, reject) => {
            new SkipchainRPC(roster)
            .getSkipBlockByIndex(genesis,index)
            .then((skipblock) => resolve(skipblock.skipblock)
            ).catch( e => reject(e));
        })
    }





    /**
     * Formats and outputs the date at which a block was validated
     * @param block block of which we want the validation time
     */
    static getTimeString(block : SkipBlock): string{
        var timestamp = Number(DataHeader.decode(block.data).timestamp);
        const date = new Date(timestamp/1000_000)
        const hours = date.getHours();
        const minutes = "0" + date.getMinutes();
        const seconds = "0" + date.getSeconds();
        const day = date.getDay();
        const month = date.getMonth();
        const year = date.getFullYear();
        
        return date.toISOString().slice(0,10)+ " at " + hours + ":" + minutes.substr(-2)+":"+seconds.substr(-2)
    }

    static trigger(id : string): void{

        alert(id);
    }


    /**
     * Takes a string and copies it to clipboard, notify it has been done afterwards.
     * To work with all browsers, this needs to be called after an event generated by a user (a click for instance)
     * @param str string to copy to clipboard
     * @param flash flash used to display a notification on
     */
    static copyToClipBoard(str : string, flash: Flash): void {
        const dummy = document.createElement('textarea');
        dummy.value = str;
        document.body.appendChild(dummy);
        dummy.select();
        document.execCommand("copy");
        document.body.removeChild(dummy);
        flash.display(Flash.flashType.INFO,"Copied to clipboard");
    }

    static addHashBlocky(
        line: d3.Selection<HTMLElement,unknown,HTMLElement,any>, 
        hash : string,
        flash : Flash)
    {
        const blocky = blockies.create({seed : hash})
        line
            .append("img")
            .attr("class", 'uk-img')
            .attr("src", blocky.toDataURL())
            .attr("uk-tooltip", ` ${hash}`)
            .on("click", function() {Utils.copyToClipBoard(hash, flash)})
            .on("mouseover",function() {d3.select(this).style("cursor", "pointer")})
            .on("mouseout", function() {d3.select(this).style("cursor", "default")});
    }

    static addIDBlocky(
        line: d3.Selection<HTMLElement,unknown,HTMLElement,any>, 
        hash : string,
        flash : Flash)
    {
        const blocky = blockies.create({seed : hash})
        line
            .append("img")
            .attr("class", 'uk-img clip-blocky')
            .attr("src", blocky.toDataURL())
            .attr("uk-tooltip", ` ${hash}`)
            .on("click", function() {Utils.copyToClipBoard(hash, flash)})
            .on("mouseover",function() {d3.select(this).style("cursor", "pointer")})
            .on("mouseout", function() {d3.select(this).style("cursor", "default")});
    }
    
}
