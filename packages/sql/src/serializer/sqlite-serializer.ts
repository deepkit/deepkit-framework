import {sqlSerializer} from './sql-serializer';

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
