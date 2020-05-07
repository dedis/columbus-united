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

  const myobserver = blocksDiagram.getBlockObserver();
  const mydetailBlock = new DetailBlock(myobserver, new Browsing(roster), blocksDiagram);
}

const rosterStr = getRosterStr();
