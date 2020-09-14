import {PropertyCompilerSchema} from './decorators';
import {reserveVariable} from './serializer-compiler';
import {JitStack} from './jit';
import { Types } from './models';

export type TypeCheckerCompilerContext = Map<string, any>;
export type TypeCheckerCompiler = (
    accessor: string,
    property: PropertyCompilerSchema,
    utils: { reserveVariable: (name?: string) => string, path: string, context: TypeCheckerCompilerContext, raise: (code: string, message: string) => string },
    jitStack: JitStack,
) => string | { template: string, context: { [name: string]: any } | Map<string, any> };

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
        if (res.context instanceof Map) {
            for (const [k, v] of res.context.entries()) {
                rootContext.set(k, v);
            }
        } else {
            for (const i in res.context) {
                if (!res.context.hasOwnProperty(i)) continue;
                rootContext.set(i, res.context[i]);
            }
        }
        return res.template;
    }
}
