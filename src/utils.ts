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
import { DataBody } from "@dedis/cothority/byzcoin/proto";

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
     * Gets the block  by it's hash and roster
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

//     static getTransations(block:SkipBlock): Buffer {
//         txs: Buffer;
//         const body = DataBody.decode(block.payload);
//         body.txResults.forEach((transaction, i) => {
//             const accepted: string = transaction.accepted
//                 ? "Accepted"
//                 : "Not accepted";

        
        
//     }
// }

    /**
     * Formats and outputs the date at which a block was validated
     * @param block block of which we want the validation time
     */
    static getTimeString(block : SkipBlock): string{
        var timestamp = Number(DataHeader.decode(block.data).timestamp);
        const date = new Date(timestamp/1000_000)
        console.log(timestamp)
        const hours = date.getHours();
        const minutes = "0" + date.getMinutes();
        const seconds = "0" + date.getSeconds();
        return date.toDateString()+ " at " + hours + ":" + minutes.substr(-2)+":"+seconds.substr(-2)
    }

    
}
