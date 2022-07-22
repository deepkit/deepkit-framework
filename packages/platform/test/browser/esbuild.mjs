#! /usr/bin/env node
import { build } from "esbuild";
import { getDirname } from "../../dist/esm/index.mjs";
const crossDirname = getDirname();

await build({
    entryPoints: [crossDirname + '/src/base.test.mjs'],
    outdir: crossDirname,
    bundle: true,
    target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
    format: 'iife',
});
