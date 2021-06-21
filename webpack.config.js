// webpack v4
const path = require('path');
const CompressionPlugin = require('compression-webpack-plugin');

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
  resolve: {
    fallback: {
      'stream': require.resolve('stream-browserify'),
      'buffer': require.resolve('buffer/'),
      'util': require.resolve('util/'),
    },
  },
  plugins: [
    new CompressionPlugin({
      filename: "[path][base].gz",
      algorithm: "gzip",
      test: shouldCompress,
    }),
    new CompressionPlugin({
      filename: "[path][base].br",
      algorithm: 'brotliCompress',
      test: shouldCompress,
    }),
  ],
  optimization: {
    minimize: true
  },
  devtool: 'source-map',
  performance: {
    maxEntrypointSize: 307200,
    maxAssetSize: 307200,
    assetFilter: assetFilename =>
      !assetFilename.match(/\.map(\.(gz|br))?$/),
  },
};
