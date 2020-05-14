import { Roster } from "@dedis/cothority/network";

import { BlocksDiagram } from "./blocksDiagram";
import { Browsing } from "./browsing";
import { DetailBlock } from "./detailBlock";
import { Flash } from "./flash";

import { getRosterStr } from "./roster";

export function sayHi() {
  const roster = Roster.fromTOML(rosterStr);
  const flash = new Flash();
  if (!roster) {
    flash.display(Flash.flashType.ERROR, "Roster is undefined");
    return;
  }
  const blocksDiagram = new BlocksDiagram(roster, flash);
  blocksDiagram.loadInitialBlocks();
  const browse = new Browsing(roster, flash);
  const blockObserver = blocksDiagram.getBlockObserver();
  const updateObserver = blocksDiagram.isUpdatedObserver()
  const mydetailBlock = new DetailBlock(blockObserver, browse, flash, updateObserver);
}

const rosterStr = getRosterStr();
