import { getTypeJitContainer, ReflectionKind, Type } from './reflection/type.js';
import { CompilerContext, toFastProperties } from '@deepkit/core';
import { ReceiveType, resolveReceiveType } from './reflection/reflection.js';
import { getIndexCheck, JitStack } from './serializer.js';

export type Resolver = (path: string) => Type | undefined;

function pathResolverCode(type: Type, compilerContext: CompilerContext, jitStack: JitStack): string {
    const typeVar = compilerContext.reserveVariable('type', type);

    if (type.kind === ReflectionKind.array) {
        return `
        {
            const dotIndex = path.indexOf('.');
            if (dotIndex === -1) return ${compilerContext.reserveVariable('type', type.type)};
            const pathName = dotIndex === -1 ? path : path.substr(0, dotIndex);
            path = dotIndex === -1 ? '' : path.substr(dotIndex + 1);
            ${pathResolverCode(type.type, compilerContext, jitStack)}
        }
        `;
    } else if (type.kind === ReflectionKind.tupleMember) {
        return `
            if (!path) return ${compilerContext.reserveVariable('type', type)};
            ${pathResolverCode(type.type, compilerContext, jitStack)};
        `;
    } else if (type.kind === ReflectionKind.tuple) {
        const cases: string[] = [];
        for (let i = 0; i < type.types.length; i++) {
            cases.push(`
            case "${i}": {
                ${pathResolverCode(type.types[i], compilerContext, jitStack)}
            }
            `);
        }

        return `
        {
            const dotIndex = path.indexOf('.');
            const segment = dotIndex === -1 ? path : path.substr(0, dotIndex);
            path = dotIndex === -1 ? '' : path.substr(dotIndex + 1);
            switch (segment) {
                ${cases.join('\n')}
                default: {
                    return undefined;
                }
            }
        }
        `;
    } else if (type.kind === ReflectionKind.class && type.classType === Set) {
    } else if (type.kind === ReflectionKind.class && type.classType === Map) {
    } else if (type.kind === ReflectionKind.union) {
        //todo: which type will be picked? return union?
    } else if (type.kind === ReflectionKind.class || type.kind === ReflectionKind.objectLiteral) {
        const jit = compilerContext.reserveVariable('jit', jitStack.getOrCreate(undefined, type, () => pathResolver(type, jitStack)));
        return `return ${jit}.fn(path);`;
    }

    return `return ${typeVar}`;
}

export function resolvePath<T>(path: string, type?: ReceiveType<T>): Type {
    type = resolveReceiveType(type);
    const resolver = pathResolver(type);
    const t = resolver(path);
    if (!t) throw new Error(`No type found for path ${path} in ${type.typeName}`);
    return t;
}

export function pathResolver<T>(type?: ReceiveType<T>, jitStack: JitStack = new JitStack()): Resolver {
    type = resolveReceiveType(type);
    const jit = getTypeJitContainer(type);
    if (jit.pathResolver) return jit.pathResolver;

    if (type.kind === ReflectionKind.objectLiteral || type.kind === ReflectionKind.class) {
        const compilerContext = new CompilerContext();
        const lines: string[] = [];
        const defaultCase: string[] = [];

        for (const member of type.types) {
            if (member.kind === ReflectionKind.propertySignature || member.kind === ReflectionKind.property) {
                if ('symbol' === typeof member.name) continue;
                lines.push(`
            case ${JSON.stringify(member.name)}: {
                if (path === '') return ${compilerContext.reserveVariable('type', member)};
                ${pathResolverCode(member.type, compilerContext, jitStack)}
            }`);
            } else if (member.kind === ReflectionKind.indexSignature) {
                const checkValid = compilerContext.reserveName('check');
                defaultCase.push(`else if (${getIndexCheck(compilerContext, 'pathName', member.index)}) {
                    let ${checkValid} = false;
                    if (!${checkValid}) {
                        ${pathResolverCode(member.type, compilerContext, jitStack)}
                    }
                }`);
            }
        }

        const code = `
        const dotIndex = path.indexOf('.');
        const pathName = dotIndex === -1 ? path : path.substr(0, dotIndex);
        path = dotIndex === -1 ? '' : path.substr(dotIndex + 1);

        if (!pathName) return ${compilerContext.reserveVariable('type', type)};

        switch(pathName) {
            ${lines.join('\n')}
            default: {
                if (false) {} ${defaultCase.join('\n')}
            }
        }
        `;

        jit.pathResolver = compilerContext.build(code, 'path');
        toFastProperties(jit);

        return jit.pathResolver;
    }

    throw new Error(`pathResolver requires TypeClass or TypeObjectLiteral`);
}
