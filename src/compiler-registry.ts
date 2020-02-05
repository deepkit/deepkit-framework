import {PropertyCompilerSchema, Types} from "./decorators";
import {jitPartial} from "./jit";

export type TypeConverterCompilerContext = Map<string, any>;
export type TypeConverterCompiler = (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable: () => string, context: TypeConverterCompilerContext) => string | { template: string, context: { [name: string]: any } };

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
    type: Types,
    compiler: TypeConverterCompiler
) {
    if (!compiler) {
        throw new Error('Compiler has no value.');
    }
    compilerRegistry.set(fromFormat + ':' + toFormat + ':' + type, compiler);
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
    compiler: TypeConverterCompiler,
    setter: string,
    getter: string,
    property: PropertyCompilerSchema,
): string {

    const res = compiler(setter, getter, property, reserveVariable.bind(undefined, rootContext), rootContext);
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


export function getDataConverterJS(
    setter: string,
    accessor: string,
    property: PropertyCompilerSchema,
    fromFormat: string,
    toFormat: string,
    rootContext: TypeConverterCompilerContext
): string {
    let compiler = compilerRegistry.get(fromFormat + ':' + toFormat + ':' + property.type);

    if (property.isArray) {
        //we just use `a.length` to check whether its array-like, because Array.isArray() is way too slow.
        let setDefault = property.isOptional ? '' : `${setter} = [];`;
        if (!compiler) {
            return `
            if (${accessor}.length === undefined || 'string' === typeof ${accessor} || 'function' !== typeof ${accessor}.slice) {
                ${setDefault}
            } else {
                ${setter} = ${accessor}.slice();
            }
            `
        }
        return `
            if (${accessor}.length === undefined || 'string' === typeof ${accessor} || 'function' !== typeof ${accessor}.slice) {
                ${setDefault}
            } else {
                 var l = ${accessor}.length;
                 var a = ${accessor}.slice();
                 while (l--) {
                    //make sure all elements have the correct type
                    if (${accessor}[l] !== undefined && ${accessor}[l] !== null) {
                        var itemValue;
                        ${executeCompiler(rootContext, compiler, `itemValue`, `a[l]`, property)}
                        if (itemValue === undefined) {
                            a.splice(l, 1);
                        } else {
                            a[l] = itemValue;   
                        }
                    }
                 }
                 ${setter} = a;
            }
        `;
    } else if (property.isMap) {
        const line = compiler ? executeCompiler(rootContext, compiler, `a[i]`, `${accessor}[i]`, property) : `a[i] = ${accessor}[i];`;
        let setDefault = property.isOptional ? '' : `${setter} = {};`;
        return `
            var a = {};
            //we make sure its a object and not an array
            if (${accessor} && 'object' === typeof ${accessor} && 'function' !== typeof ${accessor}.slice) {
                for (var i in ${accessor}) {
                    if (!${accessor}.hasOwnProperty(i)) continue;
                    if (${accessor}[i] !== undefined && ${accessor}[i] !== null) {
                        ${line}
                    }
                }
                ${setter} = a;
            } else {
                ${setDefault}
            }
        `;
    } else if (property.isPartial) {
        const varClassType = reserveVariable(rootContext);
        rootContext.set('jitPartial', jitPartial);
        rootContext.set(varClassType, property.resolveClassType);
        return `${setter} = jitPartial('${fromFormat}', '${toFormat}', ${varClassType}, ${accessor})`;
    } else if (compiler) {
        return executeCompiler(rootContext, compiler, setter, accessor, property);
    } else {
        return `
        //${fromFormat}:${toFormat}:${property.type} has no compiler template
        ${setter} = ${accessor};
        `;
    }
}
