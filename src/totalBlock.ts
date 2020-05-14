import { SkipBlock } from "@dedis/cothority/skipchain";
import { Roster } from "@dedis/cothority/network";
import { Observable } from "rxjs";
import { WebSocketConnection } from "@dedis/cothority/network/connection";
import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import {
  PaginateResponse,
  PaginateRequest,
} from "@dedis/cothority/byzcoin/proto/stream";

export class TotalBlock {
  roster: Roster;
  lastBlockSeenID: string;
  lastBlock:SkipBlock;
  constructor(roster: Roster) {
    this.roster = roster;
    this.lastBlockSeenID =
      "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";
  }

  getTotalBlock():number {
    let observableLastBlock = this.getLatestBlock(this.lastBlockSeenID, this.roster)
    observableLastBlock.subscribe({
      next: (skipBlock) => {
        this.lastBlockSeenID = skipBlock.hash.toString("hex");
        this.lastBlock = skipBlock;
        return skipBlock.index
      },
    })
    return 0;
  }


  // getLatestBlock follows the highest possible forward links from the given
  // block ID (hex hash) until the last known block of the chain and notifies the
  // observer with the latest block.
  private getLatestBlock(
    startID: string,
    roster: Roster
  ): Observable<SkipBlock> {
    return new Observable((sub) => {
      let nextID = Buffer.from(startID, "hex");

      try {
        var conn = new WebSocketConnection(
          roster.list[0].getWebSocketAddress(),
          ByzCoinRPC.serviceName
        );
      } catch (error) {
        sub.error(error);
      }
      conn
        .sendStream<PaginateResponse>( // fetch next block
          new PaginateRequest({
            startid: nextID,
            pagesize: 1,
            numpages: 1,
            backward: false,
          }),
          PaginateResponse
        )
        .subscribe({
          complete: () => {
            sub.error("unexpected paginate complete");
          },
          error: (err: Error) => {
            sub.error(err);
          },
          // ws callback "onMessage":
          next: ([data, ws]) => {
            if (data.errorcode != 0) {
              sub.error(data.errortext);
            }
            const block = data.blocks[0];
            if (block.forwardLinks.length === 0) {
              sub.next(block);
            } else {
              nextID = block.forwardLinks[block.forwardLinks.length - 1].to;
              const message = new PaginateRequest({
                startid: nextID,
                pagesize: 1,
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
