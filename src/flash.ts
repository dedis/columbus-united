import * as d3 from "d3";
/**
 * Create flash alerte using flashType, displayed at the top of the page
 * @author Julien von Felten <julien.vonfelten@epfl.ch>
 * @export
 * @class Flash
 */
export class Flash {
  containerFlash: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  flashType: Flash.flashType;

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
    let span;
    let divAlert;
    switch (errorCode) {
      case Flash.flashType.ERROR:
        divAlert = this.containerFlash.append("div").attr("class", "alert");
        span = divAlert
          .append("span")
          .attr("class", "close-btn")
          .text(`\u2715`);
        divAlert.append("text").text(`Error: ${text}`);
        break;

      case Flash.flashType.WARNING:
        divAlert = this.containerFlash
          .append("div")
          .attr("class", "alert warning");
        span = divAlert
          .append("span")
          .attr("class", "close-btn")
          .text(`\u2715`);
        divAlert.append("text").text(`Warning: ${text}`);
        break;

      case Flash.flashType.INFO:
        divAlert = this.containerFlash
          .append("div")
          .attr("class", "alert info");
        span = divAlert
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
        span = divAlert
          .append("span")
          .attr("class", "close-btn")
          .text(`\u2715`);
        divAlert.append("text").text(`Other error not handled: ${text}`);
        break;
    }
    // on click to remove the flash
    span.on("click", function () {
      const div = this.parentElement;
      div.style.opacity = "0";
      // tslint:disable-next-line
      setTimeout(function () {
        div.style.display = "none";
      }, 200);
    });
  }
}

/**
 * enumeration to express the different flash types
 */
export namespace Flash {
  export enum flashType {
    ERROR,
    WARNING,
    INFO,
    OTHER,
  }
}
