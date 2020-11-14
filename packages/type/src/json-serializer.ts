/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {getClassSchema, PropertyCompilerSchema} from './model';
import {arrayBufferToBase64, base64ToArrayBuffer, base64ToTypedArray, typedArrayToBase64} from './core';
import {getClassToXFunction, getPartialClassToXFunction, getPartialXToClassFunction, getXToClassFunction} from './jit';
import {getEnumLabels, getEnumValues, getValidEnumValue, isValidEnumValue} from '@deepkit/core';
import {CompilerState, getDataConverterJS} from './serializer-compiler';
import {getSortedUnionTypes} from './union';
import {Serializer} from './serializer';
import {moment} from './moment';
import {typedArrayNamesMap} from './types';

export class JSONSerializer extends Serializer {
    constructor() {
        super('json');
    }
}

export const jsonSerializer = new JSONSerializer();

export function compilerToString(property: PropertyCompilerSchema, state: CompilerState) {
    state.addSetter(`typeof ${state.accessor} === 'string' ? ${state.accessor} : ''+${state.accessor};`);
}

jsonSerializer.toClass.register('string', compilerToString);

export function compilerToNumber(property: PropertyCompilerSchema, state: CompilerState) {
    state.addSetter(`typeof ${state.accessor} === 'number' ? ${state.accessor} : +${state.accessor};`);
}

jsonSerializer.toClass.register('number', compilerToNumber);
jsonSerializer.fromClass.register('number', compilerToNumber);

jsonSerializer.toClass.register('literal', (property: PropertyCompilerSchema, state: CompilerState) => {
    const literalValue = state.setVariable('_literal_value_' + property.name, property.literalValue);
    state.addSetter(literalValue);
});

jsonSerializer.toClass.prepend('undefined', (property, state: CompilerState) => {
    if (property.type === 'literal' && !property.isOptional) {
        const literalValue = state.setVariable('_literal_value_' + property.name, property.literalValue);
        state.addSetter(literalValue);
    }
    return;
});

jsonSerializer.toClass.prepend('null', (property: PropertyCompilerSchema, state: CompilerState) => {
    if (property.type === 'literal' && !property.isNullable) {
        const literalValue = state.setVariable('_literal_value_' + property.name, property.literalValue);
        state.addSetter(literalValue);
    }
});

jsonSerializer.toClass.register('date', (property: PropertyCompilerSchema, state: CompilerState) => {
    state.addSetter(`new Date(${state.accessor});`);
});

jsonSerializer.toClass.register('moment', (property: PropertyCompilerSchema, state: CompilerState) => {
    state.setContext({moment});
    state.addSetter(`moment(${state.accessor});`);
});

jsonSerializer.toClass.register('boolean', (property: PropertyCompilerSchema, state: CompilerState) => {
    state.addCodeForSetter(`
    if ('boolean' === typeof ${state.accessor}) {
        ${state.setter} = ${state.accessor};
    } else {
        if ('true' === ${state.accessor} || '1' === ${state.accessor} || 1 === ${state.accessor}) ${state.setter} = true;
        if ('false' === ${state.accessor} || '0' === ${state.accessor} || 0 === ${state.accessor}) ${state.setter} = false;
    }
    `);
});

jsonSerializer.toClass.register('enum', (property: PropertyCompilerSchema, state: CompilerState) => {
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

jsonSerializer.toClass.registerForBinary((property: PropertyCompilerSchema, state: CompilerState) => {
    state.setContext({base64ToTypedArray, typedArrayNamesMap});
    state.addSetter(`base64ToTypedArray(${state.accessor}, typedArrayNamesMap.get('${property.type}'))`);
});

jsonSerializer.toClass.register('arrayBuffer', (property: PropertyCompilerSchema, state: CompilerState) => {
    state.setContext({base64ToArrayBuffer});
    state.addSetter(`base64ToArrayBuffer(${state.accessor})`);
});

jsonSerializer.fromClass.registerForBinary((property: PropertyCompilerSchema, state: CompilerState) => {
    state.setContext({typedArrayToBase64});
    state.addSetter(`typedArrayToBase64(${state.accessor});`);
});

jsonSerializer.fromClass.register('arrayBuffer', (property: PropertyCompilerSchema, state: CompilerState) => {
    state.setContext({arrayBufferToBase64});
    state.addSetter(`arrayBufferToBase64(${state.accessor})`);
});

const convertToPlainUsingToJson = (property: PropertyCompilerSchema, state: CompilerState) => {
    state.addSetter(`${state.accessor}.toJSON();`);
};

jsonSerializer.fromClass.register('date', convertToPlainUsingToJson);
jsonSerializer.fromClass.register('moment', convertToPlainUsingToJson);

jsonSerializer.fromClass.register('class', (property: PropertyCompilerSchema, state: CompilerState) => {
    const classSchema = getClassSchema(property.resolveClassType!);
    const classToX = state.setVariable('classToX', state.jitStack.getOrCreate(classSchema, () => getClassToXFunction(classSchema, state.serializerCompilers.serializer, state.jitStack)));

    state.addSetter(`${classToX}.fn(${state.accessor}, _options)`);
});

jsonSerializer.toClass.register('class', (property: PropertyCompilerSchema, state) => {
    const classSchema = getClassSchema(property.resolveClassType!);
    const xToClass = state.setVariable('xToClass', state.jitStack.getOrCreate(classSchema, () => getXToClassFunction(classSchema, state.serializerCompilers.serializer, state.jitStack)));

    const foreignSchema = getClassSchema(property.resolveClassType!);
    if (foreignSchema.decorator) {
        //the actual type checking happens within getXToClassFunction()'s constructor param
        //so we dont check here for object.
        state.addSetter(`${xToClass}.fn(${state.accessor}, _options, getParents(), _state)`);
        return;
    }

    state.addCodeForSetter(`
        //object and not an array
        if ('object' === typeof ${state.accessor} && 'function' !== typeof ${state.accessor}.slice) {
            ${state.setter} = ${xToClass}.fn(${state.accessor}, _options, getParents(), _state);
        } else if (${!property.isReference} && 'string' === typeof ${state.accessor}) {
            try {
                ${state.setter} = ${xToClass}.fn(JSON.parse(${state.accessor}), _options, getParents(), _state);
            } catch (e) {}
        }
    `);
});

jsonSerializer.toClass.register('union', (property: PropertyCompilerSchema, state) => {
    let discriminator: string[] = [`if (false) { }`];
    const discriminants: string[] = [];
    let elseBranch = `throw new Error('No valid discriminant was found, so could not determine class type. Guard tried: [${discriminants.join(',')}].');`;

    if (property.isOptional) {
        elseBranch = '';
    } else if (property.isNullable) {
        elseBranch = `${state.setter} = null;`;
    } else if (property.hasManualDefaultValue()) {
        const defaultVar = state.setVariable('default', property.defaultValue);
        elseBranch = `${state.setter} = ${defaultVar};`;
    }

    for (const unionType of getSortedUnionTypes(property)) {
        const guardVar = state.setVariable('guard_' + unionType.property.type, unionType.guard);
        discriminants.push(unionType.property.type);

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

jsonSerializer.fromClass.register('union', (property: PropertyCompilerSchema, state) => {
    let discriminator: string[] = [`if (false) { }`];
    const discriminants: string[] = [];
    let elseBranch = `throw new Error('No valid discriminant was found, so could not determine class type. Guard tried: [${discriminants.join(',')}].');`;

    if (property.isOptional) {
        elseBranch = '';
    } else if (property.isNullable) {
        elseBranch = `${state.setter} = null;`;
    } else if (property.hasManualDefaultValue()) {
        const defaultVar = state.setVariable('default', property.defaultValue);
        elseBranch = `${state.setter} = ${defaultVar};`;
    }

    for (const unionType of getSortedUnionTypes(property)) {
        const guardVar = state.setVariable('guard_' + unionType.property.type, unionType.guard);
        discriminants.push(unionType.property.type);

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

    state.addSetter(`${partialClassToX}.fn(${state.accessor}, _options)`);
});
