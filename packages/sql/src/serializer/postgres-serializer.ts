import {sqlSerializer} from './sql-serializer';

export const postgresSerializer = new class extends sqlSerializer.fork('postgres') {
};