/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassSchema, getClassSchema, getGlobalStore, PropertySchema, UnpopulatedCheck } from './model';
import { isExcluded } from './mapper';
import { ClassType, toFastProperties } from '@deepkit/core';
import { getDataConverterJS, reserveVariable } from './serializer-compiler';
import { Serializer } from './serializer';

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

const resolvedReflectionCaches = new Map<ClassType, { [path: string]: PropertySchema }>();

/**
 * This resolves the PropertySchema for a property path.
 *
 * A property path can be a deep path, separated with dots. This function makes sure to return the
 * correct PropertySchema so that a correct compiler can be built to convert this type.
 */
export function resolvePropertySchema<T>(schema: ClassSchema<T>, propertyPath: string): PropertySchema {
    if (schema.getPropertiesMap().has(propertyPath)) return schema.getPropertiesMap().get(propertyPath)!;

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
                    return cache[propertyPath] = resolvePropertySchema(
                        getClassSchema(prop.getSubType().getResolvedClassType()),
                        names.slice(i + 2).join('.')
                    );
                } else if (names[i + 1]) {
                    //we got a name or array index
                    return cache[propertyPath] = prop.getSubType();
                }
            } else {
                if (names[i + 1]) {
                    //we got a name or array index
                    return cache[propertyPath] = prop.getSubType();
                }
            }
        } else {
            if (prop.type === 'class') {
                return cache[propertyPath] = resolvePropertySchema(getClassSchema(prop.getResolvedClassType()), names.slice(i + 1).join('.'));
            } else {
                //`Property ${getClassPropertyName(classType, name)} is not an array or map, so can not resolve ${propertyPath}.`
                throw new Error(`Invalid path ${propertyPath} in class ${schema.getClassName()}.`);
            }
        }
    }

    throw new Error(`Invalid path ${propertyPath} in class ${schema.getClassName()}.`);
}

export interface JitConverterOptions {
    /**
     * Which groups to include. If a property is not assigned to
     * a given group, it will be excluded.
     * Use an empty array to include only non-grouped properties.
     */
    groups?: string[];

    /**
     * Which groups to exclude. If a property is assigned to at least
     * one given group, it will be excluded. Basically the opposite of
     * `groups`, but you can combine both.
     * Use an empty array to exclude only non-grouped properties.
     */
    groupsExclude?: string[];

    /**
     * When target is class instance and a property has @ParentReference you can
     * pass instances so the reference can be resolved, for cases
     * where its impossible to resolve otherwise.
     */
    parents?: any[];
}

export function getPropertyClassToXFunction(
    property: PropertySchema,
    serializer: Serializer
): (value: any, options?: JitConverterOptions) => any {
    const jit = property.jit;
    let fn = jit[serializer.fromClassSymbol];
    if (fn) return fn;

    jit[serializer.fromClassSymbol] = createPropertyClassToXFunction(property, serializer);
    toFastProperties(jit);
    return jit[serializer.fromClassSymbol];
}

export function getPropertyXtoClassFunction(
    property: PropertySchema,
    serializer: Serializer
): (value: any, parents?: any[], options?: JitConverterOptions) => any {
    const jit = property.jit;
    let fn = jit[serializer.toClassSymbol];
    if (fn) return fn;

    jit[serializer.toClassSymbol] = createPropertyXToClassFunction(property, serializer);
    toFastProperties(jit);
    return jit[serializer.toClassSymbol];
}

/**
 * Creates a new JIT compiled function to convert given property schema. Deep paths are not allowed.
 */
export function createPropertyClassToXFunction(
    property: PropertySchema,
    serializer: Serializer
): (value: any, parents?: any[]) => any {
    const context = new Map<any, any>();
    const jitStack = new JitStack();

    const line = getDataConverterJS('result', '_value', property, serializer.fromClass, context, jitStack);

    const functionCode = `
        return function(_value, _options, _stack, _depth) {
            var result;
            //createJITConverterFromPropertySchema ${property.name} ${property.type}
            ${line}
            return result;
        }
        `;

    const compiled = new Function(...context.keys(), functionCode);
    return compiled.bind(undefined, ...context.values())();
}

/**
 * Creates a new JIT compiled function to convert given property schema. Deep paths are not allowed.
 */
export function createPropertyXToClassFunction(
    property: PropertySchema,
    serializer: Serializer
): (value: any, parents?: any[], options?: JitConverterOptions) => any {
    const context = new Map<any, any>();
    const jitStack = new JitStack();

    const line = getDataConverterJS('result', '_value', property, serializer.toClass, context, jitStack);

    const functionCode = `
        return function(_value, _parents, _options) {
            var result, _state;
            function getParents() {
                return _parents;
            }
            if (!_parents) _parents = [];
            //createJITConverterFromPropertySchema ${property.name} ${property.type}
            ${line}
            return result;
        }
        `;

    const compiled = new Function(...context.keys(), functionCode);
    return compiled.bind(undefined, ...context.values())();
}

export function getParentResolverJS<T>(
    schema: ClassSchema<T>,
    setter: string,
    property: PropertySchema,
    context: Map<string, any>
): string {
    context.set('findParent', findParent);
    const varClassType = reserveVariable(context);
    context.set(varClassType, property.resolveClassType);

    const code = `${setter} = findParent(_parents, ${varClassType});`;

    if (property.isUndefinedAllowed()) {
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

    if (options.groupsExclude) {
        if (options.groupsExclude.length === 0 && groupNames.length === 0) {
            return false;
        }
        for (const group of options.groupsExclude) {
            if (groupNames.includes(group)) {
                return false;
            }
        }
    }

    if (options.groups) {
        if (options.groups.length === 0 && groupNames.length === 0) {
            return true;
        }
        for (const group of options.groups) {
            if (groupNames.includes(group)) {
                return true;
            }
        }
        return false;
    }


    return true;
}

export function createClassToXFunction<T>(schema: ClassSchema<T>, serializer: Serializer, jitStack: JitStack = new JitStack())
    : (instance: T, options?: JitConverterOptions) => any {
    const context = new Map<string, any>();
    const prepared = jitStack.prepare(schema);

    let functionCode = '';
    if (schema.decorator) {
        const property = schema.getProperty(schema.decorator);

        functionCode = `
        return function(_instance, _options, _stack, _depth) {
            var result, _state;
            ${getDataConverterJS(`result`, `_instance.${schema.decorator}`, property, serializer.fromClass, context, jitStack)}
            return result;
        }
        `;
    } else {
        const convertProperties: string[] = [];

        for (const property of schema.getProperties()) {
            if (property.isParentReference) continue; //we do not export parent references, as this would lead to an circular reference
            if (isExcluded(schema, property.name, serializer.name)) continue;

            let setDefault = '';
            if (property.hasManualDefaultValue() || property.type === 'literal') {
                if (property.defaultValue !== undefined) {
                    const defaultValue = reserveVariable(context, 'defaultValue', property.defaultValue);
                    setDefault = `_data.${property.name} = ${defaultValue}();`;
                } else if (property.type === 'literal' && !property.isOptional) {
                    setDefault = `_data.${property.name} = ${JSON.stringify(property.literalValue)};`;
                }
            } else if (property.isNullable) {
                setDefault = `_data.${property.name} = null;`;
            }

            convertProperties.push(`
            //${property.name}:${property.type}
            if (!_options || isGroupAllowed(_options, ${JSON.stringify(property.groupNames)})){
                if (${JSON.stringify(property.name)} in _instance) {
                    ${getDataConverterJS(`_data.${property.name}`, `_instance.${property.name}`, property, serializer.fromClass, context, jitStack)}
                } else {
                    ${setDefault}
                }
            }
            `);
        }

        let circularCheckBeginning = '';
        let circularCheckEnd = '';

        if (schema.hasCircularReference()) {
            circularCheckBeginning = `
            if (_stack) {
                if (_stack.includes(_instance)) return undefined;
            } else {
                _stack = [];
            }
            _stack.push(_instance);
            `;
            circularCheckEnd = `_stack.pop();`;
        }

        functionCode = `
        return function self(_instance, _options, _stack, _depth) {
            ${circularCheckBeginning}
            var _data = {};
            _depth = !_depth ? 1 : _depth + 1;
            var _oldUnpopulatedCheck = _global.unpopulatedCheck;
            _global.unpopulatedCheck = UnpopulatedCheckNone;
    
            ${convertProperties.join('\n')}

            _global.unpopulatedCheck = _oldUnpopulatedCheck;

            ${circularCheckEnd}

            return _data;
        }
        `;
    }

    context.set('_classType', schema.classType);
    context.set('_global', getGlobalStore());
    context.set('UnpopulatedCheckNone', UnpopulatedCheck.None);
    context.set('isGroupAllowed', isGroupAllowed);

    try {
        const compiled = new Function(...context.keys(), functionCode);
        const fn = compiled(...context.values());
        prepared(fn);
        return fn;
    } catch (error) {
        console.log('jit code', functionCode);
        throw error;
    }
}

export function getClassToXFunction<T>(schema: ClassSchema<T>, serializer: Serializer, jitStack?: JitStack)
    : (instance: T, options?: JitConverterOptions) => any {
    const jit = schema.jit;
    let fn = jit[serializer.fromClassSymbol];
    if (fn) return fn;

    jit[serializer.fromClassSymbol] = createClassToXFunction(schema, serializer, jitStack || new JitStack());
    toFastProperties(jit);
    return jit[serializer.fromClassSymbol];
}

export function getGeneratedJitFunctionFromClass(schema: ClassSchema, serializer: Serializer) {
    return schema.jit[serializer.fromClassSymbol];
}

export function getJitFunctionXToClass(schema: ClassSchema, serializer: Serializer) {
    return schema.jit[serializer.toClassSymbol];
}

export class JitStackEntry {

}

/**
 * A tracker for generated jit functions. Necessary to detect and automatically resolves circular schemas.
 */
export class JitStack {
    protected stack?: Map<ClassSchema, { fn: Function | undefined }>;
    protected schemaStack: ClassSchema[] = [];

    getStack() {
        if (!this.stack) this.stack = new Map<ClassSchema, { fn: Function | undefined }>();
        return this.stack;
    }

    has(schema: ClassSchema): boolean {
        return this.getStack().has(schema);
    }

    get(schema: ClassSchema) {
        return this.getStack().get(schema)!;
    }

    getOrCreate(schema: ClassSchema, create: () => Function): { fn: Function | undefined } {
        const stack = this.getStack();
        if (stack.has(schema)) return stack.get(schema)!;
        const entry = { fn: create() };
        stack.set(schema, entry);
        return entry;
    }

    get currentSchema(): ClassSchema | undefined {
        return this.schemaStack[this.schemaStack.length - 1];
    }

    prepare(schema: ClassSchema) {
        if (this.getStack().has(schema)) throw new Error('Circular jit building detected: ' + schema.getClassName());
        this.schemaStack.push(schema);

        const entry: { fn: Function | undefined } = { fn: undefined };
        this.getStack().set(schema, entry);
        return (fn: Function) => {
            this.schemaStack.pop();
            entry.fn = fn;
        };
    }
}

export function createXToClassFunction<T>(schema: ClassSchema<T>, serializer: Serializer, jitStack: JitStack = new JitStack())
    : (data: any, options?: JitConverterOptions, parents?: any[], state?: ToClassState) => T {

    const context = new Map<string, any>();
    const prepared = jitStack.prepare(schema);

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
                ${getDataConverterJS(`c_${property.name}`, `c_${property.name}`, property, serializer.toClass, context, jitStack,)}
            `);
        } else if (property.isParentReference) {
            //parent resolver
            constructorArguments.push(`var c_${property.name}; ` + getParentResolverJS(schema, `c_${property.name}`, property, context));
        } else {
            constructorArguments.push(`
                //constructor parameter ${property.name}
                var c_${property.name} = _data[${JSON.stringify(property.name)}];
                ${getDataConverterJS(`c_${property.name}`, `c_${property.name}`, property, serializer.toClass, context, jitStack)}
            `);
        }

        constructorArgumentNames.push(`c_${property.name}`);
    }

    for (const property of schema.getProperties()) {
        if (assignedViaConstructor[property.name]) continue;

        if (isExcluded(schema, property.name, serializer.name)) continue;

        if (property.isParentReference) {
            setProperties.push(getParentResolverJS(schema, `_instance.${property.name}`, property, context));
        } else {
            let setDefault = '';
            if (property.hasManualDefaultValue() || property.type === 'literal') {
                if (property.defaultValue !== undefined) {
                    const defaultValue = reserveVariable(context, 'defaultValue', property.defaultValue);
                    setDefault = `_instance.${property.name} = ${defaultValue}();`;
                } else if (property.type === 'literal' && !property.isOptional) {
                    setDefault = `_instance.${property.name} = ${JSON.stringify(property.literalValue)};`;
                }
            } else if (property.isNullable) {
                setDefault = `_instance.${property.name} = null;`;
            }

            setProperties.push(`
            if (!_options || isGroupAllowed(_options, ${JSON.stringify(property.groupNames)})) {
                if (${JSON.stringify(property.name)} in _data) {
                    ${getDataConverterJS(`_instance.${property.name}`, `_data.${property.name}`, property, serializer.toClass, context, jitStack)}
                } else {
                    ${setDefault}
                }
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
                //IE11 compatible way
                _state.onFullLoadCallbacks.forEach(function(cb){cb();});
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

    context.set('_classType', schema.classType);
    context.set('ToClassState', ToClassState);
    context.set('isGroupAllowed', isGroupAllowed);
    try {
        const compiled = new Function(...context.keys(), functionCode);
        const fn = compiled(...context.values());
        prepared(fn);
        return fn;
    } catch (error) {
        console.log('jit code', functionCode);
        throw error;
    }
}

export function getXToClassFunction<T>(schema: ClassSchema<T>, serializer: Serializer, jitStack?: JitStack)
    : (data: any, options?: JitConverterOptions, parents?: any[], state?: ToClassState) => T {

    const jit = schema.jit;
    let fn = jit[serializer.toClassSymbol];
    if (fn) return fn;

    jit[serializer.toClassSymbol] = createXToClassFunction(schema, serializer, jitStack || new JitStack());
    toFastProperties(jit);
    return jit[serializer.toClassSymbol];
}

export function getPartialXToClassFunction<T>(schema: ClassSchema<T>, serializer: Serializer): (data: any, options?: JitConverterOptions, parents?: any[]) => any {
    const jit = schema.jit;
    let fn = jit[serializer.partialToClassSymbol];
    if (fn) return fn;

    jit[serializer.partialToClassSymbol] = createPartialXToClassFunction(schema, serializer);
    toFastProperties(jit);
    return jit[serializer.partialToClassSymbol];
}

export function getPartialClassToXFunction<T>(schema: ClassSchema<T>, serializer: Serializer): (data: any, options?: JitConverterOptions) => any {
    const jit = schema.jit;
    let fn = jit[serializer.partialFromClassSymbol];
    if (fn) return fn;

    jit[serializer.partialFromClassSymbol] = createPartialClassToXFunction(schema, serializer);
    toFastProperties(jit);
    return jit[serializer.partialFromClassSymbol];
}

export function createPartialXToClassFunction<T>(schema: ClassSchema<T>, serializer: Serializer)
    : (data: any, options?: JitConverterOptions, parents?: any[]) => any {
    const context = new Map<string, any>();
    const jitStack = new JitStack();
    context.set('isGroupAllowed', isGroupAllowed);

    const props: string[] = [];

    for (const property of schema.getProperties()) {
        if (property.isParentReference) continue;

        props.push(`
            if (!_options || isGroupAllowed(_options, ${JSON.stringify(property.groupNames)})){
            if (_data.hasOwnProperty(${JSON.stringify(property.name)})) {
                ${getDataConverterJS(`_result.${property.name}`, `_data.${property.name}`, property, serializer.toClass, context, jitStack)}
            }
            }
        `);
    }

    const functionCode = `
        return function(_data, _options, _parents) {
            var _result = {}, _state;
            function getParents() {
                return _parents;
            }
            if (!_parents) _parents = [];

            ${props.join('\n')}
            return _result;
        }
    `;

    const compiled = new Function(...context.keys(), functionCode);
    return compiled.bind(undefined, ...context.values())();
}

export function createPartialClassToXFunction<T>(schema: ClassSchema<T>, serializer: Serializer)
    : (data: any, options?: JitConverterOptions) => any {
    const context = new Map<string, any>();
    const jitStack = new JitStack();
    context.set('isGroupAllowed', isGroupAllowed);

    const props: string[] = [];

    for (const property of schema.getProperties()) {
        if (property.isParentReference) continue;

        props.push(`
            if (!_options || isGroupAllowed(_options, ${JSON.stringify(property.groupNames)})){
            if (_data.hasOwnProperty(${JSON.stringify(property.name)})) {
                ${getDataConverterJS(`_result.${property.name}`, `_data.${property.name}`, property, serializer.fromClass, context, jitStack)}
            }
            }
        `);
    }

    context.set('_global', getGlobalStore());
    context.set('UnpopulatedCheckNone', UnpopulatedCheck.None);

    const functionCode = `
        return function(_data, _options, _stack, _depth) {
            var _result = {};
            _depth = !_depth ? 1 : _depth + 1;

            var _oldUnpopulatedCheck = _global.unpopulatedCheck;
            _global.unpopulatedCheck = UnpopulatedCheckNone;
    
            ${props.join('\n')}
            
            _global.unpopulatedCheck = _oldUnpopulatedCheck;
            return _result;
        }
    `;

    const compiled = new Function(...context.keys(), functionCode);
    return compiled.bind(undefined, ...context.values())();
}
