import {ClassSchema, getDataConverterJS, getGlobalStore, JitStack, jsonSerializer, PropertySchema, Serializer, SerializerCompilers, UnpopulatedCheck} from '@deepkit/type';
import {toFastProperties} from '@deepkit/core';

function createJITConverterForSnapshot(
    classSchema: ClassSchema,
    properties: Iterable<PropertySchema>,
    serializerCompilers: SerializerCompilers
) {
    const context = new Map<any, any>();
    const jitStack = new JitStack();
    const setProperties: string[] = [];

    for (const property of properties) {
        if (property.isParentReference) continue;

        if (property.isReference) {
            const referenceCode: string[] = [];

            for (const pk of property.getResolvedClassSchema().getPrimaryFields()) {
                referenceCode.push(`
                //createJITConverterForSnapshot ${property.name}->${pk.name} class:snapshot:${property.type} reference
                ${getDataConverterJS(`_result.${property.name}.${pk.name}`, `_value.${property.name}.${pk.name}`, pk, serializerCompilers, context, jitStack)}
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
            `_result.${property.name}`, `_value.${property.name}`, property, serializerCompilers, context, jitStack,
            `_result.${property.name} = null`, `_result.${property.name} = null`,
        )}
            `);
    }

    const functionCode = `
        return function(_value, _parents, _options) {
            var _result = {};
            var oldUnpopulatedCheck = _global.unpopulatedCheck;
            _global.unpopulatedCheck = UnpopulatedCheckNone;
            ${setProperties.join('\n')}
            _global.unpopulatedCheck = oldUnpopulatedCheck;
            return _result;
        }
        `;


    context.set('_global', getGlobalStore());
    context.set('UnpopulatedCheckNone', UnpopulatedCheck.None);

    const compiled = new Function(...context.keys(), functionCode);
    const fn = compiled.bind(undefined, ...context.values())();
    fn.buildId = classSchema.buildId;
    return fn;
}

/**
 * Creates a new JIT compiled function to convert the class instance to a snapshot.
 * A snapshot is essentially the class instance as `plain` serialization while references are
 * stored only as their primary keys.
 *
 * Generated function is cached.
 */
export function getJITConverterForSnapshot(
    classSchema: ClassSchema
): (value: any) => any {
    const jit = classSchema.jit;
    if (jit.snapshotConverter) return jit.snapshotConverter;

    jit.snapshotConverter = createJITConverterForSnapshot(classSchema, classSchema.getClassProperties().values(), jsonSerializer.fromClass);
    toFastProperties(jit);
    return jit.snapshotConverter;
}

/**
 * Extracts the primary key of JSONPartial (snapshot) and converts to class type.
 */
export function getPrimaryKeyExtractor<T>(
    classSchema: ClassSchema<T>
): (value: any) => Partial<T> {
    const jit = classSchema.jit;
    if (jit.primaryKey) return jit.primaryKey;

    jit.primaryKey = createJITConverterForSnapshot(classSchema, classSchema.getPrimaryFields(), jsonSerializer.toClass);
    toFastProperties(jit);
    return jit.primaryKey;
}

/**
 * Creates a primary key hash generator that takes an item from any format
 * converts it to class format, then to plain, then uses the primitive values to create a string hash.
 */
export function getPrimaryKeyHashGenerator(
    classSchema: ClassSchema,
    serializer: Serializer
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

function simplePrimaryKeyHash(value: any): string {
    return '\0' + value;
}

export function getSimplePrimaryKeyHashGenerator(classSchema: ClassSchema) {
    return simplePrimaryKeyHash;
}

function createPrimaryKeyHashGenerator(
    classSchema: ClassSchema,
    serializer: Serializer
) {
    const context = new Map<any, any>();
    const setProperties: string[] = [];
    const jitStack = new JitStack();

    for (const property of classSchema.getPrimaryFields()) {
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
                ${getDataConverterJS(`lastValue`, `lastValue`, pk, jsonSerializer.fromClass, context, jitStack)}
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
            throw new Error(`Class as primary key (${classSchema.getClassName()}.${property.name}) is not supported`);
        }

        setProperties.push(`
            //getPrimaryKeyHashGenerator ${property.name} class:plain:${property.type}
            lastValue = '';
            ${getDataConverterJS(`lastValue`, `_value.${property.name}`, property, serializer.toClass, context, jitStack)}
            ${getDataConverterJS(`lastValue`, `lastValue`, property, jsonSerializer.fromClass, context, jitStack)}
            _result += '\\0' + lastValue;
        `);
    }

    const functionCode = `
        return function(_value) {
            var _result = '';
            var lastValue;
            ${setProperties.join('\n')}
            return _result;
        }
    `;

    const compiled = new Function(...context.keys(), functionCode);
    const fn = compiled.bind(undefined, ...context.values())();
    fn.buildId = classSchema.buildId;
    return fn;
}
