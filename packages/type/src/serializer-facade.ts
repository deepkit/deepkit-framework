import { getClassTypeFromInstance } from '@deepkit/core';

import { DeepPartial } from './changes.js';
import { typeInfer } from './reflection/processor.js';
import { ReceiveType, resolveReceiveType } from './reflection/reflection.js';
import {
    ReflectionKind,
    Type,
    TypeClass,
    TypeObjectLiteral,
    findMember,
    getTypeJitContainer,
} from './reflection/type.js';
import {
    NamingStrategy,
    SerializationOptions,
    SerializeFunction,
    Serializer,
    TemplateRegistry,
    getPartialSerializeFunction,
    getSerializeFunction,
    serializer,
} from './serializer.js';
import { assert } from './typeguard.js';
import { JSONPartial, JSONSingle } from './utils.js';

/**
 * Casts/coerces a given data structure to the target data type and validates all attached validators.
 *
 * Same as validatedDeserialize().
 *
 * @throws ValidationError if casting or validation fails
 */
export function cast<T>(
    data: JSONPartial<T> | unknown,
    options?: SerializationOptions,
    serializerToUse: Serializer = serializer,
    namingStrategy?: NamingStrategy,
    type?: ReceiveType<T>,
): T {
    const fn = getSerializeFunction(resolveReceiveType(type), serializerToUse.deserializeRegistry, namingStrategy);
    const item = fn(data, options) as T;
    assert(item, undefined, type);
    return item;
}

/**
 * Same as cast but returns a ready to use function. Used to improve performance.
 */
export function castFunction<T>(
    serializerToUse: Serializer = serializer,
    namingStrategy?: NamingStrategy,
    type?: ReceiveType<T>,
): (data: JSONPartial<T> | unknown, options?: SerializationOptions) => T {
    const fn = getSerializeFunction(resolveReceiveType(type), serializerToUse.deserializeRegistry, namingStrategy);
    return (data: JSONPartial<T> | unknown, options?: SerializationOptions) => {
        const item = fn(data, options);
        assert(item, undefined, type);
        return item;
    };
}

/**
 * Deserialize given data structure from JSON data objects to JavaScript objects, without running any validators.
 *
 * Types that are already correct will be used as-is.
 *
 * ```typescript
 * interface Data {
 *     created: Date;
 * }
 *
 * const data = deserialize<Data>({created: '2009-02-13T23:31:30.123Z'});
 * //data is {created: Date(2009-02-13T23:31:30.123Z)}
 *
 * @throws ValidationError when deserialization fails.
 * ```
 */
export function deserialize<T>(
    data: JSONPartial<T> | unknown,
    options?: SerializationOptions,
    serializerToUse: Serializer = serializer,
    namingStrategy?: NamingStrategy,
    type?: ReceiveType<T>,
): T {
    const fn = getSerializeFunction(resolveReceiveType(type), serializerToUse.deserializeRegistry, namingStrategy);
    return fn(data, options) as T;
}

/**
 * Same as deserialize but returns a ready to use function. Used to improve performance.
 */
export function deserializeFunction<T>(
    serializerToUse: Serializer = serializer,
    namingStrategy?: NamingStrategy,
    type?: ReceiveType<T>,
): SerializeFunction<any, T> {
    return getSerializeFunction(resolveReceiveType(type), serializerToUse.deserializeRegistry, namingStrategy);
}

/**
 * Patch serialization for deep dot paths, e.g. `{'user.shippingAddress.street': 'abc'}`
 * If a naming strategy is used, it could be converted to `{'user.shipping_address.street': 'abc'}`.
 */
export function patch<T>(
    data: DeepPartial<T>,
    options?: SerializationOptions,
    serializerToUse: Serializer = serializer,
    namingStrategy?: NamingStrategy,
    type?: ReceiveType<T>,
): (data: JSONPartial<T> | unknown) => T {
    type = resolveReceiveType(type);
    if (type.kind !== ReflectionKind.objectLiteral && type.kind !== ReflectionKind.class)
        throw new Error('patch() only works on object literals and classes');
    return getPatchSerializeFunction(type, serializerToUse.deserializeRegistry, namingStrategy)(data, options);
}

/**
 * Create a serializer/deserializer function including validator for the given type for a patch structure.
 * This is handy for deep patch structures like e.g '{user.address.street: "new street"}'.
 */
export function getPatchSerializeFunction(
    type: TypeClass | TypeObjectLiteral,
    registry: TemplateRegistry,
    namingStrategy: NamingStrategy = new NamingStrategy(),
): (data: any, state?: SerializationOptions, patch?: { normalizeArrayIndex: boolean }) => any {
    const jitContainer = getTypeJitContainer(type);
    const id = registry.id + '_' + namingStrategy.id + '_' + 'patch';
    if (jitContainer[id]) return jitContainer[id];

    const partialSerializer = getPartialSerializeFunction(type, registry, namingStrategy);
    // const partialValidator = getValidatorFunction(registry.serializer, getPartialType(type));

    return (jitContainer[id] = function (
        data: any,
        state?: SerializationOptions,
        patch?: { normalizeArrayIndex: boolean },
    ) {
        const normalizeArrayIndex = patch?.normalizeArrayIndex ?? false;

        const result = partialSerializer(data, state);
        // disabled for the moment: we don't want to validate the patch structure yet since for database stuff it converts the structure to invalid TS representations
        // e.g. reference objects -> primary keys
        // const errors: ValidationErrorItem[] = [];
        // partialValidator(result, { errors });
        // if (errors.length) throw ValidationError.from(errors);

        outer: for (const i in data) {
            if (i.includes('.')) {
                // serialize each `i` manually.
                //e.g. user.shippingAddress.streetNo
                // path could be renamed to user.shipping_address.street_no via naming strategy
                const path = i.split('.');
                let currentType: Type = type;
                let newPath = '';
                for (const part of path) {
                    if (
                        currentType.kind === ReflectionKind.objectLiteral ||
                        currentType.kind === ReflectionKind.class
                    ) {
                        const next = findMember(part, currentType.types);
                        if (!next) continue outer;
                        if (next.kind === ReflectionKind.method || next.kind === ReflectionKind.methodSignature)
                            continue outer;
                        if (next.kind === ReflectionKind.propertySignature || next.kind === ReflectionKind.property) {
                            newPath +=
                                (newPath ? '.' : '') + namingStrategy.getPropertyName(next, registry.serializer.name);
                        } else {
                            newPath += (newPath ? '.' : '') + part;
                        }
                        currentType = next.type;
                    } else if (currentType.kind === ReflectionKind.indexSignature) {
                        newPath += (newPath ? '.' : '') + part;
                        currentType = currentType.type;
                    } else if (currentType.kind === ReflectionKind.array) {
                        const idx = Number(part);
                        if (isNaN(idx) || idx < 0) continue outer;
                        if (normalizeArrayIndex) {
                            newPath += '[' + idx + ']';
                        } else {
                            newPath += (newPath ? '.' : '') + part;
                        }
                        currentType = currentType.type;
                    } else if (currentType.kind === ReflectionKind.tuple) {
                        const idx = Number(part);
                        if (isNaN(idx) || idx < 0 || idx >= currentType.types.length) continue outer;
                        if (normalizeArrayIndex) {
                            newPath += '[' + idx + ']';
                        } else {
                            newPath += (newPath ? '.' : '') + part;
                        }
                        currentType = currentType.types[idx].type;
                    }
                }
                if (newPath) {
                    result[newPath] = getSerializeFunction(currentType, registry, namingStrategy)(data[i], state);
                    // assert(result[newPath], undefined, currentType);
                }
            }
        }

        return result;
    });
}

/**
 * Serialize given data structure to JSON data objects (not a JSON string).
 *
 * The resulting JSON object can be stringified using JSON.stringify().
 *
 * ```typescript
 * interface Data {
 *     created: Date;
 * }
 *
 * const json = serialize<Data>({created: new Date(1234567890123)});
 * //json is {created: '2009-02-13T23:31:30.123Z'}
 *
 * const jsonString = JSON.stringify(json);
 * //jsonString is '{"created":"2009-02-13T23:31:30.123Z"}'
 * ```
 *
 * @throws ValidationError when serialization or validation fails.
 */
export function serialize<T>(
    data: T,
    options?: SerializationOptions,
    serializerToUse: Serializer = serializer,
    namingStrategy?: NamingStrategy,
    type?: ReceiveType<T>,
): JSONSingle<T> {
    const fn = getSerializeFunction(resolveReceiveType(type), serializerToUse.serializeRegistry, namingStrategy);
    return fn(data, options) as JSONSingle<T>;
}

/**
 * Same as serialize but returns a ready to use function. Used to improve performance.
 */
export function serializeFunction<T>(
    serializerToUse: Serializer = serializer,
    namingStrategy?: NamingStrategy,
    type?: ReceiveType<T>,
): SerializeFunction<T> {
    return getSerializeFunction(resolveReceiveType(type), serializerToUse.serializeRegistry, namingStrategy);
}

/**
 * Clones a class instance deeply.
 */
export function cloneClass<T>(target: T, options?: SerializationOptions): T {
    const classType = getClassTypeFromInstance(target);
    const type = typeInfer(classType);
    const serialize = getSerializeFunction(type, serializer.serializeRegistry);
    const deserialize = getSerializeFunction(type, serializer.deserializeRegistry);
    return deserialize(serialize(target, options));
}

/**
 * Tries to deserialize given data as T, and throws an error if it's not possible or validation after conversion fails.
 *
 * @deprecated use cast() instead
 *
 * @throws ValidationError when serialization or validation fails.
 */
export function validatedDeserialize<T>(
    data: any,
    options?: SerializationOptions,
    serializerToUse: Serializer = serializer,
    namingStrategy?: NamingStrategy,
    type?: ReceiveType<T>,
) {
    const fn = getSerializeFunction(resolveReceiveType(type), serializerToUse.deserializeRegistry, namingStrategy);
    const item = fn(data, options) as T;
    assert(item, undefined, type);
    return item;
}
