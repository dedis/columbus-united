import { Roster } from "@dedis/cothority/network";

import { BlocksDiagram } from "./blocksDiagram";
import { Browsing } from "./browsing";
import { DetailBlock } from "./detailBlock";

import { getRosterStr } from "./roster";

export function sayHi() {
  const roster = Roster.fromTOML(rosterStr);
  if (!roster) {
    console.error("Roster is undefined");
    return;
  }
  const blocksDiagram = new BlocksDiagram(roster);
  blocksDiagram.loadInitialBlocks();

  const blockObserver = blocksDiagram.getBlockObserver();
  const updateObserver = blocksDiagram.isUpdatedObserver()
  const mydetailBlock = new DetailBlock(blockObserver, new Browsing(roster), updateObserver);
}

const rosterStr = getRosterStr();
