// webpack v4
const path = require('path');

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
  plugins: [ ],
  optimization: {
    minimize: true
  },
  devtool: 'source-map',
};
