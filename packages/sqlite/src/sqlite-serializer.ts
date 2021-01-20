/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { sqlSerializer } from '@deepkit/sql';

export const SqliteSerializer = new class extends sqlSerializer.fork('sqlite') {
};

SqliteSerializer.fromClass.register('date', (property, state) => {
    state.addSetter(`${state.accessor}.toJSON();`);
});


SqliteSerializer.fromClass.register('boolean', (property, state) => {
    state.addSetter(`${state.accessor} ? 1 : 0`);
});

SqliteSerializer.toClass.register('boolean', (property, state) => {
    state.addSetter(`${state.accessor} === 1`);
});
