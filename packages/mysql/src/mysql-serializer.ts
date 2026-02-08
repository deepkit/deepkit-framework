/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { SqlSerializer } from '@deepkit/sql';
import { TemplateState, Type, binaryTypes, isUUIDType } from '@deepkit/type';

//for queries with `returning`, MySQL returns binary stuff as base64.
function convertBinaryFromBase64(type: Type, state: TemplateState) {
    state.setContext({ Buffer });
    const offset = 'base64:type254:'.length;
    state.addSetter(
        `typeof ${state.accessor} === 'string' && ${state.accessor}.startsWith('base64:') ? Buffer.from(${state.accessor}.substr(${offset}), 'base64') : ${state.accessor}`,
    );
}

class MySQLSerializer extends SqlSerializer {
    name = 'mysql';

    protected registerSerializers() {
        super.registerSerializers();

        for (const b of binaryTypes) {
            this.deserializeRegistry.prependClass(b, convertBinaryFromBase64);
        }

        this.deserializeRegistry.addPreHook((type, state) => {
            if (isUUIDType(type)) {
                convertBinaryFromBase64(type, state);
            }
        });
    }
}

export const mySqlSerializer = new MySQLSerializer();
