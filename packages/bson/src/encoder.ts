import {
    getTypeJitContainer,
    getValidatorFunction,
    ReflectionKind,
    Type,
    TypeObjectLiteral,
    TypePropertySignature,
    ValidationError,
    ValidationErrorItem,
} from '@deepkit/type';
import { getBSONDeserializer } from './bson-deserializer.js';
import { BSONSerializer, BSONSerializerState, getBSONSerializer } from './bson-serializer.js';

interface TypeEncoder {
    encode: BSONSerializer;

    decode(v: Uint8Array, offset?: number): any;
}

interface Options {
    validation: boolean;
}

/**
 * Provides a BSON encoder/decoder for the given type and wraps it into a {v: type} object if necessary.
 * This is necessary because BSON only supports objects/arrays at the top level.
 *
 * This abstraction also calls validation on the decoded and encoded values.
 */
export function getBsonEncoder(type: Type, options: Partial<Options> = {}): TypeEncoder {
    options = Object.assign({ validation: true }, options) as Options;

    const container = getTypeJitContainer(type);
    if (container.bsonEncoder) return container.bsonEncoder;

    const standaloneType = type.kind === ReflectionKind.objectLiteral || (type.kind === ReflectionKind.class && type.types.length);

    const validator = getValidatorFunction(undefined, type);
    const validate = options.validation ? (data: any) => {
        const errors: ValidationErrorItem[] = [];
        validator(data, { errors });
        if (errors.length) {
            throw new ValidationError(errors, type);
        }
        return data;
    } : (data: any) => data;

    if (!standaloneType) {
        //BSON only supports objects, so we wrap it into a {v: type} object.
        const wrappedType: TypeObjectLiteral = {
            kind: ReflectionKind.objectLiteral,
            types: [{
                kind: ReflectionKind.propertySignature,
                name: 'v',
                type: type,
            } as TypePropertySignature],
        };

        const decoder = getBSONDeserializer<any>(undefined, wrappedType);
        const encoder = getBSONSerializer(undefined, wrappedType);

        return container.bsonEncoder = {
            decode: (v: Uint8Array, offset: number = 0) => validate(decoder(v, offset).v),
            encode: (v: any, state?: BSONSerializerState) => encoder({ v: validate(v) }, state),
        };
    }

    const decoder = getBSONDeserializer<any>(undefined, type);
    const encoder = getBSONSerializer(undefined, type);

    return container.bsonEncoder = {
        decode: (v: Uint8Array, offset: number = 0) => validate(decoder(v, offset)),
        encode: (v: any, state?: BSONSerializerState) => encoder(validate(v), state),
    };
}
