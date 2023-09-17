#!/usr/bin/env node
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import { parse } from 'yaml';
import { $ } from 'zx';

await $`NODE_ENV=development nx build type-compiler`;

await $`node dist/packages/type-compiler/install-transformer.cjs.js`;

const { packages } = parse(await fs.readFile(join(process.cwd(), 'pnpm-workspace.yaml'), 'utf8'));

for (const pkg of packages) {
    await $`node dist/packages/type-compiler/install-transformer.cjs.js ${pkg}`;
}
