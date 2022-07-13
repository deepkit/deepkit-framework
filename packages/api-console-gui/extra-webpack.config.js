const ResolveTypeScriptPlugin = require("resolve-typescript-plugin");

module.exports = {
    resolve: {
        plugins: [new ResolveTypeScriptPlugin({
            includeNodeModules: true
        })]
    }
}
