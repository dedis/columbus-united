import { PaginateRequest, PaginateResponse } from "@dedis/cothority/byzcoin/proto/stream";
import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { StatusRPC } from "@dedis/cothority/status";
import { WebSocketConnection } from "@dedis/cothority/network";
import { ByzCoinRPC, Instruction } from "@dedis/cothority/byzcoin";
import { Flash } from "./flash";
import * as d3 from "d3";
import { Utils } from "./utils";
import DataBody from "@dedis/cothority/byzcoin/proto/data-body";
import { curveLinear } from "d3";


/**
 * The class that displays the status of the nodes of the Roster and the statistics 
 * of the Chain underneath the chain (inside an Accordion)
 * 
 * @author Sophia Artioli (sophia.artioli@epfl.ch)
 * @author Noémien Kocher (noémien.kocher@epfl.ch)
 */

export class Status {


    roster: Roster;

    initialBlock: SkipBlock;

    flash: Flash;

    constructor(roster: Roster, initialBlock: SkipBlock, flash: Flash) {

        this.roster = roster;
        this.initialBlock = initialBlock;
        this.flash = flash;

        const statusBlockContainer = d3.select("#status");
        //append list item of accordion that will contain all the elements
        const statusContainerLi = statusBlockContainer.append("li")
            .attr("id", "statusLi")
            .attr("class", "uk-open");

        const statusContainerTitle = statusContainerLi
            .append("a")
            .attr("class", "uk-accordion-title")
            .attr("href", "#");

        statusContainerTitle
            .append("h3")
            .attr(
                "style",
                "font-weight: 700; font-size: 1.1em; margin-bottom : 15px;"
            )
            .text(" Status of the Skipchain");

        const mainDiv = statusContainerLi
            .append("div")
            .attr("class", "uk-accordion-content")
            .attr("id", "status-div");

        // FIRST PART STATUS OF NODES OF ROSTER
        //list of status of nodes
        const statusRPC = new StatusRPC(roster);

        //create table of nodes status
        const nodeTable = mainDiv
            .append("table")
            .attr("id", "node-table")
            .attr("class", "uk-table uk-table-small uk-table-divider");

        nodeTable.append("caption").text("Status of Roster's nodes");
        const tableHeader = nodeTable.append("thead").append("tr");
        tableHeader.append("th").text("Name");
        tableHeader.append("th").text("Host");
        tableHeader.append("th").text("Uptime");

        //statusRPC.getStatus(0).then(s => console.log(s));
        const tableBody = nodeTable.append("tbody").attr("class", "node-table-body");

        const nodeLastIndex = Object.keys(statusRPC["conn"]).length - 1;

        //populate initial table
        for (let i = 0; i < nodeLastIndex; i++) {
            statusRPC
                .getStatus(i)
                .then((status) => {


                    //infos (+advanced infos on hover)
                    const uptime = status.getStatus("Generic").getValue("Uptime");
                    const [uptimeString, uptimeSeconds] = parseTime(uptime);

                    const Tx_bps = (parseInt(status.getStatus("Generic").getValue("TX_bytes")) / parseInt(uptimeSeconds)).toFixed(3);
                    const Rx_bps = (parseInt(status.getStatus("Generic").getValue("RX_bytes")) / parseInt(uptimeSeconds)).toFixed(3);
                    const infoList =
                        ["ConnType " + status.getStatus("Generic").getValue("ConnType"),
                        "Port " + status.getStatus("Generic").getValue("Port"),
                        "Version " + status.getStatus("Conode").getValue("version"),
                        "Tx/Rx " + Tx_bps + " Bps/ " + Rx_bps + " Bps"];
                    //name
                    const tableElement = tableBody.append("tr");
                    const elementName = tableElement.append("td");


                    elementName
                        .append("p")
                        .attr("id", "status-name-" + i)
                        .attr("style", "color: lightgreen;font-weight: bold;")
                        .text(status.serverIdentity.description)
                        .attr("uk-tooltip", infoList.join("<br/>"));
                    //host
                    tableElement
                        .append("td")
                        .text(status.getStatus("Generic").getValue("Host"));
                    //uptime
                    tableElement.append("td")
                        .text(uptimeString);


                })
                .catch(error => {

                    const downNode = statusRPC["conn"][i];
                    const tableElement = tableBody.append("tr");
                    const elementName = tableElement.append("td");
                    //origin as name
                    elementName
                        .append("p")
                        .attr("id", "status-name-${i}")
                        .attr("style", "color: #a63535;font-weight: bold;")
                        .text(downNode.url.origin);
                    //host
                    tableElement.append("td").text(downNode.url.hostname);
                    //uptime is unavailable
                    tableElement.append("td").text("");
                });
        }

        //update node tooltip infos  
        setInterval(function () {
            for (let i = 0; i < nodeLastIndex; i++) {
                statusRPC
                    .getStatus(i)
                    .then((status) => {
                        //upadted infos (+advanced infos on hover)
                        const uptime = status.getStatus("Generic").getValue("Uptime");
                        const [uptimeString, uptimeSeconds] = parseTime(uptime);

                        const Tx_bps = (parseInt(status.getStatus("Generic").getValue("TX_bytes")) / parseInt(uptimeSeconds)).toFixed(3);
                        const Rx_bps = (parseInt(status.getStatus("Generic").getValue("RX_bytes")) / parseInt(uptimeSeconds)).toFixed(3);

                        const infoList =
                            ["ConnType " + status.getStatus("Generic").getValue("ConnType"),
                            "Port " + status.getStatus("Generic").getValue("Port"),
                            "Version " + status.getStatus("Conode").getValue("version"),
                            "Tx/Rx " + Tx_bps + " Bps/ " + Rx_bps + " Bps"];

                        //update tooltip

                        d3.select("#status-name-" + i)
                            .attr("style", "color: lightgreen;font-weight: bold;")
                            .text(status.serverIdentity.description)
                            .attr("uk-tooltip", infoList.join("<br/>"));


                    }).catch(error => {
                        //no update mark node as down
                        const downNode = statusRPC["conn"][i];

                        d3.select("#status-name-" + i)
                            .attr("style", "color: #a63535;font-weight: bold;")
                            .attr("uk-tooltip", "This node is down.")
                            .text(downNode.url.origin);
                    });
            }

        }, 10 * 1000); //update every 10 second

        // SECOND PART STATISTICS
        //Statistics of the 1000 last blocks

        //fetch 1000 last block infos
        try {
            // tslint:disable-next-line
            var conn = new WebSocketConnection(
                this.roster.list[0].getWebSocketAddress(),
                ByzCoinRPC.serviceName
            );
        } catch (error) {
            this.flash.display(
                Flash.flashType.ERROR,
                `error creating conn: ${error}`
            );
            return;
        }
        const initialBlockID = Utils.bytes2String(initialBlock.hash);
        const bid = Buffer.from(initialBlockID, "hex");
        const message = new PaginateRequest({
            startid: bid,
            pagesize: 1000,
            numpages: 1,
            backward: true,

        });

        const chartData: [number, number][] = [];
        let contractData: Map<string, number> = new Map();
        var maxTx = 0;
        var totalTx = 0;
        var validatedTx = 0;
        conn.sendStream<PaginateResponse>( // fetch next block
            message,
            PaginateResponse
        ).subscribe({
            complete: () => {
                // ...
            },
            error: (err: Error) => {
                this.flash.display(Flash.flashType.ERROR, `error: ${err}`);
            },
            // ws callback "onMessage":
            next: ([data, ws]) => {
                // data is a paginate response, ws is useless 

                for (let i = 0; i < data.blocks.length; i++) {
                    var block = data.blocks[i]

                    var body = DataBody.decode(block.payload);
                    var totalTransaction = body.txResults.length;

                    chartData[data.blocks.length -1 - i] = [block.index, totalTransaction];

                    totalTx += totalTransaction;
                    if (totalTransaction > maxTx) {
                        maxTx = totalTransaction;
                    }
                    //count all different contract types
                    body.txResults.forEach((transaction, i) => {
                        var txInstruction = transaction.clientTransaction.instructions[0];
                        if( transaction.accepted){
                            validatedTx += 1;
                        }
                        if (txInstruction.type == Instruction.typeInvoke) {

                            var contractID = txInstruction.invoke.contractID;
                            if (contractData.has(contractID)) {
                                contractData.set(contractID,contractData.get(contractID) + 1)
                            } else { contractData.set(contractID, 1) }

                        } else if (txInstruction.type === Instruction.typeSpawn) {

                            var contractID = txInstruction.invoke.contractID;
                            if (contractData.has(contractID)) {
                                contractData.set(contractID,contractData.get(contractID) + 1)
                            } else { contractData.set(contractID, 1) }

                        } else if (txInstruction.type === Instruction.typeDelete) {

                            var contractID = txInstruction.delete.contractID;
                            if (contractData.has(contractID)) {
                                contractData.set(contractID,contractData.get(contractID) + 1)
                            } else { contractData.set(contractID, 1) }
                        }
                    });

                }
                console.log(contractData);
                
                const meanTx = Math.round(totalTx / 1000);

                // create chart
                const statisticDiv = mainDiv.append("div");

                const header = statisticDiv.append("div")
                    .attr("class", "uk-card-header")
                    .attr("style", "padding: 0px 0px")
                    .text("Transaction history of the 1000 last blocks");

                // set the dimensions and margins of the graph
                const margin = { top: 10, right: 10, bottom: 30, left: 30 },
                    width = 600 - margin.left - margin.right,
                    height = 250 - margin.top - margin.bottom;

                // append the svg object to the body of the page
                var graphSVG = statisticDiv
                    .append("svg")
                    .attr("width", width + margin.left + 2*margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                    .attr("margin", "15px 0px")
                    .append("g")
                    .attr("transform",
                        "translate(" + margin.left + "," + margin.top + ")");

                // Axis, domain, line
                
                var x = d3.scaleLinear().domain([chartData[0][0], chartData[999][0]]).range([0, width])
                // enough margin in domain y so that there is no interference with legend
                var y = d3.scaleLinear().domain([0, maxTx + 20]).range([height, 0]);

                var xAxis = d3.axisBottom(x);
                var yAxis = d3.axisLeft(y);

                //add the axis
                graphSVG.append("g")
                    .attr("transform", "translate(0," + height + ")")
                    .call(xAxis);

                graphSVG.append("g")
                    .call(yAxis);
                    

                var line = d3.line()
                    .x(function (d, i) {
                        return x(chartData[i][0]);
                    })
                    .y(function (d, i) {
                        return y(chartData[i][1]);
                    });


                graphSVG.append("path")
                    .attr("stroke", "#d4ebf2") //the contrast of white is too strong
                    .attr("stroke-width", 1.5)
                    .attr("fill", "none")
                    .attr("d", line(chartData));

                //show mean and max of the graph

                const legendMean = graphSVG.append("g")
                    .attr("transform", "translate(" + (width - 100) + "," + margin.top + ")");

                legendMean.append("circle")
                    .attr("r", 6)
                    .attr("cx", "-10px")
                    .attr("cy", "-4px")
                    .style("fill", "#94c0ff");

                legendMean.append("text")
                    .text("Mean : " + meanTx)
                    .style("font-size", "12px")
                    .attr("fill", "white");

                const legendMax = graphSVG.append("g")
                    .attr("transform", "translate(" + (width - 100) + "," + 3 * margin.top + ")");

                legendMax.append("circle")
                    .attr("r", 6)
                    .attr("cx", "-10px")
                    .attr("cy", "-5px")
                    .style("fill", "#404080");

                legendMax.append("text")
                    .text("Max : " + maxTx)
                    .style("font-size", "12px")
                    .attr("fill", "white");

                const statisticSummary =statisticDiv.append("div");
                statisticSummary.append("span")
                    .attr("style","position:relative; left: 2em; color:lightblue;")
                    .text("Accepted: ")
                statisticSummary.append("span")
                    .attr("class","chart-badge")
                    .attr("style","position: relative; left: 2em; background: lightgreen; color: #006fff; ")
                    .text(validatedTx)
                statisticSummary.append("span")
                    .attr("style","position:relative; left: 5em; color:lightblue;")
                    .text("Rejected: ")
                statisticSummary.append("span")
                    .attr("class","chart-badge")
                    .attr("style","position: relative; left: 5em; background: #ff4d4d; color: lightblue;")
                    .text(totalTx-validatedTx)

                const contractStatistic = statisticSummary.append("div")
                    .attr("style","margin: 15px 0px;width:"+ width +"px;overflow: auto;");
                //title
                contractStatistic.append("span")
                    .attr("style","position: relative; left: 2em; color: lightblue;")
                    .text("Contracts: ");
                var left = 1.75;
                //var myColor = 
                                        
                //contracts of the 1000 last blocks
                contractData.forEach((val,contract)=>{
                    contractStatistic.append("span")
                    .attr("class","chart-badge")
                    .attr("style","left: "+left+"em;")
                    .attr("uk-tooltip",val + " transaction(s)")
                    .text(contract)

                    left+=1;
                });

               




            },
        });









        // function that converts xxxhxxmxxxs to number of days,hours or minutes
        function parseTime(uptime: string) {
            const hours = parseInt(uptime.match(/([0-9]+)*(?=h)/)[0]);
            const minutes = parseInt(uptime.match(/([0-9]+)*(?=m)/)[0]);

            var resultingText = "";
            if (hours > 24) {
                var days = Math.floor(hours / 24);
                if (days > 1) resultingText = days + " days";
                else resultingText = days + " day";

            } else if (hours >= 1) {
                resultingText = hours + " hours";
            } else {
                var totalMinutes = hours * 60 + minutes;
                resultingText = totalMinutes + " minutes";
            }
            const totalSeconds = (hours * 60 * 60 + minutes * 60 + parseInt(uptime.match(/([0-9.]+)*(?=s)/)[0])).toString();

            return [resultingText, totalSeconds];

        }
    }

}



