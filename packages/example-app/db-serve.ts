import { serveOrmBrowser } from '@deepkit/orm-browser';
import { SQLiteDatabase } from './src/database.js';

const db = new SQLiteDatabase(':memory:');
db.migrate().then(() => {
    return serveOrmBrowser([db]);
});
