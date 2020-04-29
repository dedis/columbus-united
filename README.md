# student_20_columbus_react
Implementation of an intuitive and insightful blockchain explorer - by Julien von Felten and Iozzia Anthony Lucien

## Setup
### Ubuntu
Download `conode-v<x.y.z>.tar.gz` from https://github.com/dedis/cothority/releases  
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
```
export function getRosterStr() {
    return `<content>`;
}
```
Replace `<content>` with previously copied content  
In root of this project: `npm install`  

## Run
### Ubuntu
Start server in conode folder: `./conode.Linux.x86_64 server` (to view debug messages: `./conode.Linux.x86_64 -d 2 server`)  

Compile in root of this project: `npm run bundle` (for automatic compilation upon changes: `npm run watch`)  
