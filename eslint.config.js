'use strict';

const globals = require('globals');
const eslintJS = require('@eslint/js');

module.exports = [
    eslintJS.configs.recommended,
    {
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.browser,
                ...globals.node,
            }
        },
        rules: {
            'indent': ['error', 4],
            'no-shadow': ['error'],
            'no-var': ['error'],
            'no-unused-vars': ['error', {
                vars: 'all',
                args: 'none',
                caughtErrors: 'none',
                ignoreRestSiblings: false,
                ignoreUsingDeclarations: false,
                reportUsedIgnorePattern: false,
            }],
            'operator-linebreak': ['error', 'after'],
            'quote-props': ['error', 'consistent-as-needed'],
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],
            'space-before-function-paren': ['error', 'never'],
            'strict': ['error', 'safe']
        },
    },
    {
        files: ['test/**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                afterEach: 'readonly',
                beforeEach: 'readonly',
                describe: 'readonly',
                it: 'readonly',
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
    {
        files: ['examples/**/*.js'],
        rules: {
            strict: 0,
        },
    },
];
