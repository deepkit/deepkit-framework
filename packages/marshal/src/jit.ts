import {ClassSchema, getClassSchema, getGlobalStore, PropertyCompilerSchema, PropertySchema} from './decorators';
import {isExcluded} from './mapper';
import {ClassType, getClassName} from '@super-hornet/core';
import {getDataConverterJS, reserveVariable} from './compiler-registry';

export let moment: any = () => {
    throw new Error('Moment.js not installed');
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
export function findParent<T>(parents: any[], parentType: ClassType<T>): T | void {
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
    if (schema.getClassProperties().has(propertyPath)) return schema.getClassProperties().get(propertyPath)!;

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
            if (prop.getSubType().type === 'class') {
                if (names[i + 2]) {
                    return cache[propertyPath] = resolvePropertyCompilerSchema(
                        getClassSchema(prop.getSubType().getResolvedClassType()),
                        names.slice(i + 2).join('.')
                    );
                } else if (names[i + 1]) {
                    //we got a name or array index
                    return cache[propertyPath] = PropertyCompilerSchema.createFromPropertySchema(prop.getSubType());
                }
            } else {
                if (names[i + 1]) {
                    //we got a name or array index
                    return cache[propertyPath] = PropertyCompilerSchema.createFromPropertySchema(prop.getSubType());
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

export interface JitConverterOptions {
    /**
     * Which groups to include. If a property is not assigned to
     * a given group, it will be excluded.
     */
    groups?: string[];

    /**
     * Which groups to exclude. If a property is assigned to at least
     * one given group, it will be excluded. Basically the opposite of
     * `groups`, but you can combine both.
     */
    groupsExclude?: string[];

    /**
     * When target is class instance and a property has @ParentReference you can
     * pass instances so the reference can be resolved, for cases
     * where its impossible to resolve otherwise.
     */
    parents?: any[];
}

/**
 * Creates a new JIT compiled function to convert given property schema for certain paths.
 * Paths can be deep paths making it possible to convert patch-like/mongo structure
 *
 * Note: If fromFormat -> toFormat has no compiler templates registered,
 * its tried to first serialize from `fromFormat`->class and then class->`toFormat`.
 *
 * Generated function is cached.
 */
export class JitPropertyConverter {
    protected schema: ClassSchema<any>;
    protected cacheJitPropertyMap: WeakMap<PropertyCompilerSchema, any>;

    constructor(
        public readonly fromFormat: string,
        public readonly toFormat: string,
        private classType: ClassType<any>,
        private options?: JitConverterOptions
    ) {
        this.schema = getClassSchema(classType);
        this.schema.initializeProperties();

        this.cacheJitPropertyMap = cacheJitProperty.get(fromFormat + ':' + toFormat)!;
        if (!this.cacheJitPropertyMap) {
            this.cacheJitPropertyMap = new WeakMap<PropertySchema, any>();
            cacheJitProperty.set(fromFormat + ':' + toFormat, this.cacheJitPropertyMap);
        }
    }

    convert(path: string, value: any, result?: any): any {
        let property: PropertyCompilerSchema;

        try {
            property = this.schema.getClassProperties().get(path) || resolvePropertyCompilerSchema(this.schema, path);
        } catch (error) {
            return;
        }

        if (this.options && !isGroupAllowed(this.options, property.groupNames)) return;

        if (result) {
            result[path] = this.convertProperty(property, value);
        } else {
            return this.convertProperty(property, value);
        }
    }

    convertProperty(property: PropertyCompilerSchema, value: any): any {
        if (property.isParentReference) {
            return;
        }

        const jit = this.cacheJitPropertyMap.get(property);
        if (jit) {
            return jit(value, this.options && this.options.parents, this.options);
        }

        const context = new Map<any, any>();

        const functionCode = `
        return function(_value, _parents, _options) {
            var result, _state;
            function getParents() {
                return _parents;
            }
            if (!_parents) _parents = [];
            //convertProperty ${property.name} ${this.fromFormat}:${this.toFormat}:${property.type}
            ${getDataConverterJS('result', '_value', property, this.fromFormat, this.toFormat, context)}
            return result;
        }
        `;

        const compiled = new Function(...context.keys(), functionCode);
        const fn = compiled.bind(undefined, ...context.values())();
        this.cacheJitPropertyMap.set(property, fn);

        return fn(value, this.options && this.options.parents, this.options);
    }
}

/**
 *
 * Creates a new JIT compiled function to convert given property schema. Deep paths are not allowed.
 * Generated function is cached.
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
        return function(_value, _parents, _options) {
            var result, _state;
            function getParents() {
                return _parents;
            }
            if (!_parents) _parents = [];
            //createJITConverterFromPropertySchema ${property.name} ${fromFormat}:${toFormat}:${property.type}
            ${getDataConverterJS('result', '_value', property, fromFormat, toFormat, context)}
            return result;
        }
        `;

    const compiled = new Function(...context.keys(), functionCode);
    const fn = compiled.bind(undefined, ...context.values())();
    cacheJitPropertyMap.set(property, fn);

    return fn;
}

function getParentResolverJS<T>(
    schema: ClassSchema<T>,
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
        throw new Error('${schema.getClassPropertyName(property.name)} is defined as @f.parentReference and ' +
                    'NOT @f.optional, but no parent found. Add @f.optional or provide ${property.name} in parents to fix that.');
    `;
}

export class ToClassState {
    onFullLoadCallbacks: (() => void)[] = [];
}

function isGroupAllowed(options: JitConverterOptions, groupNames: string[]): boolean {
    if (!options.groups && !options.groupsExclude) return true;

    if (options.groupsExclude && options.groupsExclude.length) {
        for (const groupName of groupNames) {
            if (options.groupsExclude.includes(groupName)) {
                return false;
            }
        }
    }

    if (options.groups && options.groups.length) {
        for (const groupName of groupNames) {
            if (options.groups.includes(groupName)) {
                return true;
            }
        }
        return false;
    }


    return true;
}

export function createClassToXFunction<T>(schema: ClassSchema<T>, toFormat: string | 'plain')
    : (instance: T, options?: JitConverterOptions) => any {
    if (toFormat === 'plain') {
        let jit = JITClassToPlainCache.get(schema);
        if (jit && jit.buildId === schema.buildId) return jit;
    } else {
        let cache = JITClassToXCache.get(toFormat);
        if (!cache) {
            cache = new Map();
            JITClassToXCache.set(toFormat, cache);
        }
        let jit = cache.get(schema);
        if (jit && jit.buildId === schema.buildId) return jit;
    }

    const context = new Map<string, any>();

    const decoratorName = schema.decorator;
    let functionCode = '';
    if (decoratorName) {
        const property = schema.getProperty(decoratorName);

        functionCode = `
        return function(_instance, _options) {
            var result, _state;
            ${getDataConverterJS(`result`, `_instance.${decoratorName}`, property, 'class', toFormat, context)}
            return result;
        }
        `;
        // return propertyClassToPlain(classType, decoratorName, (target as any)[decoratorName]);
    } else {

        const convertProperties: string[] = [];

        for (const property of schema.getClassProperties().values()) {
            if (property.isParentReference) {
                //we do not export parent references, as this would lead to an circular reference
                continue;
            }

            if (property.backReference) continue;

            if (isExcluded(schema, property.name, toFormat)) {
                continue;
            }

            convertProperties.push(`
            //${property.name}:${property.type}
            if (!_options || isGroupAllowed(_options, ${JSON.stringify(property.groupNames)})){ 
                ${getDataConverterJS(`_data.${property.name}`, `_instance.${property.name}`, property, 'class', toFormat, context)}
            }
        `);
        }

        functionCode = `
        return function(_instance, _options) {
            var _data = {};
            var _oldUnpopulatedCheckActive = _global.unpopulatedCheckActive;
            _global.unpopulatedCheckActive = false;
            ${convertProperties.join('\n')}
            _global.unpopulatedCheckActive = _oldUnpopulatedCheckActive;
            return _data;
        }
        `;
    }

    const compiled = new Function('_classType', '_global', 'isGroupAllowed', ...context.keys(), functionCode);
    const fn = compiled(schema.classType, getGlobalStore(), isGroupAllowed, ...context.values());
    fn.buildId = schema.buildId;
    if (toFormat === 'plain') {
        JITClassToPlainCache.set(schema, fn);
    } else {
        JITClassToXCache.get(toFormat)!.set(schema, fn);
    }

    return fn;
}

export function getJitFunctionClassToX(schema: ClassSchema<any>, toFormat: string = 'plain') {
    if (toFormat === 'plain') {
        let jit = JITClassToPlainCache.get(schema);
        if (jit) return jit;
    } else {
        let cache = JITClassToXCache.get(toFormat);
        if (cache) return cache.get(schema);
    }
}

export function getJitFunctionXToClass(schema: ClassSchema<any>, fromFormat: string = 'plain') {
    if (fromFormat === 'plain') {
        let jit = JITPlainToClassCache.get(schema);
        if (jit) return jit;
    } else {
        let cache = JITXToClassCache.get(fromFormat);
        if (cache) return cache.get(schema);
    }
}

export function createXToClassFunction<T>(schema: ClassSchema<T>, fromTarget: string | 'plain')
    : (data: { [name: string]: any }, options?: JitConverterOptions, parents?: any[], state?: ToClassState) => T {
    if (fromTarget === 'plain') {
        let jit = JITPlainToClassCache.get(schema);
        if (jit && jit.buildId === schema.buildId) return jit;
    } else {
        let cache = JITXToClassCache.get(fromTarget);
        if (!cache) {
            cache = new Map();
            JITXToClassCache.set(fromTarget, cache);
        }
        let jit = cache.get(schema);
        if (jit && jit.buildId === schema.buildId) return jit;
    }

    const context = new Map<string, any>();

    const setProperties: string[] = [];
    const constructorArguments: string[] = [];
    const constructorArgumentNames: string[] = [];
    const assignedViaConstructor: { [propertyName: string]: boolean } = {};
    const constructorParameter = schema.getMethodProperties('constructor');

    for (const property of constructorParameter) {
        assignedViaConstructor[property.name] = true;

        if (schema.decorator && property.name === schema.decorator) {
            constructorArguments.push(`
                //constructor parameter ${property.name}, decorated
                var c_${property.name} = _data;
                ${getDataConverterJS(`c_${property.name}`, `c_${property.name}`, property, fromTarget, 'class', context)}
            `);
        } else if (property.isParentReference) {
            //parent resolver
            constructorArguments.push(`var c_${property.name}; ` + getParentResolverJS(schema, `c_${property.name}`, property, context));
        } else {
            constructorArguments.push(`
                //constructor parameter ${property.name}
                var c_${property.name} = _data[${JSON.stringify(property.name)}];
                ${getDataConverterJS(`c_${property.name}`, `c_${property.name}`, property, fromTarget, 'class', context)}
            `);
        }

        constructorArgumentNames.push(`c_${property.name}`);
    }

    for (const property of schema.getClassProperties().values()) {
        if (assignedViaConstructor[property.name]) continue;
        if (property.isReference || property.backReference) continue;

        if (property.isParentReference) {
            setProperties.push(getParentResolverJS(schema, `_instance.${property.name}`, property, context));
        } else {
            setProperties.push(`
            if (!_options || isGroupAllowed(_options, ${JSON.stringify(property.groupNames)})) {
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
            `);
        } else {
            registerLifeCircleEvents.push(`
                _instance.${onLoad.methodName}();
            `);
        }
    }

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
        return function(_data, _options, _parents, _state) {
            var _instance, parentsWithItem;
            _parents = _parents || (_options ? _options.parents : []);
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
        const compiled = new Function('_classType', 'ToClassState', 'isGroupAllowed', ...context.keys(), functionCode);
        const fn = compiled(schema.classType, ToClassState, isGroupAllowed, ...context.values());
        fn.buildId = schema.buildId;
        if (fromTarget === 'plain') {
            JITPlainToClassCache.set(schema, fn);
        } else {
            JITXToClassCache.get(fromTarget)!.set(schema, fn);
        }

        return fn;
    } catch (e){
        console.log('jit code', functionCode);
        throw e;
    }
}

export function jitPlainToClass<T>(classType: ClassType<T> | ClassSchema<T>, data: any, options?: JitConverterOptions): T {
    classType = classType instanceof ClassSchema ? classType : getClassSchema(classType);
    return createXToClassFunction(classType, 'plain')(data, options);
}

export function plainToClassFactory<T>(classType: ClassType<T>) {
    return createXToClassFunction(getClassSchema(classType), 'plain');
}

export function jitClassToPlain<T>(classType: ClassType<T> | ClassSchema<T>, instance: T, options?: JitConverterOptions): Partial<T> {
    classType = classType instanceof ClassSchema ? classType : getClassSchema(classType);

    if (!(instance instanceof classType.classType)) {
        throw new Error(`Could not classToPlain since target is not a class instance of ${getClassName(classType)}`);
    }

    return createClassToXFunction(classType, 'plain')(instance, options);
}

export function jitPartial<T, R extends object>(
    fromFormat: string,
    toFormat: string,
    classType: ClassType<T>,
    partial: R,
    options?: JitConverterOptions
): { [F in keyof R]?: any } {
    const result: Partial<{ [F in keyof R]: any }> = {};
    const jitConverter = new JitPropertyConverter(fromFormat, toFormat, classType, options);

    for (const i in partial) {
        if (!partial.hasOwnProperty(i)) continue;
        jitConverter.convert(i, partial[i], result);
    }

    return result;
}

export function jitPartialClassToPlain<T, R extends object>(
    classType: ClassType<T>,
    partial: R,
    options?: JitConverterOptions
): { [F in keyof R]?: any } {
    return jitPartial('class', 'plain', classType, partial, options);
}

export function jitPartialPlainToClass<T, R extends object>(
    classType: ClassType<T>,
    partial: R,
    options?: JitConverterOptions
): { [F in keyof R]?: any } {
    return jitPartial('plain', 'class', classType, partial, options);
}
