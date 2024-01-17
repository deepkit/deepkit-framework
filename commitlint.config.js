const {
    utils: { getPackages },
} = require('@commitlint/config-lerna-scopes');

const customScopes = ['deps'];

module.exports = {
    extends: ['@commitlint/config-conventional', '@commitlint/config-lerna-scopes'],
    ignores: [
        message =>
            message.startsWith('Merge') ||
            message.startsWith('Revert'),
    ],
    rules: {
        'header-max-length': [0, 'always', 125],
        'footer-max-line-length': [0, 'always', Infinity],
        'body-max-line-length': [0, 'always', Infinity],
        'scope-enum': async ctx => [
            2,
            'always',
            [...customScopes, ...(await getPackages(ctx))],
        ],
    },
};
