import { getClassTypeFromInstance } from '@deepkit/core';
import { ReceiveType, resolveReceiveType } from './reflection/reflection.js';
import { getSerializeFunction, NamingStrategy, SerializationOptions, serializer, Serializer } from './serializer.js';
import { JSONPartial, JSONSingle } from './utils.js';
import { typeInfer } from './reflection/processor.js';
import { assert } from './typeguard.js';

/**
 * Casts/coerces a given data structure to the target data type and validates all attached validators.
 *
 * Same as validatedDeserialize().
 *
 * @throws ValidationError if casting or validation fails
 */
export function cast<T>(data: JSONPartial<T> | unknown, options?: SerializationOptions, serializerToUse: Serializer = serializer, namingStrategy?: NamingStrategy, type?: ReceiveType<T>): T {
    const fn = getSerializeFunction(resolveReceiveType(type), serializerToUse.deserializeRegistry, namingStrategy);
    const item = fn(data, options) as T;
    assert(item, undefined, type);
    return item;
}

/**
 * Casts/coerces a given data structure to the target data type.
 *
 * Same as deserialize().
 */
export function castFunction<T>(options?: SerializationOptions, serializerToUse: Serializer = serializer, namingStrategy?: NamingStrategy, type?: ReceiveType<T>): (data: JSONPartial<T> | unknown) => T {
    const fn = getSerializeFunction(resolveReceiveType(type), serializerToUse.deserializeRegistry, namingStrategy);
    return (data: JSONPartial<T> | unknown) => fn(data, options);
}

/**
 * Deserialize given data structure from JSON data objects to JavaScript objects.
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
 * @throws ValidationError when serialization or validation fails.
 * ```
 */
export function deserialize<T>(data: JSONPartial<T> | unknown, options?: SerializationOptions, serializerToUse: Serializer = serializer, namingStrategy?: NamingStrategy, type?: ReceiveType<T>): T {
    const fn = getSerializeFunction(resolveReceiveType(type), serializerToUse.deserializeRegistry, namingStrategy);
    return fn(data, options) as T;
}

/**
 * Same as deserialize but returns a ready to use function. Used to improve performance.
 */
export function deserializeFunction<T>(options?: SerializationOptions, serializerToUse: Serializer = serializer, namingStrategy?: NamingStrategy, type?: ReceiveType<T>): (data: JSONPartial<T> | unknown) => T {
    return getSerializeFunction(resolveReceiveType(type), serializerToUse.deserializeRegistry, namingStrategy);
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
export function serialize<T>(data: T, options?: SerializationOptions, serializerToUse: Serializer = serializer, namingStrategy?: NamingStrategy, type?: ReceiveType<T>): JSONSingle<T> {
    const fn = getSerializeFunction(resolveReceiveType(type), serializerToUse.serializeRegistry, namingStrategy);
    return fn(data, options) as JSONSingle<T>;
}

/**
 * Same as serialize but returns a ready to use function. Used to improve performance.
 */
export function serializeFunction<T>(options?: SerializationOptions, serializerToUse: Serializer = serializer, namingStrategy?: NamingStrategy, type?: ReceiveType<T>): (data: T) => any {
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
 * @throws ValidationError when serialization or validation fails.
 */
export function validatedDeserialize<T>(data: any, options?: SerializationOptions, serializerToUse: Serializer = serializer, namingStrategy?: NamingStrategy, type?: ReceiveType<T>) {
    const fn = getSerializeFunction(resolveReceiveType(type), serializerToUse.deserializeRegistry, namingStrategy);
    const item = fn(data, options) as T;
    assert(item, undefined, type);
    return item;
}
