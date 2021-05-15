import { Roster } from "@dedis/cothority/network";
import { StatusRPC } from "@dedis/cothority/status";
import * as d3 from "d3";


/**
 * The class that displays the status of the nodes of the Roster and the statistics 
 * of the Chain underneath the chain (inside an Accordion)
 * 
 * @author Sophia Artioli (sophia.artioli@epfl.ch)
 * @author Noémien Kocher (noémien.kocher@epfl.ch)
 */

export class Status {

    
    roster : Roster;

    constructor(roster: Roster) {

        this.roster = roster;

        const statusBlockContainer = d3.select("#status");
        //append list item of accordion that will contain all the elements
        const statusContainerLi = statusBlockContainer.append("li")
            .attr("id","statusLi")
            .attr("class", "uk-open");
        
        const statusContainerTitle= statusContainerLi.append("a")
            .attr("class","uk-accordion-title")
            .attr("href","#");
            
        statusContainerTitle
            .append("h3")
            .attr("color","#666")
            .attr("font-size","1.3em")
            .attr("font-weight","700")
            .text(" Status of the Skipchain");

        const mainDiv = statusContainerLi.append("div")
            .attr("class","uk-accordion-content")
            .attr("id","status-div");

        //list of status of nodes
        const statusRPC = new StatusRPC(roster);

        //create table of nodes status
        const nodeTable = mainDiv.append("table")
            .attr("id","node-table")
            .attr("class","uk-table uk-table-small uk-table-divider");
        
        nodeTable.append("caption")
            .text("Status of Roster's nodes");
        const tableHeader = nodeTable.append("thead").append("tr");
        tableHeader.append("th")
            .text("Name");
        tableHeader.append("th")
            .text("Host");
        tableHeader.append("th")
            .text("Uptime");

        
        
        //statusRPC.getStatus(0).then(s => console.log(s));
        const tableBody = nodeTable.append("tbody");
        
        const nodeLastIndex = Object.keys(statusRPC["conn"]).length -1;
        //console.log(Object.keys(statusRPC).entries)
        for (let i = 0; i < nodeLastIndex; i++) {
            statusRPC.getStatus(i).then(
                (status) =>{
                    const tableElement = tableBody.append("tr");
                    const elementName = tableElement.append("td");
                    elementName.append("p")
                        .attr("class","up-nodes")
                        .text(status.serverIdentity.description);
                    tableElement.append("td")
                        .text(status.getStatus("Generic").getValue("Host"));
                    //const uptime= status.getStatus("Generic").getValue("Uptime");
                    //const uptime_string= 
                    tableElement.append("td")
                        .text(status.getStatus("Generic").getValue("Uptime"));
                    console.log(status);
                    
                })
            .catch(e => console.log(e));
        }
        
    
        

    }

    
}
