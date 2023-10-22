/**
 * Normalizes the given path.
 * Removes duplicate slashes, removes trailing slashes, adds a leading slash.
 */
export function pathNormalize(path: string): string {
    path = path[0] !== '/' ? '/' + path : path;
    path = path.length > 1 && path[path.length - 1] === '/' ? path.slice(0, -1) : path;
    return path.replace(/\/+/g, '/');
}

/**
 * Returns the directory (dirname) of the given path.
 */
export function pathDirectory(path: string): string {
    if (path === '/') return '/';
    const lastSlash = path.lastIndexOf('/');
    return lastSlash <= 0 ? '/' : path.slice(0, lastSlash);
}

/**
 * Returns the basename of the given path.
 */
export function pathBasename(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash === -1 ? path : path.slice(lastSlash + 1);
}

/**
 * Returns the extension of the given path.
 */
export function pathExtension(path: string): string {
    const basename = pathBasename(path);
    const lastDot = basename.lastIndexOf('.');
    return lastDot === -1 ? '' : basename.slice(lastDot + 1);
}

export function pathJoin(...paths: string[]): string {
    return '/' + paths
        .map(v => pathNormalize(v).slice(1))
        .filter(v => !!v)
        .join('/');
}
