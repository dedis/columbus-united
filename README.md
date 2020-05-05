# columbus-united

Implementation of an intuitive and insightful blockchain explorer - by Julien von Felten and Iozzia Anthony Lucien

## Ubuntu

### Setup

Install nodejs and npm:

```bash
sudo apt-get install nodejs
sudo apt-get install npm
```

Download `conode-v<x.y.z>.tar.gz` [here](https://github.com/dedis/cothority/releases)  
Extract it  
Execute `./conode.Linux.x86_64 setup` in this folder  
When prompted, enter the address `127.0.0.1:7770`  
Finish setup with your preferences  
Start server: `./conode.Linux.x86_64 server`  
Stop it (ctrl+C)  
Replace database in `~/.local/share/conode` (must be same name)  
View content of `public.toml`: `cat ~/.config/conode/public.toml`  
Copy it  
Create a file `src/roster.ts` containing:

```ts
export function getRosterStr() {
    return `<content>`;
}
```

Replace `<content>` with previously copied content  
In root of this project: `npm install`  

### Run

Start server in conode folder: `./conode.Linux.x86_64 server`  
To view debug messages: `./conode.Linux.x86_64 -d 2 server`  
Compile in root of this project: `npm run bundle`  
For automatic compilation upon changes: `npm run watch`  
Check TypeScript code formatting: `npm run lint`  

## Recommendations for Visual Studio Code

### Settings

Add vertical lines at columns 80 and 100: `editor.rulers` -> `Edit in settings.json` -> `"editor.rulers": [80,100]`  

### Extensions

#### Live Server

Purpose: Automatically refresh the html upon compile  
Install: `ritwickdey.liveserver`  
Use:

* Right click on `index.html`
* `Open with Live Server`

#### Prettier - Code formatter

Purpose: Automatically format the code  
Install: `esbenp.prettier-vscode`  
Setup: setting `editor.defaultFormatter` -> select `esbenp.prettier-vscode`  
Use:

* Open Command Palette (`Ctrl+Shift+P`)
* `Format Document`

#### TypeScript Hero

Purpose: Automatically organize TypeScript imports  
Install: `rbbit.typescript-hero`  
Use:

* Open Command Palette (`Ctrl+Shift+P`)
* `TS Hero: Organize imports`

#### Rewrap

Purpose: Automatically reformat comments to a given line length (default is 80)  
Install: `stkb.rewrap`  
Use:

* Open Command Palette (`Ctrl+Shift+P`)
* `Rewrap Comment / Text`
