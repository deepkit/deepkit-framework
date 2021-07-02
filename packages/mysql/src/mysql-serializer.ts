/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { binaryTypes, CompilerState, PropertySchema } from '@deepkit/type';
import { sqlSerializer } from '@deepkit/sql';

export const mySqlSerializer = new class extends sqlSerializer.fork('mysql') {
};

//for queries with `returning`, MySQL returns binary stuff as base64.
function convertBinaryFromBase64(property: PropertySchema, state: CompilerState) {
    state.setContext({ Buffer });
    const offset = 'base64:type254:'.length;
    state.addSetter(`typeof ${state.accessor} === 'string' && ${state.accessor}.startsWith('base64:') ? Buffer.from(${state.accessor}.substr(${offset}), 'base64') : ${state.accessor}`);
}

//enums are stored as json, so we need always a string, no matter if the enum is actually an number index.
mySqlSerializer.fromClass.append('enum', (property, compiler) => {
    compiler.addSetter(`${compiler.accessor}+''`);
});

mySqlSerializer.toClass.prepend('uuid', convertBinaryFromBase64);
mySqlSerializer.toClass.prepend('arrayBuffer', convertBinaryFromBase64);

for (const type of binaryTypes) {
    mySqlSerializer.toClass.prepend(type, convertBinaryFromBase64);
}
