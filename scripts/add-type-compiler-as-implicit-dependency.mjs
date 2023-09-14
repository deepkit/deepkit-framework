#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import nx from "@nx/devkit";
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const packages = await fs.readdir(path.join(nx.workspaceRoot, 'packages'));
for (const name of packages) {
    if (name === 'rollup.config.js' || name === 'type-spec' || name === 'type-compiler') continue;
    const filePath = path.join(nx.workspaceRoot, 'packages', name, 'project.json')
    const pkg = require(filePath)
    pkg.implicitDependencies ||= []
    pkg.implicitDependencies = pkg.implicitDependencies.filter(dep => dep !== 'type-compiler');
    pkg.implicitDependencies = [...pkg.implicitDependencies, 'type-compiler'];
    await fs.writeFile(filePath, JSON.stringify(pkg, null, 2), 'utf8')
}
