import { Roster, WebSocketAdapter } from '@dedis/cothority/network';
import { SkipBlock } from '@dedis/cothority/skipchain';
import { WebSocketConnection } from '@dedis/cothority/network/connection';
import { ByzCoinRPC, Instruction, Argument } from '@dedis/cothority/byzcoin';
import { PaginateResponse, PaginateRequest } from '@dedis/cothority/byzcoin/proto/stream';
import { Subject } from 'rxjs';
import { DataBody } from '@dedis/cothority/byzcoin/proto';
import * as d3 from 'd3';
import { BrowseBlocks } from './browseBlocks';

var roster: Roster;
var ws: WebSocketAdapter;
const firstBlockIDStart = "9cc36071ccb902a1de7e0d21a2c176d73894b1cf88ae4cc2ba4c95cd76f474f3" //"a6ace9568618f63df1c77544fafc56037bf249e4749fb287ca82cc55edc008f8" 
              //DELETE contract: 30acb65139f5f9b479eaea33dae7ccf5704b3b0cf446dff1fb5d6b60b95caa59
const pageSize = 15 //combien de blocks je veux          Expliquer que 20/20 est bon car testé deja
const numPages = 15 //nombre de requete pour faire du streaming: 50 blocks, en 5 requete asynchrone. 
//nombre de block total: pagesize * numpages
var nextIDB: string = ""
var totalBlocks = 36650
var seenBlocks = 0
var matchfound = 0

var contractID = ""
var blocks: SkipBlock[] = []
var instanceSearch :Instruction = null

var container: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>

export function sayHi() {
  roster = Roster.fromTOML(rosterStr);
  if (!roster) {
    console.log("Roster is undefined")
    return;
  }
  document.getElementById("browse").addEventListener("click", browseClick)
  document.getElementById("show").addEventListener("click", show)
  
  container = d3.select("body").append("div").attr("id", "container")

  // Blocks UI
  let browseBlocks = new BrowseBlocks(roster)
  browseBlocks.main()
}

function createText(texts: string[], args?: Argument[]){/*
  var detailsHTML = container.append("details")
  // Fetch all the details element.
  const details = document.querySelectorAll("details");

  // Add the onclick listeners.
  details.forEach((targetDetail) => {
    targetDetail.addEventListener("click", () => {
      // Close all the details that are not targetDetail.
      details.forEach((detail) => {
        if (detail !== targetDetail) {
          detail.removeAttribute("open");
        }
      });
    });
  });

  detailsHTML.append("summary").text(texts[0])
  for(let i = 1; i < texts.length; i++){
    detailsHTML.append("p").text(texts[i]).on("click", () =>{
      details.forEach((detail)=>{
        detail.removeAttribute("open")
      })
    })
  }*/
}


function show(e:Event){
  console.log(seenBlocks)
  showInstance(instanceSearch)
}

function showInstance(instance : Instruction){
  console.log("Number of blocks seen: "+seenBlocks+", total should be: "+totalBlocks)
  console.log(instance)
  //browse(pageSize, numPages, firstBlockIDStart, instance)

  container.append("text").text("Instruction hash is: " +instance.hash().toString("hex"))
  container.append("text").text("Instance ID is: " +instance.instanceID.toString("hex"))
  showSpawn(instance)
  var j = showInvoke(instance)
  showDelete(instance, j)

}

function showSpawn(instance:Instruction){
  const payload = blocks[0].payload
  const body = DataBody.decode(payload)
  body.txResults.forEach((transaction) => {
    transaction.clientTransaction.instructions.forEach((instruction, j) => {
      if(instruction.instanceID.toString("hex") === instance.instanceID.toString("hex")){
        if (instruction.spawn !== null) {
          console.log("\n--- Instruction spawn")
          console.log("\n---- Hash: " + instruction.hash().toString("hex"))
          console.log("\n---- ContractID: " + instruction.spawn.contractID)
          createText(["Instruction spawn", "Hash: "+ instruction.hash().toString("hex"), "ContractID: " + instruction.spawn.contractID, 
          "Args: "], instruction.spawn.args)
        }
      }
    });
  });
}

function showInvoke(instance:Instruction){
  var j = 0

  for(let i = 0; i < blocks.length; i++){
    const payload = blocks[i].payload
    const body = DataBody.decode(payload)
    body.txResults.forEach((transaction) => {
      transaction.clientTransaction.instructions.forEach((instruction) => {
        if(instruction.instanceID.toString("hex") === instance.instanceID.toString("hex")){
          matchfound++
          if (instruction.invoke !== null) {
            console.log("\n--- Instruction invoke :" + j++)
            console.log("\n---- Hash: " + instruction.hash().toString("hex"))
            console.log("\n---- ContractID: " + instruction.invoke.contractID)
            createText(["Instruction invoke", "Hash: "+ instruction.hash().toString("hex"), "ContractID: " + instruction.invoke.contractID, 
            "Args: "], instruction.invoke.args)
          }
        }
      });
    });
  }
  return j
}

function showDelete(instance:Instruction, j:number){
  const payload = blocks[blocks.length-1].payload
  const body = DataBody.decode(payload)
  body.txResults.forEach((transaction) => {
    transaction.clientTransaction.instructions.forEach((instruction) => {
      if(instruction.instanceID.toString("hex") === instance.instanceID.toString("hex")){
        if (instruction.delete !== null) {
          console.log("\n--- Instruction delete 1")
          console.log("\n---- Hash: " + instruction.hash().toString("hex"))
          console.log("\n---- Instance ID: " + instruction.instanceID.toString("hex"))
        }
      }
    });
  });
}

function printdataConsole(block: SkipBlock, pageNum: number) {
  const payload = block.payload
  const body = DataBody.decode(payload)
  console.log("- block: " + seenBlocks + ", page " + pageNum + ", hash: " + block.hash.toString(
    "hex"))
  body.txResults.forEach((transaction, i) => {
    console.log("\n-- Transaction: " + i)
    transaction.clientTransaction.instructions.forEach((instruction, j) => {
      console.log("\n--- Instruction " + j)
      console.log("\n---- Hash: " + instruction.hash().toString("hex"))
      console.log("\n---- Instance ID: " + instruction.instanceID.toString("hex"))
      if (instruction.spawn !== null) {
        console.log("\n---- spawn")

      }
      if (instruction.invoke !== null) {
        console.log("\n---- invoke")
      }
    });
  });
  return 0
}

function printdataBox(block: SkipBlock, pageNum: number){

  var detailsHTML = container.append("details")
  detailsHTML.attr("id", "detailsChanged")
  const payload = block.payload
  const body = DataBody.decode(payload)
  body.txResults.forEach((transaction, i)=>{
    transaction.clientTransaction.instructions.forEach((instruction, j)=>{
      


      if (instruction.spawn !== null) {
        detailsHTML.append("summary").text("Spawn with instanceID: "+instruction.instanceID.toString("hex") + ", and Hash is: "+instruction.hash().toString("hex"))
        detailsHTML.append("p").text("ContractID: "+instruction.spawn.contractID)
        var argsDetails = detailsHTML.append("details")
        argsDetails.append("summary").text("args are:")
        var my_list = argsDetails.append("ul")
        instruction.spawn.args.forEach((arg, _) => {
          my_list.append("li").text("Arg name : " +arg.name)
          my_list.append("li").text("Arg value : " +arg.value)
        });
      }


      else if (instruction.invoke !== null) {
        detailsHTML.append("summary").text("Invoke with instanceID: "+instruction.instanceID.toString("hex") + ", and Hash is: "+instruction.hash().toString("hex"))
        detailsHTML.append("p").text("ContractID: "+instruction.invoke.contractID)
        var argsDetails = detailsHTML.append("details")
        argsDetails.append("summary").text("args are:")
        var my_list = argsDetails.append("ul")
        instruction.invoke.args.forEach((arg, _) => {
          my_list.append("li").text("Arg name : " +arg.name)
          my_list.append("li").text("Arg value : " +arg.value)
        });
      }
      else if(instruction.delete !== null){
        detailsHTML.append("summary").text("Delete with instanceID: "+instruction.instanceID.toString("hex") + ", and Hash is: "+instruction.hash().toString("hex"))
        detailsHTML.append("p").text("ContractID: "+instruction.delete.contractID)
      }

      var verifiersHTML = detailsHTML.append("details")
      verifiersHTML.append("summary").text("Verifiers: "+block.verifiers.length)
      block.verifiers.forEach((uid, j) => {
        verifiersHTML.append("p").text("Verifier: "+j+" ID: "+uid.toString("hex"))
      });
      var backlinkHTML = detailsHTML.append("details")
      backlinkHTML.append("summary").text("Backlinks: "+block.backlinks.length)
      block.backlinks.forEach((value, j) => {
        backlinkHTML.append("p").text("Backlink: "+j+" Value: "+value.toString("hex"))
      });

      var forwardlinkHTML = detailsHTML.append("details")
      forwardlinkHTML.append("summary").text("ForwardLinks: "+block.forwardLinks.length)
      block.forwardLinks.forEach((fl, j) => {
        forwardlinkHTML.append("p").text("ForwardLink: "+j)
        forwardlinkHTML.append("p").text("From: "+fl.from.toString("hex")+" Hash: "+fl.hash().toString("hex"))
        forwardlinkHTML.append("p").text("signature: + " + fl.signature.sig.toString("hex"))
      });
    })
  })

    // Fetch all the details element.
    const details = document.querySelectorAll("detailsChanged");

    // Add the onclick listeners.
    details.forEach((targetDetail) => {
      targetDetail.addEventListener("click", () => {
        // Close all the details that are not targetDetail.
        details.forEach((detail) => {
          
          if (detail !== targetDetail) {
            detail.removeAttribute("open");
          }
        });
      });
    });
}

function browseClick(e: Event) {
  ws = undefined
  nextIDB = ""
  seenBlocks = 0
  matchfound = 0
     
  contractID = ""
  blocks = []
  var inst = null
  browse(pageSize, numPages, firstBlockIDStart, inst)
}

function browse(pageSizeB: number,
  numPagesB: number, firstBlockID: string, instance: Instruction) {
  instanceSearch = instance
  var subjectBrowse = new Subject<[number, SkipBlock]>();
  var pageDone = 0;
  contractID = (document.getElementById("contractID") as HTMLInputElement).value
  subjectBrowse.subscribe({
    next: ([i, skipBlock]) => {
      if (i == pageSizeB) {
        pageDone++;
        if (pageDone == numPagesB && seenBlocks < 4000) {
          if (skipBlock.forwardLinks.length != 0 ) {
            nextIDB = skipBlock.forwardLinks[0].to.toString("hex");
            pageDone = 0;
            getNextBlocks(nextIDB, pageSizeB, numPagesB, subjectBrowse);
          } else {
            subjectBrowse.complete()
          }
        }
      }
    },
    complete: () => {
      console.log("Fin de la Blockchain")
      console.log("closed")
      showInstance(instanceSearch)
    },
    error: (err: any) => {
      console.log("error: ", err);
      if (err === 1) {
        console.log("Browse recall: " + 1)
        ws = undefined //To reset the websocket, create a new handler for the next function (of getnextblock)
        browse(1, 1, nextIDB, instanceSearch)
      }
    }
  });
  getNextBlocks(firstBlockID, pageSizeB, numPagesB, subjectBrowse);
  console.log(blocks)
  return subjectBrowse
}

function getNextBlocks(
  nextID: string,
  pageSizeNB: number,
  numPagesNB: number,
  subjectBrowse: Subject<[number, SkipBlock]>) {
  var bid: Buffer;
  nextIDB = nextID
  try {
    bid = hex2Bytes(nextID);
  } catch (error) {
    console.log("failed to parse the block ID: ", error);
    return;
  }

  try {
    var conn = new WebSocketConnection(
      roster.list[0].getWebSocketAddress(),
      ByzCoinRPC.serviceName
    );
  } catch (error) {
    console.log("error creating conn: ", error);
    return;
  }
  if (ws !== undefined) {
    const message = new PaginateRequest({
      startid: bid,
      pagesize: pageSizeNB,
      numpages: numPagesNB,
      backward: false
    });

    const messageByte = Buffer.from(message.$type.encode(message).finish());
    ws.send(messageByte);  //fetch next block

  } else {

    conn.sendStream<PaginateResponse>(  //fetch next block
      new PaginateRequest({
        startid: bid,
        pagesize: pageSizeNB,
        numpages: numPagesNB,
        backward: false
      }),
      PaginateResponse).subscribe({
        // ws callback "onMessage":
        next: ([data, ws]) => {
          var ret = handlePageResponse(data, ws, subjectBrowse)
          if (ret == 1) {
            console.log("Error Handling with a return 1")
            subjectBrowse.error(1)
          }
        },
        complete: () => {
          console.log("closed");
        },
        error: (err: Error) => {
          console.log("error: ", err);
          ws = undefined;
        }
      });
  }
}

function handlePageResponse(data: PaginateResponse, localws: WebSocketAdapter, subjectBrowse: Subject<[number, SkipBlock]>) {
  if (data.errorcode != 0) {
    console.log(
      `got an error with code ${data.errorcode} : ${data.errortext}`
    );
    return 1;
  }
  if (localws !== undefined) {
    ws = localws
  }
  var runCount = 0;
  for (var i = 0; i < data.blocks.length; i++) {
    seenBlocks++
    runCount++;
    var block = data.blocks[i]
    subjectBrowse.next([runCount, data.blocks[i]]);
    const payload = block.payload
    const body = DataBody.decode(payload)
    body.txResults.forEach((transaction) => {
      transaction.clientTransaction.instructions.forEach((instruction) => {
        if (instruction.instanceID.toString("hex") === contractID) {
          console.log("*****************Contract match found*****************")
          if(!blocks.includes(data.blocks[i])){
            instanceSearch = instruction
            blocks.push(data.blocks[i])
          }
          printdataConsole(block, data.pagenumber)
          printdataBox(block, data.pagenumber)
        }
      })
    })
  }
  return 0;
}

function hex2Bytes(hex: string) {
  if (!hex) {
    return Buffer.allocUnsafe(0);
  }

  return Buffer.from(hex, "hex");
}

const rosterStr = `[[servers]]
Address = "tls://127.0.0.1:7770"
Suite = "Ed25519"
Public = "a10dc0d4c45c5b1d64997e2a29dc136ebff4ee9b439aab21835c3df0fd10537d"
Description = "New cothority"
[servers.Services]
  [servers.Services.ByzCoin]
    Public = "37c079d0c083a7a166e8b0e89e36c52f31ed6bbbda6f2dd4dcf712924a177a2c8767668af6f6551bfb3044bd5665f85588e6781e15aca9cda74a847c91d57fbd345cb1b7280b37f423b838cbb54c6ca2ca61e140e7d480b45e01e24a555895f87e2407135edd324ba3549c0d67d8658a7e58df5b250536f4c4f6db0a6d6d2652"
    Suite = "bn256.adapter"
  [servers.Services.Skipchain]
    Public = "2920ae1d3a2b20fef455b436073210406627dc492b40e854d071802d1e25d79277d61fc161ad6c6ada2b69c6ac1bb130c513de4685c09ab60ad8c10a168592ba44eb6a7210eb8892e16f536e5d348666da9d8c9dfbe73358b52b970e9ecfeb592af7d720f64ced15b548c7eb6d7e268935e2d55ce77c2e9d6290ded819eef556"
    Suite = "bn256.adapter"`;
