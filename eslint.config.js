const globals = require('globals');

const eslintJS = require('@eslint/js');
const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
    baseDirectory: __dirname
});

module.exports = [
    eslintJS.configs.recommended,
    ...compat.extends('eslint-config-standard'),
    {
        languageOptions: {
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.node,
            }
        },
        rules: {
            'camelcase': 0,
            'comma-dangle': 0,
            'indent': ['error', 4],
            'new-cap': 0,
            'no-shadow': ['error'],
            'no-var': ['error'],
            'object-shorthand': ['warn', 'consistent'],
            'operator-linebreak': ['error', 'after'],
            'quote-props': ['error', 'consistent-as-needed'],
            'semi': ['error', 'always'],
            'space-before-function-paren': ['error', 'never'],
        },
    },
    {
        files: ['test/**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                it: 'readonly',
                describe: 'readonly',
            },
        },
        rules: {
            'no-unused-expressions': 0,
            'comma-dangle': ['error', {
                arrays: 'always-multiline',
                objects: 'always-multiline',
                imports: 'never',
                exports: 'never',
                functions: 'ignore',
            }],
        },
    },
];
