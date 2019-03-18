module.exports = {
    "mode": "modules",
    "out": "docs",
    exclude: [
        '**/node_modules/**',
        '**/*.spec.ts',
        '**/tests/**/*.ts',
    ],
    lernaExclude: ['@marcj/benchmark'],
    name: 'marshal.ts',
    excludePrivate: true,
    skipInternal: true,
};
