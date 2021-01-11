/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {ClassType, CompilerContext} from '@deepkit/core';
import {ClassSchema, getClassSchema, getDataConverterJS, getSortedUnionTypes, PropertySchema} from '@deepkit/type';
import {BaseParser, ParserV2} from './bson-parser';
import {bsonTypeGuards} from './bson-typeguards';
import {seekElementSize} from './continuation';
import {BSONType, BSON_BINARY_SUBTYPE_UUID, digitByteSize} from './utils';

function createPropertyConverter(setter: string, property: PropertySchema, compiler: CompilerContext, parentProperty?: PropertySchema): string {
    //we want the isNullable value from the actual property, not the decorated.
    const nullOrSeek = `
        if (elementType === ${BSONType.NULL}) {
            ${setter} = null;
        } else {
            seekElementSize(elementType, parser);
        }
    `;

    // if (property.type === 'class' && property.getResolvedClassSchema().decorator) {
    //     property = property.getResolvedClassSchema().getDecoratedPropertySchema();
    // }

    const propertyVar = '_property_' + property.name;
    compiler.context.set(propertyVar, property);

    if (property.type === 'uuid') {
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
    } else if (property.type === 'class') {
        const schema = property.getResolvedClassSchema();

        if (property.isReference || property.backReference || (parentProperty && (parentProperty.backReference || parentProperty.isReference))) {
            const primary = schema.getPrimaryField();
            return createPropertyConverter(setter, primary, compiler);
        }

        if (schema.decorator) {
            //we need to create the instance and assign
            const forwardProperty = schema.getDecoratedPropertySchema();
            const decoratedVar = compiler.reserveVariable('decorated');
            const classTypeVar = compiler.reserveVariable('classType', property.classType);
            let arg = '';
            const propertyAssign: string[] = [];
            if (forwardProperty.methodName === 'constructor') {
                arg = decoratedVar;
            } else {
                propertyAssign.push(`${setter}.${forwardProperty.name} = ${decoratedVar};`);
            }

            return `
            if (elementType === ${BSONType.NULL}) {
                ${setter} = null;
            } else {
                ${decoratedVar} = undefined;
                ${createPropertyConverter(decoratedVar, schema.getDecoratedPropertySchema(), compiler)}
                
                ${setter} = new ${classTypeVar}(${arg});
                ${propertyAssign.join('\n')}
            }
            `;

            return createPropertyConverter(setter, schema.getDecoratedPropertySchema(), compiler);
        }

        const propertySchema = '_propertySchema_' + property.name;
        compiler.context.set('getRawBSONDecoder', getRawBSONDecoder);
        compiler.context.set(propertySchema, property.getResolvedClassSchema());

        return `
            if (elementType === ${BSONType.OBJECT}) {
                ${setter} = getRawBSONDecoder(${propertySchema})(parser);
            } else {
                ${nullOrSeek}
            }
            `;
    } else if (property.isArray) {
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
    } else if (property.isMap) {
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
        let elseBranch = `throw new Error('No valid discriminant for property ${property.name} was found, so could not determine class type. Guard tried: [${discriminants.join(',')}].');`;

        if (property.isOptional) {
            elseBranch = `
            //isOptional
            // ${setter} = undefined;
            ${nullOrSeek}
            `;
        } else if (property.isNullable) {
            elseBranch = `
            //isNullable
            // ${setter} = null;
            ${nullOrSeek}
            `;
        } else if (property.hasManualDefaultValue()) {
            const defaultVar = compiler.reserveVariable('default', property.defaultValue);
            //we omit default values in BSON. That's only necesary for decoding
            elseBranch = `
                ${setter} = ${defaultVar};
            `;
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
                ${elseBranch}
            }
        `;
    }

    return `
        if (elementType === ${BSONType.NULL}) {
            ${setter} = null;
        } else {
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

    let propertyCode: string[] = [];
    for (const property of schema.getClassProperties().values()) {
        //todo, support non-ascii names
        const bufferCompare: string[] = [];
        for (let i = 0; i < property.name.length; i++) {
            bufferCompare.push(`parser.buffer[parser.offset + ${i}] === ${property.name.charCodeAt(i)}`);
        }
        bufferCompare.push(`parser.buffer[parser.offset + ${property.name.length}] === 0`);

        if (property.methodName === 'constructor') {
            constructorArgumentNames[constructorParameter.indexOf(property)] = `object.${property.name}`;
        } else {
            if (property.isParentReference) {
                throw new Error('Parent references not supported in BSON.');
            } else {
                setProperties.push(`_instance.${property.name} = object.${property.name};`);
            }
        }

        propertyCode.push(`
            //property ${property.name} (${property.type})
            if (${bufferCompare.join(' && ')}) {
                parser.offset += ${property.name.length} + 1;
                ${createPropertyConverter(`object.${property.name}`, property, compiler)}
                continue;
            }
        `);
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
        parser.seek((offset || 0) + 4);

        while (true) {
            const elementType = parser.eatByte();
            if (elementType === 0) break;

            ${propertyCode.join('\n')}

            //jump over this property when not registered in schema
            while (parser.buffer[parser.offset++] != 0);
            //seek property value
            seekElementSize(elementType, parser);
        }

        ${schema.isCustomClass() ? instantiate : 'return object;'}
    `;

    const fn = compiler.build(functionCode, 'parser', 'offset', '_options');
    fn.buildId = schema.buildId;
    return fn;
}

export function getRawBSONDecoder<T>(schema: ClassSchema<T> | ClassType<T>): (parser: BaseParser, offset?: number) => T {
    schema = schema instanceof ClassSchema ? schema : getClassSchema(schema);

    if (schema.jit.rawBson) return schema.jit.rawBson;
    schema.jit.rawBson = createSchemaDecoder(schema);

    return schema.jit.rawBson;
}

export function getBSONDecoder<T>(schema: ClassSchema<T> | ClassType<T>): (bson: Uint8Array, offset?: number) => T {
    const fn = getRawBSONDecoder(schema);

    return (bson, offset = 0) => {
        return fn(new ParserV2(bson), offset);
    };
}
