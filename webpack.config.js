const path = require("path");

module.exports = {
    entry: ["@babel/polyfill", "./src/index.ts"],
    devtool: 'inline-source-map',
    mode: 'development',
    output: {
        filename: "bundle.min.js",
        path: path.resolve(__dirname, "dist"),
        library: "jsapp",
        libraryTarget: "umd",
        globalObject: "this",
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                include: [
                    // Because of the way the cothority librairy is released we
                    // must include the cothority source in order to proprely 
                    // transpile it.
                    /node_modules\/@dedis\/cothority/,
                    /.\/src/
                ],
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"],
                    },
                },
            },
            {
                test: /\.ts$/,
                include: [
                    /node_modules\/@dedis\/cothority/,
                    /.\/src/
                ],
                use: [
                    {
                        loader: "babel-loader",
                        options: {
                            presets: ["@babel/preset-env"],
                        },
                    },
                    "ts-loader",
                ],
            },
        ],
    },
    resolve: {
        extensions: [".js", ".ts"],
    },
};