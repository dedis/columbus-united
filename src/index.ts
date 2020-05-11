import { Roster } from "@dedis/cothority/network";

import { BlocksDiagram } from "./blocksDiagram";
import { Browsing } from "./browsing";
import { DetailBlock } from "./detailBlock";

import { getRosterStr } from "./roster";
import { SkipchainRPC, SkipBlock } from '@dedis/cothority/skipchain';

export function sayHi() {
  const roster = Roster.fromTOML(rosterStr);
  if (!roster) {
    console.error("Roster is undefined");
    return;
  }
  const blocksDiagram = new BlocksDiagram(roster);
  blocksDiagram.loadInitialBlocks();

  const myobserver = blocksDiagram.getBlockObserver();

  const totalBlock = findTotalBlocks(roster);

  const mydetailBlock = new DetailBlock(myobserver, new Browsing(roster, totalBlock));
}

const rosterStr = getRosterStr();

function findTotalBlocks(roster:Roster):number{
  const rpc = new SkipchainRPC(roster);
  const latestBlockPromise = rpc.getLatestBlock(Buffer.from("9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3", "hex"))
  let totalblock = null
  latestBlockPromise.then(
    (skipBlock: SkipBlock) => {
      console.log("last skipblock index",skipBlock.index)
      console.log("HASH : "+skipBlock.hash.toString("hex"))
      totalblock = skipBlock.index
    },
    (e: Error) => {
      console.log("error", e.message)
    }
  )
  return totalblock
}