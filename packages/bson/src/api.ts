/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { ReceiveType, ReflectionKind, Type, resolveReceiveType, validate } from '@deepkit/type';

import { getBSONDeserializer } from './deserializer.js';
import { BSONError } from './errors.js';
import { getBSONSerializer, serializeAnyObjectRuntime } from './serializer.js';

/**
 * Deserialize a BSON buffer to a typed object using the JIT deserializer.
 */
export function deserializeBSON<T>(buffer: Uint8Array, offset?: number, receiveType?: ReceiveType<T>): T {
    return getBSONDeserializer<T>(receiveType)(buffer, offset);
}

/**
 * Serialize a typed object to BSON using the JIT serializer.
 * Returns a copy of the buffer (safe to store).
 */
export function serializeBSON<T>(data: T, receiveType?: ReceiveType<T>): Uint8Array {
    const [buffer, size] = getBSONSerializer<T>(receiveType)(data);
    return buffer.slice(0, size);
}

/**
 * High-level encoder that combines BSON serialization/deserialization with validation.
 * Provides an API with encode/decode methods that validate data before processing.
 */
export function getBSONEncoder<T>(receiveType?: ReceiveType<T>) {
    const type = resolveReceiveType(receiveType);

    // BSON only supports document types. For non-object types, wrap in { v: T }.
    const isObject = type.kind === ReflectionKind.objectLiteral || type.kind === ReflectionKind.class;
    const wrapperType: Type = isObject
        ? type
        : ({
              kind: ReflectionKind.objectLiteral,
              types: [
                  {
                      kind: ReflectionKind.propertySignature,
                      name: 'v',
                      parent: undefined as any,
                      type: type,
                  },
              ],
          } as any);

    const serializer = getBSONSerializer(wrapperType as any);
    const deserializer = getBSONDeserializer(wrapperType as any);

    return {
        encode(data: T): Uint8Array {
            const result = validate(data, type);
            if (result.length > 0) {
                const err = result[0];
                throw new BSONError(err.path ? `${err.path}: ${err.message}` : err.message, 'DK-B080');
            }

            const toSerialize = isObject ? data : { v: data };
            const [buffer, size] = serializer(toSerialize);
            return buffer.slice(0, size);
        },

        decode(buffer: Uint8Array): T {
            const raw = deserializer(buffer);

            const data = isObject ? raw : (raw as any).v;

            const result = validate(data, type);
            if (result.length > 0) {
                const err = result[0];
                throw new BSONError(err.path ? `${err.path}: ${err.message}` : err.message, 'DK-B080');
            }

            return data;
        },
    };
}

/**
 * Shared buffer for untyped serialization (avoids allocation per call).
 */
let untypedBuffer = new Uint8Array(1024 * 1024); // 1MB initial
let untypedView = new DataView(untypedBuffer.buffer);

/**
 * Serialize any plain object to BSON without type information.
 * Uses runtime type detection (slower than JIT but works without types).
 */
export function serializeBSONWithoutOptimiser(data: Record<string, any>): Uint8Array {
    const size = serializeAnyObjectRuntime(untypedBuffer, untypedView, 0, data);
    return untypedBuffer.slice(0, size);
}
