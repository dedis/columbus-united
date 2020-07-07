import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import {
    PaginateRequest,
    PaginateResponse,
} from "@dedis/cothority/byzcoin/proto/stream";
import { Roster } from "@dedis/cothority/network";
import { WebSocketConnection } from "@dedis/cothority/network/connection";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { Observable } from "rxjs";

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
}
