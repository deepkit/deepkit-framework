import { getTypeJitContainer, ReflectionKind, Type, TypePropertySignature } from '@deepkit/type';
import { getBSONDeserializer } from './bson-deserializer.js';
import { BSONSerializer, BSONSerializerState, getBSONSerializer } from './bson-serializer.js';

interface TypeEncoder {
    encode: BSONSerializer;

    decode(v: Uint8Array, offset?: number): any;
}

/**
 * Provides a BSON encoder/decoder for the given type and wraps it into a {v: type} object if necessary.
 * This is necessary because BSON only supports objects/arrays at the top level.
 */
export function getBsonEncoder(type: Type): TypeEncoder {
    const container = getTypeJitContainer(type);
    if (container.bsonEncoder) return container.bsonEncoder;

    const standaloneType = type.kind === ReflectionKind.objectLiteral || (type.kind === ReflectionKind.class && type.types.length);

    if (!standaloneType) {
        //BSON only supports objects, so we wrap it into a {v: type} object.
        type = {
            kind: ReflectionKind.objectLiteral,
            types: [{
                kind: ReflectionKind.propertySignature,
                name: 'v',
                type: type,
            } as TypePropertySignature],
        };

        const decoder = getBSONDeserializer<any>(undefined, type);
        const encoder = getBSONSerializer(undefined, type);

        return container.bsonEncoder = {
            decode: (v: Uint8Array, offset: number = 0) => decoder(v, offset).v,
            encode: (v: any, state?: BSONSerializerState) => encoder({ v }, state),
        };
    }

    const decoder = getBSONDeserializer<any>(undefined, type);
    const encoder = getBSONSerializer(undefined, type);

    return container.bsonEncoder = {
        decode: (v: Uint8Array, offset: number = 0) => decoder(v, offset),
        encode: encoder,
    };
}
