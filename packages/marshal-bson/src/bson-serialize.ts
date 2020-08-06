import {ClassSchema, getClassSchema, getGlobalStore, PropertySchema} from '@super-hornet/marshal';
import {ClassType} from '@super-hornet/core';
import {seekElementSize} from './continuation';
import {
    BSON_BINARY_SUBTYPE_DEFAULT,
    BSON_DATA_ARRAY,
    BSON_DATA_BINARY,
    BSON_DATA_BOOLEAN,
    BSON_DATA_DATE,
    BSON_DATA_INT,
    BSON_DATA_NUMBER,
    BSON_DATA_OBJECT,
    BSON_DATA_STRING,
    digitByteSize
} from './utils';
import {Long} from 'bson';

// BSON MAX VALUES
const BSON_INT32_MAX = 0x7fffffff;
const BSON_INT32_MIN = -0x80000000;

const BSON_INT64_MAX = Math.pow(2, 63) - 1;
const BSON_INT64_MIN = -Math.pow(2, 63);

// JS MAX PRECISE VALUES
const JS_INT_MAX = 0x20000000000000; // Any integer up to 2^53 can be precisely represented by a double.
const JS_INT_MIN = -0x20000000000000; // Any integer down to -2^53 can be precisely represented by a double.

function stringByteLength(str: string): number {
    if (!str) return 0;
    let size = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c < 128) {
            size += 1;
        } else if (c > 127 && c < 2048) {
            size += 2;
        } else {
            size += 3;
        }
    }
    return size;
}

function getPropertySizer(context: Map<string, any>, property: PropertySchema, accessor): string {
    let code = '';
    if (property.type === 'array') {
        context.set('digitByteSize', digitByteSize);
        code = `
        size += 4; //array size
        for (let i = 0; i < ${accessor}.length; i++) {
            size += 1; //element type
            size += digitByteSize(i); //element name
            ${getPropertySizer(context, property.getSubType(), `${accessor}[i]`)}
        }
        size += 1; //null
        `;
    } else if (property.type === 'map') {
        context.set('stringByteLength', stringByteLength);
        code = `
        size += 4; //object size
        for (let i in ${accessor}) {
            if (!${accessor}.hasOwnProperty(i)) continue;
            size += 1; //element type
            size += stringByteLength(i); //element name
            ${getPropertySizer(context, property.getSubType(), `${accessor}[i]`)}
        }
        size += 1; //null
        `;
    } else if (property.type === 'class') {
        const sizer = '_converter_' + property.name;
        context.set(sizer, createBSONSizer(property.getResolvedClassSchema()));
        code = `size += ${sizer}(${accessor});`;
    } else if (property.type === 'boolean') {
        code = `size += 1;`;
    } else if (property.type === 'date' || property.type === 'moment') {
        code = `size += 8;`;
    } else if (property.type === 'string') {
        context.set('stringByteLength', stringByteLength);
        code = `
            size += 4; //size
            size += stringByteLength(${accessor});
            size += 1; //null
        `;
    } else if (property.type === 'arrayBuffer' || property.isTypedArray) {
        code = `
            size += 4; //size
            size += 1; //sub type
            if (${accessor}) size += ${accessor}.byteLength;
        `;
    } else if (property.type === 'number') {
        code = `
        if (Math.floor(${accessor}) === ${accessor}) {
            //it's an int
            if (${accessor} >= ${BSON_INT32_MIN} && ${accessor} <= ${BSON_INT32_MAX}) {
                //32bit
                size += 4;
            } else if (${accessor} >= ${JS_INT_MIN} && ${accessor} <= ${JS_INT_MAX}) {
                //double, 64bit
                size += 8;
            } else {
                //long
                size += 8;
            }
        } else {
            //double
            size += 8;
        }
        `;
    }

    if (!property.isOptional) {
        return code;
    }

    return `
        if (${accessor} !== null && ${accessor} !== undefined) {
            ${code}
        }
    `;
}

interface SizerFn {
    buildId: number;
    (data: object): number;
}

/**
 * Creates a JIT compiled function that allows to get the BSON buffer size of a certain object.
 */
export function createBSONSizer(classSchema: ClassSchema): SizerFn {
    const context = new Map<string, any>();
    let getSizeCode: string[] = [];

    for (const property of classSchema.getClassProperties().values()) {
        //todo, support non-ascii names
        getSizeCode.push(`
            //${property.name}
            size += 1; //type
            size += ${property.name.length} + 1; //property name
            ${getPropertySizer(context, property, `obj.${property.name}`)}
        `);
    }

    const functionCode = `
        return function(obj) {
            let size = 4; //object size
            
            ${getSizeCode.join('\n')}
            size += 1; //null
            
            return size;
        }
    `;

    // console.log('functionCode', functionCode);

    const compiled = new Function('_global', 'Buffer', 'seekElementSize', ...context.keys(), functionCode);
    const fn = compiled.bind(undefined, getGlobalStore(), Buffer, seekElementSize, ...context.values())();
    fn.buildId = classSchema.buildId;
    return fn;
}

function getTypeCode(
    property: PropertySchema,
    context: Map<string, any>,
    accessor: string,
    nameAccessor?: string,
): string {
    let nameWriter = `
        //arrays don't need a index name, we use always null directly.
        //js-bson doesnt use it for deserialize as well. This saves tons of time
        //when serialization and deserialization.
        writer.writeAsciiString(${nameAccessor});
        writer.writeByte(0); 
    `;
    if (!nameAccessor) {
        const nameSetter: string[] = [];
        for (let i = 0; i < property.name.length; i++) {
            nameSetter.push(`writer.buffer[writer.offset++] = ${property.name.charCodeAt(i)};`);
        }
        nameWriter = `
        ${nameSetter.join('\n')};
        writer.writeByte(0); //null
     `;
    }

    if (property.type === 'class') {
        const propertySchema = `_schema_${property.name}`;
        context.set('getBSONSerializer', getBSONSerializer);
        context.set(propertySchema, property.getResolvedClassSchema());
        return `
            writer.writeByte(${BSON_DATA_OBJECT});
            ${nameWriter}
            getBSONSerializer(${propertySchema})(${accessor}, writer);
        `;
    }

    if (property.type === 'string') {
        return `
            writer.writeByte(${BSON_DATA_STRING});
            ${nameWriter}
            const start = writer.offset;
            writer.offset += 4; //size placeholder
            writer.writeString(${accessor});
            writer.writeByte(0); //null
            writer.writeDelayedSize(writer.offset - start - 4, start);
        `;
    }

    if (property.type === 'arrayBuffer' || property.isTypedArray) {
        return `
            writer.writeByte(${BSON_DATA_BINARY});
            ${nameWriter}
            writer.writeUint32(${accessor}.byteLength);
            writer.writeByte(${BSON_BINARY_SUBTYPE_DEFAULT});
            ${accessor}.copy(writer.buffer, writer.offset);
            writer.offset += ${accessor}.byteLength;
        `;
    }

    if (property.type === 'boolean') {
        return `
            writer.writeByte(${BSON_DATA_BOOLEAN});
            ${nameWriter}
            writer.writeByte(${accessor} ? 1 : 0);
        `;
    }

    if (property.type === 'date') {
        context.set('Long', Long);
        return `
            writer.writeByte(${BSON_DATA_DATE});
            ${nameWriter}
            const long = Long.fromNumber(${accessor}.getTime());
            writer.writeUint32(long.getLowBits());
            writer.writeUint32(long.getHighBits());
        `;
    }

    if (property.type === 'partial') {
        throw new Error('Todo: implement');
    }

    if (property.type === 'any') {
        throw new Error('Todo: implement');
    }

    if (property.type === 'enum') {
        throw new Error('Todo: implement');
    }

    if (property.type === 'objectId') {
        throw new Error('Todo: implement');
    }

    if (property.type === 'uuid') {
        throw new Error('Todo: implement');
    }

    if (property.type === 'union') {
        throw new Error('Todo: implement');
    }

    if (property.type === 'moment') {
        context.set('Long', Long);
        return `
            writer.writeByte(${BSON_DATA_DATE});
            ${nameWriter}
            const long = Long.fromNumber(${accessor}.valueOf());
            writer.writeUint32(long.getLowBits());
            writer.writeUint32(long.getHighBits());
        `;
    }

    if (property.type === 'number') {
        return `
            if (Math.floor(${accessor}) === ${accessor}) {
                //it's an int
                if (${accessor} >= ${BSON_INT32_MIN} && ${accessor} <= ${BSON_INT32_MAX}) {
                    //32bit
                    writer.writeByte(${BSON_DATA_INT});
                    ${nameWriter}
                    writer.writeInt32(${accessor});
                } else if (${accessor} >= ${JS_INT_MIN} && ${accessor} <= ${JS_INT_MAX}) {
                    //double, 64bit
                    writer.writeByte(${BSON_DATA_NUMBER});
                    ${nameWriter}
                    writer.writeDouble(${accessor});
                } else {
                    //long
                    size += 8;
                    throw new Error('Long not implemented yet');
                }
            } else {
                //double, 64bit
                writer.writeByte(${BSON_DATA_NUMBER});
                ${nameWriter}
                writer.writeDouble(${accessor});
            }
        `;
    }

    if (property.type === 'array') {
        //todo: correctly set size
        return `
            writer.writeByte(${BSON_DATA_ARRAY});
            ${nameWriter}
            const start = writer.offset;
            writer.offset += 4; //size
            
            for (let i = 0; i < ${accessor}.length; i++) {
                //${property.getSubType().type}
                ${getTypeCode(property.getSubType(), context, `${accessor}[i]`, `''+i`)}
            }
            writer.writeNull();
            writer.writeDelayedSize(writer.offset - start, start);
        `;
    }

    if (property.type === 'map') {
        return `
            writer.writeByte(${BSON_DATA_OBJECT});
            ${nameWriter}
            const start = writer.offset;
            writer.offset += 4; //size
            
            for (let i in ${accessor}) {
                if (!${accessor}.hasOwnProperty(i)) continue;
                //${property.getSubType().type}
                ${getTypeCode(property.getSubType(), context, `${accessor}[i]`, `i`)}
            }
            writer.writeNull();
            writer.writeDelayedSize(writer.offset - start, start);
        `;
    }

    return '';
}

export class Writer {
    public offset = 0;
    public dataView: DataView;

    constructor(public buffer: Buffer) {
        this.dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    writeUint32(v: number) {
        this.dataView.setUint32(this.offset, v, true);
        this.offset += 4;
    }

    writeInt32(v: number) {
        this.dataView.setInt32(this.offset, v, true);
        this.offset += 4;
    }

    writeDouble(v: number) {
        this.dataView.setFloat64(this.offset, v, true);
        this.offset += 8;
    }

    writeDelayedSize(v: number, position: number) {
        this.dataView.setUint32(position, v, true);
    }

    writeByte(v: number) {
        this.buffer[this.offset++] = v;
    }

    writeNull() {
        this.writeByte(0);
    }

    writeAsciiString(str: string) {
        for (let i = 0; i < str.length; i++) {
            this.buffer[this.offset++] = str.charCodeAt(i);
        }
    }

    writeString(str: string) {
        if (!str) return;
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            if (c < 128) {
                this.buffer[this.offset++] = c;
            } else if (c > 127 && c < 2048) {
                this.buffer[this.offset++] = (c >> 6) | 192;
                this.buffer[this.offset++] = ((c & 63) | 128);
            } else {
                this.buffer[this.offset++] = (c >> 12) | 224;
                this.buffer[this.offset++] = ((c >> 6) & 63) | 128;
                this.buffer[this.offset++] = (c & 63) | 128;
            }
        }
    }
}

interface EncoderFn {
    buildId: number;
    (data: object): Buffer;
}

function createSchemaSerialize(classSchema: ClassSchema): EncoderFn {
    const context = new Map<string, any>();

    let getPropertyCode: string[] = [];

    for (const property of classSchema.getClassProperties().values()) {
        getPropertyCode.push(`
            //${property.name}:${property.type}
            if (obj.${property.name} != null) {
                ${getTypeCode(property, context, `obj.${property.name}`)}
            }
        `);
    }

    const functionCode = `
        return function(obj, writer) {
            writer = writer || new Writer(Buffer.alloc(_sizer(obj)));
            const start = writer.offset;
            writer.offset += 4; //size placeholder
            
            ${getPropertyCode.join('\n')}
            writer.writeNull();
            writer.writeDelayedSize(writer.offset - start, start);
            
            return writer.buffer;
        }
    `;

    // console.log('functionCode', functionCode);

    const compiled = new Function('_global', '_sizer', 'Writer', 'seekElementSize', ...context.keys(), functionCode);
    const fn = compiled.bind(undefined, getGlobalStore(), createBSONSizer(classSchema), Writer, seekElementSize, ...context.values())();
    fn.buildId = classSchema.buildId;
    return fn;
}

const serializers = new Map<ClassSchema, (data: object) => Buffer>();

export function getBSONSerializer(schema: ClassSchema | ClassType<any>) {
    schema = schema instanceof ClassSchema ? schema : getClassSchema(schema);

    let serializer = serializers.get(schema);
    if (serializer) return serializer;

    serializer = createSchemaSerialize(schema);
    serializers.set(schema, serializer);
    return serializer;
}