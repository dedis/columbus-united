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
            .attr("width","400 px")
            .attr("class","uk-table");
        
        nodeTable.append("caption")
            .text("Status of Roster's nodes");
        const tableHeader = nodeTable.append("thead").append("tr");
        tableHeader.append("th")
            .text("Server ID");
        tableHeader.append("th")
            .text("Status");
        tableHeader.append("th")
            .text("Host");

        

        statusRPC.getStatus(0).then((blockStatus)=>{
            const name = blockStatus.serverIdentity.description;
            const url= blockStatus.serverIdentity.url;
            const up = blockStatus.status.Db.field.open;

            console.log(name);
        });
        
        console.log(statusRPC.getStatus(0));

    }
}
