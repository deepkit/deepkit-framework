import {ClassSchema, getClassSchema, PropertySchema} from '@super-hornet/marshal';
import {BSON_DATA_ARRAY, BSON_DATA_BINARY, BSON_DATA_DATE, BSON_DATA_NULL, BSON_DATA_OBJECT, digitByteSize, moment} from './utils';
import {ClassType} from '@super-hornet/core';
import {BaseParser, ParserV2} from './bson-parser';
import {seekElementSize} from './continuation';

function createPropertyConverter(setter: string, property: PropertySchema, context: Map<string, any>, parentProperty?: PropertySchema) {
    //we want the isNullable value from the actual property, not the decorated.
    const nullOrSeek = `
        if (elementType === ${BSON_DATA_NULL}) {
            ${setter} = null;
        } else {
            seekElementSize(elementType, parser);
        }
    `;

    if (property.type === 'class' && property.getResolvedClassSchema().decorator) {
        property = property.getResolvedClassSchema().getDecoratedPropertySchema();
    }

    const propertyVar = '_property_' + property.name;
    context.set(propertyVar, property);

    if (property.type === 'moment') {
        context.set('Moment', moment);
        return `
            if (elementType === ${BSON_DATA_DATE}) {
                ${setter} = Moment(parser.parse(elementType));
            } else {
                ${nullOrSeek}
            }
            `;
    } else if (property.type === 'uuid') {
        return `
            if (elementType === ${BSON_DATA_BINARY}) {
                ${setter} = parser.parseUUID();
            } else {
                ${nullOrSeek}
            }
            `;
    } else if (property.type === 'class') {
        if (property.isReference || property.backReference || (parentProperty && (parentProperty.backReference || parentProperty.isReference))) {
            const schema = property.getResolvedClassSchema();
            const primary = schema.getPrimaryField();
            return createPropertyConverter(setter, primary, context);
        }

        const propertySchema = '_propertySchema_' + property.name;
        context.set('getRawBSONDecoder', getRawBSONDecoder);
        context.set(propertySchema, property.getResolvedClassSchema());

        return `
            if (elementType === ${BSON_DATA_OBJECT}) {
                ${setter} = getRawBSONDecoder(${propertySchema})(parser);
            } else {
                ${nullOrSeek}
            }
            `;
    } else if (property.isArray) {
        context.set('digitByteSize', digitByteSize);

        return `
        if (elementType === ${BSON_DATA_ARRAY}) {
            ${setter} = [];
            parser.seek(4);
            for (let i = 0; ; i++) {
                const elementType = parser.eatByte();
                if (elementType === 0) break;
        
                //arrays are represented as objects, so we skip the key name
                parser.seek(digitByteSize(i));
        
                let v = undefined;
                ${createPropertyConverter(`v`, property.getSubType(), context, property)}
                ${setter}.push(v);
            }
            continue;
        } else {
            ${nullOrSeek}
        }
        `;
    } else if (property.isMap) {
        return `
        if (elementType === ${BSON_DATA_OBJECT}) {
            ${setter} = {};
            parser.seek(4);
            while (true) {
                const elementType = parser.eatByte();
                if (elementType === 0) break;

                const name = parser.eatObjectPropertyName();

                ${createPropertyConverter(`${setter}[name]`, property.getSubType(), context)}
            }
            continue;
        } else {
            ${nullOrSeek}
        }
        `;
    }

    return `
        if (elementType === ${BSON_DATA_NULL}) {
            ${setter} = null;
        } else {
            ${setter} = parser.parse(elementType, ${propertyVar});
        }
    `;
}

interface DecoderFn {
    buildId: number;
    (parser: BaseParser): any;
}

function createSchemaDecoder(classSchema: ClassSchema): DecoderFn {
    const context = new Map<string, any>();
    context.set('seekElementSize', seekElementSize);

    let propertyCode: string[] = [];
    for (const property of classSchema.getClassProperties().values()) {
        //todo, support non-ascii names
        const bufferCompare: string[] = [];
        for (let i = 0; i < property.name.length; i++) {
            bufferCompare.push(`parser.buffer[parser.offset + ${i}] === ${property.name.charCodeAt(i)}`);
        }
        bufferCompare.push(`parser.buffer[parser.offset + ${property.name.length}] === 0`);

        propertyCode.push(`
            if (${bufferCompare.join(' && ')}) {
                parser.offset += ${property.name.length} + 1;
                ${createPropertyConverter(`object.${property.name}`, property, context)};
                continue;
            }
        `);
    }

    // console.log('createBSONDecoder', classSchema.getClassName(), [...classSchema.getClassProperties().keys()]);

    const functionCode = `
        return function(parser) {
            var object = {};
            parser.seek(4);

            while (true) {
                const elementType = parser.eatByte();
                if (elementType === 0) break;

                ${propertyCode.join('\n')};

                //jump over this property when not registered in schema
                while (parser.buffer[parser.offset++] != 0);
                //seek property value
                seekElementSize(elementType, parser);
            }
            
            return object;
        }
    `;

    const compiled = new Function(...context.keys(), functionCode);
    const fn = compiled.bind(undefined, ...context.values())();
    fn.buildId = classSchema.buildId;
    return fn;
}

const parsers = new Map<ClassSchema, DecoderFn>();

export function getRawBSONDecoder<T>(schema: ClassSchema<T> | ClassType<T>): (parser: BaseParser) => T {
    schema = schema instanceof ClassSchema ? schema : getClassSchema(schema);

    let parser = parsers.get(schema);
    if (parser && parser.buildId === schema.buildId) return parser;

    parser = createSchemaDecoder(schema);
    parsers.set(schema, parser);

    return parser;
}

/**
 * Note: This does not create the class instances of T nor does it resolve decorated properties, or unions.
 * Call mongoToClass() on the result to create the actual instance.
 */
export function getBSONDecoder<T>(schema: ClassSchema<T> | ClassType<T>): (bson: Buffer) => T {
    const fn = getRawBSONDecoder(schema);

    return (bson) => {
        return fn(new ParserV2(bson));
    };
}