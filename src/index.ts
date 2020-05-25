import { Roster } from "@dedis/cothority/network";

import { BlocksDiagram } from "./blocksDiagram";
import { Browsing } from "./browsing";
import { DetailBlock } from "./detailBlock";
import { Flash } from "./flash";

import { getRosterStr } from "./roster";
import { TotalBlock } from "./totalBlock";

import "uikit";
import "./style.css";
/**
 *
 * Main file that creates the different objects and subjects.
 *
 * @author Anthony Iozzia <anthony.iozzia@epfl.ch>
 * @author Julien von Felten <julien.vonfelten@epfl.ch>
 *
 * @export
 * @returns : only in case of an error
 */
export function sayHi() {
  const roster = Roster.fromTOML(rosterStr);
  const flash = new Flash();
  if (!roster) {
    flash.display(Flash.flashType.ERROR, "Roster is undefined");
    return;
  }
  const blocksDiagram = new BlocksDiagram(roster, flash);
  blocksDiagram.loadInitialBlocks();

  const totalBlock = new TotalBlock(roster);

  const browse = new Browsing(roster, flash, totalBlock);

  const mydetailBlock = new DetailBlock(
    blocksDiagram.getBlockObserver(),
    browse,
    flash,
    blocksDiagram.isUpdatedObserver()
  );
}

const rosterStr = getRosterStr();
