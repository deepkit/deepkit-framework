/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

// errors
export { BSONError, CircularReferenceError, TypeNotSerializableError } from './src/errors.js';

// model
export { ObjectId } from './src/model.js';

// parser
export type { ParsedField, ParsedDocument, ParsedArray } from './src/parser.js';
export {
    parseDocumentFields,
    parseArrayElements,
    parseValueAny,
    parseDocumentToObject,
    parseArrayToArray,
    deserializeBSONWithoutOptimiser,
} from './src/parser.js';

// deserializer
export { getBSONDeserializer } from './src/deserializer.js';

// serializer
export type { SerializeResult } from './src/serializer.js';
export { getBSONSerializer } from './src/serializer.js';

// api
export { deserializeBSON, serializeBSON, getBSONEncoder, serializeBSONWithoutOptimiser } from './src/api.js';

// stream
export { BSONStreamReader } from './src/stream.js';

// types
export {
    BSONType,
    BSON_BINARY_SUBTYPE_DEFAULT,
    BSON_BINARY_SUBTYPE_UUID,
    OBJECT_ID_BYTE_LENGTH,
    UUID_BYTE_LENGTH,
    DEFAULT_BUFFER_SIZE,
    INT32_MIN,
    INT32_MAX,
} from './src/types.js';
export type { BSONDeserializer } from './src/types.js';
