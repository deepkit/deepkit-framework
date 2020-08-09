import {ClassSchema, getClassSchema, getGlobalStore, PropertySchema} from '@super-hornet/marshal';
import {ClassType} from '@super-hornet/core';
import {seekElementSize} from './continuation';
import {
    BSON_BINARY_SUBTYPE_DEFAULT, BSON_BINARY_SUBTYPE_UUID,
    BSON_DATA_ARRAY,
    BSON_DATA_BINARY,
    BSON_DATA_BOOLEAN,
    BSON_DATA_DATE,
    BSON_DATA_INT, BSON_DATA_LONG, BSON_DATA_NULL,
    BSON_DATA_NUMBER,
    BSON_DATA_OBJECT, BSON_DATA_OID,
    BSON_DATA_STRING,
    digitByteSize
} from './utils';
import {Long, Binary, ObjectId} from 'bson';

// BSON MAX VALUES
const BSON_INT32_MAX = 0x7fffffff;
const BSON_INT32_MIN = -0x80000000;

const BSON_INT64_MAX = Math.pow(2, 63) - 1;
const BSON_INT64_MIN = -Math.pow(2, 63);

// JS MAX PRECISE VALUES
export const JS_INT_MAX = 0x20000000000000; // Any integer up to 2^53 can be precisely represented by a double.
export const JS_INT_MIN = -0x20000000000000; // Any integer down to -2^53 can be precisely represented by a double.

export function hexToByte(hex: string, index: number = 0, offset: number = 0): number {
    let code1 = hex.charCodeAt(index * 2 + offset) - 48;
    if (code1 > 9) code1 -= 39;

    let code2 = hex.charCodeAt((index * 2) + offset + 1) - 48;
    if (code2 > 9) code2 -= 39;
    return code1 * 16 + code2;
}

export function uuidStringToByte(hex: string, index: number = 0): number {
    let offset = 0;
    //e.g. bef8de96-41fe-442f-b70c-c3a150f8c96c
    if (index > 3) offset += 1;
    if (index > 5) offset += 1;
    if (index > 7) offset += 1;
    if (index > 9) offset += 1;
    return hexToByte(hex, index, offset);
}

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

function getValueSize(value: any): number {
    if ('boolean' === typeof value) return 1;
    if ('string' === typeof value) {
        //size + content + null
        return 4 + stringByteLength(value) + 1;
    }

    if ('number' === typeof value) {
        if (Math.floor(value) === value) {
            //it's an int
            if (value >= BSON_INT32_MIN && value <= BSON_INT32_MAX) {
                //32bit
                return 4;
            } else if (value >= JS_INT_MIN && value <= JS_INT_MAX) {
                //double, 64bit
                return 8;
            } else {
                //long
                return 8;
            }
        } else {
            //double
            return 8;
        }
    }

    return 0;
}

function getPropertySizer(context: Map<string, any>, property: PropertySchema, accessor): string {
    context.set('getValueSize', getValueSize);
    let code = `size += getValueSize(${accessor});`;

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
            size += stringByteLength(i) + 1; //element name + null
            ${getPropertySizer(context, property.getSubType(), `${accessor}[i]`)}
        }
        size += 1; //null
        `;
    } else if (property.type === 'class') {
        const sizer = '_converter_' + property.name;
        context.set(sizer, createBSONSizer(property.getResolvedClassSchema()));
        code = `size += ${sizer}(${accessor});`;
    } else if (property.type === 'date' || property.type === 'moment') {
        code = `size += 8;`;


    } else if (property.type === 'partial') {
        throw new Error('Todo: implement');
    } else if (property.type === 'any') {
        throw new Error('Todo: implement');
    } else if (property.type === 'union') {
        throw new Error('Todo: implement');


    } else if (property.type === 'objectId') {
        code = `size += 12;`;
    } else if (property.type === 'uuid') {
        code = `size += 4 + 1 + 16;`;
    } else if (property.type === 'arrayBuffer' || property.isTypedArray) {
        code = `
            size += 4; //size
            size += 1; //sub type
            if (${accessor}) size += ${accessor}.byteLength;
        `;
    }

    let setNull = '';
    if (property.isNullable) {
        setNull = 'size += 1;';
    }

    return `
        if (${accessor} !== undefined) {
            if (${accessor} === null) {
                ${setNull};
            } else {
                ${code}
            }
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

    const compiled = new Function('Buffer', 'seekElementSize', ...context.keys(), functionCode);
    const fn = compiled.bind(undefined, Buffer, seekElementSize, ...context.values())();
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
    let code = '';

    function numberParser() {
        context.set('Long', Long);
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
                    writer.writeByte(${BSON_DATA_LONG});
                    ${nameWriter}
                    const long = Long.fromNumber(${accessor});
                    writer.writeUint32(long.getLowBits());
                    writer.writeUint32(long.getHighBits());
                }
            } else {
                //double, 64bit
                writer.writeByte(${BSON_DATA_NUMBER});
                ${nameWriter}
                writer.writeDouble(${accessor});
            }
        `;
    }

    if (property.type === 'class') {
        const propertySchema = `_schema_${property.name}`;
        context.set('getBSONSerializer', getBSONSerializer);
        context.set(propertySchema, property.getResolvedClassSchema());
        code = `
            writer.writeByte(${BSON_DATA_OBJECT});
            ${nameWriter}
            getBSONSerializer(${propertySchema})(${accessor}, writer);
        `;
    }

    if (property.type === 'string') {
        code = `
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
        code = `
            writer.writeByte(${BSON_DATA_BINARY});
            ${nameWriter}
            writer.writeUint32(${accessor}.byteLength);
            writer.writeByte(${BSON_BINARY_SUBTYPE_DEFAULT});
            ${accessor}.copy(writer.buffer, writer.offset);
            writer.offset += ${accessor}.byteLength;
        `;
    }

    if (property.type === 'boolean') {
        code = `
            writer.writeByte(${BSON_DATA_BOOLEAN});
            ${nameWriter}
            writer.writeByte(${accessor} ? 1 : 0);
        `;
    }

    if (property.type === 'date') {
        context.set('Long', Long);
        code = `
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

    if (property.type === 'union') {
        throw new Error('Todo: implement');
    }

    if (property.type === 'enum') {
        code = `
        if ('string' === typeof ${accessor}) {
            writer.writeByte(${BSON_DATA_STRING});
            ${nameWriter}
            const start = writer.offset;
            writer.offset += 4; //size placeholder
            writer.writeString(${accessor});
            writer.writeByte(0); //null
            writer.writeDelayedSize(writer.offset - start - 4, start);
        } else {
            ${numberParser()}
        }
        `;
    }

    if (property.type === 'objectId') {
        context.set('hexToByte', hexToByte);
        context.set('ObjectId', ObjectId);
        code = `
            writer.writeByte(${BSON_DATA_OID});
            ${nameWriter}
            
            if ('string' === typeof ${accessor}) {
                writer.buffer[writer.offset+0] = hexToByte(${accessor}, 0);
                writer.buffer[writer.offset+1] = hexToByte(${accessor}, 1);
                writer.buffer[writer.offset+2] = hexToByte(${accessor}, 2);
                writer.buffer[writer.offset+3] = hexToByte(${accessor}, 3);
                writer.buffer[writer.offset+4] = hexToByte(${accessor}, 4);
                writer.buffer[writer.offset+5] = hexToByte(${accessor}, 5);
                writer.buffer[writer.offset+6] = hexToByte(${accessor}, 6);
                writer.buffer[writer.offset+7] = hexToByte(${accessor}, 7);
                writer.buffer[writer.offset+8] = hexToByte(${accessor}, 8);
                writer.buffer[writer.offset+9] = hexToByte(${accessor}, 9);
                writer.buffer[writer.offset+10] = hexToByte(${accessor}, 10);
                writer.buffer[writer.offset+11] = hexToByte(${accessor}, 11);
            } else {
                if (${accessor} instanceof ObjectId) {
                    ${accessor}.id.copy(writer.buffer, writer.offset);
                }
            }
            writer.offset += 12;
        `;
    }

    if (property.type === 'uuid') {
        context.set('uuidStringToByte', uuidStringToByte);
        context.set('Binary', Binary);
        code = `
            writer.writeByte(${BSON_DATA_BINARY});
            ${nameWriter}
            writer.writeUint32(16);
            writer.writeByte(${BSON_BINARY_SUBTYPE_UUID});
            
            if ('string' === typeof ${accessor}) {
                writer.buffer[writer.offset+0] = uuidStringToByte(${accessor}, 0);
                writer.buffer[writer.offset+1] = uuidStringToByte(${accessor}, 1);
                writer.buffer[writer.offset+2] = uuidStringToByte(${accessor}, 2);
                writer.buffer[writer.offset+3] = uuidStringToByte(${accessor}, 3);
                //-
                writer.buffer[writer.offset+4] = uuidStringToByte(${accessor}, 4);
                writer.buffer[writer.offset+5] = uuidStringToByte(${accessor}, 5);
                //-
                writer.buffer[writer.offset+6] = uuidStringToByte(${accessor}, 6);
                writer.buffer[writer.offset+7] = uuidStringToByte(${accessor}, 7);
                //-
                writer.buffer[writer.offset+8] = uuidStringToByte(${accessor}, 8);
                writer.buffer[writer.offset+9] = uuidStringToByte(${accessor}, 9);
                //-
                writer.buffer[writer.offset+10] = uuidStringToByte(${accessor}, 10);
                writer.buffer[writer.offset+11] = uuidStringToByte(${accessor}, 11);
                writer.buffer[writer.offset+12] = uuidStringToByte(${accessor}, 12);
                writer.buffer[writer.offset+13] = uuidStringToByte(${accessor}, 13);
                writer.buffer[writer.offset+14] = uuidStringToByte(${accessor}, 14);
                writer.buffer[writer.offset+15] = uuidStringToByte(${accessor}, 15);
            } else {
                if (${accessor} instanceof Binary) {
                    ${accessor}.buffer.copy(writer.buffer, writer.offset);
                } else {
                    ${accessor}.copy(writer.buffer, writer.offset);
                }
            }
            writer.offset += 16;
        `;
    }

    if (property.type === 'moment') {
        context.set('Long', Long);
        code = `
            writer.writeByte(${BSON_DATA_DATE});
            ${nameWriter}
            const long = Long.fromNumber(${accessor}.valueOf());
            writer.writeUint32(long.getLowBits());
            writer.writeUint32(long.getHighBits());
        `;
    }

    if (property.type === 'number') {
        code = numberParser();
    }

    if (property.type === 'array') {
        code = `
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
        code = `
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

    let setNull = '';
    if (property.isNullable) {
        setNull = `
            writer.writeByte(${BSON_DATA_NULL});
            ${nameWriter}
        `;
    }

    return `
    if (${accessor} !== undefined) {
        if (${accessor} === null) {
            ${setNull}
        } else {
            ${code}
        }
    }
        `;
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
            ${getTypeCode(property, context, `obj.${property.name}`)}
        `);
    }

    const functionCode = `
        return function(obj, writer) {
            writer = writer || new Writer(Buffer.allocUnsafe(_sizer(obj)));
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