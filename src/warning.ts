import * as d3 from "d3";

export class Warning {
    containerWarnings: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;

  constructor() {
      this.containerWarnings = d3.select("body").append("div").attr("class", "alertContainer")
  }

  public displaying(typeError: number, text: string) {
    //display the block and the error with colors
    let span = undefined;
    if (typeError === 1) {
      let divAlert = this.containerWarnings.append("div").attr("class", "alert");
      span = divAlert.append("span").attr("class", "closebtn").text(`x`);
      divAlert.append("text").text(`Error: ${text}`);
    } else if (typeError === 2) {
      let divAlert = this.containerWarnings.append("div").attr("class", "alert warning");
      span = divAlert.append("span").attr("class", "closebtn").text(`x`);
      divAlert.append("text").text(`Warning: ${text}`);
    } else if (typeError === 3) {
      let divAlert = this.containerWarnings.append("div").attr("class", "alert info");
      span = divAlert.append("span").attr("class", "closebtn").text(`x`);
      divAlert.append("text").text(`Info: ${text}`);
    } else {
      let divAlert = this.containerWarnings.append("div").attr("class", "alert other");
      span = divAlert.append("span").attr("class", "closebtn").text(`x`);
      divAlert.append("text").text(`Other error not handled: ${text}`);
    }

      span.on("click", function () {
        let div = this.parentElement;
        div.style.opacity = "0";
        setTimeout(function () {
          div.style.display = "none";
        }, 200);
      });
    
  }
}
