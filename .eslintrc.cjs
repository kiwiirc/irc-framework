// @ts-check
/* eslint-env es6 */

const { defineConfig } = require('eslint-define-config');

const baseRules = defineConfig({
    rules: {
        camelcase: 0,
        'comma-dangle': 0,
        indent: ['error', 4],
        'new-cap': 0,
        'no-shadow': ['error'],
        'no-var': ['error'],
        'operator-linebreak': ['error', 'after'],
        semi: ['error', 'always'],
        'space-before-function-paren': ['error', 'never'],
        'standard/no-callback-literal': 0,
        'node/no-callback-literal': 0,
    },
}).rules;

module.exports = defineConfig({
    root: true,
    parserOptions: {
        sourceType: 'script',
    },
    extends: ['eslint:recommended', 'standard'],
    env: {
        browser: true,
        node: true,
    },
    rules: {
        ...baseRules,
    },
    overrides: [
        {
            files: ['**/*.ts'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                tsconfigRootDir: __dirname,
                project: [
                    './tsconfig.json',
                    './examples/tsconfig.json',
                    './src/tsconfig.json',
                    './test/tsconfig.json',
                ],
            },
            plugins: ['@typescript-eslint'],
            extends: [
                'eslint:recommended',
                'plugin:@typescript-eslint/recommended',
                'plugin:@typescript-eslint/recommended-requiring-type-checking',
                'standard',
            ],
            rules: {
                ...baseRules,
            },
        },
    ],
});
