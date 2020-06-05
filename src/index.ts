import "uikit";
import "./style.css";

import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain/skipblock";

import { BlocksDiagram } from "./blocksDiagram";
import { Browsing } from "./browsing";
import { DetailBlock } from "./detailBlock";
import { Flash } from "./flash";
import { getRosterStr } from "./roster";
import { TotalBlock } from "./totalBlock";
import { Utils } from "./utils";

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

  const initialBlockIndex = 1; // Change here the first block to display
  if (initialBlockIndex < 0) {
    flash.display(
      Flash.flashType.ERROR,
      "index of initial block cannot be negative, specified index is " +
        initialBlockIndex
    );
  }

  const hashBlock0 =
    "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3";

  Utils.getBlockFromIndex(hashBlock0, initialBlockIndex, roster).subscribe({
    error: (err: any) => {
      flash.display(
        Flash.flashType.ERROR,
        "unable to find initial block with index " + initialBlockIndex
      );
    },
    next: (block: SkipBlock) => {
      const blocksDiagram = new BlocksDiagram(roster, flash, block);
      blocksDiagram.loadInitialBlocks();

      const totalBlock = new TotalBlock(roster, block);

      const browse = new Browsing(roster, flash, totalBlock, block);

      const mydetailBlock = new DetailBlock(
        blocksDiagram.getBlockObserver(),
        browse,
        flash,
        blocksDiagram.isUpdatedObserver()
      );
    },
  });
}

const rosterStr = getRosterStr();
