const path = require("path");
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')

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
    plugins: [
        new NodePolyfillPlugin()
    ],
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
            {
                test: /\.s[ac]ss$/i,
                use: [
                    // Creates `style` nodes from JS strings
                    'style-loader',
                    // Translates CSS into CommonJS
                    'css-loader',
                    // Compiles Sass to CSS
                    'sass-loader',
                ],
            },
        ],
    },
    resolve: {
        extensions: [".js", ".ts"],
        modules: ['node_modules'],
        fallback: {
            path: require.resolve('path-browserify'),
            stream: require.resolve('stream-browserify'),
            'crypto-browserify': require.resolve('crypto-browserify'),
            fs: false,
            tls: false,
            net: false,
            zlib: false,
            http: false,
            https: false,
            crypto: false
        }
    },
};