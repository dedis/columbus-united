import * as d3 from "d3";
import * as rx from "rxjs";

/**
 * Create flash alerte using flashType, displayed at the top of the page
 * @author Julien von Felten <julien.vonfelten@epfl.ch>
 * @export
 * @class Flash
 */
export class Flash {
    private static closeAlert(div: HTMLElement) {
        div.style.opacity = "0";
        setTimeout(() => {
            div.style.display = "none";
        }, 200);

    }
    containerFlash: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
    flashType: Flash.flashType;
    span: d3.Selection<HTMLSpanElement, unknown, HTMLElement, any>;
    /**
     * Creates an instance of Flash, setting the container
     * @memberof Flash
     */
    constructor() {
        this.containerFlash = d3
            .select("body")
            .append("div")
            .attr("class", "alert-container");
    }

    /**
     * Public function to display the flash with the errorCode and the text
     *
     * @param {Flash.flashType} errorCode: The error code corresponding to the flashType
     * @param {string} text The text to display
     * @memberof Flash
     */
    display(errorCode: Flash.flashType, text: string) {
        let divAlert;

        switch (errorCode) {
            case Flash.flashType.ERROR:
                divAlert = this.containerFlash
                    .append("div")
                    .attr("class", "alert");
                this.span = divAlert
                    .append("span")
                    .attr("class", "close-btn")
                    .text(`\u2715`);
                divAlert.append("text").text(`Error: ${text}`);
                break;

            case Flash.flashType.WARNING:
                divAlert = this.containerFlash
                    .append("div")
                    .attr("class", "alert warning");
                this.span = divAlert
                    .append("span")
                    .attr("class", "close-btn")
                    .text(`\u2715`);
                divAlert.append("text").text(`Warning: ${text}`);
                break;

            case Flash.flashType.INFO:
                divAlert = this.containerFlash
                    .append("div")
                    .attr("class", "alert info");
                this.span = divAlert
                    .append("span")
                    .attr("class", "close-btn")
                    .text(`\u2715`);
                divAlert.append("text").text(`Info: ${text}`);
                break;

            case Flash.flashType.OTHER:
            default:
                divAlert = this.containerFlash
                    .append("div")
                    .attr("class", "alert other");
                this.span = divAlert
                    .append("span")
                    .attr("class", "close-btn")
                    .text(`\u2715`);
                divAlert
                    .append("text")
                    .text(`Other error not handled: ${text}`);
                break;
        }
        const timer = rx.timer(2000);

        timer.subscribe(()=>{
            this;
            Flash.closeAlert(this.span.node().parentElement);
            });

        // on click to remove the flash
        // tslint:disable-next-line
        this.span.on("click", function () {
            this;
            Flash.closeAlert(this.parentElement);
        });
    }

} // tslint:disable-next-line

/**
 * enumeration to express the different flash types
 */
// tslint:disable-next-line
export namespace Flash {
    export enum flashType {
        ERROR,
        WARNING,
        INFO,
        OTHER,
    }
}
