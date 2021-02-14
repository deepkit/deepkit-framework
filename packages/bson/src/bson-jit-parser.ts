/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, CompilerContext } from '@deepkit/core';
import { ClassSchema, getClassSchema, getSortedUnionTypes, PropertySchema } from '@deepkit/type';
import { BaseParser, ParserV2 } from './bson-parser';
import { bsonTypeGuards } from './bson-typeguards';
import { seekElementSize } from './continuation';
import { BSONType, BSON_BINARY_SUBTYPE_UUID, digitByteSize } from './utils';

function createPropertyConverter(setter: string, property: PropertySchema, compiler: CompilerContext, parentProperty?: PropertySchema): string {
    //we want the isNullable value from the actual property, not the decorated.
    const defaultValue = !property.hasDefaultValue && property.defaultValue !== undefined ?
        `${compiler.reserveVariable('defaultValue', property.defaultValue)}()`
        : 'undefined';

    const nullCheck = `
    if (elementType === ${BSONType.UNDEFINED}) {
        if (${property.isOptional}) ${setter} = ${defaultValue};
    } else if (elementType === ${BSONType.NULL}) {
        if (${property.isOptional}) ${setter} = ${defaultValue};
        if (${property.isNullable}) ${setter} = null;
    }`;

    const nullOrSeek = `
        ${nullCheck} else {
            seekElementSize(elementType, parser);
        }
    `;

    // if (property.type === 'class' && property.getResolvedClassSchema().decorator) {
    //     property = property.getResolvedClassSchema().getDecoratedPropertySchema();
    // }

    const propertyVar = '_property_' + property.name;
    compiler.context.set(propertyVar, property);

    if (property.type === 'string') {
        return `
            if (elementType === ${BSONType.STRING}) {
                const size = parser.eatUInt32(); //size
                ${setter} = parser.eatString(size);
            } else {
                ${nullOrSeek}
            }
        `;
    } else if (property.type === 'literal') {
        const literalValue = compiler.reserveVariable('literalValue', property.literalValue);
        if (property.isOptional || property.isNullable) {
            return `
                if (${property.isOptional} && (elementType === ${BSONType.UNDEFINED} || elementType === ${BSONType.NULL})) {
                    ${setter} = ${defaultValue};
                } else if (${property.isNullable} && elementType === ${BSONType.NULL}) {
                    ${setter} = null;
                } else {
                    ${setter} = ${literalValue};
                    seekElementSize(elementType, parser);
                }
            `;
        } else {
            return `
                ${setter} = ${literalValue};
                seekElementSize(elementType, parser);
            `;
        }
    } else if (property.type === 'enum') {
        return `
        if (elementType === ${BSONType.STRING} || elementType === ${BSONType.NUMBER} || elementType === ${BSONType.INT} || elementType === ${BSONType.LONG}) {
            ${setter} = parser.parse(elementType);
        } else {
            ${nullOrSeek}
        }`;
    } else if (property.type === 'boolean') {
        return `
            if (elementType === ${BSONType.BOOLEAN}) {
                ${setter} = parser.parseBoolean();
            } else {
                ${nullOrSeek}
            }
        `;
    } else if (property.type === 'date') {
        return `
            if (elementType === ${BSONType.DATE}) {
                ${setter} = parser.parseDate();
            } else {
                ${nullOrSeek}
            }
        `;
    } else if (property.type === 'number') {
        return `
            if (elementType === ${BSONType.INT}) {
                ${setter} = parser.parseInt();
            } else if (elementType === ${BSONType.NUMBER}) {
                ${setter} = parser.parseNumber();
            } else if (elementType === ${BSONType.LONG} || elementType === ${BSONType.TIMESTAMP}) {
                ${setter} = parser.parseLong();
            } else {
                ${nullOrSeek}
            }
        `;
    } else if (property.type === 'uuid') {
        return `
            if (elementType === ${BSONType.BINARY}) {
                parser.eatUInt32(); //size
                const subType = parser.eatByte();
                if (subType !== ${BSON_BINARY_SUBTYPE_UUID}) throw new Error('${property.name} BSON binary type invalid. Expected UUID(4), but got ' + subType); 
                ${setter} = parser.parseUUID();
            } else {
                ${nullOrSeek}
            }
            `;
    } else if (property.type === 'objectId') {
        return `
            if (elementType === ${BSONType.OID}) {
                ${setter} = parser.parseOid();
            } else {
                ${nullOrSeek}
            }
            `;
    } else if (property.type === 'partial') {
        const object = compiler.reserveVariable('partiaObject', {});
        const propertyCode: string[] = [];
        const schema = property.getResolvedClassSchema();

        for (let subProperty of schema.getProperties()) {
            //todo, support non-ascii names
            const bufferCompare: string[] = [];
            for (let i = 0; i < subProperty.name.length; i++) {
                bufferCompare.push(`parser.buffer[parser.offset + ${i}] === ${subProperty.name.charCodeAt(i)}`);
            }
            bufferCompare.push(`parser.buffer[parser.offset + ${subProperty.name.length}] === 0`);

            propertyCode.push(`
            //partial: property ${subProperty.name} (${subProperty.toString()})
            if (${bufferCompare.join(' && ')}) {
                parser.offset += ${subProperty.name.length} + 1;
                ${createPropertyConverter(`${object}.${subProperty.name}`, subProperty, compiler)}
                continue;
            }
        `);
        }

        return `
        if (elementType === ${BSONType.OBJECT}) {
            ${object} = {};
            const end = parser.eatUInt32() + parser.offset;
            
            while (parser.offset < end) {
                const elementType = parser.eatByte();
                if (elementType === 0) break;
                
                ${propertyCode.join('\n')}
                
                //jump over this property when not registered in schema
                while (parser.offset < end && parser.buffer[parser.offset++] != 0);

                //seek property value
                if (parser.offset >= end) break;
                seekElementSize(elementType, parser);
            }
            ${setter} = ${object};
        } else {
            ${nullOrSeek}
        }
    `;

    } else if (property.type === 'class') {
        const schema = property.getResolvedClassSchema();

        if (schema.decorator) {
            //we need to create the instance and assign
            const forwardProperty = schema.getDecoratedPropertySchema();
            const decoratedVar = compiler.reserveVariable('decorated');
            const classTypeVar = compiler.reserveVariable('classType', property.classType);
            let arg = '';
            const propertyAssign: string[] = [];

            const check = forwardProperty.isOptional ? `'v' in ${decoratedVar}` : `${decoratedVar}.v !== undefined`;

            if (forwardProperty.methodName === 'constructor') {
                arg = `(${check} ? ${decoratedVar}.v : undefined)`;
            } else {
                propertyAssign.push(`if (${check}) ${setter}.${forwardProperty.name} = ${decoratedVar}.v;`);
            }

            return `
            //decorated
            if (elementType !== ${BSONType.UNDEFINED} && elementType !== ${BSONType.NULL}) {
                ${decoratedVar} = {};
                ${createPropertyConverter(`${decoratedVar}.v`, schema.getDecoratedPropertySchema(), compiler)}

                ${setter} = new ${classTypeVar}(${arg});
                ${propertyAssign.join('\n')}
            } else {
                ${nullOrSeek}
            }
            `;
        }

        const propertySchema = '_propertySchema_' + property.name;
        compiler.context.set('getRawBSONDecoder', getRawBSONDecoder);
        compiler.context.set(propertySchema, property.getResolvedClassSchema());
        let primaryKeyHandling = '';
        if (property.isReference) {
            primaryKeyHandling = createPropertyConverter(setter, property.getResolvedClassSchema().getPrimaryField(), compiler);
        }
        
        return `
            if (elementType === ${BSONType.OBJECT}) {
                ${setter} = getRawBSONDecoder(${propertySchema})(parser);
            } else if (${property.isReference}) {
                ${primaryKeyHandling}
            } else {
                ${nullOrSeek}
            }
            `;
    } else if (property.type === 'array') {
        compiler.context.set('digitByteSize', digitByteSize);
        const v = compiler.reserveVariable('v');

        return `
        if (elementType === ${BSONType.ARRAY}) {
            ${setter} = [];
            parser.seek(4);
            for (let i = 0; ; i++) {
                const elementType = parser.eatByte();
                if (elementType === 0) break;
        
                //arrays are represented as objects, so we skip the key name
                parser.seek(digitByteSize(i));
        
                let ${v} = undefined;
                ${createPropertyConverter(v, property.getSubType(), compiler, property)}
                ${setter}.push(${v});
            }
        } else {
            ${nullOrSeek}
        }
        `;
    } else if (property.type === 'map') {
        const name = compiler.reserveVariable('propertyName');

        return `
        if (elementType === ${BSONType.OBJECT}) {
            ${setter} = {};
            parser.seek(4);
            while (true) {
                const elementType = parser.eatByte();
                if (elementType === 0) break;

                ${name} = parser.eatObjectPropertyName();

                ${createPropertyConverter(`${setter}[${name}]`, property.getSubType(), compiler)}
            }
        } else {
            ${nullOrSeek}
        }
        `;
    } else if (property.type === 'union') {
        let discriminator: string[] = [`if (false) {\n}`];
        const discriminants: string[] = [];
        for (const unionType of getSortedUnionTypes(property, bsonTypeGuards)) {
            discriminants.push(unionType.property.type);
        }

        for (const unionType of getSortedUnionTypes(property, bsonTypeGuards)) {
            const guardVar = compiler.reserveVariable('guard_' + unionType.property.type, unionType.guard);
            discriminator.push(`
                //guard:${unionType.property.type}
                else if (${guardVar}(elementType, parser)) {
                    ${createPropertyConverter(setter, unionType.property, compiler, property)}
                }
            `);
        }

        return `
            ${discriminator.join('\n')}
            else {
                ${nullOrSeek}
            }
        `;
    }

    return `
        ${nullCheck} else {
            ${setter} = parser.parse(elementType, ${propertyVar});
        }
    `;
}

interface DecoderFn {
    buildId: number;

    (parser: BaseParser, offset?: number): any;
}

function createSchemaDecoder(schema: ClassSchema): DecoderFn {
    const compiler = new CompilerContext();
    compiler.context.set('seekElementSize', seekElementSize);

    const setProperties: string[] = [];
    const constructorArgumentNames: string[] = [];
    const constructorParameter = schema.getMethodProperties('constructor');

    const resetDefaultSets: string[] = [];
    const setDefaults: string[] = [];

    const propertyCode: string[] = [];
    for (const property of schema.getProperties()) {
        //todo, support non-ascii names
        const bufferCompare: string[] = [];
        for (let i = 0; i < property.name.length; i++) {
            bufferCompare.push(`parser.buffer[parser.offset + ${i}] === ${property.name.charCodeAt(i)}`);
        }
        bufferCompare.push(`parser.buffer[parser.offset + ${property.name.length}] === 0`);
        const valueSetVar = compiler.reserveVariable('valueSetVar', false);

        const defaultValue = property.defaultValue !== undefined ? compiler.reserveVariable('defaultValue', property.defaultValue) : 'undefined';

        if (property.hasManualDefaultValue() || property.type === 'literal') {
            resetDefaultSets.push(`${valueSetVar} = false;`)

            if (property.defaultValue !== undefined) {
                setDefaults.push(`if (!${valueSetVar}) object.${property.name} = ${defaultValue};`)
            } else if (property.type === 'literal' && !property.isOptional) {
                setDefaults.push(`if (!${valueSetVar}) object.${property.name} = ${JSON.stringify(property.literalValue)};`)

            }
        } else if (property.isNullable) {
            resetDefaultSets.push(`${valueSetVar} = false;`)
            setDefaults.push(`if (!${valueSetVar}) object.${property.name} = null;`)
        }

        const check = property.isOptional ? `${JSON.stringify(property.name)} in object` : `object.${property.name} !== undefined`;

        if (property.methodName === 'constructor') {
            constructorArgumentNames[constructorParameter.indexOf(property)] = `(${check} ? object.${property.name} : ${defaultValue})`;
        } else {
            if (property.isParentReference) {
                throw new Error('Parent references not supported in BSON.');
            } else {
                setProperties.push(`if (${check}) _instance.${property.name} = object.${property.name};`);
            }
        }

        propertyCode.push(`
            //property ${property.name} (${property.toString()})
            if (${bufferCompare.join(' && ')}) {
                parser.offset += ${property.name.length} + 1;
                ${valueSetVar ? `${valueSetVar} = true;` : ''}
                ${createPropertyConverter(`object.${property.name}`, property, compiler)}
                continue;
            } `);
    }

    let instantiate = '';
    if (schema.isCustomClass()) {
        compiler.context.set('_classType', schema.classType);
        instantiate = `
            _instance = new _classType(${constructorArgumentNames.join(', ')});
            ${setProperties.join('\n')}
            return _instance;
        `;
    }

    const functionCode = `
        var object = {};
        ${schema.isCustomClass() ? 'var _instance;' : ''}
        const end = parser.eatUInt32() + parser.offset;
        
        ${resetDefaultSets.join('\n')}

        while (parser.offset < end) {
            const elementType = parser.eatByte();
            if (elementType === 0) break;

            ${propertyCode.join('\n')}

            //jump over this property when not registered in schema
            while (parser.offset < end && parser.buffer[parser.offset++] != 0);
            //seek property value
            if (parser.offset >= end) break;
            seekElementSize(elementType, parser);
        }

        ${setDefaults.join('\n')}
        ${schema.isCustomClass() ? instantiate : 'return object;'}
    `;

    const fn = compiler.build(functionCode, 'parser', 'partial');
    fn.buildId = schema.buildId;
    return fn;
}

export function getRawBSONDecoder<T>(schema: ClassSchema<T> | ClassType<T>): (parser: BaseParser) => T {
    schema = schema instanceof ClassSchema ? schema : getClassSchema(schema);

    if (schema.jit.rawBson) return schema.jit.rawBson;
    schema.jit.rawBson = createSchemaDecoder(schema);

    return schema.jit.rawBson;
}

export type BSONDecoder<T> = (bson: Uint8Array, offset?: number) => T;

export function getBSONDecoder<T>(schema: ClassSchema<T> | ClassType<T>): BSONDecoder<T> {
    const fn = getRawBSONDecoder(schema);

    schema = schema instanceof ClassSchema ? schema : getClassSchema(schema);
    if (schema.jit.bsonEncoder) return schema.jit.bsonEncoder;

    schema.jit.bsonEncoder = (bson: Uint8Array, offset: number = 0) => {
        return fn(new ParserV2(bson, offset));
    };

    return schema.jit.bsonEncoder;
}
