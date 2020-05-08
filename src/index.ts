import { Roster } from "@dedis/cothority/network";

import { BlocksDiagram } from "./blocksDiagram";
import { Browsing } from "./browsing";
import { DetailBlock } from "./detailBlock";
import { Warning } from './warning';


import { getRosterStr } from "./roster";

export function sayHi() {
  const roster = Roster.fromTOML(rosterStr);
  const warning = new Warning();
  if (!roster) {
    warning.displaying(1, "Roster is undefined")
    return;
  }
  const blocksDiagram = new BlocksDiagram(roster, warning);
  blocksDiagram.loadInitialBlocks();
  const browse = new Browsing(roster, warning)
  const myobserver = blocksDiagram.getBlockObserver();
  const mydetailBlock = new DetailBlock(myobserver, browse, warning);
}

const rosterStr = getRosterStr();
