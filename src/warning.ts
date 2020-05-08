

export class Warning{
    constructor(){ 
    }

    public displaying(typeError:number, text:string){
        //display the block and the error with colors
        if(typeError === 1){
            console.log("Display1: "+typeError+" "+text)

        }else if(typeError === 2){
            console.log("Display2: "+typeError+" "+text)

        }else if(typeError === 3){
            console.log("Display3: "+typeError+" "+text)

        }else{
            console.log("Display4: "+typeError+" "+text)

        }
    }
}