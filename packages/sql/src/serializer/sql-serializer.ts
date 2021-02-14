/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { isObject } from '@deepkit/core';
import {
    CompilerState,
    getClassSchema,
    getDataConverterJS,
    jsonSerializer,
    nodeBufferToArrayBuffer,
    nodeBufferToTypedArray,
    PropertySchema,
    Serializer,
    typedArrayNamesMap,
    typedArrayToBuffer
} from '@deepkit/type';

export const hexTable: string[] = [];
for (let i = 0; i < 256; i++) {
    hexTable[i] = (i <= 15 ? '0' : '') + i.toString(16);
}

export const sqlSerializer: Serializer = new class extends jsonSerializer.fork('sql') {
};

export function uuid4Binary(u: any): Buffer {
    return 'string' === typeof u ? Buffer.from(u.replace(/-/g, ''), 'hex') : Buffer.alloc(0);
}

export function uuid4Stringify(buffer: Buffer): string {
    return hexTable[buffer[0]] + hexTable[buffer[1]] + hexTable[buffer[2]] + hexTable[buffer[3]]
        + '-'
        + hexTable[buffer[4]] + hexTable[buffer[5]]
        + '-'
        + hexTable[buffer[6]] + hexTable[buffer[7]]
        + '-'
        + hexTable[buffer[8]] + hexTable[buffer[9]]
        + '-'
        + hexTable[buffer[10]] + hexTable[buffer[11]] + hexTable[buffer[12]] + hexTable[buffer[13]] + hexTable[buffer[14]] + hexTable[buffer[15]]
        ;
}

sqlSerializer.fromClass.register('undefined', (property: PropertySchema, state: CompilerState) => {
    //sql does not support 'undefined' as column type, so we convert automatically to null
    state.addSetter(`null`);
});

sqlSerializer.fromClass.register('null', (property: PropertySchema, state: CompilerState) => {
    //sql does not support 'undefined' as column type, so we convert automatically to null
    state.addSetter(`null`);
});

sqlSerializer.toClass.register('null', (property: PropertySchema, state: CompilerState) => {
    //sql does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isOptional) return state.addSetter(`undefined`);
    if (property.isNullable) return state.addSetter(`null`);
});

sqlSerializer.toClass.register('undefined', (property: PropertySchema, state: CompilerState) => {
    //sql does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isOptional) return state.addSetter(`undefined`);
    if (property.isNullable) return state.addSetter(`null`);
});

//SQL escape does the job.
sqlSerializer.fromClass.register('date', (property: PropertySchema, state: CompilerState) => {
    state.addSetter(`${state.accessor}`);
});

sqlSerializer.toClass.register('uuid', (property: PropertySchema, state: CompilerState) => {
    state.setContext({ uuid4Stringify });
    state.addCodeForSetter(`
        try {
            ${state.setter} = 'string' === typeof ${state.accessor} ? ${state.accessor} : uuid4Stringify(${state.accessor});
        } catch (error) {
            throw new TypeError('Invalid UUID v4 given in property ${property.name}: ' + error);
        }
        `
    );
});

sqlSerializer.fromClass.register('uuid', (property: PropertySchema, state: CompilerState) => {
    state.setContext({ uuid4Binary });
    state.addCodeForSetter(`
        try {
            ${state.setter} = uuid4Binary(${state.accessor});
        } catch (error) {
            throw new TypeError('Invalid UUID v4 given in property ${property.name}: ' + error);
        }
        `
    );
});

sqlSerializer.toClass.prepend('class', (property: PropertySchema, state: CompilerState) => {
    //when property is a reference, then we stored in the database the actual primary key and used this
    //field as foreignKey. This makes it necessary to convert it differently (concretely we treat it as the primary)
    const classSchema = getClassSchema(property.resolveClassType!);

    //note: jsonSerializer already calls JSON.parse if data is a string

    if (property.isReference) {
        const primary = classSchema.getPrimaryField();
        state.addCodeForSetter(getDataConverterJS(state.setter, state.accessor, primary, state.serializerCompilers, state.rootContext, state.jitStack));
        state.forceEnd();
    }

    return;
});

sqlSerializer.fromClass.prepend('class', (property: PropertySchema, state: CompilerState) => {
    //When property is a reference we store the actual primary (as foreign key) of the referenced instance instead of the actual instance.
    //This way we implemented basically relations in the database
    const classSchema = getClassSchema(property.resolveClassType!);

    if (property.isReference) {
        const classType = state.setVariable('classType', property.resolveClassType);
        state.rootContext.set('isObject', isObject);
        const primary = classSchema.getPrimaryField();

        state.addCodeForSetter(`
            if (isObject(${state.accessor})) {
                ${getDataConverterJS(state.setter, `${state.accessor}.${primary.name}`, primary, state.serializerCompilers, state.rootContext, state.jitStack)}
            } else {
                //we treat the input as if the user gave the primary key directly
                ${getDataConverterJS(state.setter, `${state.accessor}`, primary, state.serializerCompilers, state.rootContext, state.jitStack)}
            }
            `
        );
        state.forceEnd();
    }
});

sqlSerializer.fromClass.append('class', (property: PropertySchema, state: CompilerState) => {
    if (property.isReference) return;

    //we don't stringify non-root properties
    if (property.parent) return;

    //we need to convert the structure to JSON-string after it has been converted to JSON values from the previous compiler
    //but only on root properties.
    state.setContext({ stringify: JSON.stringify });
    state.addSetter(`_depth === 1 ? stringify(${state.accessor}) : ${state.accessor}`);
});

sqlSerializer.toClass.prepend('class', (property: PropertySchema, state: CompilerState) => {
    //when property is a reference, then we stored in the database the actual primary key and used this
    //field as foreignKey. This makes it necessary to convert it differently (concretely we treat it as the primary)
    const classSchema = getClassSchema(property.resolveClassType!);

    //note: jsonSerializer already calls JSON.parse if data is a string

    if (property.isReference) {
        const primary = classSchema.getPrimaryField();
        state.addCodeForSetter(getDataConverterJS(state.setter, state.accessor, primary, state.serializerCompilers, state.rootContext, state.jitStack));
        state.forceEnd();
    }

    return;
});

sqlSerializer.fromClass.register('array', (property: PropertySchema, state: CompilerState) => {
    if (property.isReference) return;

    //we don't stringify non-root properties
    if (property.parent) return;

    //we need to convert the structure to JSON-string after it has been converted to JSON values from the previous compiler
    //but only on root properties.
    state.setContext({ stringify: JSON.stringify });
    state.addSetter(`_depth === 1 ? stringify(${state.accessor}) : ${state.accessor}`);
});

sqlSerializer.toClass.prepend('array', (property: PropertySchema, state: CompilerState) => {
    if (property.parent) return;

    state.addSetter(`'string' === typeof ${state.accessor} ? JSON.parse(${state.accessor}) : ${state.accessor}`);
});

sqlSerializer.fromClass.append('map', (property: PropertySchema, state: CompilerState) => {
    //we don't stringify non-root properties
    if (property.parent) return;

    //we need to convert the structure to JSON-string after it has been converted to JSON values from the previous compiler
    //but only on root properties.
    state.setContext({ stringify: JSON.stringify });
    state.addSetter(`_depth === 1 ? stringify(${state.accessor}) : ${state.accessor}`);
});

sqlSerializer.toClass.prepend('map', (property: PropertySchema, state: CompilerState) => {
    if (property.parent) return;

    state.addSetter(`'string' === typeof ${state.accessor} ? JSON.parse(${state.accessor}) : ${state.accessor}`);
});

sqlSerializer.fromClass.registerForBinary((property: PropertySchema, state: CompilerState) => {
    state.setContext({ typedArrayToBuffer });
    state.addSetter(`typedArrayToBuffer(${state.accessor})`);
});

sqlSerializer.toClass.registerForBinary((property: PropertySchema, state: CompilerState) => {
    state.setContext({ typedArrayNamesMap, nodeBufferToTypedArray });
    state.addSetter(`nodeBufferToTypedArray(${state.accessor}, typedArrayNamesMap.get('${property.type}'))`);
});

sqlSerializer.toClass.register('arrayBuffer', (property: PropertySchema, state: CompilerState) => {
    state.setContext({ nodeBufferToArrayBuffer });
    state.addSetter(`nodeBufferToArrayBuffer(${state.accessor})`);
});
//
// sqlSerializer.fromClass.register('arrayBuffer', (property: PropertySchema, state: CompilerState) => {
//     state.setContext({ Buffer });
//     state.addSetter(`Buffer.from(${state.accessor})`);
// });
