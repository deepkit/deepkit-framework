#! /usr/bin/env node
const { build } = require("esbuild");

build({
    entryPoints: [__dirname + '/src/base.test.cjs'],
    outdir: __dirname,
    bundle: true,
    format: 'iife',
});
