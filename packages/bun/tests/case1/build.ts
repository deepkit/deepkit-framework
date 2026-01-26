import { deepkitType } from '../../dist/esm/src/plugin.js';

await Bun.build({
    entrypoints: ['./mod.ts'],
    outdir: './dist',
    format: 'esm',
    plugins: [deepkitType()],
});
