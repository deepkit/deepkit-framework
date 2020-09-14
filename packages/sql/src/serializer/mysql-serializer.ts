import {sqlSerializer} from './sql-serializer';

export const mySqlSerializer = new class extends sqlSerializer.fork('mysql') {
};