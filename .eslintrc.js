module.exports = {
    root: true,
    extends: [
        'standard'
    ],
    parserOptions: {
        sourceType: 'script',
    },
    env: {
        'browser': true,
        'node': true,
    },
    // add your custom rules here
    'rules': {
        'camelcase': 0,
        'comma-dangle': 0,
        'indent': ['error', 4],
        'new-cap': 0,
        'operator-linebreak': ['error', 'after'],
        'semi': ['error', 'always'],
        'space-before-function-paren': ['error', 'never'],
        'standard/no-callback-literal': 0,

        // TODO: Use let/const
        'prefer-const': 0,
        'no-var': 0,
    }
};
