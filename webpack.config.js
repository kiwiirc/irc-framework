// webpack v4
const path = require('path');
const CompressionPlugin = require('compression-webpack-plugin');
const BrotliPlugin = require('brotli-webpack-plugin');

const shouldCompress = /\.(js|css|html|svg)(\.map)?$/

module.exports = {
  mode: 'production',
  entry: './dist/browser/src',
  output: {
    path: path.join(path.resolve(__dirname), 'dist', 'browser', 'static'),
    filename: 'browser.js',
    library: 'irc-framework',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    rules: [ ]
  },
  plugins: [
    new CompressionPlugin({
      test: shouldCompress,
    }),
    new BrotliPlugin({
      asset: '[path].br[query]',
      test: shouldCompress,
      threshold: 10240,
      minRatio: 0.8,
      deleteOriginalAssets: false,
    }),
  ],
  optimization: {
    minimize: true
  },
  devtool: 'source-map',
  performance: {
    assetFilter: assetFilename =>
      !assetFilename.match(/\.map(\.(gz|br))?$/),
  },
};
