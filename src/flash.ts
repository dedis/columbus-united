import * as d3 from "d3";

export class Flash {
  containerFlash: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  flashType: Flash.flashType;
  constructor() {
    this.containerFlash = d3
      .select("body")
      .append("div")
      .attr("class", "alertContainer");
  }
  // TODO: adapt the class using uikit for the flash using the alert
  display(errorCode: Flash.flashType, text: string) {
    // display the block and the error with colors
    let span;
    if (errorCode === Flash.flashType.ERROR) {
      const divAlert = this.containerFlash.append("div").attr("class", "alert");
      span = divAlert.append("span").attr("class", "closebtn").text(`x`);
      divAlert.append("text").text(`Error: ${text}`);
    } else if (errorCode === Flash.flashType.WARNING) {
      const divAlert = this.containerFlash
        .append("div")
        .attr("class", "alert warning");
      span = divAlert.append("span").attr("class", "closebtn").text(`x`);
      divAlert.append("text").text(`Warning: ${text}`);
    } else if (errorCode === Flash.flashType.INFO) {
      const divAlert = this.containerFlash
        .append("div")
        .attr("class", "alert info");
      span = divAlert.append("span").attr("class", "closebtn").text(`x`);
      divAlert.append("text").text(`Info: ${text}`);
    } else {
      const divAlert = this.containerFlash
        .append("div")
        .attr("class", "alert other");
      span = divAlert.append("span").attr("class", "closebtn").text(`x`);
      divAlert.append("text").text(`Other error not handled: ${text}`);
    } // tslint:disable-next-line
    span.on("click", function () {
      const div = this.parentElement;
      div.style.opacity = "0";
      // tslint:disable-next-line
      setTimeout(function () {
        div.style.display = "none";
      }, 200);
    });
  }
} // tslint:disable-next-line
export namespace Flash {
  export enum flashType {
    ERROR,
    WARNING,
    INFO,
    OTHER,
  }
}
