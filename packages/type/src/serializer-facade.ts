import { getClassTypeFromInstance } from '@deepkit/core';
import { ReceiveType, resolveReceiveType } from './reflection/reflection';
import { getSerializeFunction, SerializationOptions, serializer, Serializer } from './serializer';
import { JSONPartial, JSONSingle } from './utils';
import { typeInfer } from './reflection/processor';

/**
 * Casts/coerces a given data structure to the target data type.
 *
 * Same as deserialize().
 */
export function cast<T>(data: JSONPartial<T> | unknown, options?: SerializationOptions, serializerToUse: Serializer = serializer, type?: ReceiveType<T>): T {
    const fn = getSerializeFunction(resolveReceiveType(type), serializerToUse.deserializeRegistry);
    return fn(data, options) as T;
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
 * ```
 */
export function deserialize<T>(data: JSONPartial<T> | unknown, options?: SerializationOptions, serializerToUse: Serializer = serializer, type?: ReceiveType<T>): T {
    const fn = getSerializeFunction(resolveReceiveType(type), serializerToUse.deserializeRegistry);
    return fn(data, options) as T;
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
 */
export function serialize<T>(data: T, options?: SerializationOptions, serializerToUse: Serializer = serializer, type?: ReceiveType<T>): JSONSingle<T> {
    const fn = getSerializeFunction(resolveReceiveType(type), serializerToUse.serializeRegistry);
    return fn(data, options) as JSONSingle<T>;
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
