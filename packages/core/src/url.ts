function removeSlash(v: string): string {
    return v.replace(/^\/+/g, '').replace(/\/+$/g, '');
}

export function urlJoin(...path: string[]): string {
    const isAbsolute = path[0] && path[0] !== '/' && path[0][0] === '/';
    return (isAbsolute ? '/' : '') + path.filter(v => !!v).map(v => v === '/' ? '' : removeSlash(v.trim())).join('/');
}
