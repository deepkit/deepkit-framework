function removeSlash(v: string): string {
    return v.replace(/(^\/+)|(\/+$)/g, '');
}

export function urlJoin(...path: string[]): string {
    const leadingSlash = path[0] && path[0] !== '/' && path[0][0] === '/';
    const last = path[path.length - 1];
    const trailingSlash = last && last !== '/' && last[last.length - 1] === '/';
    return (leadingSlash ? '/' : '') + path.filter(v => !!v).map(v => v === '/' ? '' : removeSlash(v.trim())).join('/') + (trailingSlash ? '/' : '');
}
