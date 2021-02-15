

export function normalizeDirectory(path: string): string {
    if (path[0] !== '/') path = '/' + path;
    if (path[path.length - 1] !== '/') path = path + '/';
    return path;
}
