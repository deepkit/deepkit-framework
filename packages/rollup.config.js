const path = require('node:path');
const { workspaceRoot } = require('@nx/devkit');
const { readFile } = require('fs/promises');

const tsconfig = require(path.join(workspaceRoot, 'tsconfig.base.json'));

const nxResolvePackages = (packages) => {
    const cache = new Map();

    return {
        name: 'nx-resolve-packages',
        resolveId: async (importee) => {
            if (cache.has(importee)) return cache.get(importee);

            if (!packages.includes(importee)) return null;

            const projectName = importee.split('/')[1];

            const distProjectPath = path.join(workspaceRoot, 'dist/packages', projectName);

            const packageJson = JSON.parse(await readFile(path.join(distProjectPath, 'package.json'), 'utf8'));
            const relativeIndexFilePath = packageJson.module || packageJson.main;

            const absoluteMainFilePath = path.join(distProjectPath, relativeIndexFilePath);
            cache.set(importee, absoluteMainFilePath);

            return absoluteMainFilePath;
        },
    }
}

module.exports = (config) => {
    if (process.env.NODE_ENV === 'development') {
        const external = config.external;
        const packages = Object.keys(tsconfig.compilerOptions.paths);
        // we can't require @deepkit/* packages during development
        config.external = (id) => {
            if (packages.includes(id)) return false;
            return external(id)
        }
        config.plugins.push(nxResolvePackages(packages));
    }
    return config;
}
