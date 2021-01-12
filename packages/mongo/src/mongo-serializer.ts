/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    binaryTypes,
    CompilerState,
    compilerToString,
    getClassSchema,
    getDataConverterJS,
    jsonSerializer,
    PropertySchema,
    Types
} from '@deepkit/type';
import bson from 'bson';
import mongoUuid from 'mongo-uuid';

export function uuid4Binary(u?: string): bson.Binary {
    return mongoUuid(bson.Binary, u);
}

export const mongoSerializer = new class extends jsonSerializer.fork('sql') {
};

mongoSerializer.fromClass.register('string', compilerToString);

mongoSerializer.fromClass.register('undefined', (property: PropertySchema, state: CompilerState) => {
    //mongo does not support 'undefined' as column type, so we convert automatically to null
    state.addSetter(`null`);
});

mongoSerializer.toClass.register('undefined', (property: PropertySchema, state: CompilerState) => {
    //mongo does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isOptional) return state.addSetter(`undefined`);
    if (property.isNullable) return state.addSetter(`null`);
});

mongoSerializer.fromClass.register('null', (property: PropertySchema, state: CompilerState) => {
    //mongo does not support 'undefined' as column type, so we convert automatically to null
    state.addSetter(`null`);
});

mongoSerializer.toClass.register('null', (property: PropertySchema, state: CompilerState) => {
    //mongo does not support 'undefined' as column type, so we store always null. depending on the property definition
    //we convert back to undefined or keep it null
    if (property.isOptional) return state.addSetter(`undefined`);
    if (property.isNullable) return state.addSetter(`null`);
});

//these types are handled as is by @deepkit/bson, so we remove templates set by jsonSerializer
const resetTypes: Types[] = [...binaryTypes, 'uuid', 'map', 'date', 'objectId'];
for (const type of resetTypes) {
    mongoSerializer.toClass.register(type, (property, state) => {
        state.addSetter(state.accessor);
    });
    mongoSerializer.fromClass.register(type, (property, state) => {
        state.addSetter(state.accessor);
    });
}

mongoSerializer.toClass.prepend('class', (property: PropertySchema, state: CompilerState) => {
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

mongoSerializer.fromClass.prepend('class', (property: PropertySchema, state: CompilerState) => {
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

//this is necessary since we use in FindCommand `filter: t.any`, so uuid and objectId need to be correct BSON types already
mongoSerializer.fromClass.register('uuid', (property: PropertySchema, state: CompilerState) => {
    state.setContext({ uuid4Binary });
    state.addCodeForSetter(`
        try {
            ${state.setter} = uuid4Binary(${state.accessor});
        } catch (error) {
            throw new TypeError('Invalid UUID v4 given in property ${property.name}');
        }
        `
    );
});
mongoSerializer.fromClass.register('objectId', (property: PropertySchema, state: CompilerState) => {
    state.setContext({ ObjectID: bson.ObjectID });

    state.addCodeForSetter(`
        try {
            ${state.setter} = new ObjectID(${state.accessor});
        } catch (error) {
            throw new TypeError('Invalid ObjectID given in property ${property.name}');
        }
        `
    );
});
