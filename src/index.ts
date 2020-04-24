import { Roster } from '@dedis/cothority/network';
import { BrowseBlocks } from './browseBlocks';
import { Browsing } from './browsing';
import { getRosterStr } from './roster';

export function sayHi() {
  var roster = Roster.fromTOML(rosterStr);
  if (!roster) {
    console.log("Roster is undefined")
    return;
  }
  let browseBlocks = new BrowseBlocks(roster)
  browseBlocks.main()

  let mybrowse = new Browsing(roster)
  mybrowse.sayHi1()
}
const rosterStr = getRosterStr()
