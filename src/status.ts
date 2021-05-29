import { PaginateRequest, PaginateResponse } from "@dedis/cothority/byzcoin/proto/stream";
import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import { StatusRPC } from "@dedis/cothority/status";
import * as d3 from "d3";
import { Utils } from "./utils";


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

    constructor(roster: Roster, initialBlock: SkipBlock) {

        this.roster = roster;
        this.initialBlock = initialBlock;

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

        //Statistics of the 1000 last blocks
        const initialBlockID = Utils.bytes2String(initialBlock.hash);
        const bid = Buffer.from(initialBlockID, "hex");
        const message = new PaginateRequest({
            startid: bid,
            pagesize: 1000, 
            numpages: 1,
            backward: true,

        });
        console.log(message.$type)
        console.log(message.$type.fields);
        console.log(message.$type.toString());
        console.log(message.toJSON());


        const statisticDiv = mainDiv.append("div");

        const header = statisticDiv.append("div")
            .attr("class", "uk-card-header")
            .attr("style", "padding: 0px 0px")
            .text("Transaction history of the 1000 last blocks");

        // set the dimensions and margins of the graph
        const margin = { top: 10, right: 10, bottom: 30, left: 40 },
            width = 400 - margin.left - margin.right,
            height = 250 - margin.top - margin.bottom;

        // append the svg object to the body of the page
        var graphSVG = statisticDiv
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

        var xAxis = d3.scaleLinear()
            .domain(d3.extent([0, 1000]))
            .range([0, width]);

        graphSVG.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(xAxis));

        // Add Y axis
        var yAxis = d3.scaleLinear()
            .domain([0, 70]) //to be changed to max of transactions per block
            .range([height, 0]);
        graphSVG.append("g")
            .call(d3.axisLeft(yAxis));

        // Add the line
        /*
        svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.5)
        .attr("d", d3.line()
            .x(function(d) { return x(d.date) })
            .y(function(d) { return y(d.value) })
            )

        */
        //number of transactions by contract type


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



