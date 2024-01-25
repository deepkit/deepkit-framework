export function isDebug(level: number = 1) {
    const expected = 'deepkit' + (level > 1 ? '+'.repeat(level - 1) : '');
    return 'undefined' !== typeof process && 'string' === typeof process.env.DEBUG && process.env.DEBUG.includes(expected);
}

/**
 * First level debugging with DEBUG=deepkit
 */
export function debug(...message: any[]): void {
    if (isDebug(1)) {
        console.debug(...message);
    }
}

/**
 * Second level debugging with DEBUG=deepkit+
 */
export function debug2(...message: any[]): void {
    if (isDebug(2)) {
        console.debug(...message);
    }
}
