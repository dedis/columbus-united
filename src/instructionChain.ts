import { Instruction } from "@dedis/cothority/byzcoin";
import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Subject } from "rxjs";
import { Flash } from "./flash";
import { Utils } from "./utils";
import { debounceTime } from "rxjs/operators";
import * as blockies from "blockies-ts";

/**
 * This class fully discribes the instance tracker interface
 * - instructions blocks are manually zoomed
 * - blocks infos are not shown when the blocks are too small
 * - on hover over a small block to display info about it
 * - there is a color code for block according the contract type
 *
 * @author Rosa José Sara <rosa.josesara@epfl.ch>
 ** @author Noémien Kocher <noémien.kocher@epfl.ch>
 */
export class InstructionChain {
    static loadedInstructions = 0;

    roster: Roster;
    flash: Flash;
    instructionBlock: [SkipBlock[], Instruction[]];

    gInstr: any;
    gInfo: any;

    //main svg and block dimension
    static readonly baseWidth = window.innerWidth; // à contrôler 1684
    static readonly baseHeight = 240;
    static readonly blockHeight = 180;
    static readonly blockWidth = 300;
    static readonly blockPadding = 20;
    static readonly blockStarty = InstructionChain.baseHeight - 200;

    //block color
    static readonly invokedColor = "#1749b3";
    static readonly spawnedColor = "lightgreen";
    static readonly deletedColor = "#ff4d4d";

    // The number of blocks the window can display at normal scale.
    static numBlock = Math.floor(
        InstructionChain.baseWidth /
            (InstructionChain.blockWidth + InstructionChain.blockPadding)
    );

    // The number of total loaded instructions on the chain
    totalLoaded = 0;

    //useful subjects and variable
    chainSubject = new Subject<any>();
    hoverClickedSubject = new Subject<number>();
    hoverClickedBlockIndex = 0;
    smallBlockCliked = false;

    // The coordinates of the view.
    lastTransform = { x: 0, y: 0, k: 1 };

    /**
     * Create an instance of InstructionChain
     * @param roster
     * @param flash
     * @param tuple
     */
    constructor(
        roster: Roster,
        flash: Flash,
        tuple: [SkipBlock[], Instruction[]]
    ) {
        this.roster = roster;
        this.flash = flash;
        this.instructionBlock = tuple;

        //add legend
        const svg = d3
            .select("#query-card-container")
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
            .attr("x", "18")
            .attr("y", "22")
            .text("invoked")
            .style("font-size", "15px")
            .style("fill", "#666")
            .attr("alignment-baseline", "middle");
        svg.append("rect")
            .attr("height", "15")
            .attr("width", "15")
            .attr("x", "80")
            .attr("y", "10")
            .attr("fill", InstructionChain.spawnedColor);
        svg.append("text")
            .attr("x", "98")
            .attr("y", "22")
            .text("spawned")
            .style("font-size", "15px")
            .style("fill", "#666")
            .attr("alignment-baseline", "middle");
        svg.append("rect")
            .attr("height", "15")
            .attr("width", "15")
            .attr("x", "165")
            .attr("y", "10")
            .attr("fill", InstructionChain.deletedColor);
        svg.append("text")
            .attr("x", "183")
            .attr("y", "22")
            .text("deleted")
            .style("font-size", "15px")
            .style("fill", "#666")
            .attr("alignment-baseline", "middle");
        svg.append("text")
            .attr("class", "total-instr")
            .attr("x", "1160")
            .attr("y", "22")
            .text(`total loaded : ${this.totalLoaded}`)
            .attr("fill", "#666");

        //set the group that will contain the instructions block and the one that will contain informations when the blocks are too small
        this.gInstr = svg.append("g").attr("class", "ginstr");
        this.gInfo = svg.append("g").attr("id", "gIntr_info");

        //Set the subject when the view is dragged or zoomed
        this.chainSubject.subscribe({
            next: (transform: any) => {
                this.lastTransform = transform;
                this.gInstr.remove();
                this.gInstr = svg.append("g").attr("class", "ginstr");

                // Horizontal translation  on  the chain
                const transformString = "translate(" + transform.x + ",0)";

                //add remaining blocks
                let total = 0;
                for (let i = 0; i < this.totalLoaded; ++i) {
                    const xTranslate =
                        i *
                        (InstructionChain.blockWidth +
                            InstructionChain.blockPadding) *
                        transform.k;
                    this.addInstructionBlock(
                        xTranslate,
                        this.instructionBlock,
                        i,
                        this.gInstr,
                        transform
                    );
                    total++;
                    svg.select(".total-instr").text(`total loaded : ${total}`);
                }
                this.gInstr.attr("transform", transformString);
            },
        });
        const zoom = d3
            .zoom()
            .extent([
                [0, InstructionChain.blockStarty],
                [InstructionChain.baseWidth, InstructionChain.blockHeight],
            ])
            .scaleExtent([0.0001, 1])
            .on("zoom", () => {
                this.chainSubject.next(d3.event.transform);
            });
        svg.call(zoom).on("dblclick.zoom", null);

        // display first blocks
        for (
            this.totalLoaded = 0;
            this.totalLoaded < InstructionChain.numBlock &&
            this.totalLoaded < this.instructionBlock[1].length;
            this.totalLoaded++
        ) {
            const xTranslate =
                this.totalLoaded *
                (InstructionChain.blockWidth + InstructionChain.blockPadding);
            this.addInstructionBlock(
                xTranslate,
                this.instructionBlock,
                this.totalLoaded,
                this.gInstr,
                this.lastTransform
            );
            svg.select(".total-instr").text(
                `total loaded : ${this.totalLoaded + 1}`
            );
        }

        //set the zoom and scroll event handler subject to add and resize block as necessary
        this.chainSubject.pipe(debounceTime(80)).subscribe({
            next: (transform: any) => {
                const isLoadingInstr = this.checkAndAddBlocks(
                    transform,
                    this.gInstr
                );
            },
        });

        //set the subject that is notified when a block si too small and hovered
        this.hoverClickedSubject.subscribe({
            next: (instri: number) => {
                this.createHoverInfo(instri, this.instructionBlock, this.gInfo);
            },
        });
    }

    /**
     * Display the instruction blocks and the informations it should contain
     *
     * @param xTranslate the x position of the block
     * @param tuple value of the observable (obtain from the query)
     * @param instrIndex index of the instruction
     * @param gInstr the svg group in which we will draw the instruction block
     * @param transform the transform state of the chain
     */
    private addInstructionBlock(
        xTranslate: number,
        tuple: [SkipBlock[], Instruction[]],
        instrIndex: number,
        gInstr: any,
        transform: any
    ) {
        const self = this;
        const block = tuple[0][instrIndex];
        const instruction = tuple[1][instrIndex];
        const color = this.getColor(instruction);
        const k = transform.k;

        //the of k for which we consider blocks are too small
        const tooSmallValue = 0.35;

        const box = gInstr
            .append("rect")
            .attr("class", "instructionBox")
            .attr("id", `${instrIndex}`)
            .attr("width", InstructionChain.blockWidth * k) //block are manually scaled
            .attr("height", InstructionChain.blockHeight * k)
            .attr("x", xTranslate)
            .attr("y", InstructionChain.blockStarty)
            .attr("fill", "white")
            .attr("stroke", color)
            .attr("stroke-width", "4px");

        // instruction information are shown on if block aren't too small
        if (k <= tooSmallValue) {
            box.on("mouseover", () => {
                // show info if no small blocks have been clicked yet
                if (!this.smallBlockCliked) {
                    this.resetInfoGroup();
                    this.hoverClickedSubject.next(instrIndex);
                }
            })

                .on("mouseout", () => {
                    if (!this.smallBlockCliked) {
                        this.resetInfoGroup();
                    }
                })
                .on("click", () => {
                    // reset if we clicked on a small block previously
                    if (this.hoverClickedBlockIndex != instrIndex) {
                        this.resetInfoGroup();
                    }
                    if (!this.smallBlockCliked) {
                        this.smallBlockCliked = true;
                        this.hoverClickedBlockIndex = instrIndex;
                        this.hoverClickedSubject.next(instrIndex);
                    } else {
                        // small block info will disappear if we clik a second time
                        this.smallBlockCliked = false;
                        this.resetInfoGroup();
                    }
                });
        } else {
            this.resetInfoGroup();
            if (this.smallBlockCliked) {
                this.smallBlockCliked = false;
            }
        }

        if (k > tooSmallValue) {
            // extract instruction info
            let contractName = "";
            let action = "";
            if (instruction.type === Instruction.typeSpawn) {
                contractName = instruction.spawn.contractID;
                instruction.spawn.contractID.slice(1);
                action = `Spawned ${contractName}`;
            } else if (instruction.type === Instruction.typeInvoke) {
                contractName = instruction.invoke.contractID;
                instruction.invoke.contractID.slice(1);
                action = `Invoked ${contractName}`;
            } else if (instruction.type === Instruction.typeDelete) {
                action = "Deleted";
                contractName = instruction.delete.contractID;
            }
            // display instruction info
            gInstr
                .append("text")
                .attr(
                    "x",
                    xTranslate + ((InstructionChain.blockWidth - 90) * k) / 2
                ) // center the text in the block
                .attr("y", InstructionChain.blockStarty + 20 * k)
                .text(`Block ${block.index}`)
                .style("font-weight", "bold")
                .style("font-size", 16 * k)
                .style("fill", color)
                .on("click", function () {
                    Utils.copyToClipBoard(
                        `${block.hash.toString("hex")}`,
                        self.flash
                    );
                })
                .on("mouseover", function () {
                    d3.select(this).style("cursor", "pointer");
                })
                .on("mouseout", function () {
                    d3.select(this).style("cursor", "default");
                })
                .attr("uk-tooltip", `${block.hash.toString("hex")}`);
            gInstr
                .append("text")
                .text("action :")
                .attr("x", xTranslate + 5 * k)
                .attr("y", InstructionChain.blockStarty + 50 * k)
                .style("font-weight", "bold")
                .style("font-size", 16 * k)
                .style("fill", "#666")
                .append("tspan")
                .attr("y", InstructionChain.blockStarty + 50 * k) //pas sur transform.k
                .attr("dx", "0.2em")
                .text(`${action}`)
                .style("font-weight", "bold")
                .style("font-size", 16 * k)
                .style("fill", color);
            gInstr
                .append("text")
                .text("arguments :")
                .attr(
                    "x",
                    xTranslate + ((InstructionChain.blockWidth - 90) * k) / 2
                )
                .attr("y", InstructionChain.blockStarty + 80 * k)
                .style("font-weight", "bold")
                .style("font-size", 16 * k)
                .style("text-decoration", "underline")
                .style("fill", "#666");

            const beautifiedArgs = instruction.beautify();
            let dy = InstructionChain.blockStarty + 110 * k;
            beautifiedArgs.args.forEach((arg, i) => {
                const argNameBox = gInstr
                    .append("text")
                    .attr("x", xTranslate + 5 * k)
                    .attr("y", dy)
                    .style("font-weight", "bold")
                    .style("font-size", 16 * k)
                    .style("fill", "#666")
                    .text(`${arg.name} : `);
                // add a blocky in case of invoked coin
                if (arg.name == "destination" || arg.name == "roster") {
                    const blocky = blockies.create({ seed: arg.value });
                    const imBlockies = gInstr
                        .append("svg:image")
                        .attr("x", xTranslate + 107 * k)
                        .attr("y", dy - 15 * k)
                        .attr("width", 20 * k)
                        .attr("height", 20 * k)
                        .attr("xlink:href", blocky.toDataURL())
                        .attr("uk-tooltip", arg.value)
                        .on("click", function () {
                            Utils.copyToClipBoard(arg.value, self.flash);
                        })
                        .on("mouseover", function () {
                            d3.select(this).style("cursor", "pointer");
                        })
                        .on("mouseout", function () {
                            d3.select(this).style("cursor", "default");
                        });
                } else {
                    let argValue = `${arg.value}`;
                    const argText = argNameBox.append("tspan");
                    argText
                        .attr("y", dy)
                        .attr("dx", "0.2em")
                        .text(function () {
                            //truncate the text so it doesn't get out of the box (depending the argument)
                            if (contractName == "deferred") {
                                if (argValue.length > 6) {
                                    argText.attr("uk-tooltip", argValue);
                                    return argValue.substring(0, 6) + "...";
                                } else {
                                    return argValue;
                                }
                            } else {
                                if (argValue.length >= 20) {
                                    argText.attr("uk-tooltip", argValue);
                                    return argValue.substring(0, 20) + "...";
                                } else {
                                    return argValue;
                                }
                            }
                        })
                        .style("width", 100)
                        .style("font-size", 16 * k)
                        .style("fill", "#666");
                }
                dy += 30 * k;
            });
        }
    }

    /**
     * Helper to the get the color that represent the instruction
     * @param instruction
     * @returns the color of the instruction according to its contract type
     */
    private getColor(instruction: Instruction): string {
        let color: string;
        if (instruction.type == Instruction.typeSpawn) {
            color = InstructionChain.spawnedColor;
        } else if (instruction.type == Instruction.typeInvoke) {
            color = InstructionChain.invokedColor;
        } else {
            color = InstructionChain.deletedColor;
        }

        return color;
    }

    /**
     * Helper : check that a block can be added to the chain and add when required
     * @param transform the tranform object
     * @param gInstr the svg group in which the info should be drawn
     * @returns true if block have been added false otherwise
     */
    private checkAndAddBlocks(transform: any, gInstr: any): boolean {
        //new blocks are added if there remains instruction to be displayed
        const allAreLoaded =
            this.totalLoaded >= this.instructionBlock[1].length;
        if (allAreLoaded) {
            return false;
        }

        const bounds = Utils.transformToIndexes(
            transform,
            InstructionChain.blockWidth + InstructionChain.blockPadding,
            InstructionChain.baseWidth
        );

        //check if whe need to load blocks to right
        const loadingCond =
            this.totalLoaded - 1 < bounds.right &&
            this.totalLoaded + 1 >= bounds.left;
        if (loadingCond) {
            const xTranslate =
                this.totalLoaded *
                (InstructionChain.blockWidth + InstructionChain.blockPadding) *
                transform.k;

            for (let i = 0; i < bounds.right && !allAreLoaded; ++i) {
                setTimeout(() => {
                    this.addInstructionBlock(
                        xTranslate,
                        this.instructionBlock,
                        this.totalLoaded,
                        gInstr,
                        transform
                    );
                    this.totalLoaded += 1;
                    d3.select(".total-instr").text(
                        `total loaded : ${this.totalLoaded}`
                    );
                }, 1000);
            }
        }

        return true;
    }
    /**
     * Helper to display the rectangle block info when the main blocks are too small
     * @param instri index of the instruction
     * @param tuple value of the observable (obtain from the query)
     * @param gInfo  group in which to draw the instruction info
     */
    private createHoverInfo(
        instri: number,
        tuple: [SkipBlock[], Instruction[]],
        gInfo: any
    ) {
        const self = this;
        const block = tuple[0][instri];
        const instruction = tuple[1][instri];
        const color = this.getColor(instruction);

        // block position variables
        const xPos = 500;
        const yPos = 120;

        let contractName = "";
        let action = "";
        let args: any;
        if (instruction.type === Instruction.typeSpawn) {
            contractName = instruction.spawn.contractID;
            action = `Spawned ${contractName}`;
        } else if (instruction.type === Instruction.typeInvoke) {
            contractName = instruction.invoke.contractID;
            args = instruction.invoke.args;
            action = `Invoked ${contractName}`;
        } else if (instruction.type === Instruction.typeDelete) {
            action = "Deleted";
            contractName = instruction.delete.contractID;
        }

        gInfo
            .append("rect")
            .attr("x", xPos)
            .attr("y", yPos)
            .attr("width", 300)
            .attr("height", 100)
            .attr("fill", "white")
            .attr("stroke", color)
            .attr("stroke-width", "2px");
        gInfo
            .append("text")
            .attr("x", xPos + 50)
            .attr("y", yPos + 20)
            .text(`Block ${block.index}`)
            .style("font-weight", "bold")
            .style("font-size", 16)
            .style("fill", color)
            .append("tspan")
            .text(`- ${action}`);

        const coin_invoked = contractName == "coin" && args.length > 1;
        if (coin_invoked) {
            const beautifiedArgs = instruction.beautify().args;
            const contract = beautifiedArgs[0].value;
            const destination = beautifiedArgs[1].value;

            gInfo
                .append("text")
                .attr("x", xPos + 75)
                .attr("y", yPos + 60)
                .text(`${contract} given to`)
                .style("font-weight", "bold")
                .style("font-size", 16)
                .style("fill", "#666");
            const blocky = blockies.create({ seed: destination });
            gInfo
                .append("svg:image")
                .attr("x", xPos + 190)
                .attr("y", yPos + 45)
                .attr("width", 20)
                .attr("height", 20)
                .attr("xlink:href", blocky.toDataURL())
                .attr("uk-tooltip", destination)
                .on("click", function () {
                    Utils.copyToClipBoard(destination, self.flash);
                })
                .on("mouseover", function () {
                    d3.select(this).style("cursor", "pointer");
                })
                .on("mouseout", function () {
                    d3.select(this).style("cursor", "default");
                });
        } else {
            const beautifiedArgs = instruction.beautify().args;
            const argName = beautifiedArgs[0].name;
            const argVal = beautifiedArgs[0].value;
            const info = `${argName} : ${argVal}`;
            const argText = gInfo.append("text");
            argText
                .attr("x", 520)
                .attr("y", 100 + 80)
                .text(() => {
                    // truncate the text so it doesn't get out of the block
                    if (info.length >= 25 && argName == "value") {
                        argText.attr("uk-tooltip", argVal);
                        return info.substring(0, 25) + "...";
                    } else if (info.length >= 30) {
                        argText.attr("uk-tooltip", argVal);
                        return info.substring(0, 30) + "...";
                    } else {
                        return info;
                    }
                })
                .style("font-weight", "bold")
                .style("font-size", 16)
                .style("fill", "#666");
        }
    }

    /**
     * reset the information group (when block are too small)
     */
    private resetInfoGroup() {
        this.gInfo.remove();
        this.gInfo = d3
            .selectAll("#svg-instr")
            .append("g")
            .attr("id", "gIntr_info");
    }
}
