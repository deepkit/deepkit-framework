/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

export { ObjectId } from './src/model.js';
export { deserializeBSONWithoutOptimiser, ParserV2 as Parser } from './src/bson-parser.js';
export type { BSONDeserializer } from './src/bson-deserializer.js';
export { getBSONDeserializer, deserializeBSON } from './src/bson-deserializer.js';
export type { BSONSerializer } from './src/bson-serializer.js';
export {
    stringByteLength, createBSONSizer, getBSONSizer, getBSONSerializer, bsonBinarySerializer, serializeBSON, serializeWithoutOptimiser, Writer, BSONBinarySerializer, ValueWithBSONSerializer
} from './src/bson-serializer.js';
