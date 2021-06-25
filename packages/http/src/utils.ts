

export function normalizeDirectory(path: string): string {
    if (path[0] !== '/') path = '/' + path;
    if (path[path.length - 1] !== '/') path = path + '/';
    return path;
}

export function resolveUrl(from: string, to: string) {
    const resolvedUrl = new URL(to, new URL(from, 'resolve://'));
    if (resolvedUrl.protocol === 'resolve:') {
      const { pathname, search, hash } = resolvedUrl;
      return pathname + search + hash;
    }
    return resolvedUrl.toString();
  }