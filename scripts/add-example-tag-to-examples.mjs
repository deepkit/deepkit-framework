#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import nx from "@nx/devkit";
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const examples = await fs.readdir(path.join(nx.workspaceRoot, 'examples'));
for (const name of examples) {
    try {
        if (name === 'rollup.config.js') continue;
        const filePath = path.join(nx.workspaceRoot, 'examples', name, 'project.json')
        const project = require(filePath)
        project.tags ||= []
        project.tags = project.tags.filter(dep => dep !== 'example');
        project.tags = [...project.tags, 'example'];
        await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf8')
    } catch {}
}
