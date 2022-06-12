const resolve = require('enhanced-resolve');
// const resolve2 = require('resolve');

/**
 * This custom jest resolver makes sure symlinks are not followed, so preserveSymlinks=true.
 * Especially in framework-integration test break if symlinks are followed.
 *
 * NODE_PRESERVE_SYMLINKS=1 npm run test packages/framework-integration/tests/
 * and other alternatives do not work anymore, hence the need for this custom resolver.
 */

/**
 * @typedef {{
    basedir: string;
    browser?: boolean;
    defaultResolver: (request: string, options: ResolverOptions) => string;
    extensions?: readonly string[];
    moduleDirectory?: readonly string[];
    paths?: readonly string[];
    rootDir?: string;
  }} ResolverOptions
 */

/**
 * @param {string} request
 * @param {ResolverOptions} options
 */
const myResolve = resolve.create.sync({
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.node'],
    symlinks: false,
    conditionNames: ['require', 'node', 'default'],
});

module.exports = (request, options) => {
    try {
        const res = myResolve(options.basedir, request);
        // const res = resolve2.sync(request, {
        //     ...options,
        //     preserveSymlinks: true,
        // });
        return res;
    } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
            return options.defaultResolver(request, options);
        }
        throw e;
    }
};
