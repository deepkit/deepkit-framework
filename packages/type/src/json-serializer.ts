/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, getEnumLabels, getEnumValues, getValidEnumValue, isObject, isValidEnumValue } from '@deepkit/core';
import { arrayBufferToBase64, base64ToArrayBuffer, base64ToTypedArray, typedArrayToBase64 } from './core';
import { getClassToXFunction, getPartialClassToXFunction, getPartialXToClassFunction, getXToClassFunction, JitConverterOptions } from './jit';
import { jsonTypeGuards } from './json-typeguards';
import { ClassSchema, getClassSchema, getClassTypeFromInstance, PropertySchema } from './model';
import { Serializer } from './serializer';
import { CompilerState, getDataConverterJS } from './serializer-compiler';
import { getSortedUnionTypes } from './union';
import { ExtractClassType, JSONEntity, PlainOrFullEntityFromClassTypeOrSchema } from './utils';
import { validate, ValidationFailed } from './validation';

export class JSONSerializer extends Serializer {
    constructor() {
        super('json');
    }
}

export const jsonSerializer = new JSONSerializer();

export function compilerToString(property: PropertySchema, state: CompilerState) {
    state.addSetter(`typeof ${state.accessor} === 'string' ? ${state.accessor} : ''+${state.accessor};`);
}


/**
 * Converts a class instance into a plain object, which can be used with JSON.stringify() to convert it into a JSON string.
 */
export function classToPlain<T extends ClassType | ClassSchema>(classTypeOrSchema: T, target: ExtractClassType<T>, options?: JitConverterOptions): JSONEntity<ExtractClassType<T>> {
    return getClassToXFunction(getClassSchema(classTypeOrSchema), jsonSerializer)(target, options);
}

/**
 * Take a regular object literal and returns an instance of classType.
 * Missing data is either replaced by the default value of that property or undefined.
 *
 * This method does not validate the given data. Use either [[validatedPlainToClass]] to validate beforehand
 * or use [[validate]] on your newly created instance.
 *
 * ```typescript
 * const entity = plainToClass(MyEntity, {field1: 'value'});
 * entity instanceof MyEntity; //true
 * ```
 */
export function plainToClass<T extends ClassType | ClassSchema>(
    classTypeOrSchema: T,
    data: PlainOrFullEntityFromClassTypeOrSchema<ExtractClassType<T>>,
    options?: JitConverterOptions
): ExtractClassType<T> {
    return getXToClassFunction(getClassSchema(classTypeOrSchema), jsonSerializer)(data, options);
}

/**
 * Same as [plainToClass] but with validation before creating the class instance.
 *
 * ```typescript
 * try {
 *     const entity = await validatedPlainToClass(MyEntity, {field1: 'value'});
 *     entity instanceof MyEntity; //true
 * } catch (error) {
 *     if (error instanceof ValidationFailed) {
 *         //handle that case.
 *     }
 * }
 * ```
 */
export function validatedPlainToClass<T extends ClassType | ClassSchema>(
    classType: T,
    data: PlainOrFullEntityFromClassTypeOrSchema<ExtractClassType<T>>,
    options?: JitConverterOptions
): ExtractClassType<T> {
    const errors = validate(classType, data);
    if (errors.length) {
        throw new ValidationFailed(errors);
    }

    return plainToClass(classType, data, options);
}

export function isBinaryJSON(v: any): boolean {
    return v && v['$type'] === 'binary' && typeof v.data === 'string';
}

export function isBigIntJSON(v: any): boolean {
    return v && v['$type'] === 'bigint' && typeof v.data === 'string';
}

/**
 * Clones a class instance deeply.
 */
export function cloneClass<T>(target: T, options?: JitConverterOptions): T {
    const s = jsonSerializer.for(getClassTypeFromInstance(target));
    return s.deserialize(s.serialize(target, options), options, options?.parents);
}


jsonSerializer.toClass.register('string', compilerToString);

export function compilerToNumber(property: PropertySchema, state: CompilerState) {
    state.addSetter(`typeof ${state.accessor} === 'number' ? ${state.accessor} : +${state.accessor};`);
}

jsonSerializer.toClass.register('number', compilerToNumber);
jsonSerializer.fromClass.register('number', compilerToNumber);

jsonSerializer.toClass.register('literal', (property: PropertySchema, state: CompilerState) => {
    const literalValue = state.setVariable('_literal_value_' + property.name, property.literalValue);
    state.addSetter(literalValue);
});

jsonSerializer.toClass.register('uuid', (property: PropertySchema, state: CompilerState) => {
    state.addCodeForSetter(`if ('string' === typeof ${state.accessor}) ${state.setter} = ${state.accessor};`);
});

jsonSerializer.fromClass.register('uuid', (property: PropertySchema, state: CompilerState) => {
    state.addCodeForSetter(`if ('string' === typeof ${state.accessor}) ${state.setter} = ${state.accessor};`);
});

jsonSerializer.toClass.prepend('undefined', (property, state: CompilerState) => {
    if (property.type === 'literal' && !property.isOptional) {
        const literalValue = state.setVariable('_literal_value_' + property.name, property.literalValue);
        state.addSetter(literalValue);
    }
    return;
});

jsonSerializer.fromClass.prepend('undefined', (property, state: CompilerState) => {
    if (property.type === 'literal' && !property.isOptional) {
        const literalValue = state.setVariable('_literal_value_' + property.name, property.literalValue);
        state.addSetter(literalValue);
    }
    return;
});

jsonSerializer.toClass.prepend('null', (property: PropertySchema, state: CompilerState) => {
    if (property.type === 'literal' && !property.isNullable) {
        const literalValue = state.setVariable('_literal_value_' + property.name, property.literalValue);
        state.addSetter(literalValue);
    }
});

jsonSerializer.fromClass.prepend('null', (property: PropertySchema, state: CompilerState) => {
    if (property.type === 'literal' && !property.isNullable) {
        const literalValue = state.setVariable('_literal_value_' + property.name, property.literalValue);
        state.addSetter(literalValue);
    }
});

jsonSerializer.toClass.register('date', (property: PropertySchema, state: CompilerState) => {
    state.addSetter(`new Date(${state.accessor});`);
});

jsonSerializer.toClass.register('boolean', (property: PropertySchema, state: CompilerState) => {
    state.addCodeForSetter(`
    if ('boolean' === typeof ${state.accessor}) {
        ${state.setter} = ${state.accessor};
    } else {
        if ('true' === ${state.accessor} || '1' === ${state.accessor} || 1 === ${state.accessor}) ${state.setter} = true;
        if ('false' === ${state.accessor} || '0' === ${state.accessor} || 0 === ${state.accessor}) ${state.setter} = false;
    }
    `);
});

jsonSerializer.toClass.register('enum', (property: PropertySchema, state: CompilerState) => {
    //this a candidate where we can extract ENUM information during build time and check very fast during
    //runtime, so we don't need a call to getResolvedClassTypeForValidType(), isValidEnumValue(), etc in runtime anymore.
    const allowLabelsAsValue = property.allowLabelsAsValue;
    const typeValue = state.setVariable('typeValue', property.resolveClassType);

    state.setContext({
        isValidEnumValue,
        getEnumValues,
        getEnumLabels,
        getValidEnumValue
    });

    state.addCodeForSetter(`
        var typeValue = ${typeValue};
        if (undefined !== ${state.accessor} && !isValidEnumValue(typeValue, ${state.accessor}, ${allowLabelsAsValue})) {
            const valids = getEnumValues(typeValue);
            if (${allowLabelsAsValue}) {
                //IE11 compatible way
                getEnumLabels(typeValue).forEach(function(label){valids.push(label);});
            }
            throw new Error('Invalid ENUM given in property ${property.name}: ' + ${state.accessor} + ', valid: ' + valids.join(','));
        }
        ${state.setter} = getValidEnumValue(typeValue, ${state.accessor}, ${allowLabelsAsValue});
    `);
});

jsonSerializer.toClass.registerForBinary((property: PropertySchema, state: CompilerState) => {
    state.setContext({ base64ToTypedArray });
    state.setContext({ isBinaryJSON });
    //property.type maps to global type constructor names
    state.addSetter(`${state.accessor} instanceof ${property.type} ? ${state.accessor} : (isBinaryJSON(${state.accessor}) ? base64ToTypedArray(${state.accessor}.data, ${property.type}) : new ${property.type}())`);
});

jsonSerializer.toClass.register('arrayBuffer', (property: PropertySchema, state: CompilerState) => {
    state.setContext({ base64ToArrayBuffer });
    state.setContext({ isBinaryJSON });
    state.addSetter(`${state.accessor} instanceof ArrayBuffer ? ${state.accessor} : (isBinaryJSON(${state.accessor}) ? base64ToArrayBuffer(${state.accessor}.data): new ArrayBuffer())`);
});

//we need to add '$type' to make union with auto-detection work
jsonSerializer.fromClass.registerForBinary((property: PropertySchema, state: CompilerState) => {
    state.setContext({ typedArrayToBase64 });
    state.addSetter(`{'$type': 'binary', data: typedArrayToBase64(${state.accessor})}`);
});

jsonSerializer.fromClass.register('arrayBuffer', (property: PropertySchema, state: CompilerState) => {
    state.setContext({ arrayBufferToBase64 });
    state.addSetter(`{'$type': 'binary', data: arrayBufferToBase64(${state.accessor})}`);
});

jsonSerializer.toClass.register('bigint', (property: PropertySchema, state: CompilerState) => {
    state.setContext({ isBigIntJSON });
    state.addSetter(`typeof ${state.accessor} === 'bigint' ? ${state.accessor} : (isBigIntJSON(${state.accessor}) ? BigInt('0x' + ${state.accessor}.data): 0n)`);
});

jsonSerializer.fromClass.register('bigint', (property: PropertySchema, state: CompilerState) => {
    state.addSetter(`{'$type': 'bigint', data: ${state.accessor}.toString(16)}`);
});

const convertToPlainUsingToJson = (property: PropertySchema, state: CompilerState) => {
    state.addSetter(`${state.accessor}.toJSON();`);
};

jsonSerializer.fromClass.register('date', convertToPlainUsingToJson);


export function convertArray(property: PropertySchema, state: CompilerState) {
    const a = state.setVariable('a');
    const l = state.setVariable('l');
    let setDefault = property.isOptional ? '' : `${state.setter} = [];`;

    //we just use `a.length` to check whether its array-like, because Array.isArray() is way too slow.
    state.addCodeForSetter(`
    if (${state.accessor}.length === undefined || 'string' === typeof ${state.accessor} || 'function' !== typeof ${state.accessor}.slice) {
        ${setDefault}
    } else {
         let ${l} = ${state.accessor}.length;
         let ${a} = ${state.accessor}.slice();
         while (${l}--) {
            //make sure all elements have the correct type
            if (${state.accessor}[${l}] !== undefined && ${state.accessor}[${l}] !== null) {
                let itemValue;
                ${getDataConverterJS(`itemValue`, `${a}[${l}]`, property.getSubType(), state.serializerCompilers, state.rootContext, state.jitStack)}
                if (${!property.getSubType().isOptional} && itemValue === undefined) {
                    ${a}.splice(${l}, 1);
                } else {
                    ${a}[${l}] = itemValue;
                }
            }
         }
         ${state.setter} = ${a};
    }
    `);
}

jsonSerializer.fromClass.register('array', convertArray);
jsonSerializer.toClass.register('array', convertArray);

function convertMap(property: PropertySchema, state: CompilerState) {
    const a = state.setVariable('a');
    const i = state.setVariable('i');
    let setDefault = property.isOptional ? '' : `${state.setter} = {};`;

    state.addCodeForSetter(`
        let ${a} = {};
        //we make sure its a object and not an array
        if (${state.accessor} && 'object' === typeof ${state.accessor} && 'function' !== typeof ${state.accessor}.slice) {
            for (let ${i} in ${state.accessor}) {
                if (!${state.accessor}.hasOwnProperty(${i})) continue;
                if (${!property.getSubType().isOptional} && ${state.accessor}[${i}] === undefined) {
                    continue;
                }
                ${getDataConverterJS(`${a}[${i}]`, `${state.accessor}[${i}]`, property.getSubType(), state.serializerCompilers, state.rootContext, state.jitStack)}
            }
            ${state.setter} = ${a};
        } else {
            ${setDefault}
        }
    `);
}

jsonSerializer.fromClass.register('map', convertMap);
jsonSerializer.toClass.register('map', convertMap);

jsonSerializer.fromClass.register('class', (property: PropertySchema, state: CompilerState) => {
    const classSchema = getClassSchema(property.resolveClassType!);
    const classToX = state.setVariable('classToX', state.jitStack.getOrCreate(classSchema, () => getClassToXFunction(classSchema, state.serializerCompilers.serializer, state.jitStack)));

    state.setContext({isObject});
    let primarKeyHandling = '';
    if (property.isReference) {
        primarKeyHandling = getDataConverterJS(state.setter, state.accessor, property.getResolvedClassSchema().getPrimaryField(), state.serializerCompilers, state.rootContext, state.jitStack);
    }

    state.addCodeForSetter(`
    if (isObject(${state.accessor})) {
        ${state.setter} = ${classToX}.fn(${state.accessor}, _options, _stack, _depth);
    } else if (${property.isReference}) {
        ${primarKeyHandling}
    }
    `);
});

jsonSerializer.toClass.register('class', (property: PropertySchema, state) => {
    if (!property.resolveClassType) {
        throw new Error(`Property ${property.name} has no classType defined`);
    }

    const classSchema = getClassSchema(property.resolveClassType!);
    const xToClass = state.setVariable('xToClass', state.jitStack.getOrCreate(classSchema, () => getXToClassFunction(classSchema, state.serializerCompilers.serializer, state.jitStack)));

    const foreignSchema = getClassSchema(property.resolveClassType!);
    if (foreignSchema.decorator) {
        //the actual type checking happens within getXToClassFunction()'s constructor param
        //so we dont check here for object.
        state.addSetter(`${xToClass}.fn(${state.accessor}, _options, getParents(), _state)`);
        return;
    }

    state.setContext({isObject});
    let primarKeyHandling = '';
    if (property.isReference) {
        primarKeyHandling = getDataConverterJS(state.setter, state.accessor, property.getResolvedClassSchema().getPrimaryField(), state.serializerCompilers, state.rootContext, state.jitStack);
    }

    state.addCodeForSetter(`
        //object and not an array
        if ('object' === typeof ${state.accessor} && 'function' !== typeof ${state.accessor}.slice) {
            ${state.setter} = ${xToClass}.fn(${state.accessor}, _options, getParents(), _state);
        } else if (${!property.isReference} && 'string' === typeof ${state.accessor} && '{' === ${state.accessor}[0]) {
            try {
                ${state.setter} = ${xToClass}.fn(JSON.parse(${state.accessor}), _options, getParents(), _state);
            } catch (e) {}
        } else if (${property.isReference}) {
            ${primarKeyHandling}
        }
    `);
});

jsonSerializer.toClass.register('union', (property: PropertySchema, state) => {
    let discriminator: string[] = [`if (false) { }`];
    const discriminants: string[] = [];
    for (const unionType of getSortedUnionTypes(property, jsonTypeGuards)) {
        discriminants.push(unionType.property.type);
    }
    let elseBranch = `throw new Error('No valid discriminant was found, so could not determine class type. Guard tried: [${discriminants.join(',')}].');`;

    if (property.isOptional) {
        elseBranch = '';
    } else if (property.isNullable) {
        elseBranch = `${state.setter} = null;`;
    } else if (property.hasManualDefaultValue()) {
        const defaultVar = state.setVariable('default', property.defaultValue);
        elseBranch = `${state.setter} = ${defaultVar}();`;
    }

    for (const unionType of getSortedUnionTypes(property, jsonTypeGuards)) {
        const guardVar = state.setVariable('guard_' + unionType.property.type, unionType.guard);

        discriminator.push(`
                //guard:${unionType.property.type}
                else if (${guardVar}(${state.accessor})) {
                    ${getDataConverterJS(state.setter, state.accessor, unionType.property, state.serializerCompilers, state.rootContext, state.jitStack)}
                }
            `);
    }

    state.addCodeForSetter(`
        ${discriminator.join('\n')}
        else {
            ${elseBranch}
        }
    `);
});

jsonSerializer.fromClass.register('union', (property: PropertySchema, state) => {
    let discriminator: string[] = [`if (false) { }`];
    const discriminants: string[] = [];
    for (const unionType of getSortedUnionTypes(property, jsonTypeGuards)) {
        discriminants.push(unionType.property.type);
    }
    let elseBranch = `throw new Error('No valid discriminant was found, so could not determine class type. Guard tried: [${discriminants.join(',')}].');`;

    if (property.isOptional) {
        elseBranch = '';
    } else if (property.isNullable) {
        elseBranch = `${state.setter} = null;`;
    } else if (property.hasManualDefaultValue()) {
        const defaultVar = state.setVariable('default', property.defaultValue);
        elseBranch = `${state.setter} = ${defaultVar}();`;
    }

    for (const unionType of getSortedUnionTypes(property, jsonTypeGuards)) {
        const guardVar = state.setVariable('guard_' + unionType.property.type, unionType.guard);

        discriminator.push(`
                //guard:${unionType.property.type}
                else if (${guardVar}(${state.accessor})) {
                    ${getDataConverterJS(state.setter, state.accessor, unionType.property, state.serializerCompilers, state.rootContext, state.jitStack)}
                }
            `);
    }

    state.addCodeForSetter(`
        ${discriminator.join('\n')}
        else {
            ${elseBranch}
        }
    `);
});

jsonSerializer.toClass.register('partial', (property, state) => {
    const classSchema = getClassSchema(property.getSubType().resolveClassType!);
    const partialXToClass = state.setVariable('partialXToClass', state.jitStack.getOrCreate(classSchema, () => getPartialXToClassFunction(classSchema, state.serializerCompilers.serializer)));

    state.addSetter(`${partialXToClass}.fn(${state.accessor}, _options, getParents(), _state);`);
});

jsonSerializer.fromClass.register('partial', (property, state) => {
    const classSchema = getClassSchema(property.getSubType().resolveClassType!);
    const partialClassToX = state.setVariable('partialClassToX', state.jitStack.getOrCreate(classSchema, () => getPartialClassToXFunction(classSchema, state.serializerCompilers.serializer)));

    state.addSetter(`${partialClassToX}.fn(${state.accessor}, _options, _stack, _depth)`);
});
