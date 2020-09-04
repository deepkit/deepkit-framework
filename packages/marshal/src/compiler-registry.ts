import {PropertyCompilerSchema, Types} from './decorators';
import {jitPartial, JitStack} from './jit';

export type TypeConverterCompilerContext = Map<string, any>;
export type ReserveVariable = (name?: string) => string;

export type TypeConverterCompiler = (
    setter: string,
    accessor: string,
    property: PropertyCompilerSchema,
    reserveVariable: ReserveVariable,
    rootContext: TypeConverterCompilerContext,
    jitStack: JitStack
) => string | {
    template: string, context: { [name: string]: any }
};

export const compilerRegistry = new Map<string, TypeConverterCompiler>();

/**
 * Registers a new compiler template for a certain type in certain direction
 * (plain to class, class to plain for example).
 *
 * Note: Don't handle isArray/isMap/isPartial or isOptional at `property` as those are already handled before
 * your compiler code is called. Focus on marshalling the given type as fast and clear as possible.
 * The value you can access via `accessor` is at this stage never undefined and never null.
 *
 * Note: When you come from `class` to x (registerConverterCompile('class', x)) then values additionally are
 * guaranteed to have certain value types since the TS system enforces it. Marshal plainToClass made that sure as well.
 * If a user overwrites with `as any` its not our business to convert them implicitly.
 *
 * Warning: Context is shared across types, so make sure either your assigned names are unique or generate new variable
 * name using `reserveVariable`.
 *
 * INTERNAL WARNING: However, coming from `plain` to `x` the property values usually come from user input which makes
 * it necessary to check the type and convert it if necessary. This is extremely important to not
 * introduce security issues. As third-party integration you should however not handle fromFormat='plain',
 * as this is made in the core. Marshaling from plain to your target platform is made by calling first plainToClass()
 * and then classToX(), Marshal is fast enough to buy this convenience (of not having to declare too many compiler
 * templates).
 */
export function registerConverterCompiler(
    fromFormat: string,
    toFormat: string,
    type: Types | 'undefined' | 'null',
    compiler: TypeConverterCompiler
) {
    compilerRegistry.set(fromFormat + ':' + toFormat + ':' + type, compiler);
}

export function getConverterCompiler(
    fromFormat: string,
    toFormat: string,
    type: Types | 'undefined' | 'null',
): TypeConverterCompiler {
    return compilerRegistry.get(fromFormat + ':' + toFormat + ':' + type) || (() => {
        return '';
    });
}

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
    compilers: TypeConverterCompiler[],
    setter: string,
    getter: string,
    property: PropertyCompilerSchema
): string {
    let template = '';
    for (const compiler of compilers) {
        const res = compiler(setter, getter, property, (name?: string) => reserveVariable(rootContext, name), rootContext, jitStack);
        if ('string' === typeof res) {
            template += res;
        } else {
            for (const i in res.context) {
                if (!res.context.hasOwnProperty(i)) continue;
                rootContext.set(i, res.context[i]);
            }
            template += res.template;
        }
    }
    return template;
}

function getCompilers(
    fromFormat: string,
    toFormat: string,
    property: PropertyCompilerSchema
): { compilers: TypeConverterCompiler[], subProperty: PropertyCompilerSchema } {
    const subProperty = property.isArray || property.isMap ? property.getSubType() : property;

    const compilerDirection = fromFormat + ':' + toFormat;
    let compilers: TypeConverterCompiler[] = [];
    const candidate = compilerRegistry.get(compilerDirection + ':' + subProperty.type);
    if (candidate) compilers.push(candidate);

    if (!compilers.length && fromFormat !== 'class' && toFormat !== 'class') {
        //no compiler found from fromFormat to toFormat (e.g. plain to mongo)
        //we thus first convert from source format to class, then from class to target format.
        const fromSourceToClass = fromFormat + ':class';
        const fromClassToTarget = 'class:' + toFormat;
        const candidateToClass = compilerRegistry.get(fromSourceToClass + ':' + subProperty.type);
        if (candidateToClass) compilers.push(candidateToClass);
        const candidateToTarget = compilerRegistry.get(fromClassToTarget + ':' + subProperty.type);
        if (candidateToTarget) compilers.push(candidateToTarget);
    }

    return {compilers, subProperty};
}

export function getDataConverterJS(
    setter: string,
    accessor: string,
    property: PropertyCompilerSchema,
    fromFormat: string,
    toFormat: string,
    rootContext: TypeConverterCompilerContext,
    jitStack: JitStack,
    undefinedSetterCode: string = '',
    nullSetterCode: string = ''
): string {
    const {compilers, subProperty} = getCompilers(fromFormat, toFormat, property);
    const setNull = property.isNullable ? `${setter} = null;` : '';
    rootContext.set('_default_' + property.name, property.defaultValue);
    const setUndefined = !property.hasDefaultValue && property.defaultValue !== undefined ? `${setter} = ${'_default_' + property.name};` : '';

    const undefinedCompiler = compilerRegistry.get(fromFormat + ':' + toFormat + ':undefined');
    const nullCompiler = compilerRegistry.get(fromFormat + ':' + toFormat + ':undefined');
    undefinedSetterCode = undefinedSetterCode || (undefinedCompiler ? executeCompiler(rootContext, jitStack, [undefinedCompiler], setter, accessor, subProperty) : '');
    nullSetterCode = nullSetterCode || (nullCompiler ? executeCompiler(rootContext, jitStack, [nullCompiler], setter, accessor, subProperty) : '');

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
                            ${getDataConverterJS(`itemValue`, `${a}[${l}]`, property.getSubType(), fromFormat, toFormat, rootContext, jitStack)}
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
                        ${getDataConverterJS(`${a}[${i}]`, `${accessor}[${i}]`, property.getSubType(), fromFormat, toFormat, rootContext, jitStack)}
                    }
                    ${setter} = ${a};
                } else {
                    ${setDefault}
                }
            }
        `;
    } else if (property.isPartial) {
        //rework
        const varClassType = reserveVariable(rootContext);
        rootContext.set('jitPartial', jitPartial);
        rootContext.set(varClassType, property.getSubType().resolveClassType);
        return `
            if (${accessor} === undefined) {
                ${setUndefined}
                ${undefinedSetterCode}
            } else if (${accessor} === null) {
                ${setNull}
                ${nullSetterCode}
            } else {
                ${setter} = jitPartial(${varClassType}, '${fromFormat}', '${toFormat}', ${accessor}, _options);
            }
        `;
    } else {
        const convert = compilers.length ? executeCompiler(rootContext, jitStack, compilers, setter, accessor, property) : `${setter} = ${accessor};`;
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
