import { resolvePacked } from "./reflection/processor";
import { ReceiveType } from "./reflection/reflection";
import { createSerializeFunction, SerializationOptions, Serializer } from './serializer';
import { jsonSerializer } from "./serializer-json";
import { JSONPartial } from "./utils";

export function cast<T>(data: JSONPartial<T> | unknown, options?: SerializationOptions, serializer: Serializer = jsonSerializer, type?: ReceiveType<T>): T {
    const fn = createSerializeFunction(resolvePacked(type!), serializer.deserializeRegistry);
    return fn(data, options) as T;
}

export const deserialize = cast;

export function serialize<T>(data: T, options?: SerializationOptions, serializer: Serializer = jsonSerializer, type?: ReceiveType<T>): T {
    const fn = createSerializeFunction(resolvePacked(type!), serializer.serializeRegistry);
    return fn(data, options) as T;
}
