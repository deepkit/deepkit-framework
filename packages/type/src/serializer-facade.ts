import { getClassTypeFromInstance } from '@deepkit/core';
import { resolvePacked } from './reflection/processor';
import { ReceiveType } from './reflection/reflection';
import { createSerializeFunction, SerializationOptions, Serializer } from './serializer';
import { jsonSerializer } from './serializer-json';
import { JSONPartial } from './utils';
import { typeInfer } from './reflection/type';

export function cast<T>(data: JSONPartial<T> | unknown, options?: SerializationOptions, serializer: Serializer = jsonSerializer, type?: ReceiveType<T>): T {
    const fn = createSerializeFunction(resolvePacked(type!), serializer.deserializeRegistry);
    return fn(data, options) as T;
}

export function deserialize<T>(data: JSONPartial<T> | unknown, options?: SerializationOptions, serializer: Serializer = jsonSerializer, type?: ReceiveType<T>): T {
    const fn = createSerializeFunction(resolvePacked(type!), serializer.deserializeRegistry);
    return fn(data, options) as T;
}

export function serialize<T>(data: T, options?: SerializationOptions, serializer: Serializer = jsonSerializer, type?: ReceiveType<T>): T {
    const fn = createSerializeFunction(resolvePacked(type!), serializer.serializeRegistry);
    return fn(data, options) as T;
}

/**
 * Clones a class instance deeply.
 */
export function cloneClass<T>(target: T, options?: SerializationOptions): T {
    const classType = getClassTypeFromInstance(target);
    const type = typeInfer(classType);
    const serializer = createSerializeFunction(type, jsonSerializer.serializeRegistry);
    const deserializer = createSerializeFunction(type, jsonSerializer.deserializeRegistry);
    return deserializer(serializer(target, options));
}
