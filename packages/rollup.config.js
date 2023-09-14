const path = require('node:path');
const { workspaceRoot } = require('@nx/devkit');
const preserveShebang = require('rollup-plugin-preserve-shebang');

const tsconfig = require(path.join(workspaceRoot, 'tsconfig.base.json'));

const nxResolveDistPackages = (packages) => {
    const resolvePackagePath =  (id) => {
        const projectName = id.split('/')[1];

        const projectPath = path.join(workspaceRoot, 'packages', projectName);

        const pkg = require(path.join(projectPath, 'package.json'));

        if (pkg.name !== id && !id.startsWith(`${pkg.name}/`)) {
            throw new Error(`Package name doesn't match, expected ${id} but got ${pkg.name}`);
        }

        return path.join(workspaceRoot, 'dist/packages', projectName);
    }

    return {
        name: 'nx-resolve-dist-packages',
        resolveId: async (id) => {
            if (!packages.includes(id)) return null;

            const projectPath = resolvePackagePath(id);

            return {
                id: projectPath,
                external: true
            }
        },
        generateBundle(options, bundle) {
            for (const info of Object.values(bundle)) {
                if (!info.fileName.endsWith('.d.ts') || info.type !== 'asset') continue;

                const source = typeof info.source !== 'string' ? new TextDecoder().decode(info.source) : info.source;

                const newSource = packages.reduce((source, id) => {
                    const distPath = resolvePackagePath(id);
                    if (!distPath) return source;
                    return source.replaceAll(id, distPath);
                }, source);

                this.emitFile({
                    ...info,
                    source: newSource,
                })
            }
        },
    }
}

module.exports = (config) => {
    if (process.env.NODE_ENV === 'development') {
        const packages = Object.keys(tsconfig.compilerOptions.paths);

        const external = config.external;
        config.external = (id) => packages.includes(id) ? false : external(id);

        // peer-deps-external conflicts with nx-resolve-packages when @deepkit packages are specified in package.json peerDependencies
        config.plugins = config.plugins.filter(plugin => plugin.name !== 'peer-deps-external');

        config.plugins.push(nxResolveDistPackages(packages));

        config.makeAbsoluteExternalsRelative = false;
    }

    config.plugins.push(preserveShebang());

    return config
}

module.exports.nxResolveDistPackages = nxResolveDistPackages
