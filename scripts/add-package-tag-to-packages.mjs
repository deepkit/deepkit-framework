#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import nx from "@nx/devkit";
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const packages = await fs.readdir(path.join(nx.workspaceRoot, 'packages'));
for (const name of packages) {
    if (name === 'rollup.config.js') continue;
    const filePath = path.join(nx.workspaceRoot, 'packages', name, 'project.json')
    const project = require(filePath)
    project.tags ||= []
    project.tags = project.tags.filter(dep => dep !== 'package');
    project.tags = [...project.tags, 'package'];
    await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf8')
}
