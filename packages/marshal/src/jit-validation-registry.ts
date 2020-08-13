import {PropertyCompilerSchema, Types} from './decorators';
import {reserveVariable} from './compiler-registry';
import {JitStack} from './jit';

export type TypeCheckerCompilerContext = Map<string, any>;
export type TypeCheckerCompiler = (
    accessor: string,
    property: PropertyCompilerSchema,
    utils: { reserveVariable: (name?: string) => string, path: string, context: TypeCheckerCompilerContext, raise: (code: string, message: string) => string },
    jitStack: JitStack,
) => string | { template: string, context: { [name: string]: any } };

export const validationRegistry = new Map<string, TypeCheckerCompiler>();

export function registerCheckerCompiler(
    type: Types,
    compiler: TypeCheckerCompiler
) {
    validationRegistry.set(type, compiler);
}

export function executeCheckerCompiler(
    path: string,
    rootContext: TypeCheckerCompilerContext,
    jitStack: JitStack,
    compiler: TypeCheckerCompiler,
    getter: string,
    property: PropertyCompilerSchema,
): string {
    const res = compiler(
        getter,
        property,
        {
            reserveVariable: (name?: string) => {
                return reserveVariable(rootContext, name);
            },
            context: rootContext,
            path: path,
            raise: (code: string, message: string) => {
                return `_errors.push(new ValidationError(${path}, ${JSON.stringify(code)}, ${JSON.stringify(message)}))`;
            },
        },
        jitStack
    );
    if ('string' === typeof res) {
        return res;
    } else {
        for (const i in res.context) {
            if (!res.context.hasOwnProperty(i)) continue;
            rootContext.set(i, res.context[i]);
        }
        return res.template;
    }
}
