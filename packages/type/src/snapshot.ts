/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { CompilerContext, toFastProperties } from '@deepkit/core';
import { JitStack } from './jit';
import { jsonSerializer } from './json-serializer';
import { isExcluded } from './mapper';
import { ClassSchema, getGlobalStore, PropertySchema, UnpopulatedCheck } from './model';
import { Serializer, SerializerCompilers } from './serializer';
import { getDataConverterJS } from './serializer-compiler';
import { arrayBufferToBase64, base64ToArrayBuffer, base64ToTypedArray, typedArrayToBase64 } from './core';


function createJITConverterForSnapshot(
    schema: ClassSchema,
    properties: PropertySchema[],
    serializerCompilers: SerializerCompilers,
) {
    const compiler = new CompilerContext();
    const jitStack = new JitStack();
    const setProperties: string[] = [];

    for (const property of properties) {
        if (property.isParentReference) continue;

        if (isExcluded(schema, property.name, 'json')) continue;

        if (property.isReference) {
            const referenceCode: string[] = [];

            for (const pk of property.getResolvedClassSchema().getPrimaryFields()) {
                referenceCode.push(`
                //createJITConverterForSnapshot ${property.name}->${pk.name} class:snapshot:${property.type} reference
                ${getDataConverterJS(`_result.${property.name}.${pk.name}`, `_value.${property.name}.${pk.name}`, pk, serializerCompilers, compiler, jitStack)}
                `);
            }

            setProperties.push(`
            //createJITConverterForSnapshot ${property.name} class:snapshot:${property.type} reference
            if (undefined === _value.${property.name}) {
                _result.${property.name} = null;
            } else if (null === _value.${property.name}) {
                _result.${property.name} = null;
            } else {
                _result.${property.name} = {};
                ${referenceCode.join('\n')}
            }
            `);
            continue;
        }

        setProperties.push(`
            //createJITConverterForSnapshot ${property.name} class:snapshot:${property.type}
            ${getDataConverterJS(
            `_result.${property.name}`, `_value.${property.name}`, property, serializerCompilers, compiler, jitStack,
            `_result.${property.name} = null`, `_result.${property.name} = null`,
        )}
            `);
    }

    let circularCheckBeginning = '';
    let circularCheckEnd = '';

    if (schema.hasCircularReference()) {
        circularCheckBeginning = `
        if (_stack) {
            if (_stack.includes(_value)) return undefined;
        } else {
            _stack = [];
        }
        _stack.push(_value);
        `;
        circularCheckEnd = `_stack.pop();`;
    }

    const functionCode = `
        ${circularCheckBeginning}
        var _result = {};
        var oldUnpopulatedCheck = _global.unpopulatedCheck;
        _global.unpopulatedCheck = UnpopulatedCheckNone;
        ${setProperties.join('\n')}
        _global.unpopulatedCheck = oldUnpopulatedCheck;
        ${circularCheckEnd}
        return _result;
        `;

    compiler.context.set('_global', getGlobalStore());
    compiler.context.set('UnpopulatedCheckNone', UnpopulatedCheck.None);

    const fn = compiler.build(functionCode, '_value', '_parents', '_options', '_stack', '_depth');
    fn.buildId = schema.buildId;
    return fn;
}

export const snapshotSerializer = new class extends jsonSerializer.fork('snapshot') {
    constructor() {
        super();

        //we keep bigint as is
        this.fromClass.noop('bigint');
        this.toClass.noop('bigint');

        //convert binary to base64 (instead of hex, important for primary key hash)
        this.fromClass.registerForBinary((property, compiler) => {
            if (property.type === 'arrayBuffer') {
                compiler.setContext({ arrayBufferToBase64 });
                compiler.addSetter(`${compiler.accessor} instanceof ArrayBuffer ? arrayBufferToBase64(${compiler.accessor}) : null`);
                return;
            }
            compiler.setContext({ typedArrayToBase64 });
            compiler.addSetter(`${compiler.accessor} instanceof ${property.type} ? typedArrayToBase64(${compiler.accessor}) : null`);
        });

        this.toClass.registerForBinary((property, compiler) => {
            if (property.type === 'arrayBuffer') {
                compiler.setContext({ base64ToArrayBuffer });
                compiler.addSetter(`base64ToArrayBuffer(${compiler.accessor})`);
                return;
            }

            compiler.setContext({ base64ToTypedArray });
            compiler.addSetter(`base64ToTypedArray(${compiler.accessor}, ${property.type})`);
        });
    }
};

/**
 * Creates a new JIT compiled function to convert the class instance to a snapshot.
 * A snapshot is essentially the class instance as `plain` serialization while references are
 * stored only as their primary keys.
 *
 * Generated function is cached.
 */
export function getConverterForSnapshot(
    classSchema: ClassSchema
): (value: any) => any {
    const jit = classSchema.jit;
    if (jit.snapshotConverter) return jit.snapshotConverter;

    jit.snapshotConverter = createJITConverterForSnapshot(classSchema, classSchema.getProperties(), snapshotSerializer.fromClass);
    toFastProperties(jit);
    return jit.snapshotConverter;
}

/**
 * Creates a snapshot using getConverterForSnapshot().
 */
export function createSnapshot<T>(classSchema: ClassSchema<T>, item: T) {
    return getConverterForSnapshot(classSchema)(item);
}

/**
 * Extracts the primary key of JSONPartial (snapshot) and converts to class type.
 */
export function getPrimaryKeyExtractor<T>(
    classSchema: ClassSchema<T>
): (value: any) => Partial<T> {
    const jit = classSchema.jit;
    if (jit.primaryKey) return jit.primaryKey;

    jit.primaryKey = createJITConverterForSnapshot(classSchema, classSchema.getPrimaryFields(), snapshotSerializer.toClass);
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
    classSchema: ClassSchema,
    serializer: Serializer = jsonSerializer
): (value: any) => string {
    const jit = classSchema.jit;

    if (!jit.pkHash) {
        jit.pkHash = {};
        toFastProperties(jit);
    }

    if (jit.pkHash[serializer.name]) return jit.pkHash[serializer.name];

    jit.pkHash[serializer.name] = createPrimaryKeyHashGenerator(classSchema, serializer);
    toFastProperties(jit.pkHash);
    return jit.pkHash[serializer.name];
}

// export function getForeignKeyHash(row: any, property: PropertySchema): string {
//     const foreignSchema = property.getResolvedClassSchema();
//     return getPrimaryKeyHashGenerator(foreignSchema)(row[property.name]);
// }

function simplePrimaryKeyHash(value: any): string {
    return '\0' + value;
}

export function getSimplePrimaryKeyHashGenerator(classSchema: ClassSchema) {
    return simplePrimaryKeyHash;
}

function createPrimaryKeyHashGenerator(
    schema: ClassSchema,
    serializer: Serializer
) {
    const context = new CompilerContext();
    const setProperties: string[] = [];
    const jitStack = new JitStack();

    for (const property of schema.getPrimaryFields()) {
        if (property.isParentReference) continue;

        if (property.isReference) {
            const referenceCode: string[] = [];

            for (const pk of property.getResolvedClassSchema().getPrimaryFields()) {
                if (pk.type === 'class') {
                    throw new Error(`Class as primary key (${property.getResolvedClassSchema().getClassName()}.${pk.name}) is not supported`);
                }

                referenceCode.push(`
                //getPrimaryKeyExtractor ${property.name}->${pk.name} class:snapshot:${property.type} reference
                lastValue = '';
                ${getDataConverterJS(`lastValue`, `_value.${property.name}.${pk.name}`, pk, serializer.toClass, context, jitStack)}
                ${getDataConverterJS(`lastValue`, `lastValue`, pk, snapshotSerializer.fromClass, context, jitStack)}
                _result += '\\0' + lastValue;
            `);
            }

            setProperties.push(`
            //getPrimaryKeyExtractor ${property.name} class:snapshot:${property.type} reference
            if (undefined !== _value.${property.name} && null !== _value.${property.name}) {
                ${referenceCode.join('\n')}
            } else {
                _result += '\\0';
            }
            `);
            continue;
        }

        if (property.type === 'class') {
            throw new Error(`Class as primary key (${schema.getClassName()}.${property.name}) is not supported`);
        }

        setProperties.push(`
            //getPrimaryKeyHashGenerator ${property.name} class:plain:${property.type}
            lastValue = '';
            ${getDataConverterJS(`lastValue`, `_value.${property.name}`, property, serializer.toClass, context, jitStack)}
            ${getDataConverterJS(`lastValue`, `lastValue`, property, snapshotSerializer.fromClass, context, jitStack)}
            _result += '\\0' + lastValue;
        `);
    }

    let circularCheckBeginning = '';
    let circularCheckEnd = '';

    if (schema.hasCircularReference()) {
        circularCheckBeginning = `
        if (_stack) {
            if (_stack.includes(_value)) return undefined;
        } else {
            _stack = [];
        }
        _stack.push(_value);
        `;
        circularCheckEnd = `_stack.pop();`;
    }

    const functionCode = `
        var _result = '';
        var lastValue;
        ${circularCheckBeginning}
        ${setProperties.join('\n')}
        ${circularCheckEnd}
        return _result;
    `;

    const fn = context.build(functionCode, '_value', '_stack');
    fn.buildId = schema.buildId;
    return fn;
}
