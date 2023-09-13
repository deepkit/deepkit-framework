const path = require('node:path');
const { workspaceRoot } = require('@nx/devkit');

const tsconfig = require(path.join(workspaceRoot, 'tsconfig.base.json'));

const nxResolveLocalPackages = (packages) => {
    return {
        name: 'nx-resolve-local-packages',
        resolveId: async (id) => {
            if (!packages.includes(id)) return null;

            const projectName = id.split('/')[1];

            const projectPath = path.join(workspaceRoot, 'dist/packages', projectName);
            const pkg = require(path.join(projectPath, 'package.json'));

            if (pkg.name !== id) {
                throw new Error(`Package name doesn't match, expected ${id} but got ${pkg.name}`);
            }

            return {
                id: projectPath,
                external: true
            }
        }
    }
}

module.exports = (config) => {
    if (process.env.NODE_ENV === 'development') {
        const packages = Object.keys(tsconfig.compilerOptions.paths);

        const external = config.external;
        config.external = (id) => packages.includes(id) ? false : external(id);

        // peer-deps-external conflicts with nx-resolve-packages when @deepkit packages are specified in package.json peerDependencies
        config.plugins = config.plugins.filter(plugin => plugin.name !== 'peer-deps-external');

        config.plugins.push(nxResolveLocalPackages(packages));
    }

    /*return {
        ...config,
        output: {
            ...config.output,
            sourcemap: true,
        }
    };*/

    return config;
}

module.exports.nxResolveLocalPackages = nxResolveLocalPackages
