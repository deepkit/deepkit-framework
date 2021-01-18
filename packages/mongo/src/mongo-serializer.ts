/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ObjectId, UUID } from '@deepkit/bson';
import {
    CompilerState,
    compilerToNumber,
    compilerToString,
    convertArray,
    getClassSchema,
    getClassToXFunction,
    getDataConverterJS,
    PropertySchema,
    Serializer
} from '@deepkit/type';

export const mongoSerializer = new Serializer('mongo');

mongoSerializer.fromClass.register('string', compilerToString);
mongoSerializer.fromClass.register('number', compilerToNumber);

mongoSerializer.fromClass.register('array', (property: PropertySchema, state: CompilerState) => {
    if (property.backReference || (property.parent && property.parent.backReference)) {
        //we don't serialize back references to mongodb
        state.template = '';
    } else {
        convertArray(property, state);
    }
});
mongoSerializer.toClass.register('array', (property: PropertySchema, state: CompilerState) => {
    if (property.backReference || (property.parent && property.parent.backReference)) {
        //we don't serialize back references to mongodb
        state.addSetter('undefined');
    } else {
        convertArray(property, state);
    }
});

mongoSerializer.fromClass.register('class', (property: PropertySchema, state: CompilerState) => {
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
    } else if (property.backReference || (property.parent && property.parent.backReference)) {
        //we don't serialize back references to mongodb
        state.template = '';
    } else {
        const classToX = state.setVariable('classToX', state.jitStack.getOrCreate(classSchema, () => getClassToXFunction(classSchema, state.serializerCompilers.serializer, state.jitStack)));
        state.addSetter(`${classToX}.fn(${state.accessor}, _options, _stack)`);
    }
});

//this is necessary since we use in FindCommand `filter: t.any`, so uuid and objectId need to be a wrapper type so that @deepkit/bson serializes correctly
mongoSerializer.fromClass.register('uuid', (property: PropertySchema, state: CompilerState) => {
    state.setContext({ UUID });
    state.addSetter(`new UUID(${state.accessor})`);
});

mongoSerializer.fromClass.register('objectId', (property: PropertySchema, state: CompilerState) => {
    state.setContext({ ObjectId });

    state.addSetter(`new ObjectId(${state.accessor})`);
});
