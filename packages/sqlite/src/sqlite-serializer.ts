/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { SqlSerializer, isDirectPropertyOfEntity } from '@deepkit/sql';
import { ReflectionKind } from '@deepkit/type';

class SQLiteSerializer extends SqlSerializer {
    name = 'sqlite';
    protected registerSerializers() {
        super.registerSerializers();

        this.serializeRegistry.registerClass(Date, (type, state) => {
            state.addSetter(`${state.accessor}.toJSON();`);
        });

        this.serializeRegistry.append(ReflectionKind.boolean, (type, state) => {
            if (!isDirectPropertyOfEntity(state)) return;
            state.addSetter(`${state.accessor} ? 1 : 0`);
        });
    }
}

export const sqliteSerializer = new SQLiteSerializer;
