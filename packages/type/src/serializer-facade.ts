import { resolvePacked } from "./reflection/processor";
import { ReceiveType } from "./reflection/reflection";
import { createSerializeFunction, Serializer } from "./serializer";
import { jsonSerializer } from "./serializer-json";
import { JSONPartial } from "./utils";

export function cast<T>(data: JSONPartial<T>, serializer: Serializer = jsonSerializer, type?: ReceiveType<T>): T {
    const fn = createSerializeFunction(resolvePacked(type!), serializer.deserializeRegistry);
    return fn(data) as T;
}

export function serialize<T>(data: T, serializer: Serializer = jsonSerializer, type?: ReceiveType<T>): T {
    const fn = createSerializeFunction(resolvePacked(type!), serializer.serializeRegistry);
    return fn(data) as T;
}
