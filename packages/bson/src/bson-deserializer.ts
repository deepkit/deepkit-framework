import { executeTemplates, getTypeJitContainer, JitStack, NamingStrategy, ReceiveType, resolveReceiveType, TemplateState, Type } from '@deepkit/type';
import { CompilerContext, toFastProperties } from '@deepkit/core';
import { seekElementSize } from './continuation';
import { BSONBinarySerializer, bsonBinarySerializer } from './bson-serializer';
import { ParserV2 } from './bson-parser';

function createBSONDeserializer(type: Type, serializer: BSONBinarySerializer, namingStrategy: NamingStrategy = new NamingStrategy(), path: string = '', jitStack: JitStack = new JitStack()) {
    const compiler = new CompilerContext();
    compiler.context.set('seekElementSize', seekElementSize);

    const state = new TemplateState('result', '', compiler, serializer.bsonDeserializeRegistry, namingStrategy, jitStack, [path]);
    state.target = 'deserialize';

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

export function getBSONDeserializer<T>(serializer: BSONBinarySerializer = bsonBinarySerializer, receiveType?: ReceiveType<T>): BSONDeserializer<T> {
    const type = resolveReceiveType(receiveType);

    const jit = getTypeJitContainer(type);
    if (jit[serializer.deserializeId]) return jit[serializer.deserializeId];

    const deserializer = createBSONDeserializer(type, bsonBinarySerializer);
    jit[serializer.deserializeId] = function (bson: Uint8Array, offset: number = 0) {
        const parser = new ParserV2(bson, offset);
        return deserializer(parser);
    };
    toFastProperties(jit);
    return jit[serializer.deserializeId];
}

export function deserializeBSON<T>(data: Uint8Array, offset?: number, serializer: BSONBinarySerializer = bsonBinarySerializer, receiveType?: ReceiveType<T>): T {
    return getBSONDeserializer(serializer, receiveType)(data, offset) as T;
}
