import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import {
    PaginateRequest,
    PaginateResponse,
} from "@dedis/cothority/byzcoin/proto/stream";
import { Roster } from "@dedis/cothority/network";
import { WebSocketConnection } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { Observable } from "rxjs";

import { Utils } from "./utils";

/**
 * Create an observable to get the total number of blocks of the blockchain.
 * It keeps the last block seen in order to be faster to next time it is
 * called.
 * @author Julien von Felten <julien.vonfelten@epfl.ch>
 * @export
 * @class TotalBlock
 */
export class TotalBlock {
    roster: Roster;
    lastBlockSeenID: string;

    /**
     * Creates an instance of TotalBlock using the roster,
     * setting the lastBlockSeen as the first block of the
     * blockchain
     *
     * @param {Roster} roster
     * @memberof TotalBlock
     */
    constructor(roster: Roster, initialBlock: SkipBlock) {
        this.roster = roster;
        this.lastBlockSeenID = Utils.bytes2String(initialBlock.hash);
    }

    /**
     * Return the observable with the last block of the blockchain
     *
     * @returns {Observable<SkipBlock>}
     * @memberof TotalBlock
     */
    getTotalBlock(): Observable<SkipBlock> {
        return this.getLatestBlock(this.lastBlockSeenID, this.roster);
    }

    /**
     * Follows the highest possible forward links from the given
     * block ID (hex hash) until the last known block of the chain
     * and notifies the observer with the latest block.
     *
     * @private
     * @param {string} startID
     * @param {Roster} roster
     * @returns {Observable<SkipBlock>}
     * @memberof TotalBlock
     */
    private getLatestBlock(
        startID: string,
        roster: Roster
    ): Observable<SkipBlock> {
        return new Observable((sub) => {
            let nextID = Buffer.from(startID, "hex");

            try {
                // tslint:disable-next-line
                var conn = new WebSocketConnection(
                    roster.list[0].getWebSocketAddress(),
                    ByzCoinRPC.serviceName
                );
            } catch (error) {
                sub.error(error);
            }
            conn.sendStream<PaginateResponse>( // fetch next block
                new PaginateRequest({
                    startid: nextID,

                    pagesize: 1, // tslint:disable-next-line
                    numpages: 1,
                    backward: false,
                }),
                PaginateResponse
            ).subscribe({
                complete: () => {
                    sub.error("unexpected paginate complete");
                },
                error: (err: Error) => {
                    sub.error(err);
                },
                // ws callback "onMessage":
                next: ([data, ws]) => {
                    // tslint:disable-next-line
                    if (data.errorcode != 0) {
                        sub.error(data.errortext);
                    }
                    const block = data.blocks[0];
                    if (block.forwardLinks.length === 0) {
                        this.lastBlockSeenID = block.hash.toString("hex");
                        sub.next(block);
                    } else {
                        nextID =
                            block.forwardLinks[block.forwardLinks.length - 1]
                                .to;
                        const message = new PaginateRequest({
                            startid: nextID,

                            pagesize: 1, // tslint:disable-next-line
                            numpages: 1,
                            backward: false,
                        });
                        const messageByte = Buffer.from(
                            message.$type.encode(message).finish()
                        );
                        ws.send(messageByte); // fetch next block
                    }
                },
            });
        });
    }
}
