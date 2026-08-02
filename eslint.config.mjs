import globals from 'globals';
import eslintJS from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';

export default [
    eslintJS.configs.recommended,
    stylistic.configs.recommended,
    {
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.browser,
                ...globals.node,
            }
        },
        rules: {
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
            'strict': ['error', 'safe'],

            // stylistic rules
            '@stylistic/arrow-parens': 0,
            '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
            '@stylistic/comma-dangle': 0,
            '@stylistic/generator-star-spacing': ['error', { before: true, after: true }],
            '@stylistic/indent': ['error', 4, { SwitchCase: 0 }],
            '@stylistic/indent-binary-ops': ['error', 4],
            '@stylistic/max-statements-per-line': 0,
            '@stylistic/no-multi-spaces': ['error', { ignoreEOLComments: true }],
            '@stylistic/operator-linebreak': ['error', 'after'],
            '@stylistic/quote-props': ['error', 'consistent-as-needed'],
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/space-before-function-paren': ['error', {
                anonymous: 'never',
                named: 'never',
                asyncArrow: 'always',
                catch: 'always'
            }],
            '@stylistic/spaced-comment': 0,
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
