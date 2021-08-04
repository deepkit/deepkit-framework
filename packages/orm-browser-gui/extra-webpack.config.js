module.exports = {
    resolve: {
        fallback: {
            util: false,
            fs: false,
            path: false,
            process: false,
            '@deepkit/logger': false
        }
    }
}
