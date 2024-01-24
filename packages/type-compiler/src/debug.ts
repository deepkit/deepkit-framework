export function isDebug() {
    return (
        'undefined' !== typeof process && 'string' === typeof process.env.DEBUG && process.env.DEBUG.includes('deepkit')
    );
}

export function debug(...message: any[]): void {
    if (isDebug()) {
        console.debug(...message);
    }
}
