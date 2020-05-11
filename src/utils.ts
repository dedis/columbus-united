import { Subject, Observable } from "rxjs";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { WebSocketConnection } from "@dedis/cothority/network/connection";
import { Roster } from "@dedis/cothority/network";
import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import {
  PaginateResponse,
  PaginateRequest,
} from "@dedis/cothority/byzcoin/proto/stream";

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

  static getBlockFromIndex(
    index: number,
    roster: Roster
  ): Observable<SkipBlock> {
    let hashBlock0 =
      "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";

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

            if (data.errorcode != 0) {
              sub.error(data.errortext)
            } else if (block.index == index) {
              sub.next(block);
            } else if (block.forwardLinks.length == 0) {
              sub.error("End of blockchain")
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
}
