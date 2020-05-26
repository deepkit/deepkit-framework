import {ClassSchema, getClassSchema, MarshalGlobal, PropertyCompilerSchema, PropertySchema} from "./decorators";
import {getDecorator, isExcluded} from "./mapper";
import {ClassType, getClassName, getClassPropertyName} from "@marcj/estdlib";
import {getDataConverterJS, reserveVariable} from "./compiler-registry";

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
    if (!parents) return;
    for (let i = parents.length - 1; i >= 0; i--) {
        if (parents[i] instanceof parentType) {
            return parents[i];
        }
    }
}

const JITPlainToClassCache = new Map<any, any>();
const JITXToClassCache = new Map<any, Map<any, any>>();

const JITClassToPlainCache = new Map<any, any>();
const JITClassToXCache = new Map<any, Map<any, any>>();

const resolvedReflectionCaches = new Map<ClassType<any>, { [path: string]: PropertyCompilerSchema }>();

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

const cacheJitProperty = new Map<string, WeakMap<PropertySchema, any>>();

/**
 * A handy utility class that allows fast access to a JitPropertyConverter class.
 */
export class CacheJitPropertyConverter {
    protected cache = new Map<ClassType<any>, JitPropertyConverter>();

    constructor(
        public readonly fromFormat: string,
        public readonly toFormat: string
    ) {
    }

    getJitPropertyConverter(classType: ClassType<any>): JitPropertyConverter {
        let converter = this.cache.get(classType);
        if (converter) return converter;
        converter = new JitPropertyConverter(this.fromFormat, this.toFormat, classType);
        this.cache.set(classType, converter);
        return converter;
    }
}


/**
 * Creates a new JIT compiled function to convert given property schema for certain paths.
 * Paths can be deep paths making it possible to convert patch-like/mongo structure
 *
 * Note: If fromFormat -> toFormat has no compiler templates registered,
 * the generated function does virtually nothing.
 */
export class JitPropertyConverter {
    protected schema: ClassSchema<any>;
    protected cacheJitPropertyMap: WeakMap<PropertyCompilerSchema, any>;

    constructor(
        public readonly fromFormat: string,
        public readonly toFormat: string,
        classType: ClassType<any>
    ) {
        this.schema = getClassSchema(classType);
        this.schema.initializeProperties();

        this.cacheJitPropertyMap = cacheJitProperty.get(fromFormat + ':' + toFormat)!;
        if (!this.cacheJitPropertyMap) {
            this.cacheJitPropertyMap = new WeakMap<PropertySchema, any>();
            cacheJitProperty.set(fromFormat + ':' + toFormat, this.cacheJitPropertyMap);
        }
    }

    convert(path: string, value: any, parents?: any[]): any {
        let property: PropertyCompilerSchema;

        try {
            property = this.schema.classProperties.get(path) || resolvePropertyCompilerSchema(this.schema, path)
        } catch (error) {
            return;
        }

        return this.convertProperty(property, value, parents);
    }

    convertProperty(property: PropertyCompilerSchema, value: any, parents?: any[]): any {
        if (property.isParentReference) {
            return;
        }

        const jit = this.cacheJitPropertyMap.get(property);
        if (jit) {
            return jit(value, parents);
        }

        const context = new Map<any, any>();

        const functionCode = `
        return function(_value, _parents) {
            var result, _state;
            function getParents() {
                return _parents;
            }
            if (!_parents) _parents = [];
            if (_value === null) {
                result = null;
            } else if (_value !== undefined) {
                //convertProperty ${property.name} ${this.fromFormat}:${this.toFormat}:${property.type}
                ${getDataConverterJS('result', '_value', property, this.fromFormat, this.toFormat, context)}
            }
            return result;
        }
        `;

        const compiled = new Function(...context.keys(), functionCode);
        const fn = compiled.bind(undefined, ...context.values())();
        this.cacheJitPropertyMap.set(property, fn);

        return fn(value, parents);
    }
}

/**
 *
 * Creates a new JIT compiled function to convert given property schema. Deep paths are not allowed.
 */
export function createJITConverterFromPropertySchema(
    fromFormat: string,
    toFormat: string,
    property: PropertySchema
): (value: any, parents?: any[]) => any {
    let cacheJitPropertyMap = cacheJitProperty.get(fromFormat + ':' + toFormat)!;
    if (!cacheJitPropertyMap) {
        cacheJitPropertyMap = new WeakMap<PropertySchema, any>();
        cacheJitProperty.set(fromFormat + ':' + toFormat, cacheJitPropertyMap);
    }

    const jit = cacheJitPropertyMap.get(property);

    if (jit) {
        return jit;
    }

    const context = new Map<any, any>();

    const functionCode = `
        return function(_value, _parents) {
            var result, _state;
            function getParents() {
                return _parents;
            }
            if (!_parents) _parents = [];
            if (_value === null) {
                result = null;
            } else if (_value !== undefined) {
                //createJITConverterFromPropertySchema ${property.name} ${fromFormat}:${toFormat}:${property.type}
                ${getDataConverterJS('result', '_value', property, fromFormat, toFormat, context)}
            }
            return result;
        }
        `;

    const compiled = new Function(...context.keys(), functionCode);
    const fn = compiled.bind(undefined, ...context.values())();
    cacheJitPropertyMap.set(property, fn);

    return fn;
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

    if (property.isActualOptional()) {
        return code;
    }

    return `
    ${code}
    if (!${setter})
        throw new Error('${getClassPropertyName(classType, property.name)} is defined as @ParentReference() and ' +
                    'NOT @f.optional(), but no parent found. Add @f.optional() or provide ${property.name} in parents to fix that.');
    `;
}

export class ToClassState {
    onFullLoadCallbacks: (() => void)[] = [];
}

export function createClassToXFunction<T>(classType: ClassType<T>, toFormat: string | 'plain')
    : (instance: T) => any {
    if (toFormat === 'plain') {
        let jit = JITClassToPlainCache.get(classType);
        if (jit) return jit;
    } else {
        let cache = JITClassToXCache.get(toFormat);
        if (!cache) {
            cache = new Map();
            JITClassToXCache.set(toFormat, cache);
        }
        let jit = cache.get(classType);
        if (jit) return jit;
    }

    const schema = getClassSchema(classType);
    const context = new Map<string, any>();

    const decoratorName = getDecorator(classType);
    let functionCode = '';
    if (decoratorName) {
        const property = schema.getProperty(decoratorName);

        functionCode = `
        return function(_instance) {
            if (_instance.${decoratorName} === null) return null;
            if (_instance.${decoratorName} === undefined) return;
            var result, _state;
            ${getDataConverterJS(`result`, `_instance.${decoratorName}`, property, 'class', toFormat, context)}
            return result;
        }
        `;
        // return propertyClassToPlain(classType, decoratorName, (target as any)[decoratorName]);
    } else {

        const convertProperties: string[] = [];

        for (const property of schema.classProperties.values()) {
            if (property.isParentReference) {
                //we do not export parent references, as this would lead to an circular reference
                continue;
            }

            if (property.backReference) continue;

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
        return function(_instance) {
            const _data = {};
            MarshalGlobal.unpopulatedCheckActive = false;
            ${convertProperties.join('\n')}
            MarshalGlobal.unpopulatedCheckActive = true;
            return _data;
        }
        `;
    }


    try {
        const compiled = new Function('_classType', 'MarshalGlobal', ...context.keys(), functionCode);
        const fn = compiled(classType, MarshalGlobal, ...context.values());
        if (toFormat === 'plain') {
            JITClassToPlainCache.set(classType, fn);
        } else {
            JITClassToXCache.get(toFormat)!.set(classType, fn);
        }

        return fn;
    } catch (error) {
        console.log('jit code', functionCode);
        throw error;
    }
}

export function createXToClassFunction<T>(classType: ClassType<T>, fromTarget: string | 'plain')
    : (data: { [name: string]: any }, parents?: any[], state?: ToClassState) => T {
    if (fromTarget === 'plain') {
        let jit = JITPlainToClassCache.get(classType);
        if (jit) return jit;
    } else {
        let cache = JITXToClassCache.get(fromTarget);
        if (!cache) {
            cache = new Map();
            JITXToClassCache.set(fromTarget, cache);
        }
        let jit = cache.get(classType);
        if (jit) return jit;
    }

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
            constructorArguments.push(`var c_${property.name}; ` + getParentResolverJS(classType, `c_${property.name}`, property, context));
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

    // const valueChecks: string[] = [];
    // for (const property of schema.classProperties.values()) {
    //     if (!property.isActualOptional()) {
    //         valueChecks.push(`
    //         if (undefined === _instance.${property.name} || null === _instance.${property.name}) {
    //             throw new TypeError('Property ${schema.getClassName()}.${property.name} has no value.');
    //         }
    //         `)
    //     }
    // }

    let fullLoadHookPre = '';
    let fullLoadHookPost = '';
    if (schema.hasFullLoadHooks()) {
        fullLoadHookPre = `var hadState = !!_state;`;
        fullLoadHookPost = `
            if (!hadState && _state.onFullLoadCallbacks.length) {
                //we are at the end, so call fullLoad hooks
                for (const cb of _state.onFullLoadCallbacks) cb();
            }
        `;
    }

    const functionCode = `
        return function(_data, _parents, _state) {
            var _instance, parentsWithItem;
            function getParents() {
                if (parentsWithItem) return parentsWithItem;
                parentsWithItem = _parents ? _parents.slice(0) : [];
                parentsWithItem.push(_instance);
                return parentsWithItem;
            }
            ${fullLoadHookPre}
            _state = _state || new ToClassState();
            ${constructorArguments.join('\n')}
            _instance = new _classType(${constructorArgumentNames.join(', ')});
            ${setProperties.join('\n')}
            ${registerLifeCircleEvents.join('\n')}
            ${fullLoadHookPost}
            return _instance;
        }
    `;

    try {
        const compiled = new Function('_classType', 'ToClassState', ...context.keys(), functionCode);
        const fn = compiled(classType, ToClassState, ...context.values());
        if (fromTarget === 'plain') {
            JITPlainToClassCache.set(classType, fn);
        } else {
            JITXToClassCache.get(fromTarget)!.set(classType, fn);
        }

        return fn;
    } catch (error) {
        console.log('jit code', functionCode);
        throw error;
    }
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
    const jitConverter = new JitPropertyConverter(fromFormat, toFormat, classType);

    for (const i in partial) {
        if (!partial.hasOwnProperty(i)) continue;
        result[i] = result[i] = jitConverter.convert(i, partial[i], parents);
    }

    return result;
}


export function jitPartialClassToPlain<T, K extends keyof T>(classType: ClassType<T>, partial: { [name: string]: any }): Partial<{ [F in K]: any }> {
    return jitPartial('class', 'plain', classType, partial);
}

export function jitPartialPlainToClass<T, K extends keyof T>(classType: ClassType<T>, partial: { [name: string]: any }, parents?: any[]): Partial<{ [F in K]: any }> {
    return jitPartial('plain', 'class', classType, partial, parents);
}
