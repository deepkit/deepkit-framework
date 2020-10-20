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

import {
    CompilerState,
    getClassSchema,
    getDataConverterJS,
    jsonSerializer,
    moment,
    nodeBufferToArrayBuffer,
    nodeBufferToTypedArray,
    PropertyCompilerSchema,
    typedArrayNamesMap,
    typedArrayToBuffer
} from '@deepkit/type';

export const hexTable: string[] = [];
for (let i = 0; i < 256; i++) {
    hexTable[i] = (i <= 15 ? '0' : '') + i.toString(16);
}

export const sqlSerializer = new class extends jsonSerializer.fork('sql') {
};

export function uuid4Binary(u: string): Buffer {
    return Buffer.from(u.replace(/-/g, ''), 'hex');
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

sqlSerializer.fromClass.register('undefined', (property: PropertyCompilerSchema, state: CompilerState) => {
    //sql does not support 'undefined' as column type, so we convert automatically to null
    state.addSetter(`null`);
});

sqlSerializer.fromClass.register('null', (property: PropertyCompilerSchema, state: CompilerState) => {
    //sql does not support 'undefined' as column type, so we convert automatically to null
    state.addSetter(`null`);
});

sqlSerializer.toClass.register('null', (property: PropertyCompilerSchema, state: CompilerState) => {
    //sql does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isOptional) return state.addSetter(`undefined`);
    if (property.isNullable) return state.addSetter(`null`);
});

sqlSerializer.toClass.register('undefined', (property: PropertyCompilerSchema, state: CompilerState) => {
    //sql does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isOptional) return state.addSetter(`undefined`);
    if (property.isNullable) return state.addSetter(`null`);
});

//SQL escape does the job.
sqlSerializer.fromClass.register('date', (property: PropertyCompilerSchema, state: CompilerState) => {
    state.addSetter(`${state.accessor}`);
});

sqlSerializer.fromClass.register('moment', (property: PropertyCompilerSchema, state: CompilerState) => {
    state.addSetter(`${state.accessor}.toDate()`);
});

sqlSerializer.toClass.register('moment', (property: PropertyCompilerSchema, state: CompilerState) => {
    state.setContext({moment});
    state.addSetter(`moment(${state.accessor})`);
});

sqlSerializer.toClass.register('uuid', (property: PropertyCompilerSchema, state: CompilerState) => {
    state.setContext({uuid4Stringify});
    state.addCodeForSetter(`
        try {
            ${state.setter} = 'string' === typeof ${state.accessor} ? ${state.accessor} : uuid4Stringify(${state.accessor});
        } catch (error) {
            throw new TypeError('Invalid UUID v4 given in property ${property.name}: ' + error);
        }
        `
    );
});

sqlSerializer.fromClass.register('uuid', (property: PropertyCompilerSchema, state: CompilerState) => {
    state.setContext({uuid4Binary});
    state.addCodeForSetter(`
        try {
            ${state.setter} = uuid4Binary(${state.accessor});
        } catch (error) {
            throw new TypeError('Invalid UUID v4 given in property ${property.name}');
        }
        `
    );
});

sqlSerializer.toClass.prepend('class', (property: PropertyCompilerSchema, state: CompilerState) => {
    //when property is a reference, then we stored in the database the actual primary key and used this
    //field as foreignKey. This makes it necessary to convert it differently (concretely we treat it as the primary)
    const classSchema = getClassSchema(property.resolveClassType!);

    if (property.isReference) {
        const primary = classSchema.getPrimaryField();
        state.addCodeForSetter(getDataConverterJS(state.setter, state.accessor, primary, state.serializerCompilers, state.rootContext, state.jitStack));
        state.forceEnd();
    }

    return;
});

sqlSerializer.fromClass.prepend('class', (property: PropertyCompilerSchema, state: CompilerState) => {
    //When property is a reference we store the actual primary (as foreign key) of the referenced instance instead of the actual instance.
    //This way we implemented basically relations in the database
    const classSchema = getClassSchema(property.resolveClassType!);

    if (property.isReference) {
        const classType = state.setVariable('classType', property.resolveClassType);
        const primary = classSchema.getPrimaryField();

        state.addCodeForSetter(`
            if (${state.accessor} instanceof ${classType}) {
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

sqlSerializer.fromClass.append('class', (property: PropertyCompilerSchema, state: CompilerState) => {
    if (property.isReference) return;

    //we need to convert the structure to JSON-string after it has been converted to JSON values from the previous compiler
    state.setContext({stringify: JSON.stringify});
    state.addSetter(`stringify(${state.accessor})`);
});

sqlSerializer.fromClass.registerForBinary((property: PropertyCompilerSchema, state: CompilerState) => {
    state.setContext({typedArrayToBuffer});
    state.addSetter(`typedArrayToBuffer(${state.accessor})`);
});

sqlSerializer.toClass.registerForBinary((property: PropertyCompilerSchema, state: CompilerState) => {
    state.setContext({typedArrayNamesMap, nodeBufferToTypedArray});
    state.addSetter(`nodeBufferToTypedArray(${state.accessor}, typedArrayNamesMap.get('${property.type}'))`);
});

sqlSerializer.toClass.register('arrayBuffer', (property: PropertyCompilerSchema, state: CompilerState) => {
    state.setContext({nodeBufferToArrayBuffer});
    state.addSetter(`nodeBufferToArrayBuffer(${state.accessor})`);
});

sqlSerializer.fromClass.register('arrayBuffer', (property: PropertyCompilerSchema, state: CompilerState) => {
    state.setContext({Buffer});
    state.addSetter(`Buffer.from(${state.accessor})`);
});
