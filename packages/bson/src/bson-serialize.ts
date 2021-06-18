/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, CompilerContext, isArray, isObject, toFastProperties } from '@deepkit/core';
import { ClassSchema, getClassSchema, getGlobalStore, getSortedUnionTypes, JitStack, jsonTypeGuards, PropertySchema, UnpopulatedCheck, unpopulatedSymbol } from '@deepkit/type';
import { seekElementSize } from './continuation';
import { isObjectId, isUUID, ObjectId, ObjectIdSymbol, UUID, UUIDSymbol } from './model';
import { BSON_BINARY_SUBTYPE_BIGINT, BSON_BINARY_SUBTYPE_DEFAULT, BSON_BINARY_SUBTYPE_UUID, BSONType, digitByteSize, TWO_PWR_32_DBL_N } from './utils';

export function createBuffer(size: number): Uint8Array {
    return 'undefined' !== typeof Buffer && 'function' === typeof Buffer.allocUnsafe ? Buffer.allocUnsafe(size) : new Uint8Array(size);
}

(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

// BSON MAX VALUES
const BSON_INT32_MAX = 0x7fffffff;
const BSON_INT32_MIN = -0x80000000;

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

export function stringByteLength(str: string): number {
    if (!str) return 0;
    let size = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c < 128) size += 1;
        else if (c > 127 && c < 2048) size += 2;
        else size += 3;
    }
    return size;
}

export function getValueSize(value: any): number {
    if ('boolean' === typeof value) {
        return 1;
    } else if ('string' === typeof value) {
        //size + content + null
        return 4 + stringByteLength(value) + 1;
    } else if ('bigint' === typeof value) {
        return 4 + 1 + Math.ceil(value.toString(16).length / 2);
    } else if ('number' === typeof value) {
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
    } else if (value instanceof Date) {
        return 8;
    } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        let size = 4; //size
        size += 1; //sub type
        size += value.byteLength;
        return size;
    } else if (isArray(value)) {
        let size = 4; //object size
        for (let i = 0; i < value.length; i++) {
            size += 1; //element type
            size += digitByteSize(i); //element name
            size += getValueSize(value[i]);
        }
        size += 1; //null
        return size;
    } else if (isUUID(value)) {
        return 4 + 1 + 16;
    } else if (isObjectId(value)) {
        return 12;
    } else if (value && value['_bsontype'] === 'Binary') {
        let size = 4; //size
        size += 1; //sub type
        size += value.buffer.byteLength;
        return size;
    } else if (value instanceof RegExp) {
        return stringByteLength(value.source) + 1
            +
            (value.global ? 1 : 0) +
            (value.ignoreCase ? 1 : 0) +
            (value.multiline ? 1 : 0) +
            1;
    } else if (isObject(value)) {
        let size = 4; //object size
        for (let i in value) {
            if (!value.hasOwnProperty(i)) continue;
            size += 1; //element type
            size += stringByteLength(i) + 1; //element name + null
            size += getValueSize(value[i]);
        }
        size += 1; //null
        return size;
    } //isObject() should be last

    return 0;
}

function getPropertySizer(schema: ClassSchema, compiler: CompilerContext, property: PropertySchema, accessor: string, jitStack: JitStack): string {
    if (property.type === 'class' && property.getResolvedClassSchema().decorator) {
        property = property.getResolvedClassSchema().getDecoratedPropertySchema();
        accessor = `(${accessor} && ${accessor}.${property.name})`;
    }

    compiler.context.set('getValueSize', getValueSize);
    let code = `size += getValueSize(${accessor});`;

    if (property.type === 'array') {
        compiler.context.set('digitByteSize', digitByteSize);
        const isArrayVar = compiler.reserveVariable('isArray', isArray);
        const unpopulatedSymbolVar = compiler.reserveVariable('unpopulatedSymbol', unpopulatedSymbol);

        const i = compiler.reserveVariable('i');
        code = `
        if (${accessor} && ${accessor} !== ${unpopulatedSymbolVar} && ${isArrayVar}(${accessor})) {
            size += 4; //array size
            for (let ${i} = 0; ${i} < ${accessor}.length; ${i}++) {
                size += 1; //element type
                size += digitByteSize(${i}); //element name
                ${getPropertySizer(schema, compiler, property.getSubType(), `${accessor}[${i}]`, jitStack)}
            }
            size += 1; //null
        }
        `;
    } else if (property.type === 'bigint') {
        code = `
        if (typeof ${accessor} === 'bigint') {
            size += 4 + 1 + Math.ceil(${accessor}.toString(16).length / 2);
        }
        `;
    } else if (property.type === 'number') {
        code = `
        if (typeof ${accessor} === 'number') {
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
        } else if (typeof ${accessor} === 'bigint') {
            size += 8;
        }
        `;
    } else if (property.type === 'string') {
        code = `
        if (typeof ${accessor} === 'string') {
            size += getValueSize(${accessor});
        }
        `;
    } else if (property.type === 'literal') {
        code = `
        if (typeof ${accessor} === 'string' || typeof ${accessor} === 'number' || typeof ${accessor} === 'boolean') {
            size += getValueSize(${accessor});
        } else if (!${property.isOptional} && !${property.isOptional}) {
            size += getValueSize(${JSON.stringify(property.literalValue)});
        }
        `;
    } else if (property.type === 'boolean') {
        code = `
        if (typeof ${accessor} === 'boolean') {
            size += 1;
        }
        `;
    } else if (property.type === 'map') {
        compiler.context.set('stringByteLength', stringByteLength);
        const i = compiler.reserveVariable('i');
        code = `
        size += 4; //object size
        for (${i} in ${accessor}) {
            if (!${accessor}.hasOwnProperty(${i})) continue;
            size += 1; //element type
            size += stringByteLength(${i}) + 1; //element name + null;
            ${getPropertySizer(schema, compiler, property.getSubType(), `${accessor}[${i}]`, jitStack)}
        }
        size += 1; //null
        `;
    } else if (property.type === 'class') {
        const sizer = '_sizer_' + property.name;
        const forwardSchema = property.getResolvedClassSchema();
        const sizerFn = jitStack.getOrCreate(forwardSchema, () => createBSONSizer(property.getResolvedClassSchema(), jitStack));
        const unpopulatedSymbolVar = compiler.reserveVariable('unpopulatedSymbol', unpopulatedSymbol);
        compiler.context.set('isObject', isObject);
        compiler.context.set(sizer, sizerFn);
        compiler.context.set('UUIDSymbol', UUIDSymbol);
        compiler.context.set('ObjectIdSymbol', ObjectIdSymbol);

        let primarKeyHandling = '';
        const isReference = property.isReference || (property.parent && property.parent.isReference);
        if (isReference) {
            primarKeyHandling = getPropertySizer(schema, compiler, forwardSchema.getPrimaryField(), accessor, jitStack);
        }

        let circularCheck = 'true';
        if (schema.hasCircularReference()) {
            circularCheck = `!_stack.includes(${accessor})`;
        }

        code = `
            if (${accessor} !== ${unpopulatedSymbolVar}) {
                if (isObject(${accessor}) && !${accessor}.hasOwnProperty(UUIDSymbol) && !${accessor}.hasOwnProperty(ObjectIdSymbol) && ${circularCheck}) {
                    size += ${sizer}.fn(${accessor}, _stack);
                } else if (${isReference})  {
                    ${primarKeyHandling}
                }
            }
        `;
    } else if (property.type === 'date') {
        code = `if (${accessor} instanceof Date) size += 8;`;
    } else if (property.type === 'objectId') {
        compiler.context.set('isObjectId', isObjectId);
        code = `if ('string' === typeof ${accessor}|| isObjectId(${accessor})) size += 12;`;
    } else if (property.type === 'uuid') {
        compiler.context.set('isUUID', isUUID);
        code = `if ('string' === typeof ${accessor} || isUUID(${accessor})) size += 4 + 1 + 16;`;
    } else if (property.type === 'arrayBuffer' || property.isTypedArray) {
        code = `
            size += 4; //size
            size += 1; //sub type
            if (${accessor}['_bsontype'] === 'Binary') {
                size += ${accessor}.buffer.byteLength
            } else {
                size += ${accessor}.byteLength;
            }
        `;
    } else if (property.type === 'union') {
        let discriminator: string[] = [`if (false) {\n}`];
        const discriminants: string[] = [];
        for (const unionType of getSortedUnionTypes(property, jsonTypeGuards)) {
            discriminants.push(unionType.property.type);
        }
        const elseBranch = `throw new Error('No valid discriminant was found for ${property.name}, so could not determine class type. Guard tried: [${discriminants.join(',')}]. Got: ' + ${accessor});`;

        for (const unionType of getSortedUnionTypes(property, jsonTypeGuards)) {
            const guardVar = compiler.reserveVariable('guard_' + unionType.property.type, unionType.guard);

            discriminator.push(`
                //guard:${unionType.property.type}
                else if (${guardVar}(${accessor})) {
                    ${getPropertySizer(schema, compiler, unionType.property, `${accessor}`, jitStack)}
                }
            `);
        }

        code = `
            ${discriminator.join('\n')}
            else {
                ${elseBranch}
            }
        `;
    }

    // since JSON does not support undefined, we emulate it via using null for serialization, and convert that back to undefined when deserialization happens
    // not: When the value is not defined (property.name in object === false), then this code will never run.
    let writeDefaultValue = `
        // size += 0; //null
    `;

    if (!property.hasDefaultValue && property.defaultValue !== undefined) {
        const propertyVar = compiler.reserveVariable('property', property);
        const cloned = property.clone();
        cloned.defaultValue = undefined;
        writeDefaultValue = `
            ${propertyVar}.lastGeneratedDefaultValue = ${propertyVar}.defaultValue();
            ${getPropertySizer(schema, compiler, cloned, `${propertyVar}.lastGeneratedDefaultValue`, jitStack)}
        `;
    } else if (!property.isOptional && property.type === 'literal') {
        writeDefaultValue = `size += getValueSize(${JSON.stringify(property.literalValue)});`;
    }

    return `
    if (${accessor} === undefined) {
        ${writeDefaultValue}
    } else if (${accessor} === null) {
        if (${property.isNullable}) {
            // size += 0; //null
        } else {
            ${writeDefaultValue}
        }
    } else {
        ${code}
    }
    `;
}

/**
 * Creates a JIT compiled function that allows to get the BSON buffer size of a certain object.
 */
export function createBSONSizer(schema: ClassSchema, jitStack: JitStack = new JitStack()): (data: object) => number {
    const compiler = new CompilerContext;
    let getSizeCode: string[] = [];
    const prepared = jitStack.prepare(schema);


    for (const property of schema.getProperties()) {
        //todo, support non-ascii names

        let setDefault = '';
        if (property.hasManualDefaultValue() || property.type === 'literal') {
            if (property.defaultValue !== undefined) {
                const propertyVar = compiler.reserveVariable('property', property);
                setDefault = `
                    size += 1; //type
                    size += ${property.name.length} + 1; //property name
                    ${propertyVar}.lastGeneratedDefaultValue = ${propertyVar}.defaultValue();
                    ${getPropertySizer(schema, compiler, property, `${propertyVar}.lastGeneratedDefaultValue`, jitStack)}
                `;
            } else if (property.type === 'literal' && !property.isOptional) {
                setDefault = `
                size += 1; //type
                size += ${property.name.length} + 1; //property name
                ${getPropertySizer(schema, compiler, property, JSON.stringify(property.literalValue), jitStack)}`;
            }
        } else if (property.isNullable) {
            setDefault = `
                size += 1; //type null
                size += ${property.name.length} + 1; //property name
            `;
        }

        getSizeCode.push(`
            //${property.name}
            if (${JSON.stringify(property.name)} in obj) {
                size += 1; //type
                size += ${property.name.length} + 1; //property name
                ${getPropertySizer(schema, compiler, property, `obj.${property.name}`, jitStack)}
            } else {
                ${setDefault}
            }
        `);
    }

    compiler.context.set('_global', getGlobalStore());
    compiler.context.set('UnpopulatedCheck', UnpopulatedCheck);
    compiler.context.set('seekElementSize', seekElementSize);

    let circularCheckBeginning = '';
    let circularCheckEnd = '';

    if (schema.hasCircularReference()) {
        circularCheckBeginning = `
        if (!_stack) _stack = [];
        _stack.push(obj);
        `;
        circularCheckEnd = `_stack.pop();`;
    }

    const functionCode = `
        ${circularCheckBeginning}
        let size = 4; //object size

        const unpopulatedCheck = _global.unpopulatedCheck;
        _global.unpopulatedCheck = UnpopulatedCheck.ReturnSymbol;

        ${getSizeCode.join('\n')}

        size += 1; //null

        _global.unpopulatedCheck = unpopulatedCheck;

        ${circularCheckEnd}
        return size;
    `;

    try {
        const fn = compiler.build(functionCode, 'obj', '_stack');
        prepared(fn);
        return fn;
    } catch (error) {
        console.log('Error compiling BSON sizer', functionCode);
        throw error;
    }
}

export class Writer {
    public dataView: DataView;

    constructor(public buffer: Uint8Array, public offset: number = 0) {
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

    writeBuffer(buffer: Uint8Array, offset: number = 0) {
        // buffer.copy(this.buffer, this.buffer.byteOffset + this.offset);
        for (let i = offset; i < buffer.byteLength; i++) {
            this.buffer[this.offset++] = buffer[i];
        }
        // this.offset += buffer.byteLength;
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
        if (typeof str !== 'string') return;
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

    writeBigInt(value: bigint) {
        let hex = value.toString(16);
        if (hex.length % 2) hex = '0' + hex;
        const size = Math.ceil(hex.length / 2);
        this.writeUint32(size);
        this.writeByte(BSON_BINARY_SUBTYPE_BIGINT);
        for (let i = 0; i < size; i++) {
            this.buffer[this.offset + i] = hexToByte(hex, i);
        }
        this.offset += size;
    }

    writeUUID(value: string | UUID) {
        value = value instanceof UUID ? value.id : value;
        this.writeUint32(16);
        this.writeByte(BSON_BINARY_SUBTYPE_UUID);

        this.buffer[this.offset + 0] = uuidStringToByte(value, 0);
        this.buffer[this.offset + 1] = uuidStringToByte(value, 1);
        this.buffer[this.offset + 2] = uuidStringToByte(value, 2);
        this.buffer[this.offset + 3] = uuidStringToByte(value, 3);
        //-
        this.buffer[this.offset + 4] = uuidStringToByte(value, 4);
        this.buffer[this.offset + 5] = uuidStringToByte(value, 5);
        //-
        this.buffer[this.offset + 6] = uuidStringToByte(value, 6);
        this.buffer[this.offset + 7] = uuidStringToByte(value, 7);
        //-
        this.buffer[this.offset + 8] = uuidStringToByte(value, 8);
        this.buffer[this.offset + 9] = uuidStringToByte(value, 9);
        //-
        this.buffer[this.offset + 10] = uuidStringToByte(value, 10);
        this.buffer[this.offset + 11] = uuidStringToByte(value, 11);
        this.buffer[this.offset + 12] = uuidStringToByte(value, 12);
        this.buffer[this.offset + 13] = uuidStringToByte(value, 13);
        this.buffer[this.offset + 14] = uuidStringToByte(value, 14);
        this.buffer[this.offset + 15] = uuidStringToByte(value, 15);
        this.offset += 16;
    }

    writeObjectId(value: string | ObjectId) {
        value = 'string' === typeof value ? value : value.id;
        this.buffer[this.offset + 0] = hexToByte(value, 0);
        this.buffer[this.offset + 1] = hexToByte(value, 1);
        this.buffer[this.offset + 2] = hexToByte(value, 2);
        this.buffer[this.offset + 3] = hexToByte(value, 3);
        this.buffer[this.offset + 4] = hexToByte(value, 4);
        this.buffer[this.offset + 5] = hexToByte(value, 5);
        this.buffer[this.offset + 6] = hexToByte(value, 6);
        this.buffer[this.offset + 7] = hexToByte(value, 7);
        this.buffer[this.offset + 8] = hexToByte(value, 8);
        this.buffer[this.offset + 9] = hexToByte(value, 9);
        this.buffer[this.offset + 10] = hexToByte(value, 10);
        this.buffer[this.offset + 11] = hexToByte(value, 11);
        this.offset += 12;
    }

    write(value: any, nameWriter?: () => void): void {
        if ('boolean' === typeof value) {
            if (nameWriter) {
                this.writeByte(BSONType.BOOLEAN);
                nameWriter();
            }
            this.writeByte(value ? 1 : 0);
        } else if (value instanceof RegExp) {
            if (nameWriter) {
                this.writeByte(BSONType.REGEXP);
                nameWriter();
            }
            this.writeString(value.source);
            this.writeNull();
            if (value.ignoreCase) this.writeString('i');
            if (value.global) this.writeString('s'); //BSON does not use the RegExp flag format
            if (value.multiline) this.writeString('m');
            this.writeNull();
        } else if ('string' === typeof value) {
            //size + content + null
            if (nameWriter) {
                this.writeByte(BSONType.STRING);
                nameWriter();
            }
            const start = this.offset;
            this.offset += 4; //size placeholder
            this.writeString(value);
            this.writeByte(0); //null
            this.writeDelayedSize(this.offset - start - 4, start);
        } else if ('number' === typeof value) {
            if (Math.floor(value) === value) {
                //it's an int
                if (value >= BSON_INT32_MIN && value <= BSON_INT32_MAX) {
                    //32bit
                    if (nameWriter) {
                        this.writeByte(BSONType.INT);
                        nameWriter();
                    }
                    this.writeInt32(value);
                } else if (value >= JS_INT_MIN && value <= JS_INT_MAX) {
                    //double, 64bit
                    if (nameWriter) {
                        this.writeByte(BSONType.NUMBER);
                        nameWriter();
                    }
                    this.writeDouble(value);
                } else {
                    //long, but we serialize as Double, because deserialize will be BigInt
                    if (nameWriter) {
                        this.writeByte(BSONType.NUMBER);
                        nameWriter();
                    }
                    this.writeDouble(value);
                }
            } else {
                //double
                if (nameWriter) {
                    this.writeByte(BSONType.NUMBER);
                    nameWriter();
                }
                this.writeDouble(value);
            }
        } else if (value instanceof Date) {
            if (nameWriter) {
                this.writeByte(BSONType.DATE);
                nameWriter();
            }

            this.writeUint32((value.valueOf() % TWO_PWR_32_DBL_N) | 0); //low
            this.writeUint32((value.valueOf() / TWO_PWR_32_DBL_N) | 0); //high
        } else if (isUUID(value)) {
            if (nameWriter) {
                this.writeByte(BSONType.BINARY);
                nameWriter();
            }
            this.writeUUID(value);
        } else if ('bigint' === typeof value) {
            if (nameWriter) {
                this.writeByte(BSONType.BINARY);
                nameWriter();
            }
            this.writeBigInt(value);
        } else if (isObjectId(value)) {
            if (nameWriter) {
                this.writeByte(BSONType.OID);
                nameWriter();
            }
            this.writeObjectId(value);
        } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
            if (nameWriter) {
                this.writeByte(BSONType.BINARY);
                nameWriter();
            }
            let view = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
            if ((value as any)['_bsontype'] === 'Binary') {
                view = (value as any).buffer;
            }

            this.writeUint32(value.byteLength);
            this.writeByte(BSON_BINARY_SUBTYPE_DEFAULT);

            for (let i = 0; i < value.byteLength; i++) {
                this.buffer[this.offset++] = view[i];
            }
        } else if (isArray(value)) {
            if (nameWriter) {
                this.writeByte(BSONType.ARRAY);
                nameWriter();
            }
            const start = this.offset;
            this.offset += 4; //size

            for (let i = 0; i < value.length; i++) {
                this.write(value[i], () => {
                    this.writeAsciiString('' + i);
                    this.writeByte(0);
                });
            }
            this.writeNull();
            this.writeDelayedSize(this.offset - start, start);
        } else if (value === undefined) {
            if (nameWriter) {
                this.writeByte(BSONType.UNDEFINED);
                nameWriter();
            }
        } else if (value === null) {
            if (nameWriter) {
                this.writeByte(BSONType.NULL);
                nameWriter();
            }
        } else if (isObject(value)) {
            if (nameWriter) {
                this.writeByte(BSONType.OBJECT);
                nameWriter();
            }
            const start = this.offset;
            this.offset += 4; //size

            for (let i in value) {
                if (!value.hasOwnProperty(i)) continue;
                this.write(value[i], () => {
                    this.writeString(i);
                    this.writeByte(0);
                });
            }
            this.writeNull();
            this.writeDelayedSize(this.offset - start, start);
        } else {
            //the sizer incldues the type and name, so we have to write that
            if (nameWriter) {
                this.writeByte(BSONType.UNDEFINED);
                nameWriter();
            }
        }
    }
}

function getNameWriterCode(property: PropertySchema): string {
    const nameSetter: string[] = [];
    for (let i = 0; i < property.name.length; i++) {
        nameSetter.push(`writer.buffer[writer.offset++] = ${property.name.charCodeAt(i)};`);
    }
    return `
        //write name: '${property.name}'
        ${nameSetter.join('\n')}
        writer.writeByte(0); //null
    `;
}

function getPropertySerializerCode(
    schema: ClassSchema,
    compiler: CompilerContext,
    property: PropertySchema,
    accessor: string,
    jitStack: JitStack,
    nameAccessor?: string,
): string {
    if (property.isParentReference) return '';

    let nameWriter = `
        writer.writeAsciiString(${nameAccessor});
        writer.writeByte(0);
    `;

    if (!nameAccessor) {
        nameWriter = getNameWriterCode(property);
    }

    let undefinedWriter = `
    writer.writeByte(${BSONType.UNDEFINED});
    ${nameWriter}`;

    let code = `writer.write(${accessor}, () => {
        ${nameWriter}
    });`;

    //important to put it after nameWriter and nullable check, since we want to keep the name
    if (property.type === 'class' && property.getResolvedClassSchema().decorator) {
        property = property.getResolvedClassSchema().getDecoratedPropertySchema();
        accessor = `(${accessor} && ${accessor}.${property.name})`;
    }

    if (property.type === 'class') {
        const propertySerializer = `_serializer_${property.name}`;
        const forwardSchema = property.getResolvedClassSchema();
        const serializerFn = jitStack.getOrCreate(property.getResolvedClassSchema(), () => createBSONSerialize(property.getResolvedClassSchema(), jitStack));
        compiler.context.set(propertySerializer, serializerFn);
        const unpopulatedSymbolVar = compiler.reserveVariable('unpopulatedSymbol', unpopulatedSymbol);
        compiler.context.set('isObject', isObject);
        compiler.context.set('UUIDSymbol', UUIDSymbol);
        compiler.context.set('ObjectIdSymbol', ObjectIdSymbol);

        let primarKeyHandling = '';
        const isReference = property.isReference || (property.parent && property.parent.isReference);
        if (isReference) {
            primarKeyHandling = getPropertySerializerCode(schema, compiler, forwardSchema.getPrimaryField(), accessor, jitStack, nameAccessor || JSON.stringify(property.name));
        }

        let circularCheck = 'true';
        if (schema.hasCircularReference()) {
            circularCheck = `!_stack.includes(${accessor})`;
        }

        code = `
        if (${accessor} !== ${unpopulatedSymbolVar}) {
            if (isObject(${accessor}) && !${accessor}.hasOwnProperty(UUIDSymbol) && !${accessor}.hasOwnProperty(ObjectIdSymbol) && ${circularCheck}) {
                writer.writeByte(${BSONType.OBJECT});
                ${nameWriter}
                ${propertySerializer}.fn(${accessor}, writer, _stack);
            } else if (${isReference})  {
                ${primarKeyHandling}
            } else {
                ${undefinedWriter}
            }
        } else {
            ${undefinedWriter}
        }
        `;
    } else if (property.type === 'string') {
        code = `
        if (typeof ${accessor} === 'string') {
            writer.writeByte(${BSONType.STRING});
            ${nameWriter}
            const start = writer.offset;
            writer.offset += 4; //size placeholder
            writer.writeString(${accessor});
            writer.writeByte(0); //null
            writer.writeDelayedSize(writer.offset - start - 4, start);
        } else {
            ${undefinedWriter}
        }
        `;
    } else if (property.type === 'literal') {
        code = `
        if (typeof ${accessor} === 'string' || typeof ${accessor} === 'number' || typeof ${accessor} === 'boolean') {
            ${code}
        } else if (!${property.isOptional} && !${property.isOptional}) {
            writer.write(${JSON.stringify(property.literalValue)}, () => {
                ${nameWriter}
            });
        } else {
            ${undefinedWriter}
        }
        `;
    } else if (property.type === 'boolean') {
        code = `
        if (typeof ${accessor} === 'boolean') {
            writer.writeByte(${BSONType.BOOLEAN});
            ${nameWriter}
            writer.writeByte(${accessor} ? 1 : 0);
        } else {
            ${undefinedWriter}
        }
        `;
    } else if (property.type === 'date') {
        compiler.context.set('TWO_PWR_32_DBL_N', TWO_PWR_32_DBL_N);
        code = `
        if (${accessor} instanceof Date) {
            writer.writeByte(${BSONType.DATE});
            ${nameWriter}
            if (!(${accessor} instanceof Date)) {
                throw new Error(${JSON.stringify(accessor)} + " not a Date object");
            }

            writer.writeUint32((${accessor} % TWO_PWR_32_DBL_N) | 0); //low
            writer.writeUint32((${accessor} / TWO_PWR_32_DBL_N) | 0); //high
        } else {
            ${undefinedWriter}
        }
        `;
    } else if (property.type === 'objectId') {
        compiler.context.set('isObjectId', isObjectId);
        compiler.context.set('hexToByte', hexToByte);
        code = `
            if ('string' === typeof ${accessor} || isObjectId(${accessor})) {
                writer.writeByte(${BSONType.OID});
                ${nameWriter}
                writer.writeObjectId(${accessor});
            } else {
                ${undefinedWriter}
            }
        `;
    } else if (property.type === 'uuid') {
        compiler.context.set('isUUID', isUUID);
        compiler.context.set('UUID', UUID);
        code = `
        if ('string' === typeof ${accessor} || isUUID(${accessor})) {
            writer.writeByte(${BSONType.BINARY});
            ${nameWriter}
            writer.writeUUID(${accessor});
        } else {
            ${undefinedWriter}
        }
        `;
    } else if (property.type === 'bigint') {
        code = `
            if ('bigint' === typeof ${accessor}) {
                writer.writeByte(${BSONType.BINARY});
                ${nameWriter}
                writer.writeBigInt(${accessor});
            }
        `;

    } else if (property.type === 'number') {
        compiler.context.set('TWO_PWR_32_DBL_N', TWO_PWR_32_DBL_N);
        code = `
            if ('bigint' === typeof ${accessor}) {
                //long
                writer.writeByte(${BSONType.LONG});
                ${nameWriter}
                writer.writeUint32(Number(${accessor} % BigInt(TWO_PWR_32_DBL_N)) | 0); //low
                writer.writeUint32(Number(${accessor} / BigInt(TWO_PWR_32_DBL_N)) | 0); //high
            } else if ('number' === typeof ${accessor}) {
                if (Math.floor(${accessor}) === ${accessor}) {
                    //it's an int
                    if (${accessor} >= ${BSON_INT32_MIN} && ${accessor} <= ${BSON_INT32_MAX}) {
                        //32bit
                        writer.writeByte(${BSONType.INT});
                        ${nameWriter}
                        writer.writeInt32(${accessor});
                    } else if (${accessor} >= ${JS_INT_MIN} && ${accessor} <= ${JS_INT_MAX}) {
                        //double, 64bit
                        writer.writeByte(${BSONType.NUMBER});
                        ${nameWriter}
                        writer.writeDouble(${accessor});
                    } else {
                        //long, but we serialize as Double, because deserialize will be BigInt
                        writer.writeByte(${BSONType.NUMBER});
                        ${nameWriter}
                        writer.writeDouble(${accessor});
                    }
                } else {
                    //double, 64bit
                    writer.writeByte(${BSONType.NUMBER});
                    ${nameWriter}
                    writer.writeDouble(${accessor});
                }
            } else {
                ${undefinedWriter}
            }
        `;
    } else if (property.type === 'array') {
        const i = compiler.reserveVariable('i');
        const isArrayVar = compiler.reserveVariable('isArray', isArray);
        const unpopulatedSymbolVar = compiler.reserveVariable('unpopulatedSymbol', unpopulatedSymbol);

        code = `
        if (${accessor} && ${accessor} !== ${unpopulatedSymbolVar} && ${isArrayVar}(${accessor})) {
            writer.writeByte(${BSONType.ARRAY});
            ${nameWriter}
            const start = writer.offset;
            writer.offset += 4; //size

            for (let ${i} = 0; ${i} < ${accessor}.length; ${i}++) {
                //${property.getSubType().name} (${property.getSubType().type})
                ${getPropertySerializerCode(schema, compiler, property.getSubType(), `${accessor}[${i}]`, jitStack, `''+${i}`)}
            }
            writer.writeNull();
            writer.writeDelayedSize(writer.offset - start, start);
        } else {
            ${undefinedWriter}
        }
        `;
    } else if (property.type === 'map') {
        const i = compiler.reserveVariable('i');
        code = `
            writer.writeByte(${BSONType.OBJECT});
            ${nameWriter}
            const start = writer.offset;
            writer.offset += 4; //size

            for (let ${i} in ${accessor}) {
                if (!${accessor}.hasOwnProperty(${i})) continue;
                //${property.getSubType().name} (${property.getSubType().type})
                ${getPropertySerializerCode(schema, compiler, property.getSubType(), `${accessor}[${i}]`, jitStack, `${i}`)}
            }
            writer.writeNull();
            writer.writeDelayedSize(writer.offset - start, start);
        `;
    } else if (property.type === 'union') {
        let discriminator: string[] = [`if (false) {\n}`];
        const discriminants: string[] = [];
        for (const unionType of getSortedUnionTypes(property, jsonTypeGuards)) {
            discriminants.push(unionType.property.type);
        }
        const elseBranch = `throw new Error('No valid discriminant was found for ${property.name}, so could not determine class type. Guard tried: [${discriminants.join(',')}]. Got: ' + ${accessor});`;

        for (const unionType of getSortedUnionTypes(property, jsonTypeGuards)) {
            const guardVar = compiler.reserveVariable('guard_' + unionType.property.type, unionType.guard);

            discriminator.push(`
                //guard
                else if (${guardVar}(${accessor})) {
                    //${unionType.property.name} (${unionType.property.type})
                    ${getPropertySerializerCode(schema, compiler, unionType.property, `${accessor}`, jitStack, nameAccessor || JSON.stringify(property.name))}
                }
            `);
        }

        code = `
            ${discriminator.join('\n')}
            else {
                ${elseBranch}
            }
        `;
    }

    // since JSON does not support undefined, we emulate it via using null for serialization, and convert that back to undefined when deserialization happens
    // not: When the value is not defined (property.name in object === false), then this code will never run.
    let writeDefaultValue = `
        writer.writeByte(${BSONType.NULL});
        ${nameWriter}
    `;

    if (!property.hasDefaultValue && property.defaultValue !== undefined) {
        const propertyVar = compiler.reserveVariable('property', property);
        const cloned = property.clone();
        cloned.defaultValue = undefined;
        writeDefaultValue = getPropertySerializerCode(schema, compiler, cloned, `${propertyVar}.lastGeneratedDefaultValue`, jitStack);
    } else if (!property.isOptional && property.type === 'literal') {
        writeDefaultValue = `writer.write(${JSON.stringify(property.literalValue)}, () => {${nameWriter}});`;
    }

    // Since mongodb does not support undefined as column type (or better it shouldn't be used that way)
    // we transport fields that are `undefined` and isOptional as `null`, and decode this `null` back to `undefined`.
    return `
    if (${accessor} === undefined) {
        ${writeDefaultValue}
    } else if (${accessor} === null) {
        if (${property.isNullable}) {
            writer.writeByte(${BSONType.NULL});
            ${nameWriter}
        } else {
            ${writeDefaultValue}
        }
    } else {
        //serialization code
        ${code}
    }
    `;
}

function createBSONSerialize(schema: ClassSchema, jitStack: JitStack = new JitStack()): (data: object, writer?: Writer) => Uint8Array {
    const compiler = new CompilerContext();
    const prepared = jitStack.prepare(schema);
    compiler.context.set('_global', getGlobalStore());
    compiler.context.set('UnpopulatedCheck', UnpopulatedCheck);
    compiler.context.set('_sizer', getBSONSizer(schema));
    compiler.context.set('Writer', Writer);
    compiler.context.set('seekElementSize', seekElementSize);
    compiler.context.set('createBuffer', createBuffer);
    compiler.context.set('schema', schema);

    let functionCode = '';

    let getPropertyCode: string[] = [];
    for (const property of schema.getProperties()) {

        let setDefault = '';
        if (property.hasManualDefaultValue() || property.type === 'literal') {
            if (property.defaultValue !== undefined) {
                const propertyVar = compiler.reserveVariable('property', property);
                //the sizer creates for us a lastGeneratedDefaultValue
                setDefault = getPropertySerializerCode(schema, compiler, property, `${propertyVar}.lastGeneratedDefaultValue`, jitStack);
            } else if (property.type === 'literal' && !property.isOptional) {
                setDefault = getPropertySerializerCode(schema, compiler, property, JSON.stringify(property.literalValue), jitStack);
            }
        } else if (property.isNullable) {
            setDefault = getPropertySerializerCode(schema, compiler, property, 'null', jitStack);
        }

        getPropertyCode.push(`
            //${property.name}:${property.type}
            if (${JSON.stringify(property.name)} in obj) {
                ${getPropertySerializerCode(schema, compiler, property, `obj.${property.name}`, jitStack)}
            } else {
                ${setDefault}
            }
        `);
    }

    let circularCheckBeginning = '';
    let circularCheckEnd = '';

    if (schema.hasCircularReference()) {
        circularCheckBeginning = `
        if (!_stack) _stack = [];
        _stack.push(obj);
        `;
        circularCheckEnd = `_stack.pop();`;
    }

    functionCode = `
        ${circularCheckBeginning}
        const size = _sizer(obj, _stack);
        writer = writer || new Writer(createBuffer(size));
        const started = writer.offset;
        writer.writeUint32(size);
        const unpopulatedCheck = _global.unpopulatedCheck;
        _global.unpopulatedCheck = UnpopulatedCheck.ReturnSymbol;

        ${getPropertyCode.join('\n')}
        writer.writeNull();

        _global.unpopulatedCheck = unpopulatedCheck;
        if (size !== writer.offset - started) {
            console.error('Wrong size calculated. Calculated=' + size + ', but serializer wrote ' + (writer.offset - started) + ' bytes. Object: ', JSON.stringify(obj), Object.getOwnPropertyNames(obj), schema.toString());
            throw new Error('Wrong size calculated. Calculated=' + size + ', but serializer wrote ' + (writer.offset - started) + ' bytes');
        }

        ${circularCheckEnd}
        return writer.buffer;
    `;

    const fn = compiler.build(functionCode, 'obj', 'writer', '_stack');
    prepared(fn);
    return fn;
}

export function serialize(data: any): Uint8Array {
    const size = getValueSize(data);
    const writer = new Writer(createBuffer(size));
    writer.write(data);
    return writer.buffer;
}

export type BSONSerializer = (data: any, writer?: Writer) => Uint8Array;
export type BSONSizer = (data: any) => number;

/**
 * Serializes an schema instance to BSON.
 *
 * Note: The instances needs to be in the mongo format already since it does not resolve decorated properties.
 *       So call it with the result of classToMongo(Schema, item).
 */
export function getBSONSerializer(schema: ClassSchema | ClassType): BSONSerializer {
    schema = getClassSchema(schema);

    const jit = schema.jit;
    if (jit.bsonSerializer) return jit.bsonSerializer;

    jit.bsonSerializer = createBSONSerialize(schema);
    toFastProperties(jit);
    return jit.bsonSerializer;
}

export function getBSONSizer(schema: ClassSchema | ClassType): BSONSizer {
    schema = getClassSchema(schema);

    const jit = schema.jit;
    if (jit.bsonSizer) return jit.bsonSizer;

    jit.bsonSizer = createBSONSizer(schema);
    toFastProperties(jit);
    return jit.bsonSizer;
}
