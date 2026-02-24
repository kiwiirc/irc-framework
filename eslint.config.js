module.exports = {
    root: true,
    extends: [
        'eslint:recommended',
        'standard'
    ],
    parserOptions: {
        sourceType: 'script',
    },
    env: {
        'browser': true,
        'node': true,
    },
    'rules': {
        'camelcase': 0,
        'comma-dangle': 0,
        'indent': ['error', 4],
        'new-cap': 0,
        'no-shadow': ['error'],
        'no-var': ['error'],
        'operator-linebreak': ['error', 'after'],
        'semi': ['error', 'always'],
        'space-before-function-paren': ['error', 'never'],
        'standard/no-callback-literal': 0,
        'n/no-callback-literal': 0,
        "object-shorthand": 0,
    }
};
