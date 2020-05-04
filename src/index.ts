import { Roster } from "@dedis/cothority/network";

import { BlocksDiagram } from "./blocksDiagram";
import { Browsing } from "./browsing";
import { getRosterStr } from "./roster";

export function sayHi() {
  const roster = Roster.fromTOML(rosterStr);
  if (!roster) {
    console.log("Roster is undefined");
    return;
  }
  const blocksDiagram = new BlocksDiagram(roster);
  blocksDiagram.loadInitialBlocks();

  const mybrowse = new Browsing(roster);
  mybrowse.sayHi1();
}

const rosterStr = getRosterStr();
