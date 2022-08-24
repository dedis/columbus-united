# columbus-united

<div align="center">
    <img src="assets/logo-color-small.png">
</div>

<div align="center">
  <a href="https://github.com/c4dt/columbus-united/actions?query=workflow%3A%22Wookiee+deployment%22">
    <img src="https://github.com/c4dt/columbus-united/workflows/Wookiee%20deployment/badge.svg?branch=production">
  </a>
  <a href="https://github.com/c4dt/columbus-united/actions?query=workflow%3A%22Wookiee+DEV+deployment%22">
    <img src="https://github.com/c4dt/columbus-united/workflows/Wookiee%20DEV%20deployment/badge.svg">
  </a>
  <br/>
  <a href="https://github.com/c4dt/columbus-united/actions?query=workflow%3APrettier">
    <img src="https://github.com/c4dt/columbus-united/workflows/Prettier/badge.svg">
  </a>
  <a href="https://github.com/c4dt/columbus-united/actions?query=workflow%3A%22Quality+checking">
    <img src="https://github.com/c4dt/columbus-united/workflows/Quality%20checking/badge.svg">
  </a>
</div>

Implementation of an intuitive and insightful blockchain explorer. The Columbus
project is a project aiming to facilitate the visualization of the
[Byzcoin](https://github.com/dedis/cothority/tree/master/byzcoin) blockchain by
providing a unified and interactive visualization tool.

This tool is a web based application written in typescript, bundled with
webpack, and using the d3 and rxjs librairies.

👌 **Quick TL;DR setup**:

1) Rename `src/roster.ts.template` to `src/roster.ts`
2) Install dependencies with `npm install`
3) Bundle the app with `npm run bundle`
4) You are ready to go, open `index.html`

[Play with it](https://wookiee.ch/columbus/)

# Features

## "Browsable" chain

Browse the chain with your mouse with drag and zoom. Blocks will naturally load.
Actions are also accessible through buttons.

<div align="center">
    <img src="docs/assets/feature1.gif">
</div>

## Explore block

Click on blocks to check their content. Many element display additional hints.

<div align="center">
    <img src="docs/assets/feature2.gif">
</div>

## Follow evolution of an instance

Check the evolution of a smart contract instance. You can get blocks and
instruction related to a particular instance.

<div align="center">
    <img src="docs/assets/feature3.gif">
</div>

## Perform search

Use the top search bar to retrieve a particular block. You can select among many
different search attribute.

<div align="center">
    <img src="docs/assets/feature4.gif">
</div>

## ... and many more

Additional features include:

- Block export to json
- Tutorial to introduce functionalities to new users
- Upload of a custom roster
- Statistics and status about the chain
- Ability to follow block links

# Stack

- Typescript, as the frontend language
- NPM, as the package manager
- Webpack, as the bundler
- d3, as the visualization library
- RxJS, as the reactive programming library
- UIkit, as the CSS framework

# Setup (ubuntu)

<details>
  <summary>See details</summary>

Install nodejs and npm:

```bash
sudo apt-get install nodejs
sudo apt-get install npm
```

Rename `src/roster.ts.template` to `src/roster.ts`. By default it uses the DEDIS
roster.

Otherwise, follow instructions in the next section to run a local conode and get
a local roster configuration.

Finally, install dependencies with `npm install`.  

You are ready to use the app: bundle it with `npm run bundle` and open
`index.html`.

## If you need to run a local blockchain

If you are developing on Columbus you will need to use a local blockchain in
order to avoid over-loading a node running the production blockchain.

Download and extract the latest binaries from
https://github.com/c4dt/byzcoin/releases. Choose the folder corresponding to
your environment (only Mac and Linux is supported) and run the `byzcoin` binary
in "proxy" mode. You need to provide an existing database. You can download a
cached database reflecting the production data at
[https://demo.c4dt.org/omniledger/cached.db](https://demo.c4dt.org/omniledger/cached.db).

Then, run the node in "proxy" mode with :

```
./byzcoin proxy <MY_DATABASE.db>
```

That's it ! This will run a node listening on 127.0.0.1:7771.

You can stop it with <kbd>ctrl</kbd> + <kbd>C</kbd>.

There are additional options that you can spot with `./byzcoin proxy -h`.

You can then use the following roster in your `roster.ts`:

```
[[servers]]
  Url = "http://127.0.0.1:7771"
  Suite = "Ed25519"
  Public = "0000000000000000000000000000000000000000000000000000000000000000"
```

</details>

# Some useful commands

Bundle the project (from the root): `npm run bundle`  
Watch for source code changes and automatically bundle: `npm run watch`  
Check TypeScript code formatting: `npm run lint`  
Check if the code is well formatted: `npm run isPretty`  
Format the code: `npm run makePretty`  

# Recommendations for Visual Studio Code

<details>
  <summary>See details</summary>

## Settings

Add vertical lines at columns 80 and 100: `editor.rulers` -> `Edit in settings.json` -> `"editor.rulers": [80,100]`  

## Extensions

### Live Server

Purpose: Automatically refresh the html upon compile  
Install: `ritwickdey.liveserver`  
Use:

* Right click on `index.html`
* `Open with Live Server`

### Prettier - Code formatter

Purpose: Automatically format the code  
Install: `esbenp.prettier-vscode`  
Setup: setting `editor.defaultFormatter` -> select `esbenp.prettier-vscode`  
Use:

* Open Command Palette (`Ctrl+Shift+P`)
* `Format Document`

### TypeScript Hero

Purpose: Automatically organize TypeScript imports  
Install: `rbbit.typescript-hero`  
Use:

* Open Command Palette (`Ctrl+Shift+P`)
* `TS Hero: Organize imports`

### Rewrap

Purpose: Automatically reformat comments to a given line length (default is 80)  
Install: `stkb.rewrap`  
Use:

* Open Command Palette (`Ctrl+Shift+P`)
* `Rewrap Comment / Text`

### Comment Anchor
Purpose: Place anchor tags within comments for easy file & workspace navigation.
Install: `ext install ExodiusStudios.comment-anchors`
Use:

* Use \\\\ANCHOR and \\\\SECTION to delimitate code regions
* Use \\\\TODO, \\\\FIXME to mark specific areas
* Read the documentation for more features

</details>

# Production deployment

A change on the `production` branch automatically triggers a deployment on
[https://status.dedis.ch](https://status.dedis.ch).

The production branch must only be used that way:

```bash
# Trigger a deployment:
git push origin master:production
```

# Dev deployment

A change on the `deploy-dev` branch automatically triggers a deployment on
[https://wookiee.ch/columbus-dev](https://wookiee.ch/columbus-dev).

The `deploy-dev` branch must only be used that way:

```bash
# Trigger a deployment:
git push origin <source branch>:deploy-dev
```

# Documentation

Generate the documentation: `npm run doc`

# Design Guidelines
Can be found in the most recent report  

# Contributors

Supervision and integration

- Noémien Kocher

Student project Spring 2020:

- Anthony Iozzia ([report](https://www.epfl.ch/labs/dedis/wp-content/uploads/2020/06/report-2020-1-Anthony-Iozzia-Columbus-II.pdf))
- Julien von Felten ([report](https://www.epfl.ch/labs/dedis/wp-content/uploads/2020/06/report-2020-1-Julien-von-Felten-Columbus-I.pdf))

Student project Fall 2020:

- Sophia Artioli 
- Lucas Trognon

[Common report](https://www.epfl.ch/labs/dedis/wp-content/uploads/2021/01/report-2020-3-Columbus-Sophia-Artiolis-Lucas-Trognon-Columbus-III.pdf)

Student project Spring 2021:

- Rosa Jose Sara
- Pilar Marxer

[Common report](https://www.epfl.ch/labs/dedis/wp-content/uploads/2021/07/report-2021-1-Pilar-Rosa_Columbus_IV.pdf)
