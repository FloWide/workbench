const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");
const path = require("path");

module.exports = {
  module: {
    rules: [
      { test: /\.(d\.ts)$/, loader: "raw-loader" },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
        include: [
          path.resolve(__dirname, "./node_modules/monaco-editor"),
          path.resolve(__dirname, "./node_modules/vscode"),
        ],
      },
      {
        test: /\.(mp3|wasm|ttf)$/i,
        type: "asset/resource",
      },
    ],
    // this fixes the ttf url loading issue
    parser: {
      javascript: {
        url: true,
      },
    },
  },
  resolve: {
    alias: {
      vscode: require.resolve("monaco-languageclient/vscode-compatibility"),
    },
    fallback: {
      path: false,
    },
  },
  plugins: [
    new MonacoWebpackPlugin({
      customLanguages: [
        {
          label: "yaml",
          entry: "monaco-yaml",
          worker: {
            id: "monaco-yaml/yamlWorker",
            entry: "monaco-yaml/yaml.worker",
          },
        }
      ],
    }),
  ],
};
