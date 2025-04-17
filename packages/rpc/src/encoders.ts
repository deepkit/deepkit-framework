import { ReflectionClass, serialize, SerializedTypes, Type, TypeTuple } from '@deepkit/type';
import { ActionMode } from './model.js';
import { getBSONDeserializer, getBSONSerializer } from '@deepkit/bson';
import { ClassType } from '@deepkit/core';

export type SchemaMapping = {
    [controllerName: string]: [actionName: string, action: number, mode: ActionMode, parameters: SerializedTypes, type: SerializedTypes][]
};

export type ParsedSchemaAction = {
    action: number;
    mode: ActionMode;
    parameters: TypeTuple;
    type: Type;
};

export type ParsedSchemaMapping = { [controllerName: string]: { [actionName: string]: ParsedSchemaAction; } }

export const schemaMapping = {
    encode: getBSONSerializer<SchemaMapping>(),
    decode: getBSONDeserializer<SchemaMapping>(),
};

export function fnv1aHash(buffer: Uint8Array): number {
    let hash = 2166136261;
    for (let i = 0, len = buffer.length; i < len; i++) {
        hash ^= buffer[i];
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export type EncodedError = [
    classType: string,
    properties: { [name: string]: any },
    stack: string,
    message: string,
];

export const schemaError = {
    encode: getBSONSerializer<EncodedError>(),
    decode: getBSONDeserializer<EncodedError>(),
};

export function rpcEncodeError(error: Error | string): EncodedError {
    let classType = '';
    let stack = '';
    let properties: { [name: string]: any } = {};

    if ('string' !== typeof error) {
        const schema = ReflectionClass.from(error['constructor'] as ClassType<typeof error>);
        stack = error.stack || '';
        if (schema.name) {
            classType = schema.name;
            if (schema.getProperties().length) {
                properties = serialize(error, undefined, undefined, undefined, schema.type);
            }
        }
    }

    return [
        classType,
        properties,
        stack,
        'string' === typeof error ? error : error.message || '',
    ];
}

// export function rpcDecodeError(error: EncodedError): Error {
//     if (error.classType) {
//         const entity = typeSettings.registeredEntities[error.classType];
//         if (!entity) {
//             throw new RpcError(`Could not find an entity named ${error.classType} for an error thrown. ` +
//                 `Make sure the class is loaded and correctly defined using @entity.name(${JSON.stringify(error.classType)})`);
//         }
//         const schema = ReflectionClass.from(entity);
//         if (error.properties) {
//             const e = deserialize(error.properties, undefined, undefined, undefined, schema.type) as Error;
//             e.stack = error.stack + '\nat ___SERVER___';
//             return e;
//         }
//
//         const classType = schema.getClassType()! as ClassType<Error>;
//         return new classType(error.message);
//     }
//
//     const e = new RpcError(error.message);
//     e.stack = error.stack + '\nat ___SERVER___';
//
//     return e;
// }
//
// export function createErrorMessage(error: any, ...args: any[]): Uint8Array {
//     const extracted = rpcEncodeError(error);
//
//     return createBuffer(0);
//     // return createRpcMessage(id, RpcTypes.Error, extracted, routeType, typeOf<rpcError>());
// }
