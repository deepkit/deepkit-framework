import {PropertyCompilerSchema} from './decorators';
import {JitStack} from './jit';
import {SerializerCompilers} from './serializer';

export type TypeConverterCompilerContext = Map<string, any>;
export type ReserveVariable = (name?: string) => string;

export type TypeConverterCompiler = (
    setter: string,
    accessor: string,
    property: PropertyCompilerSchema,
    compiler: {
        reserveVariable: ReserveVariable,
        rootContext: TypeConverterCompilerContext,
        jitStack: JitStack,
        serializerCompilers: SerializerCompilers
    }
) => string | void | {
    template: string, context: { [name: string]: any }
};

export function reserveVariable(
    rootContext: TypeConverterCompilerContext,
    name: string = 'var'
) {
    for (let i = 0; i < 10000; i++) {
        const candidate = name + '_' + i;
        if (!rootContext.has(candidate)) {
            rootContext.set(candidate, undefined);
            return candidate;
        }
    }
    throw new Error('Too many context variables');
}

export function executeCompiler(
    rootContext: TypeConverterCompilerContext,
    jitStack: JitStack,
    compiler: TypeConverterCompiler,
    setter: string,
    getter: string,
    property: PropertyCompilerSchema,
    serializerCompilers: SerializerCompilers
): string {
    let template = '';

    const res = compiler(setter, getter, property, {
        reserveVariable: (name?: string) => reserveVariable(rootContext, name),
        rootContext,
        jitStack,
        serializerCompilers,
    });
    if ('string' === typeof res) {
        template += res;
    } else if (res) {
        for (const i in res.context) {
            if (!res.context.hasOwnProperty(i)) continue;
            rootContext.set(i, res.context[i]);
        }
        template += res.template;
    }

    return template;
}

export function getDataConverterJS(
    setter: string,
    accessor: string,
    property: PropertyCompilerSchema,
    serializerCompilers: SerializerCompilers,
    rootContext: TypeConverterCompilerContext,
    jitStack: JitStack,
    undefinedSetterCode: string = '',
    nullSetterCode: string = ''
): string {
    const subProperty = property.isArray || property.isMap ? property.getSubType() : property;
    const setNull = property.isNullable ? `${setter} = null;` : '';
    rootContext.set('_default_' + property.name, property.defaultValue);
    const setUndefined = !property.hasDefaultValue && property.defaultValue !== undefined ? `${setter} = ${'_default_' + property.name};` : '';
    const undefinedCompiler = serializerCompilers.get('undefined');
    const nullCompiler = serializerCompilers.get('null');

    undefinedSetterCode = undefinedSetterCode || (undefinedCompiler ? executeCompiler(rootContext, jitStack, undefinedCompiler, setter, accessor, subProperty, serializerCompilers) : '');
    nullSetterCode = nullSetterCode || (nullCompiler ? executeCompiler(rootContext, jitStack, nullCompiler, setter, accessor, subProperty, serializerCompilers) : '');

    if (property.isArray) {
        const a = reserveVariable(rootContext, 'a');
        const l = reserveVariable(rootContext, 'l');
        //we just use `a.length` to check whether its array-like, because Array.isArray() is way too slow.
        let setDefault = property.isOptional ? '' : `${setter} = [];`;
        return `
            if (${accessor} === undefined) {
                ${setUndefined}
                ${undefinedSetterCode}
            } else if (${accessor} === null) {
                ${setNull}
                ${nullSetterCode}
            } else {
                if (${accessor}.length === undefined || 'string' === typeof ${accessor} || 'function' !== typeof ${accessor}.slice) {
                    ${setDefault}
                } else {
                     let ${l} = ${accessor}.length;
                     let ${a} = ${accessor}.slice();
                     while (${l}--) {
                        //make sure all elements have the correct type
                        if (${accessor}[${l}] !== undefined && ${accessor}[${l}] !== null) {
                            let itemValue;
                            ${getDataConverterJS(`itemValue`, `${a}[${l}]`, subProperty, serializerCompilers, rootContext, jitStack)}
                            if (${!subProperty.isOptional} && itemValue === undefined) {
                                ${a}.splice(${l}, 1);
                            } else {
                                ${a}[${l}] = itemValue;   
                            }
                        }
                     }
                     ${setter} = ${a};
                }
            }
        `;
    } else if (property.isMap) {
        const a = reserveVariable(rootContext, 'a');
        const i = reserveVariable(rootContext, 'i');
        let setDefault = property.isOptional ? '' : `${setter} = {};`;
        return `
            if (${accessor} === undefined) {
                ${setUndefined}
                ${undefinedSetterCode}
            } else if (${accessor} === null) {
                ${setNull}
                ${nullSetterCode}
            } else {
                let ${a} = {};
                //we make sure its a object and not an array
                if (${accessor} && 'object' === typeof ${accessor} && 'function' !== typeof ${accessor}.slice) {
                    for (let ${i} in ${accessor}) {
                        if (!${accessor}.hasOwnProperty(${i})) continue;
                        if (${!subProperty.isOptional} && ${accessor}[${i}] === undefined) {
                            continue;
                        }
                        ${getDataConverterJS(`${a}[${i}]`, `${accessor}[${i}]`, property.getSubType(), serializerCompilers, rootContext, jitStack)}
                    }
                    ${setter} = ${a};
                } else {
                    ${setDefault}
                }
            }
        `;
    } else {
        const compiler = serializerCompilers.get(subProperty.type);
        let convert = '';
        if (compiler) {
            convert = executeCompiler(rootContext, jitStack, compiler, setter, accessor, property, serializerCompilers);
        } else {
            convert = `//no compiler for ${subProperty.type}
            ${setter} = ${accessor};`;
        }

        return `
            if (${accessor} === undefined) {
                ${setUndefined}
                ${undefinedSetterCode}
            } else if (${accessor} === null) {
                ${setNull}
                ${nullSetterCode}
            } else {
                ${convert}
            }
        `;
    }
}
