import { DataBody } from "@dedis/cothority/byzcoin/proto";
import { Roster } from "@dedis/cothority/network";
import { SkipBlock } from "@dedis/cothority/skipchain";
import * as d3 from "d3";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { Chunk } from "./chunk";
import { Flash } from "./flash";
import { LastAddedBlock } from "./lastAddedBlock";
import { Utils } from "./utils";

/**
 * The core class that builds the chain and creates autonomous parts on it
 * @author Sophia Artioli (sophia.artioli@epfl.ch)
 * @author Noémien Kocher (noémien.kocher@epfl.ch)
 */
export class Chain {
    // Getter for the subject that is notified when a block is clicked on.
    get getBlockClickedSubject(): Subject<SkipBlock> {
        return this.blockClickedSubject;
    }

    // Getter for the subject that is notified when new blocks are loaded from the client.
    get getNewBlocksSubject(): Subject<SkipBlock[]> {
        return this.newBlocksSubject;
    }

    // Go to https://color.adobe.com/create/color-wheel with this base color to
    // find the palet of colors.
    static readonly blockColor = { r: 23, v: 73, b: 179 };

    // Block properties
    static readonly blockPadding = 10;
    static readonly blockHeight = 50;
    static readonly blockWidth = 70;
    static readonly svgHeight = 200;
    static readonly svgWidth = window.innerWidth;

    static unitBlockAndPaddingWidth = Chain.blockPadding + Chain.blockWidth;
    static readonly axisPadding = 8;

    // The number of blocks the window can display at normal scale. Used to
    // define the domain for the xScale
    static numBlocks = Chain.svgWidth / (Chain.blockWidth + Chain.blockPadding);

    // Recommended pageSize / nbPages: 80 / 50
    static pageSize = 50;
    static readonly nbPages = 1;

    // The coordinate transformation of the chain.
    static zoom: any;

    // The number of total loaded blocks on the chains
    // Initialized to 0
    static totalLoaded = 0;

    /**
     * Determine the color of the blocks.
     * The darker the block the more transactions it contains.
     */
    static getBlockColor(block: SkipBlock): string {
        const body = DataBody.decode(block.payload);
        const nbTransactions = body.txResults.length;
        const factor = 1 - nbTransactions * 0.004;
        return `rgb(${Chain.blockColor.r * factor}, ${
            Chain.blockColor.v * factor
        }, ${Chain.blockColor.b * factor})`;
    }

    // The group that contains the blocks on the chain.
    readonly gblocks: any;
    // The group that contains the arrows between blocks.
    readonly garrow: any;
    // The groups that contains the circles on the blocks of the chain
    readonly gcircle: any;
    readonly blockies: any;

    // The array that contains all autonomous parts on the chain.
    readonly chunks = new Array<Chunk>();

    // The roster defines the blockchain nodes
    roster: Roster;

    // This subject is notified each time a block is clicked.
    blockClickedSubject = new Subject<SkipBlock>();

    // This subject is notified when a new series of block has been added to the
    // view.
    newBlocksSubject = new Subject<SkipBlock[]>();

    // Flash is a utility class to display flash messages in the view.
    flash: Flash;

    // The first block displayed by the chain.
    initialBlock: SkipBlock;

    lastAddedBlock: LastAddedBlock;

    // Coordinates and scale factor of the view of the chain
    lastTransform = { x: 0, y: 0, k: 1 };

    private transformSubject: Subject<unknown>;

    constructor(roster: Roster, flash: Flash, initialBlock: SkipBlock) {
        // Blockchain properties
        this.roster = roster;
        this.flash = flash;

        // First block displayed on the chain
        this.initialBlock = initialBlock;

        // This subject will be notified when the main SVG canvas in moved by the user
        const subject = new Subject();

        this.transformSubject = subject;

        //When a new chain is created the number of loaded blocks is reset
        Chain.totalLoaded = 0;

        // Main SVG canvas that contains the chain
        const svg = d3.select("#svg-container").attr("height", Chain.svgHeight);

        // This group will contain the blocks
        this.gblocks = svg.append("g").attr("class", "gblocks");

        // This group will contain the arrows between blocks
        this.garrow = svg.append("g").attr("class", "garrow");

        d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        // This group will contain the circles. We need two separate groups because the
        // transform on the text group should not change the scale to keep the text
        // readable
        this.gcircle = svg.append("g").attr("class", "gcircle");
        this.blockies = svg.append("g").attr("class", "blockies");

        // The xScale displays the block index and allows the user to quickly see
        // where he is in the chain
        const xScale = d3
            .scaleLinear()
            .domain([initialBlock.index, initialBlock.index + Chain.numBlocks])
            .range([0, Chain.svgWidth]);

        const xAxis = d3
            .axisBottom(xScale)
            .ticks(Chain.numBlocks)
            .tickFormat(d3.format("d"));

        const xAxisDraw = svg
            .insert("g", ":first-child")
            .attr("class", "x-axis")
            .attr("fill", "#8C764A")
            .call(xAxis);

        // Update the subject when the view is dragged and zoomed in-out
        const zoom = d3
            .zoom()
            .extent([
                [0, 0],
                [Chain.svgWidth, Chain.svgHeight],
            ])
            .scaleExtent([0.0001, 1.4])
            .on("zoom", () => {
                subject.next(d3.event.transform);
            });

        //Disable zooming the view on double tap to enable double clocking on backward links
        svg.call(zoom).on("dblclick.zoom", null);
        Chain.zoom = zoom;

        //Implementation of a scrollbar underneath the chain

        const scrollbar = svg.append("g").attr("transform", "translate(0,90)"); //move the bar to the bottom of the chain

        scrollbar
            .append("rect")
            .attr("class", "mover")
            .attr("x", Chain.svgWidth / 2)
            .attr("y", Chain.svgHeight / 2)
            .attr("rx", "3px")
            .attr("width", Math.round(Chain.svgWidth / Chain.numBlocks)); //TODO fix size of mover according to total number of blocks on the chain.numblock is the numbber of blocks loaded

        const self = this;
        let last = Chain.svgWidth / 2;

        var dragHandler = d3.drag().on("drag", function () {
            d3.select(this).attr("x", d3.event.x);

            if (self.lastTransform.k == 1) {
                var newTransform = d3.zoomIdentity
                    .translate(self.lastTransform.x + (last - d3.event.x), 0)
                    .scale(1);
            } else {
                newTransform = d3.zoomIdentity
                    .translate(
                        self.lastTransform.x / self.lastTransform.k +
                            (last - d3.event.x),
                        0
                    )
                    .scale(1);
            }

            last = d3.event.x;

            d3.select("#svg-container").call(
                Chain.zoom.transform,
                newTransform
            );
        });

        dragHandler(d3.selectAll(".mover"));

        //Drop down-menu for clickable zoom in & out
        const divZoomDropdown = d3
            .selectAll(".topnav")
            .append("div")
            .attr("class", "dropdown");

        //contains zoom-in and zoom-out buttons
        const zoomButton = divZoomDropdown
            .append("button")
            .attr("class", "zoombtn");
        zoomButton
            .append("svg")
            .attr("id", "svg-zoombtn")
            .attr("transform", "translate(-5,0)")
            .append("image")
            .attr("x", "5%")
            .attr("y", "15%")
            .attr("width", "15px")
            .attr("height", "15px")
            .attr("href", "assets/zoom-icon.svg");

        const divZoomDropdownContent = divZoomDropdown
            .append("div")
            .attr("id", "dropdown-zoom")
            .attr("class", "dropdown-zoom-content");

        divZoomDropdownContent
            .append("p")
            .attr("id", "zoom-in")
            .text("Zoom In");

        divZoomDropdownContent
            .append("p")
            .attr("id", "zoom-out")
            .text("Zoom Out");

        //function to hide and show dropdown menu of zoom
        zoomButton.on("click", function () {
            document.getElementById("dropdown-zoom").classList.toggle("show");
        });

        const zoomFromButtons = d3.zoom().on("zoom", () => {
            subject.next(d3.event.transform);
        });

        //Zoom transformation when clicking on zoom buttons
        d3.select("#zoom-in").on("click", function () {
            zoomFromButtons.scaleBy(d3.select("#svg-container"), 1.2);
        });
        d3.select("#zoom-out").on("click", function () {
            zoomFromButtons.scaleBy(d3.select("#svg-container"), 0.8);
        });

        // This group will contain the left and right loaders that display a
        // spinner when new blocks are being added
        const gloader = svg.append("g").attr("id", "loader");

        // Handler to update the view (drag the view, zoom in-out). We subscribe to
        // the subject, which will notify us each time the view is dragged and
        // zoomed in-out by the user.
        subject.subscribe({
            next: (transform: any) => {
                var last = parseInt(d3.select(".mover").attr("x"));

                //TODO find the perfect threshhold
                //TODO modify width of mover according to transform.k 1370 before
                var svgWidth = parseInt(
                    d3.select("#svg-container").style("width")
                );
                var moverWidth = parseInt(d3.select(".mover").style("width"));

                if (last > svgWidth - moverWidth) {
                    d3.select(".mover").attr("x", svgWidth - moverWidth);
                } else if (last < moverWidth / 3) {
                    d3.select(".mover").attr("x", moverWidth / 3);
                } else {
                    var newX = last + this.lastTransform.x - transform.x;
                    if (newX > svgWidth - moverWidth) {
                        d3.select(".mover").attr("x", svgWidth - moverWidth);
                    } else if (newX < moverWidth / 3) {
                        d3.select(".mover").attr("x", moverWidth / 3);
                    } else {
                        d3.select(".mover").attr(
                            "x",
                            last + this.lastTransform.x - transform.x
                        );
                    }
                }

                var newWidth =
                    parseInt(d3.select(".mover").style("width")) * transform.k;

                if (newWidth >= 50 && newWidth <= svgWidth / 2) {
                    //d3.select(".mover").attr("width",newWidth);
                }

                this.lastTransform = transform;

                // This line disables translate to the left. (for reference)
                // transform.x = Math.min(0, transform.x);

                // Disable translation up/down
                transform.y = 0;

                // Update the scale
                const xScaleNew = transform.rescaleX(xScale);
                xAxis.scale(xScaleNew);
                xAxisDraw.call(xAxis);

                gloader.attr("transform", transform);
                // resize the loaders to always have a relative scale of 1
                gloader
                    .selectAll("svg")
                    .attr("transform", `scale(${1 / transform.k})`);

                // Horizontal transformation on the blocks only (sets Y scale to 1)
                const transformString =
                    "translate(" +
                    transform.x +
                    "," +
                    "0) scale(" +
                    transform.k +
                    "," +
                    "1" +
                    ")";

                var transformCircle =
                    "translate(" +
                    transform.x +
                    "," +
                    "32) scale(" +
                    transform.k +
                    "," +
                    transform.k +
                    ")";

                if (transform.k <= 0.99) {
                    transformCircle =
                        "translate(" +
                        transform.x +
                        "," +
                        "0) scale(" +
                        "0" +
                        "," +
                        "0" +
                        ")";
                }

                // The blocks, arrows, circles follow the transformations of the chain.
                this.gblocks.attr("transform", transformString);
                this.garrow.attr("transform", transformString);
                this.gcircle.attr("transform", transformCircle);
                this.blockies.attr("transform", transformCircle);
            },
        });
    }

    async init() {
        // Initialize the last added block of the chain in its dedicated space
        // It is initialized here as it takes longer to load.
        // We need to use it when creating new chunks

        this.lastAddedBlock = new LastAddedBlock(this.flash);

        await this.lastAddedBlock.init(
            this.roster,
            this.initialBlock,
            this.blockClickedSubject
        );

        // Subject that is notified about the transformation on the chain
        this.transformSubject.pipe(debounceTime(50)).subscribe({
            next: (transform: any) => {
                this.transformHandler(transform);
            },
        });
    }

    transformHandler(transform: any) {
        const bounds = Utils.transformToIndexes(
            transform,
            Chain.blockWidth + Chain.blockPadding,
            Chain.svgWidth
        );

        let alreadyHandled = false;

        // The adjacent neighbors to the current Chunk
        let leftNei: Chunk;
        let rightNei: Chunk;

        // The adjacent neighbors indexes to the current Chunk
        let leftNeiIndex = 0;
        let rightNeiIndex = 0;

        for (let i = 0; i < this.chunks.length; i++) {
            const chunk = this.chunks[i];

            // the chunk is "fully inside"
            // ---[--***--]---
            if (chunk.left >= bounds.left && chunk.right <= bounds.right) {
                alreadyHandled = true;
                break;
            }

            // the chunk is "partially inside, from the left"
            // --*[**----]---
            if (chunk.left < bounds.left && chunk.right > bounds.left) {
                alreadyHandled = true;
                break;
            }

            // the chunk is "partially inside, from the right"
            // ---[----**]*--
            if (chunk.left < bounds.right && chunk.right > bounds.right) {
                alreadyHandled = true;
                break;
            }

            // the chuck is "overly inside"
            // ---*[***]*---
            if (chunk.left < bounds.left && chunk.right > bounds.right) {
                alreadyHandled = true;
                break;
            }

            // --**-[---]-----
            if (chunk.right < bounds.left) {
                if (leftNei === undefined || chunk.right > leftNei.right) {
                    leftNei = chunk;
                    leftNeiIndex = i;
                }
            }

            // -----[---]-**--
            if (chunk.left > bounds.right) {
                if (rightNei === undefined || chunk.left < rightNei.left) {
                    rightNei = chunk;
                    rightNeiIndex = i;
                }
            }
        }

        if (!alreadyHandled) {
            // A new Chunk is created,

            if (
                bounds.left + (bounds.right - bounds.left) / 2 >
                this.lastAddedBlock.lastBlock.index
            ) {
                bounds.right = this.lastAddedBlock.lastBlock.index;
            } else {
                bounds.left = bounds.left + (bounds.right - bounds.left) / 2;
                bounds.right =
                    bounds.left + (bounds.right - bounds.left) / 2 + 20;
            }

            const c = new Chunk(
                this.roster,
                this.flash,
                leftNei,
                rightNei,
                bounds,
                this.initialBlock,
                this.lastAddedBlock,
                this.transformSubject,
                this.getNewBlocksSubject,
                this.blockClickedSubject
            );

            if (leftNei !== undefined) {
                leftNei.rightNeighbor = c;
            }

            if (rightNei !== undefined) {
                rightNei.leftNeighbor = c;
            }

            // Keep the chunks sorted.
            this.chunks.splice(leftNeiIndex + 1, 0, c);
        }
    }
}
