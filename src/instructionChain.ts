import { CONFIG_INSTANCE_ID, Instruction } from "@dedis/cothority/byzcoin";
import { Spawn } from "@dedis/cothority/byzcoin/client-transaction";
import { DataBody, DataHeader, TxResult } from "@dedis/cothority/byzcoin/proto";
import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Observable, Subject } from "rxjs";
import { connectableObservableDescriptor } from "rxjs/internal/observable/ConnectableObservable";
import { throttleTime } from "rxjs/operators";
import { Chain } from "./chain";
import { Flash } from "./flash";
import { Lifecycle } from "./lifecycle";
import { TotalBlock } from "./totalBlock";
import { Utils } from "./utils";
import { debounceTime } from "rxjs/operators";
import { AddTxRequest } from "@dedis/cothority/byzcoin/proto/requests";
import { thresholdFreedmanDiaconis } from "d3";
import * as blockies from "blockies-ts";

export class InstructionChain {

    //static readonly instrBlockPadding;
    //static readonly instrBlockHeight;
    //static readonly instrBlockWidth;

    static loadedInstructions = 0;

    roster: Roster;
    flash : Flash;
    instructionBlock: [SkipBlock[], Instruction[]];
    principalContainer : d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
    loadingContainer: any;
    clickedBlock: SkipBlock;
    selectedInstrIndex:number;
    gInstr : any;
    gloader: any;

     // Last added instruction of the chain
     lastAddedInstr: Instruction;

     // Left-most instruction of the chain
     leftBlock: Instruction;
     // Right-most instruction of the chain
     rightBlock: Instruction;

     // This subject is called when the user zoom/drag the chain
    //chainSubject: Subject<any>;

    //List of all loaded instruction block
    instructionsCard: Array<any>;


    static readonly instructionContainerHeight = 242;
    static readonly instrucionContainerWidth = 350;
    static readonly baseWidth = window.innerWidth; // à contrôler 1684
    static readonly baseHeight = 260;
    static readonly marginlength = 20;

    static readonly blockHeight = 180;
    static readonly blockWidth = 300;
    static readonly blockPadding = 20;
    static readonly blockStarty = InstructionChain.baseHeight-200;

    static readonly invokedColor = "#1749b3";
    static readonly spawnedColor = 'green'
    static readonly deletedColor = 'red'
    clickedInvokedColor = "#006fff";
    clickedSpawnedColor = "#2f984f";
    clickedDeletedColor = "#bb151a";


    static numBlock = Math.floor(InstructionChain.baseWidth/(InstructionChain.blockWidth + InstructionChain.blockPadding));

    // The number of blocks the window can display at normal scale. Used to
    // define the domain for the xScale
    //static numBlocks = Chain.svgWidth / (Chain.blockWidth + Chain.blockPadding);

    // Indicators to know if blocks should be loaded
    // The first load will then set them to false
    isLoading = false;

    // The coordinate transformation of the chain.
    static zoom: any;

    // The number of total loaded instructions on the chains
    // Initialized to 0
    totalLoaded = 0;

    // This subject is notified when a new series of block has been added to the
    // view.
    newInstructionSubject = new Subject<Instruction>();

    clickedInstrSubject = new Subject<number>();

    chainSubject = new Subject<any>();

    // This subject is called when new blocks are loaded
    subjectBrowse = new Subject<[number, SkipBlock[], boolean]>()


    // The coordinates of the view.
    lastTransform = { x: 0, y: 0, k: 1 };



    constructor(roster: Roster, flash: Flash,tuple: [SkipBlock[], Instruction[]], clickedBlock: SkipBlock){ //pas besoin de basecontainer
        this.roster = roster;
        this.flash = flash;
        this.instructionBlock = tuple;
        this.principalContainer = d3.select("#query-card-container");
        this.clickedBlock = clickedBlock;

         // This subject will be notified when the main div is moved by the user
         const subject = new Subject();
         
         //add legend
         const svg = this.principalContainer
                .append("svg")
                .attr("id", "svg-instr")
                .attr("height", InstructionChain.baseHeight)
                .attr("width", InstructionChain.baseWidth);
        svg.append("rect")
            .attr("height", "15")
            .attr("width", "15")
            .attr("y", "10")
            .attr("fill", InstructionChain.invokedColor);
        svg.append("text")
            .attr("x","18")
            .attr("y", "22")
            .text("invoked")
            .style("font-size", "15px")
            .style("fill","#666")
            .attr("alignment-baseline","middle");
        svg.append("rect")
            .attr("height", "15")
            .attr("width", "15")
            .attr("x", "80")
            .attr("y", "10")
            .attr("fill", InstructionChain.spawnedColor);
        svg.append("text")
            .attr("x","98")
            .attr("y", "22")
            .text("spawned")
            .style("font-size", "15px")
            .style("fill","#666")
            .attr("alignment-baseline","middle");
        svg.append("rect")
            .attr("height", "15")
            .attr("width", "15")
            .attr("x", "165")
            .attr("y", "10")
            .attr("fill", InstructionChain.deletedColor);
        svg.append("text")
            .attr("x","183")
            .attr("y", "22")
            .text("deleted")
            .style("font-size", "15px")
            .style("fill","#666")
            .attr("alignment-baseline","middle");
        
        //const parentGroup = svg.append("g").attr("class", "ginstr-parent")
         this.gInstr = svg.append("g").attr("class", "ginstr");
         const gloader = svg.append("g").attr("id", "loaderInstr");
         
         //this.displayChain(this.instructionBlock[1].length);
         //this.displayChain(InstructionChain.numInstruction);
         //InstructionChain.totalLoaded = InstructionChain.numInstruction;
         

         const xScale = d3
            .scaleLinear()
            //.domain([0, this.totalLoaded])
            .range([1, this.totalLoaded]);

        const xAxis = d3
            .axisBottom(xScale)
            .ticks(this.totalLoaded)
            .tickFormat(d3.format("d"));
        /*
        const xAxisDraw = svg
            .insert("g", ":first-child")
            .attr("class", "x-axis")
            .attr("fill", "#8C764A")
            .call(xAxis);*/

         // Update the subject when the view is dragged and zoomed in-out
        this.chainSubject.subscribe({
            next: (transform: any) => {
                this.lastTransform = transform;
            // Update the scale
            const xScaleNew = transform.rescaleX(xScale);
            xAxis.scale(xScaleNew);
            //xAxisDraw.call(xAxis);

            gloader.attr("transform", transform);
                // resize the loaders to always have a relative scale of 1
                gloader
                    .selectAll("svg")
                    .attr("transform", `scale(${1 / transform.k})`); 
            
            // Horizontal transformation on the blocks only (sets Y scale to 1)
            //transform.y = 0;
            //const xtransform = transform.x > 0 ? transform.x : 0;
            const transformString =
                "translate(" +
                transform.x +
                "," +
                "0) scale(" +
                transform.k +
                ",0 )";
            
            this.gInstr.attr("transform", transformString);
            //parentGroup.attr("transform", function() { return "translate(" + transform.x+ "," + transform.y + ")"; });

            //this.checkAndAddBlocks(transform,this.totalLoaded,gloader,this.gInstr);

            }


        });
        const zoom = d3
        .zoom()
        .extent([
            [0, 0],
            [InstructionChain.baseWidth, InstructionChain.baseHeight],
        ])
        .scaleExtent([0.0001, 1])
        .on("zoom", () => {
            this.chainSubject.next(d3.event.transform);
        });
        svg.call(zoom).on("dblclick.zoom", null)

        /*
        this.clickedInstrSubject.subscribe({
            next: this.updateClickedBlock.bind(this),
            
        });*/


        //instructionChain.zoom = zoom;

        // This group will contain the left and right loaders that display a
        // spinner when new blocks are being added
        //this.gloader = this.principalContainer.append("g").attr("id", "loader");

        
        console.log("initial blocks", InstructionChain.numBlock);
        for (this.totalLoaded = 0; (this.totalLoaded < InstructionChain.numBlock && this.totalLoaded< this.instructionBlock[1].length); this.totalLoaded++){
            const xTranslate = this.totalLoaded * (InstructionChain.blockWidth + InstructionChain.blockPadding);
            this.addInstructionBlock(xTranslate,this.instructionBlock,this.totalLoaded,this.gInstr);
            console.log(`${this.totalLoaded}`)
        }
        console.log("initial loaded", this.totalLoaded);
        //first block is automatically selected
        //this.selectedInstrIndex = 0;
        //this.clickedInstrSubject.next(this.selectedInstrIndex);
        //this.createInstructionCard(this.instructionBlock[1][0],this.instructionBlock[0][0],0);

        this.chainSubject.pipe(debounceTime(50)).subscribe({
            next: (transform: any) => {
                //if (!this.isLoading) {
                    //this.isLoading = true;
                    const isLoadingInstr = this.checkAndAddBlocks(
                        transform,
                        this.totalLoaded,
                        gloader,
                        this.gInstr
                    );
                    if (!isLoadingInstr) {
                        this.isLoading = false;
                    }
                //}
            }
        });

        //var maxScrollLeft = instructionChain.baseWidth - d3.event.clientX //pas sure
      
    }
    
    

    displayChain(numB : number){
        const self = this;
        for (let i = 0; i < numB; i++) {
            const blocki = this.instructionBlock[0][i];
            const instruction = this.instructionBlock[1][i];

            //this.addLoader();
            setTimeout(() => {
                this.createInstructionCard(instruction,blocki,i);
            }, 6000);
        }
        // Highlights the blocks in the blockchain
        this.highlightBlocks(this.instructionBlock[0]);
    }

    createInstructionCard(instruction: Instruction, blocki: SkipBlock, i:number){
        const self = this;
        const instructionCard = this.principalContainer.append("div");
            instructionCard
                .attr("class", "uk-card uk-card-default")
                .style("min-width", "320px")
                .style("min-height", "240px");

            const instructionCardHeader = instructionCard.append("div");
            instructionCardHeader.attr(
                "class",
                "uk-card-header uk-padding-small"
            );

            const instructionCardBody = instructionCard.append("div");
            instructionCardBody;

            let contractID = "";
            instructionCard.attr("id", "buttonInstance"); // was buttonInstance${i}
            let verb = "";
            if (instruction.type === Instruction.typeSpawn) {
                contractID = instruction.spawn.contractID;
                verb = "Spawned";
            } else if (instruction.type === Instruction.typeInvoke) {
                verb = "Invoked";
                contractID = instruction.invoke.contractID;
            } else if (instruction.type === Instruction.typeDelete) {
                verb = "Deleted";
                contractID = instruction.delete.contractID;
            }

            instructionCardHeader
                .append("span")
                .attr("class", "uk-badge")
                .text(`${verb}`)
                .on("click", function () {
                    Utils.copyToClipBoard(
                        `${instruction.hash().toString("hex")}}`,
                        self.flash
                    );
                })
                .attr("uk-tooltip", `${instruction.hash().toString("hex")}`);

            instructionCardHeader
                .append("span")
                .text(` ${contractID} contract in `);

            //Creates a clickable badge to copy a hash to the clipboard
            const instructionCardHeaderBadge = instructionCardHeader.append(
                "span"
            );

            instructionCardHeaderBadge
                .attr("class", "uk-badge")
                .text(`Block ${blocki.index}`)
                .on("click", function () {
                    Utils.copyToClipBoard(
                        `${blocki.hash.toString("hex")}`,
                        self.flash
                    );
                })
                .attr("uk-tooltip", `${blocki.hash.toString("hex")}`);
            Utils.clickable(instructionCardHeaderBadge);


            
            // Add an highlight of the instance which was browsed
            if (
                blocki.hash.toString("hex") ===
                this.clickedBlock.hash.toString("hex")
            ) {
                instructionCard.style("outline", "1px red");
            }
            // Detail of each instruction
            const divInstructionB = instructionCardBody.append("div");
            divInstructionB.attr(
                "class",
                "uk-accordion-content uk-padding-small"
            );

            divInstructionB.append("p").text("Arguments: ");
            const ulArgsB = divInstructionB.append("ul");
            ulArgsB.attr("uk-accordion", "");
            // tslint:disable-next-line
            const beautifiedArgs = instruction.beautify();

            beautifiedArgs.args.forEach((arg, i) => {
                const liArgsB = ulArgsB.append("li");
                const aArgsB = liArgsB.append("a");
                aArgsB
                    .attr("class", "uk-accordion-title")
                    .attr("href", "#")
                    .text(`${i}: ${arg.name}`);

                const divArgsB = liArgsB.append("div");
                divArgsB.attr(
                    "class",
                    "uk-accordion-content uk-padding-small uk-padding-remove-top uk-padding-remove-right uk-padding-remove-bottom"
                );

                divArgsB.append("p").text(`${arg.value}`);
            });

        //this.instructionsCard.push(instructionCard)
    }


    /**
     * Highlights the blocks in the blockchain
     *
     * @private
     * @param {string[]} blocks : the blocks to be highlighted
     * @memberof DetailBlock
     */
     private highlightBlocks(blocks: SkipBlock[]) {
        for (let i = 0; i < blocks.length; i++) {
            const blockSVG = d3.select(
                `[id = "${blocks[i].hash.toString("hex")}"]`
            );
            const button = d3.select(`#buttonInstance${i}`);
            if (!blockSVG.empty()) {
                blockSVG.attr("stroke", "red").attr("stroke-width", 5);
            } // tslint:disable-next-line
            button.on("mouseover", function () {
                blockSVG.attr("stroke", "red").attr("stroke-width", 10);
            }); // tslint:disable-next-line
            button.on("mouseout", function () {
                blockSVG.attr("stroke", "red").attr("stroke-width", 5);
            });
        }
    }

    loadNextInstruction(xPos:number, k:number){
        // In case we are reaching the end of the chain, we should not
        // load more blocks than available.
        //this.addLoader(true,this.principalContainer,xPos,1);
        setTimeout(() => {
            //display new block
            console.log("in");
            if(this.totalLoaded < this.instructionBlock[1].length){
                console.log("inside");
                this.createInstructionCard(this.instructionBlock[1][this.totalLoaded],this.instructionBlock[0][this.totalLoaded], InstructionChain.numBlock);
                this.totalLoaded += 1;
            }
        }, 800);

    }


    addLoader(backwards: boolean, gloader: any, xPos: number, k: number) {
        let className = "left-loader";
        //const xPos = this

        // Some loaders: https://codepen.io/aurer/pen/jEGbA
        gloader
            .append("svg")
            .attr("class", `${className}`)
            .attr("viewBox", "0, 0, 24, 30")
            .attr("x", xPos)
            .attr("y", InstructionChain.baseHeight / 2)
            .attr("width", "48px")
            .attr("height", "60px")
            .attr("transform-origin", `${xPos}px 0px`)
            .attr("enable-background", "new 0 0 50 50")
            .attr("transform", `scale(${1 / k})`).html(`
         <rect x="0" y="13" width="4" height="5" fill="#333">
           <animate attributeName="height" attributeType="XML"
             values="5;21;5"
             begin="0s" dur="0.6s" repeatCount="indefinite" />
           <animate attributeName="y" attributeType="XML"
             values="13; 5; 13"
             begin="0s" dur="0.6s" repeatCount="indefinite" />
         </rect>
         <rect x="10" y="13" width="4" height="5" fill="#333">
           <animate attributeName="height" attributeType="XML"
             values="5;21;5"
             begin="0.15s" dur="0.6s" repeatCount="indefinite" />
           <animate attributeName="y" attributeType="XML"
             values="13; 5; 13"
             begin="0.15s" dur="0.6s" repeatCount="indefinite" />
         </rect>
         <rect x="20" y="13" width="4" height="5" fill="#333">
           <animate attributeName="height" attributeType="XML"
             values="5;21;5"
             begin="0.3s" dur="0.6s" repeatCount="indefinite" />
           <animate attributeName="y" attributeType="XML"
             values="13; 5; 13"
             begin="0.3s" dur="0.6s" repeatCount="indefinite" />
         </rect>
      `);
    }


    getBlocks(){
        return this.instructionBlock[0];

    }

    private addInstructionBlock(xTranslate: number, tuple:[SkipBlock[], Instruction[]] ,instrIndex:number, gInstr: any){
        const self = this;
        const block = tuple[0][instrIndex];
        const instruction = tuple[1][instrIndex];
        const color = this.getColor(instruction);
        const box = gInstr
            .append("rect")
            //.transition()
            //.delay(300)
            .attr("id", `${instrIndex}`)
            .attr("width", InstructionChain.blockWidth)
            .attr("height", InstructionChain.blockHeight )
            .attr("x", xTranslate) // The blocks are appended following the transform of the chain
            .attr("y", InstructionChain.blockStarty) // Blocks are appended below the axis
            .attr("fill", "white")
            .attr("stroke", color)
            .attr("stroke-width","4px")
            //.delay(300);//
            /*
            .on("click", () => {
                //console.log("instruction", Utils.bytes2String())
                //d3.select("#buttonInstance").remove();
                //this.createInstructionCard(instruction,block,instrIndex);
                
                this.clickedInstrSubject.next(instrIndex);
                //window.location.hash = `index:${block.index}`;
            })
            .on("mouseover", function () {
                d3.select(this).style("cursor", "pointer");
            })
            .on("mouseout", function () {
                d3.select(this).style("cursor", "default");
            });*/
        let contractID = "";
        let iType = "";
        if (instruction.type === Instruction.typeSpawn) {
            contractID = instruction.spawn.contractID;
            iType = "Spawned";
        } else if (instruction.type === Instruction.typeInvoke) {
            iType = "Invoked";
            contractID = instruction.invoke.contractID;
        } else if (instruction.type === Instruction.typeDelete) {
            iType = "Deleted";
            contractID = instruction.delete.contractID;
        }
        /*gInstr.append("text")
            .text(`instruction ${this.totalLoaded+1}`)
            .attr("x", xTranslate + (InstructionChain.blockWidth-90)/2) //width/2 -du text/2
            .attr("y", InstructionChain.blockStarty-10)
            .style("fill", "#666")
            .style("font-weight", "bold")
            //.delay(400) //ajouté
            .on("click", function () {
                Utils.copyToClipBoard(
                    `${instruction.hash().toString("hex")}}`,
                    self.flash
                );
            })
            .attr("uk-tooltip", `${instruction.hash().toString("hex")}`);*/
        gInstr/*append("text")
            .text(`${contractID}`)
            .attr("x", xTranslate + 40)
            .attr("y", InstructionChain.blockStarty+20)
            .style("fill", "#666")
            .style("font-weight", "bold")
            .append("tspan")
            //.delay(500) //
            .attr("y", InstructionChain.blockStarty+20)
            .attr("dx", "0.2em")
            .text(`contract in`)
            .style("fill", "#666")*/
            .append("text")
            .attr("x", xTranslate + (InstructionChain.blockWidth-90)/2)
            .attr("y", InstructionChain.blockStarty+20)
            .attr("dx", "0.2em")
            .text(`Block ${block.index}`)
            .style("font-weight", "bold")
            .style("fill", color)
            .on("click", function () {
                Utils.copyToClipBoard(
                    `${block.hash.toString("hex")}`,
                    self.flash
                );
            })
            .attr("uk-tooltip", `${block.hash.toString("hex")}`);
        gInstr.append("text")
            .text("arguments :")
            .attr("x", xTranslate + (InstructionChain.blockWidth-90)/2)
            .attr("y", InstructionChain.blockStarty+60)
            .style("font-weight", "bold")
            .style("fill", "#666");
        
        const beautifiedArgs = instruction.beautify();
        //const interlign = 10;
        let dy = InstructionChain.blockStarty+90;
            beautifiedArgs.args.forEach((arg, i) => {

                if(arg.value == "destination"){

                }
            const argNameBox = gInstr.append("text")
                .attr("x", xTranslate+5)
                .attr("y", dy)
                .style("font-weight", "bold")
                .style("fill", "#666")
                .text(`${arg.name} : `);
                if(arg.name == "destination" || arg.name == "roster"){
                    const blocky = blockies.create({ seed: arg.value });
                    const imBlockies = gInstr
                        .append("svg:image")
                        .attr("x", xTranslate + 107)
                        .attr("y", dy-15)
                        .attr("width", 20)
                        .attr("height", 20)
                        .attr("xlink:href", blocky.toDataURL())
                        .attr("uk-tooltip", block.hash.toString("hex"))
                        .on("click", function () {
                            Utils.copyToClipBoard(arg.value, self.flash);
                        })
                        .on("mouseover", function () {
                            d3.select(this).style("cursor", "pointer");
                        })
                        .on("mouseout", function () {
                            d3.select(this).style("cursor", "default");
                        });
                }else {
                argNameBox.append("tspan")
                .attr("y", dy)
                .attr("dx", "0.2em")
                .text(`${arg.value}`)
                .style("fill", "#666");

                }
                dy += 30;
            });


        

    }

    getClickedColor(instruction: Instruction):string{
        let color:string;
        if(instruction.type == Instruction.typeInvoke){
            color = this.clickedInvokedColor;
        } else if(instruction.type == Instruction.typeSpawn){
            color = this.clickedSpawnedColor;
        } else {
            color = this.clickedDeletedColor;
        }

        return color;
    }

    getColor(instruction: Instruction): string {
        let color: string;
        if(instruction.type == Instruction.typeSpawn){
            color = InstructionChain.spawnedColor;
        } else if(instruction.type == Instruction.typeInvoke){
            color = InstructionChain.invokedColor;
        } else{
            color = InstructionChain.deletedColor;
        }

        return color;
    }

    updateClickedBlock(instrIndex:number){
        if(this.selectedInstrIndex != instrIndex){
            d3.select(`[id = "${this.selectedInstrIndex}"]`).style(
                "fill",
                this.getColor(this.instructionBlock[1][this.selectedInstrIndex])
            );
            this.selectedInstrIndex = instrIndex;
        }
        d3.select(`[id = "${instrIndex}"]`).style(
            "fill",
            this.getClickedColor(this.instructionBlock[1][instrIndex])
        );
    }

    addBlock(tranform:any, nextBlockIndex:number, gloader:any){


    }
    

    //condition pour ajouter des blocks:
    // - tous les blocks d'instructions n'ont pas encore été affichés
    checkAndAddBlocks(transform:any, nextBlockIndex:number, gloader:any,gInstr:any):boolean{
        console.log("totalLoaded",this.totalLoaded);
        console.log("query number",this.instructionBlock[1].length);
        if(this.totalLoaded >= this.instructionBlock[1].length){
            //this.flash.display(Flash.flashType.INFO, "End of the instructions chain");
            return false;
        }

        //if(transform.x > 0){
            const xTranslate = (this.totalLoaded) * (InstructionChain.blockWidth + InstructionChain.blockPadding);
            //const xLoad = xTranslate + InstructionChain.blockPadding + InstructionChain.blockWidth/2;
            
            //the this.addLoader(true,gloader,xTranslate,transform.k);
            //setTimeout(() => {
                this.addInstructionBlock(xTranslate,this.instructionBlock,this.totalLoaded,gInstr);
                this.totalLoaded += 1;
                //this.chainSubject.next(d3.event.transform);
                //d3.select(".loaderInstr").remove()
            //}, 400);
            
        //}
    
        return true;


    }

    

    

}
