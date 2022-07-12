const ResolveTypeScriptPlugin = require("resolve-typescript-plugin");

module.exports = {
    resolve: {
        fallback: {
            util: false,
            fs: false,
            path: false,
            process: false,
            '@deepkit/logger': false
        },
        plugins: [new ResolveTypeScriptPlugin({
            includeNodeModules: true
        })]
    }
}
