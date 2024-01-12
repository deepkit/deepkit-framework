/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { CompilerContext, isObject, toFastProperties } from '@deepkit/core';
import { typeSettings, UnpopulatedCheck } from './core.js';
import { ReflectionClass, ReflectionProperty } from './reflection/reflection.js';
import { ContainerAccessor, executeTemplates, noopTemplate, serializer, Serializer, TemplateRegistry, TemplateState } from './serializer.js';
import { PrimaryKeyFields, ReflectionKind } from './reflection/type.js';

function createJITConverterForSnapshot(
    schema: ReflectionClass<any>,
    properties: ReflectionProperty[],
    registry: TemplateRegistry,
) {
    const compiler = new CompilerContext();
    const setProperties: string[] = [];
    const state = new TemplateState('', '', compiler, registry);

    for (const property of properties) {
        // if (isExcluded(schema, property.name, 'json')) continue;
        const accessor = new ContainerAccessor('_value', JSON.stringify(property.getNameAsString()));
        const setter = new ContainerAccessor('_result', JSON.stringify(property.getNameAsString()));

        if (property.isReference()) {
            const referenceCode: string[] = [];

            for (const pk of property.getResolvedReflectionClass().getPrimaries()) {
                const deepAccessor = new ContainerAccessor(accessor, JSON.stringify(pk.getNameAsString()));
                const deepSetter = new ContainerAccessor(setter, JSON.stringify(pk.getNameAsString()));

                referenceCode.push(`
                //createJITConverterForSnapshot ${property.getNameAsString()}->${pk.getNameAsString()} class:snapshot:${property.type.kind} reference
                ${executeTemplates(state.fork(deepSetter, deepAccessor), pk.type)}
                `);
            }

            setProperties.push(`
            //createJITConverterForSnapshot ${property.getNameAsString()} class:snapshot:${property.getKind()} reference
            if (undefined === ${accessor} || null === ${accessor}) {
                ${setter} = null;
            } else {
                ${setter} = {};
                ${referenceCode.join('\n')}
            }
            `);
            continue;
        }

        setProperties.push(`
            //createJITConverterForSnapshot ${property.getNameAsString()} class:snapshot:${property.getKind()}
            if (undefined === ${accessor} || null === ${accessor}) {
                ${setter} = null;
            } else {
                ${executeTemplates(state.fork(setter, accessor), property.type)}
            }
        `);
    }

    let circularCheckBeginning = '';
    let circularCheckEnd = '';

    if (schema.hasCircularReference()) {
        circularCheckBeginning = `
        if (state._stack) {
            if (state._stack.includes(_value)) return undefined;
        } else {
            state._stack = [];
        }
        state._stack.push(_value);
        `;
        circularCheckEnd = `state._stack.pop();`;
    }

    const functionCode = `
        var _result = {};
        state = state || {};
        ${circularCheckBeginning}
        var oldUnpopulatedCheck = typeSettings.unpopulatedCheck;
        typeSettings.unpopulatedCheck = UnpopulatedCheckNone;
        ${setProperties.join('\n')}
        typeSettings.unpopulatedCheck = oldUnpopulatedCheck;
        ${circularCheckEnd}
        return _result;
        `;

    compiler.context.set('typeSettings', typeSettings);
    compiler.context.set('UnpopulatedCheckNone', UnpopulatedCheck.None);

    return compiler.build(functionCode, '_value', 'state');
}

function cloneValueDeep(value: any): any {
    if (Array.isArray(value)) return value.map(v => cloneValueDeep(v));
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof Set) return new Set(value);
    if (value instanceof Map) return new Map(value);
    if (value instanceof ArrayBuffer) return value.slice(0);
    if (value instanceof Uint8Array) return new Uint8Array(value);
    if (value instanceof Uint16Array) return new Uint16Array(value);
    if (value instanceof Uint32Array) return new Uint32Array(value);
    if (value instanceof Int8Array) return new Int8Array(value);
    if (value instanceof Int16Array) return new Int16Array(value);
    if (value instanceof Int32Array) return new Int32Array(value);
    if (value instanceof Float32Array) return new Float32Array(value);
    if (value instanceof Float64Array) return new Float64Array(value);
    if (value instanceof BigInt64Array) return new BigInt64Array(value);
    if (value instanceof BigUint64Array) return new BigUint64Array(value);
    if (value instanceof DataView) return new DataView(value.buffer.slice(0));
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    if (isObject(value)) {
        const copy: any = {};
        for (const i in value) {
            copy[i] = cloneValueDeep(value[i]);
        }
        return copy;
    }
    return value;
}

class SnapshotSerializer extends Serializer {
    name = 'snapshot';

    protected registerSerializers() {
        super.registerSerializers();

        //we keep bigint as is
        this.serializeRegistry.register(ReflectionKind.bigint, noopTemplate);
        this.deserializeRegistry.register(ReflectionKind.bigint, noopTemplate);

        //any is cloned as is
        this.serializeRegistry.register(ReflectionKind.any, (type, state) => {
            state.setContext({ cloneValueDeep });
            state.addSetter(`cloneValueDeep(${state.accessor})`);
        });
    }
}


export const snapshotSerializer = new SnapshotSerializer;

/**
 * Creates a new JIT compiled function to convert the class instance to a snapshot.
 * A snapshot is essentially the class instance as `plain` serialization while references are
 * stored only as their primary keys.
 *
 * Generated function is cached.
 */
export function getConverterForSnapshot(
    reflectionClass: ReflectionClass<any>
): (value: any) => any {
    const jit = reflectionClass.getJitContainer();
    if (jit.snapshotConverter) return jit.snapshotConverter;

    jit.snapshotConverter = createJITConverterForSnapshot(reflectionClass, reflectionClass.getProperties(), snapshotSerializer.serializeRegistry);
    toFastProperties(jit);
    return jit.snapshotConverter;
}

/**
 * Creates a snapshot using getConverterForSnapshot().
 */
export function createSnapshot<T>(reflectionClass: ReflectionClass<T>, item: T) {
    return getConverterForSnapshot(reflectionClass)(item);
}

/**
 * Extracts the primary key of a snapshot and converts to class type.
 */
export function getPrimaryKeyExtractor<T>(
    reflectionClass: ReflectionClass<T>
): (value: any) => Partial<T> {
    const jit = reflectionClass.getJitContainer();
    if (jit.primaryKey) return jit.primaryKey;

    jit.primaryKey = createJITConverterForSnapshot(reflectionClass, reflectionClass.getPrimaries(), snapshotSerializer.deserializeRegistry);
    toFastProperties(jit);
    return jit.primaryKey;
}

/**
 * Creates a primary key hash generator that takes an item from any format
 * converts it to class format, then to plain, then uses the primitive values to create a string hash.
 *
 * This function is designed to work on the plain values (db records or json values)
 */
export function getPrimaryKeyHashGenerator(
    reflectionClass: ReflectionClass<any>,
    serializerToUse: Serializer = serializer
): (value: any) => string {
    const jit = reflectionClass.getJitContainer();

    if (!jit.pkHash) {
        jit.pkHash = {};
        toFastProperties(jit);
    }

    if (jit.pkHash[serializerToUse.name]) return jit.pkHash[serializerToUse.name];

    jit.pkHash[serializerToUse.name] = createPrimaryKeyHashGenerator(reflectionClass, serializerToUse);
    toFastProperties(jit.pkHash);
    return jit.pkHash[serializerToUse.name];
}

// export function getForeignKeyHash(row: any, property: PropertySchema): string {
//     const foreignSchema = property.getResolvedClassSchema();
//     return getPrimaryKeyHashGenerator(foreignSchema)(row[property.name]);
// }

function simplePrimaryKeyHash(value: any): string {
    return '\0' + value;
}

export function getSimplePrimaryKeyHashGenerator(reflectionClass: ReflectionClass<any>) {
    const primary = reflectionClass.getPrimary();
    return (data: PrimaryKeyFields<any>) => simplePrimaryKeyHash(data[primary.name]);
}

function createPrimaryKeyHashGenerator(
    reflectionClass: ReflectionClass<any>,
    serializer: Serializer
) {
    const context = new CompilerContext();
    const setProperties: string[] = [];
    context.context.set('isObject', isObject);

    const state = new TemplateState('', '', context, serializer.serializeRegistry);

    for (const property of reflectionClass.getPrimaries()) {
        // if (property.isParentReference) continue;

        const accessor = new ContainerAccessor('_value', JSON.stringify(property.getNameAsString()));

        if (property.isReference()) {
            const referenceCode: string[] = [];

            for (const pk of property.getResolvedReflectionClass().getPrimaries()) {
                if (pk.type.kind === ReflectionKind.class && pk.type.types.length) {
                    throw new Error(`Class as primary key (${property.getResolvedReflectionClass().getClassName()}.${pk.getNameAsString()}) is not supported`);
                }

                const deepAccessor = new ContainerAccessor(accessor, JSON.stringify(pk.getNameAsString()));

                referenceCode.push(`
                //getPrimaryKeyExtractor ${property.getNameAsString()}->${pk.getNameAsString()} class:snapshot:${property.getKind()} reference
                lastValue = '';
                if (${deepAccessor} !== null && ${deepAccessor} !== undefined) {
                    ${executeTemplates(state.fork('lastValue', deepAccessor).forRegistry(serializer.deserializeRegistry), pk.type)}
                    ${executeTemplates(state.fork('lastValue', 'lastValue'), pk.type)}
                }
                _result += '\\0' + lastValue;
                `);
            }

            setProperties.push(`
            //getPrimaryKeyExtractor ${property.getNameAsString()} class:snapshot:${property.getKind()} reference
            if (undefined !== ${accessor} && null !== ${accessor}) {
                if (isObject(${accessor})) {
                    ${referenceCode.join('\n')}
                } else {
                    //might be a primary key directly
                    lastValue = '';
                    ${executeTemplates(state.fork('lastValue', accessor).forRegistry(serializer.deserializeRegistry), property.getResolvedReflectionClass().getPrimary().type)}
                    ${executeTemplates(state.fork('lastValue', 'lastValue'), property.getResolvedReflectionClass().getPrimary().type)}
                    _result += '\\0' + lastValue;
                    }
            } else {
                _result += '\\0';
            }
            `);
            continue;
        }

        if (property.type.kind === ReflectionKind.class && property.type.types.length) {
            throw new Error(`Class as primary key (${reflectionClass.getClassName()}.${property.getNameAsString()}) is not supported`);
        }

        setProperties.push(`
            //getPrimaryKeyHashGenerator ${property.getNameAsString()} class:plain:${property.getKind()}
            lastValue = '';
            if (${accessor} !== null && ${accessor} !== undefined) {
                ${executeTemplates(state.fork('lastValue', accessor).forRegistry(serializer.deserializeRegistry), property.type)}
                ${executeTemplates(state.fork('lastValue', 'lastValue'), property.type)}
            }
            _result += '\\0' + lastValue;
        `);
    }

    let circularCheckBeginning = '';
    let circularCheckEnd = '';

    if (reflectionClass.hasCircularReference()) {
        circularCheckBeginning = `
        if (state._stack) {
            if (state._stack.includes(_value)) return undefined;
        } else {
            state._stack = [];
        }
        state._stack.push(_value);
        `;
        circularCheckEnd = `state._stack.pop();`;
    }

    const functionCode = `
        var _result = '';
        var lastValue;
        state = state || {};
        ${circularCheckBeginning}
        ${setProperties.join('\n')}
        ${circularCheckEnd}
        return _result;
    `;

    return context.build(functionCode, '_value', 'state');
}
