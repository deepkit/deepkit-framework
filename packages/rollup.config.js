const path = require('node:path');
const { workspaceRoot } = require('@nx/devkit');

const tsconfig = require(path.join(workspaceRoot, 'tsconfig.base.json'));

const nxResolvePackages = (packages) => {
    const cache = new Map();

    return {
        name: 'nx-resolve-packages',
        resolveId: async (importee) => {
            if (cache.has(importee)) return cache.get(importee);

            if (!packages.includes(importee)) return null;

            const projectName = importee.split('/')[1];

            const projectPath = path.join(workspaceRoot, 'dist/packages', projectName);

            const result = {
                id: projectPath,
                external: true
            }

            cache.set(importee, result);

            return result;
        },
    }
}

module.exports = (config) => {
    // we can't require @deepkit/* packages during development
    if (process.env.NODE_ENV === 'development') {
        const external = config.external;
        const packages = Object.keys(tsconfig.compilerOptions.paths);
        config.external = (id) => {
            if (packages.includes(id)) return false;
            return external(id)
        }
        config.plugins.push(nxResolvePackages(packages));
    }
    return config;
}
