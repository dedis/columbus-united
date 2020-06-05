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
      "#" + (0x1000000 + Math.random() * 0xffffff).toString(16).substr(1, 6)
    );
  }

  /**
   * Browse the blockchain to find a specific block
   * Use:
   * Utils.getBlockFromIndex(
   *    hashFirstBlock,
   *    initialBlockIndex,
   *    roster
   *  ).subscribe({
   *    next: (block: SkipBlock) => {
   *      // Do something
   *    },
   *  });
   * @param hashBlock0 hash of the block of index 0 of the blockchain
   * @param index index of the wanted block
   * @param roster roster configuration
   */
  static getBlockFromIndex(
    hashBlock0: string,
    index: number,
    roster: Roster
  ): Observable<SkipBlock> {
    return new Observable((sub) => {
      let conn: WebSocketConnection;
      try {
        conn = new WebSocketConnection(
          roster.list[0].getWebSocketAddress(),
          ByzCoinRPC.serviceName
        );
      } catch (error) {
        sub.error(error);
      }

      conn
        .sendStream<PaginateResponse>( // fetch next block
          new PaginateRequest({
            backward: false,
            numpages: 1,
            pagesize: 1,
            startid: this.hex2Bytes(hashBlock0),
          }),
          PaginateResponse
        )
        .subscribe({
          // ws callback "onMessage":
          complete: () => {
            sub.error("Unexpected Paginate Complete");
          },
          error: (err: Error) => {
            sub.error(err);
          },
          next: ([data, ws]) => {
            const block = data.blocks[0];

            // tslint:disable-next-line
            if (data.errorcode != 0) {
              sub.error(data.errortext);
            } else if (block.index === index) {
              sub.next(block);
            } else if (block.forwardLinks.length === 0) {
              sub.error("End of blockchain");
            } else {
              const message = new PaginateRequest({
                backward: false,
                numpages: 1,
                pagesize: 1,
                startid: block.forwardLinks[0].to,
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
