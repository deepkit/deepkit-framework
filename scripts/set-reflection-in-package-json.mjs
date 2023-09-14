#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import nx from "@nx/devkit";
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const packages = await fs.readdir(path.join(nx.workspaceRoot, 'packages'));
for (const name of packages) {
    if (name === 'rollup.config.js' || 'api-console-gui' || 'framework-debug-gui' || 'orm-browser-gui' || 'type-spec' || 'type-compiler') continue;
    const filePath = path.join(nx.workspaceRoot, 'packages', name, 'package.json')
    const pkg = require(filePath)
    pkg.reflection ??= true;
    await fs.writeFile(filePath, JSON.stringify(pkg, null, 2), 'utf8')
}
