import {sqlSerializer} from './sql-serializer';

export const SqliteSerializer = new class extends sqlSerializer.fork('sqlite') {
};
