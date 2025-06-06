import '@deepkit/type';

export const resolveOpenApiPath = (deepkitPath: string) => {
    let s = deepkitPath.replace(/:(\w+)/g, (_, name) => `\{${name}\}`);
    s = !s.startsWith('/') ? '/' + s : s;
    return s;
};
