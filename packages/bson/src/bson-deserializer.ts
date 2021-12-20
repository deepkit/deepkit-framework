import { executeTemplates, getTypeJitContainer, JitStack, NamingStrategy, OuterType, ReceiveType, resolveReceiveType, TemplateRegistry, TemplateState } from '@deepkit/type';
import { CompilerContext, toFastProperties } from '@deepkit/core';
import { seekElementSize } from './continuation';
import { mongoSerializer } from './bson-serializer';
import { ParserV2 } from './bson-parser';

function createBSONDeserializer(type: OuterType, registry: TemplateRegistry, namingStrategy: NamingStrategy = new NamingStrategy(), path: string = '', jitStack: JitStack = new JitStack()) {
    const compiler = new CompilerContext();
    compiler.context.set('seekElementSize', seekElementSize);

    const state = new TemplateState('result', 'data', compiler, registry, namingStrategy, jitStack, [path]);

    const code = `
        let result;
        state = state || {};
        state.parser = data;
        ${executeTemplates(state, type)}
        return result;
    `;

    return compiler.build(code, 'data', 'state');
}

export type BSONDeserializer<T> = (bson: Uint8Array, offset?: number) => T;

/**
 * Serializes a schema instance to BSON.
 *
 * Note: The instances needs to be in the mongo format already since it does not resolve decorated properties.
 *       So call it with the result of classToMongo(Schema, item).
 */
export function getBSONDeserializer<T>(receiveType?: ReceiveType<T>): BSONDeserializer<T> {
    const type = resolveReceiveType(receiveType);

    const jit = getTypeJitContainer(type);
    if (jit.bsonDeserializer) return jit.bsonDeserializer;

    const deserializer = createBSONDeserializer(type, mongoSerializer.bsonDeserializeRegistry);
    jit.bsonDeserializer = function (bson: Uint8Array, offset: number = 0) {
        const parser = new ParserV2(bson, offset);
        return deserializer(parser);
    };
    toFastProperties(jit);
    return jit.bsonDeserializer;
}

export function deserializeBSON<T>(data: Uint8Array, offset?: number, receiveType?: ReceiveType<T>): T {
    return getBSONDeserializer(receiveType)(data, offset) as T;
}
