import {
    ClassSchema,
    getClassSchema,
    MarshalGlobal,
    PropertyCompilerSchema,
    PropertySchema,
    typedArrayNamesMap, Types
} from "./decorators";
import {getDecorator, isExcluded} from "./mapper";
import {
    ClassType,
    getClassName,
    getClassPropertyName,
    getEnumValues,
    getValidEnumValue,
    isValidEnumValue,
    getEnumLabels
} from "@marcj/estdlib";
import {arrayBufferToBase64, base64ToArrayBuffer, base64ToTypedArray, typedArrayToBase64} from "./core";

export let moment: any = () => {
    throw new Error('Moment.js not installed')
};

declare function require(moduleName: string): any;

try {
    moment = require('moment');
} catch (e) {
}

/**
 * This is used withing JIT functions.
 * @hidden
 */
export function findParent<T>(parents: any[], parentType: ClassType<T>): T | undefined {
    for (let i = parents.length - 1; i >= 0; i--) {
        if (parents[i] instanceof parentType) {
            return parents[i];
        }
    }
}

const JITToClassCache = new Map<any, any>();
export const JITToClassFN = new Map<any, any>();

const JITToPlainCache = new Map<any, any>();
export const JITToPlainCacheFN = new Map<any, any>();

const JITPartialCache = new Map<any, any>();

export type TypeConverterCompilerContext = { [name: string]: any };
export type TypeConverterCompiler = (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable: () => string) => string | { template: string, context: TypeConverterCompilerContext };

const compilerRegistry = new Map<string, TypeConverterCompiler>();

const resolvedReflectionCaches = new Map<ClassType<any>, { [path: string]: PropertyCompilerSchema }>();

export function printToClassJitFunction(classType: ClassType<any>) {
    console.log(getClassName(classType), 'jit ', JITToClassFN.has(classType) ? JITToClassFN.get(classType)!.toString() : undefined);
}

/**
 * This resolves the PropertyCompilerSchema for a property path.
 *
 * A property path can be a deep path, separated with dots. This function makes sure to return the
 * correct PropertyCompilerSchema so that a correct compiler can be built to convert this type.
 */
export function resolvePropertyCompilerSchema<T>(schema: ClassSchema<T>, propertyPath: string): PropertyCompilerSchema {
    if (schema.classProperties.has(propertyPath)) return schema.classProperties.get(propertyPath)!;

    let cache = resolvedReflectionCaches.get(schema.classType);
    if (!cache) {
        cache = {};
        resolvedReflectionCaches.set(schema.classType, cache);
    }

    if (cache[propertyPath]) {
        return cache[propertyPath];
    }

    const names = propertyPath === '' ? [] : propertyPath.split('.');
    if (names.length === 1) return schema.getProperty(names[0]);

    for (let i = 0; i < names.length; i++) {
        const name = names[i];

        if (!schema.hasProperty(name)) {
            throw new Error(`Invalid path ${propertyPath} in class ${schema.getClassName()}.`);
        }

        let prop = schema.getProperty(name);

        if (prop.type === 'class' && prop.isResolvedClassTypeIsDecorated()) {
            const foreignSchema = getClassSchema(prop.getResolvedClassType());
            prop = foreignSchema.getProperty(foreignSchema.decorator!);
        }

        if (prop.isMap || prop.isArray) {
            if (prop.type === 'class') {
                if (names[i + 2]) {
                    return cache[propertyPath] = resolvePropertyCompilerSchema(
                        getClassSchema(prop.getResolvedClassType()),
                        names.slice(i + 2).join('.')
                    );
                } else if (names[i + 1]) {
                    //we got a name or array index
                    return cache[propertyPath] = PropertyCompilerSchema.createFromPropertySchema(prop, false, false, false);
                }
            } else {
                if (names[i + 1]) {
                    //we got a name or array index
                    return cache[propertyPath] = PropertyCompilerSchema.createFromPropertySchema(prop, false, false, false);
                }
            }
        } else {
            if (prop.type === 'class') {
                return cache[propertyPath] = resolvePropertyCompilerSchema(getClassSchema(prop.getResolvedClassType()), names.slice(i + 1).join('.'));
            } else {
                //`Property ${getClassPropertyName(classType, name)} is not an array or map, so can not resolve ${propertyPath}.`
                throw new Error(`Invalid path ${propertyPath} in class ${schema.getClassName()}.`);
            }
        }
    }

    throw new Error(`Invalid path ${propertyPath} in class ${schema.getClassName()}.`);
}

export function resolvePropertyCompilerSchemaOrUndefined<T>(schema: ClassSchema<T>, propertyPath: string): PropertyCompilerSchema | undefined {
    try {
        return resolvePropertyCompilerSchema(schema, propertyPath);
    } catch (error) {
    }
}

/**
 * Registers a new compiler function for a certain type in certain direction
 * (plain to class, class to plain for example).
 *
 * Note: Don't use isArray/isMap/isPartial at `property` as those are already handled before your compiler code
 * is called. Focus on marshalling the given type as fast and clear as possible. Note that when you come
 * from `class` to x property values are guaranteed to have certain value types since the TS system enforces it.
 * If a user overwrites with `as any` its not our business to convert them implicitly.
 *
 * WARNING: However, coming from `plain` to `x` the property values usually come from user input which makes
 * it necessary to check the type and convert it if necessary. This is extremely important to not
 * introduce security issues.
 *
 * Note: Context is shared across types, so make either your usage unique or work around it.
 * Don't store `property` specific values into it, since it's shared and would be overwritten/invalid.
 */
export function registerConverterCompiler(
    fromFormat: string,
    toFormat: string,
    type: Types,
    compiler: TypeConverterCompiler
) {
    compilerRegistry.set(fromFormat + ':' + toFormat + ':' + type, compiler);
}

function noop() {}

export function createJITConverterFromCompilerSchema(
    fromFormat: string,
    toFormat: string,
    property?: PropertyCompilerSchema
): (value: any, parents?: any[]) => any {
    if (!property) return noop;

    //note: this key length forces v8's map implementation to a low performance. If we find
    // a way to build way smaller keys we can increase performance here by a good factor.
    //currently we get 180ms per 100k elements, but when keys are small we come down to 60ms.
    //just try `const cacheKey  = property.type;` and see.

    const cacheKey = fromFormat + ':' + toFormat + ':' + property.getCacheKey();

    let cache = JITPartialCache;

    if (property.type === 'class' || property.type === 'enum') {
        cache = JITPartialCache.get(property.resolveClassType);
        if (!cache) {
            cache = new Map();
            JITPartialCache.set(property.resolveClassType, cache);
        }
    }

    let jit = cache.get(cacheKey);
    if (jit) {
        return jit;
    }

    const context = new Map<any, any>();

    const functionCode = `
    var result;
    return function(value, _parents) {
        if (!_parents) _parents = [];
        ${getDataConverterJS('result', 'value', property, fromFormat, toFormat, context)}
        return result;
    }
    `;

    const compiled = new Function(...context.keys(), functionCode);
    const fn = compiled.bind(undefined, ...context.values())();
    cache.set(cacheKey, fn);

    return cache.get(cacheKey);
}

registerConverterCompiler('plain', 'class', 'string', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `${setter} = typeof ${accessor} === 'string' ? ${accessor} : String(${accessor});`;
});

registerConverterCompiler('plain', 'class', 'number', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `${setter} = typeof ${accessor} === 'number' ? ${accessor} : +${accessor};`;
});

registerConverterCompiler('plain', 'class', 'date', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `${setter} = new Date(${accessor});`;
});

registerConverterCompiler('plain', 'class', 'moment', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = moment(${accessor});`,
        context: {moment}
    };
});

registerConverterCompiler('plain', 'class', 'boolean', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `
    if ('boolean' === typeof ${accessor}) {
        ${setter} = ${accessor};
    } else {
        if ('true' === ${accessor} || '1' === ${accessor} || 1 === ${accessor}) ${setter} = true;
        if ('false' === ${accessor} || '0' === ${accessor} || 0 === ${accessor}) ${setter} = false;
    }
    `;
});

registerConverterCompiler('plain', 'class', 'class', (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable) => {
    const classType = reserveVariable();

    return {
        template: `
            ${setter} = createXToClassFunction(${classType}, 'plain')(${accessor}, _parents);
        `,
        context: {
            [classType]: property.resolveClassType,
            createXToClassFunction
        }
    };
});


registerConverterCompiler('plain', 'class', 'enum', (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable) => {
    //this a candidate where we can extract ENUM information during build time and check very fast during
    //runtime, so we don't need a call to getResolvedClassTypeForValidType(), isValidEnumValue(), etc in runtime anymore.
    const allowLabelsAsValue = property.allowLabelsAsValue;
    const typeValue = reserveVariable();
    return {
        template: `
        var typeValue = ${typeValue};
        if (undefined !== ${accessor} && !isValidEnumValue(typeValue, ${accessor}, ${allowLabelsAsValue})) {
            const valids = getEnumValues(typeValue);
            if (${allowLabelsAsValue}) {
                for (const label of getEnumLabels(typeValue)) {
                    valids.push(label);
                }
            }
            throw new Error('Invalid ENUM given in property ${property.name}: ' + ${accessor} + ', valid: ' + valids.join(','));
        }
        ${setter} = getValidEnumValue(typeValue, ${accessor}, ${allowLabelsAsValue});
    `,
        context: {
            [typeValue]: property.resolveClassType,
            isValidEnumValue: isValidEnumValue,
            getEnumValues: getEnumValues,
            getEnumLabels: getEnumLabels,
            getValidEnumValue: getValidEnumValue
        }
    };
});

const convertTypedArrayToClass = (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = base64ToTypedArray(${accessor}, typedArrayNamesMap.get('${property.type}'));`,
        context: {
            base64ToTypedArray,
            typedArrayNamesMap
        }
    };
};

registerConverterCompiler('plain', 'class', 'Int8Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Uint8Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Uint8Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Uint8ClampedArray', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Int16Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Uint16Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Int32Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Int32Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Uint32Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Float32Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Float64Array', convertTypedArrayToClass);

registerConverterCompiler('plain', 'class', 'arrayBuffer', (setter, getter) => {
    return {
        template: `${setter} = base64ToArrayBuffer(${getter});`,
        context: {base64ToArrayBuffer}
    };
});

const convertTypedArrayToPlain = (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = typedArrayToBase64(${accessor});`,
        context: {
            typedArrayToBase64
        }
    };
};
registerConverterCompiler('class', 'plain', 'Int8Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Uint8Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Uint8Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Uint8ClampedArray', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Int16Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Uint16Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Int32Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Int32Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Uint32Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Float32Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Float64Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'arrayBuffer', (setter, getter) => {
    return {
        template: `${setter} = arrayBufferToBase64(${getter});`,
        context: {arrayBufferToBase64}
    };
});

const convertToPlainUsingToJson = (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `${setter} = ${accessor}.toJSON();`;
};

registerConverterCompiler('class', 'plain', 'date', convertToPlainUsingToJson);
registerConverterCompiler('class', 'plain', 'moment', convertToPlainUsingToJson);

registerConverterCompiler('class', 'plain', 'class', (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable) => {
    const classType = reserveVariable();
    return {
        template: `${setter} = createClassToXFunction(${classType}, 'plain')(${accessor});`,
        context: {
            [classType]: property.resolveClassType,
            createClassToXFunction,
        }
    }
});

function reserveVariable(
    rootContext: Map<string, any>,
) {
    for (let i = 0; i < 10000; i++) {
        const candidate = 'var_' + i;
        if (!rootContext.has(candidate)) {
            rootContext.set(candidate, undefined);
            return candidate;
        }
    }
    throw new Error('Too many context variables');
}

function getParentResolverJS<T>(
    classType: ClassType<T>,
    setter: string,
    property: PropertySchema,
    context: Map<string, any>
): string {
    context.set('findParent', findParent);
    const varClassType = reserveVariable(context);
    context.set(varClassType, property.resolveClassType);

    const code = `${setter} = findParent(_parents, ${varClassType});`;

    if (property.isOptional) {
        return code;
    }

    return `
    ${code}
    if (!${setter})
        throw new Error('${getClassPropertyName(classType, property.name)} is defined as @ParentReference() and ' +
                    'NOT @f.optional(), but no parent found. Add @f.optional() or provide ${property.name} in parents to fix that.');
    `;
}

function executeCompiler(
    rootContext: Map<string, any>,
    compiler: TypeConverterCompiler,
    setter: string,
    getter: string,
    property: PropertyCompilerSchema,
): string {

    const res = compiler(setter, getter, property, reserveVariable.bind(undefined, rootContext));
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

function getDataConverterJS(
    setter: string,
    accessor: string,
    property: PropertyCompilerSchema,
    fromFormat: string,
    toFormat: string,
    rootContext: Map<string, any>
): string {
    let compiler = compilerRegistry.get(fromFormat + ':' + toFormat + ':' + property.type);

    if (property.isArray) {
        //we just use `a.length` to check whether its array-like, because Array.isArray() is way too slow.
        if (!compiler) {
            return `
                if (${accessor} && ${accessor}.length) {
                     ${setter} = ${accessor}.slice();
                }
            `
        }
        return `
            if (${accessor} && ${accessor}.length) {
                 var l = ${accessor}.length;
                 var a = ${accessor}.slice(0);
                 while (l--) {
                    //make sure all elements have the correct type
                    ${executeCompiler(rootContext, compiler, `a[l]`, `a[l]`, property)}
                 } 
                 ${setter} = a;
            }
        `;
    } else if (property.isMap) {
        const line = compiler ? executeCompiler(rootContext, compiler, `a[i]`, `${accessor}[i]`, property) : `a[i] = ${accessor}[i];`;
        return `
            var a = {};
            if (${accessor} && 'object' === typeof ${accessor}) {
                for (var i in ${accessor}) {
                    if (!${accessor}.hasOwnProperty(i)) continue;
                    ${line}
                }
                ${setter} = a;
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
        return `${setter} = ${accessor};`;
    }
}

export class ToClassState {
    onFullLoadCallbacks: (() => void)[] = [];
}

export function createClassToXFunction<T>(classType: ClassType<T>, toFormat: string | 'plain')
    : (instance: T) => any {
    let jit = JITToPlainCache.get(classType);
    if (jit) return jit;

    const schema = getClassSchema(classType);
    const context = new Map<string, any>();

    const decoratorName = getDecorator(classType);
    let functionCode = '';
    if (decoratorName) {
        const property = schema.getProperty(decoratorName);

        functionCode = `
            if (_instance.${decoratorName} === null) return null;
            if (_instance.${decoratorName} === undefined) return;
            var result;
            ${getDataConverterJS(`result`, `_instance.${decoratorName}`, property, 'class', toFormat, context)}
            return result;
        `;
        // return propertyClassToPlain(classType, decoratorName, (target as any)[decoratorName]);
    } else {

        const convertProperties: string[] = [];

        // const excludeReferences = options ? options.excludeReferences === true : false;
        const excludeReferences = true;

        for (const property of schema.classProperties.values()) {
            if (property.isParentReference) {
                //we do not export parent references, as this would lead to an circular reference
                continue;
            }
            if (excludeReferences && (property.isReference || property.backReference || property.isReferenceKey)) continue;

            if (isExcluded(classType, property.name, toFormat)) {
                continue
            }

            convertProperties.push(`
                if (_instance.${property.name} === null) {
                    _data.${property.name} = null;
                } else if (_instance.${property.name} !== undefined){
                    ${getDataConverterJS(`_data.${property.name}`, `_instance.${property.name}`, property, 'class', toFormat, context)}
                }
        `);
        }

        functionCode = `
            const _data = {};
            MarshalGlobal.unpopulatedCheckActive = false;
            ${convertProperties.join('\n')}
            MarshalGlobal.unpopulatedCheckActive = true;
            return _data;
        `;
    }

    try {
        jit = new Function('_classType', '_instance', 'MarshalGlobal', ...context.keys(), functionCode);
    } catch (error) {
        console.log('failed to build jit function', error, functionCode);
    }

    JITToPlainCacheFN.set(classType, jit);

    const additionalContext = [...context.values()];
    JITToPlainCache.set(classType, function (instance: any) {
        try {
            return jit(classType, instance, MarshalGlobal, ...additionalContext);
        } catch (error) {
            console.debug('jit code', jit.toString());
            throw error;
        }
    });

    return JITToPlainCache.get(classType);
}

export function createXToClassFunction<T>(classType: ClassType<T>, fromTarget: string | 'plain')
    : (data: { [name: string]: any }, parents?: any[], state?: ToClassState) => T {
    let jit = JITToClassCache.get(classType);
    if (jit) return jit;

    const schema = getClassSchema(classType);
    const context = new Map<string, any>();

    const setProperties: string[] = [];
    const constructorArguments: string[] = [];
    const constructorArgumentNames: string[] = [];
    const assignedViaConstructor: { [propertyName: string]: boolean } = {};
    const constructorParameter = schema.getMethodProperties('constructor');

    for (const property of constructorParameter) {
        assignedViaConstructor[property.name] = true;

        if (schema.decorator && property.name === schema.decorator) {
            constructorArguments.push(`var c_${property.name} = _data;
                if (undefined !== c_${property.name} && null !== c_${property.name}) {
                    ${getDataConverterJS(`c_${property.name}`, `c_${property.name}`, property, fromTarget, 'class', context)}
                }
            `);
        } else if (property.isParentReference) {
            //parent resolver
            setProperties.push(`var c_${property.name}; ` + getParentResolverJS(classType, `_${property.name}`, property, context));
        } else {
            constructorArguments.push(`var c_${property.name} = _data.${property.name}; 
                if (undefined !== c_${property.name} && null !== c_${property.name}) {
                    ${getDataConverterJS(`c_${property.name}`, `c_${property.name}`, property, fromTarget, 'class', context)}
                }
            `);
        }

        constructorArgumentNames.push(`c_${property.name}`);
    }

    for (const property of schema.classProperties.values()) {
        if (assignedViaConstructor[property.name]) continue;
        if (property.isReference || property.backReference) continue;

        if (property.isParentReference) {
            setProperties.push(getParentResolverJS(classType, `_instance.${property.name}`, property, context));
        } else {
            setProperties.push(`
            if (undefined !== _data.${property.name} && null !== _data.${property.name}) {
                ${getDataConverterJS(`_instance.${property.name}`, `_data.${property.name}`, property, fromTarget, 'class', context)}
            }
            `);
        }
    }

    const registerLifeCircleEvents: string[] = [];
    for (const onLoad of schema.onLoad) {
        if (onLoad.options.fullLoad) {
            registerLifeCircleEvents.push(`
                _state.onFullLoadCallbacks.push(_instance.${onLoad.methodName}.bind(_instance));
            `)
        } else {
            registerLifeCircleEvents.push(`
                _instance.${onLoad.methodName}();
            `)
        }
    }

    const functionCode = `
        ${constructorArguments.join('\n')}
        const _instance = new _classType(${constructorArgumentNames.join(', ')});
        ${setProperties.join('\n')}
        ${registerLifeCircleEvents.join('\n')}
        return _instance;
    `;

    try {
        jit = new Function('_classType', '_data', '_parents', '_state', ...context.keys(), functionCode);
    } catch (error) {
        console.log('failed to build jit function', error, functionCode);
    }

    JITToClassFN.set(classType, jit);

    const additionalContext = [...context.values()];
    JITToClassCache.set(classType, function (data: any, parents?: any[], state?: ToClassState) {
        try {
            let hadInstance = !!state;
            state = state || new ToClassState();
            const instance = jit(classType, data, parents || [], state, ...additionalContext);
            if (!hadInstance) {
                //we are at the end, so call fullLoad hooks
                for (const cb of state.onFullLoadCallbacks) {
                    cb();
                }
            }
            return instance;
        } catch (error) {
            console.debug('Jit code', jit.toString());
            throw error;
        }
    });

    return JITToClassCache.get(classType);
}

export function jitPlainToClass<T>(classType: ClassType<T>, data: any, parents?: any[]): T {
    return createXToClassFunction(classType, 'plain')(data, parents);
}


export function jitClassToPlain<T>(classType: ClassType<T>, instance: T): Partial<T> {
    if (!(instance instanceof classType)) {
        throw new Error(`Could not classToPlain since target is not a class instance of ${getClassName(classType)}`);
    }

    return createClassToXFunction(classType, 'plain')(instance);
}

export function jitPartial<T, K extends keyof T>(
    fromFormat: string,
    toFormat: string,
    classType: ClassType<T>,
    partial: { [name: string]: any },
    parents?: any[]
): Partial<{ [F in K]: any }> {
    const result: Partial<{ [F in K]: any }> = {};
    const schema = getClassSchema(classType);

    for (const i in partial) {
        if (!partial.hasOwnProperty(i)) continue;
        result[i] = createJITConverterFromCompilerSchema(fromFormat, toFormat, resolvePropertyCompilerSchemaOrUndefined(schema, i))(partial[i], parents);
    }

    return result;
}


export function jitPartialClassToPlain<T, K extends keyof T>(classType: ClassType<T>, partial: { [name: string]: any }): Partial<{ [F in K]: any }> {
    return jitPartial('class', 'plain', classType, partial);
}

export function jitPartialPlainToClass<T, K extends keyof T>(classType: ClassType<T>, partial: { [name: string]: any }, parents?: any[]): Partial<{ [F in K]: any }> {
    return jitPartial('plain', 'class', classType, partial, parents);
}
