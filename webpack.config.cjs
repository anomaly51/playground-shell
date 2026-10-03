const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("node:path");
const webpack = require("webpack");
const { merge } = require("webpack-merge");
const singleSpaDefaults = require("webpack-config-single-spa-ts");

module.exports = (webpackConfigEnv = {}, argv = {}) => {
  const isLocal = Boolean(webpackConfigEnv.isLocal);
  const defaultConfig = singleSpaDefaults({
    orgName: "lab",
    projectName: "root-config",
    webpackConfigEnv,
    argv,
    outputSystemJS: true,
    disableHtmlGeneration: true,
  });

  return merge(defaultConfig, {
    devServer: {
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: "all",
      historyApiFallback: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
    module: {
      rules: [
        {
          test: /\.html$/i,
          loader: "html-loader",
          options: {
            minimize: false,
          },
        },
      ],
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: require.resolve("systemjs/dist/system.min.js"),
            to: "vendor/system.min.js",
          },
          {
            from: require.resolve("systemjs/dist/extras/amd.min.js"),
            to: "vendor/amd.min.js",
          },
          {
            from: require.resolve("single-spa/lib/es2015/system/single-spa.min.js"),
            to: "vendor/single-spa.min.js",
          },
          {
            from: require.resolve("bootstrap/dist/css/bootstrap.min.css"),
            to: "vendor/bootstrap.min.css",
          },
          ...["react.development.js", "react.production.min.js"].map((file) => ({
            from: path.join(path.dirname(require.resolve("react/package.json")), "umd", file),
            to: `vendor/${file}`,
          })),
          ...["react-dom.development.js", "react-dom.production.min.js"].map((file) => ({
            from: path.join(path.dirname(require.resolve("react-dom/package.json")), "umd", file),
            to: `vendor/${file}`,
          })),
        ],
      }),
      new webpack.DefinePlugin({
        __ENABLE_TOOL_LINKS__: process.env.VITE_ENABLE_TOOL_LINKS !== "false",
        __API_BASE_URL__: JSON.stringify(
          process.env.VITE_API_BASE_URL || "http://localhost:3000",
        ),
        __EVENTS_BASE_URL__: JSON.stringify(
          process.env.VITE_EVENTS_BASE_URL || "http://localhost:3003",
        ),
      }),
      new HtmlWebpackPlugin({
        inject: false,
        template: "src/index.ejs",
        templateParameters: {
          isLocal,
          rootConfigUrl:
            process.env.VITE_ROOT_CONFIG_URL ||
            (isLocal
              ? "//localhost:5173/lab-root-config.js"
              : "/lab-root-config.js"),
          topologyUrl:
            process.env.VITE_TOPOLOGY_MFE_URL ||
            (isLocal
              ? "//localhost:5174/lab-topology-mfe.js"
              : "/mfe/topology/lab-topology-mfe.js"),
          trafficUrl:
            process.env.VITE_TRAFFIC_MFE_URL ||
            (isLocal
              ? "//localhost:5175/lab-traffic-mfe.js"
              : "/mfe/traffic/lab-traffic-mfe.js"),
        },
      }),
    ],
  });
};
