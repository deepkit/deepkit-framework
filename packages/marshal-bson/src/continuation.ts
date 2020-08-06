import {
    BSON_BINARY_SUBTYPE_BYTE_ARRAY,
    BSON_DATA_ARRAY,
    BSON_DATA_BINARY,
    BSON_DATA_BOOLEAN,
    BSON_DATA_CODE,
    BSON_DATA_CODE_W_SCOPE,
    BSON_DATA_DATE,
    BSON_DATA_DBPOINTER,
    BSON_DATA_DECIMAL128,
    BSON_DATA_INT,
    BSON_DATA_LONG,
    BSON_DATA_MAX_KEY,
    BSON_DATA_MIN_KEY,
    BSON_DATA_NULL,
    BSON_DATA_NUMBER,
    BSON_DATA_OBJECT,
    BSON_DATA_OID,
    BSON_DATA_REGEXP,
    BSON_DATA_STRING,
    BSON_DATA_SYMBOL,
    BSON_DATA_TIMESTAMP,
    BSON_DATA_UNDEFINED,
    digitByteSize
} from './utils';
import {BaseParser} from './bson-parser';

export function seekElementSize(elementType: number, parser: BaseParser): any {
    switch (elementType) {
        case BSON_DATA_STRING: {
            return parser.seek(parser.eatUInt32());
        }
        case BSON_DATA_OID: {
            return parser.seek(12);
        }
        case BSON_DATA_INT: {
            return parser.seek(4);
        }
        case BSON_DATA_NUMBER: {
            return parser.seek(8);
        }
        case BSON_DATA_DATE: {
            return parser.seek(8);
        }
        case BSON_DATA_BOOLEAN: {
            return parser.seek(1);
        }
        case BSON_DATA_OBJECT: {
            return parser.seek(parser.peekUInt32());
        }
        case BSON_DATA_ARRAY: {
            return parser.seek(parser.peekUInt32());
        }
        case BSON_DATA_NULL: {
            return;
        }
        case BSON_DATA_LONG: {
            return parser.seek(8);
        }
        case BSON_DATA_UNDEFINED:
            return;
        case BSON_DATA_BINARY:
            let size = parser.eatUInt32();
            const subType = parser.eatByte();

            if (subType === BSON_BINARY_SUBTYPE_BYTE_ARRAY) {
                size = parser.eatUInt32();
            }

            return parser.seek(size);
        case BSON_DATA_DECIMAL128:
        case BSON_DATA_REGEXP:
        case BSON_DATA_SYMBOL:
        case BSON_DATA_TIMESTAMP:
        case BSON_DATA_MIN_KEY:
        case BSON_DATA_MAX_KEY:
        case BSON_DATA_CODE:
        case BSON_DATA_CODE_W_SCOPE:
        case BSON_DATA_DBPOINTER:
            throw new Error('Unsupported BSON type ' + elementType);
        default:
            throw new Error('Unknown BSON type ' + elementType);
    }
}

export function feedForwardArray(parser: BaseParser) {
    parser.seek(4);

    for (let i = 0; ; i++) {
        const elementType = parser.eatByte();
        if (elementType === 0) break;

        //arrays are represented as objects, so we skip the key name, since we have `i`
        parser.seek(digitByteSize(i));

        if (elementType === BSON_DATA_OBJECT) {
            feedForward(parser);
        } else if (elementType === BSON_DATA_ARRAY) {
            feedForwardArray(parser);
        } else {
            seekElementSize(elementType, parser);
        }
    }
}

export function feedForward(parser: BaseParser) {
    parser.seek(4);

    while (true) {
        const elementType = parser.eatByte();
        if (elementType === 0) break;

        while (parser.buffer[parser.offset++] !== 0) ;

        if (elementType === BSON_DATA_OBJECT) {
            feedForward(parser);
        } else if (elementType === BSON_DATA_ARRAY) {
            feedForwardArray(parser);
        } else {
            seekElementSize(elementType, parser);
        }
    }
}
