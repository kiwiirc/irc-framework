// webpack v4
const path = require('path');

module.exports = {
  mode: 'production',
  entry: { main: './index_browser.js' },
  output: {
    path: path.resolve(__dirname),
    filename: 'browser.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: "babel-loader",
        }
      },
    ]
  },
  plugins: [ ],
  optimization: {
    minimize: true
  }
};