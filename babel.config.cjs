// @ts-check
/* eslint-env es6 */

module.exports = {
    presets: [
        [
            '@babel/preset-env',
            {
                forceAllTransforms: true,
                useBuiltIns: 'usage',
                corejs: 3,
            },
        ],
        '@babel/preset-typescript',
    ],
};
