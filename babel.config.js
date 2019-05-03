module.exports = {
  presets: [
    ['@babel/preset-env', {
      forceAllTransforms: true,
      useBuiltIns: 'usage',
      corejs: 3,
    }],
  ],
}
