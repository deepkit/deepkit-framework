import { expect, test } from '@jest/globals';
import pg from 'pg';

test('count', async () => {
    const pool = new pg.Pool({
        host: 'localhost',
        database: 'postgres',
        user: 'postgres',
    });

    pg.types.setTypeParser(1700, parseFloat);
    pg.types.setTypeParser(20, BigInt);

    (BigInt.prototype as any).toJSON = function () {
        return this.toString();
    };

    const connection = await pool.connect();

    {
        const count = (await connection.query('SELECT 1.55 as count')).rows[0].count;
        expect(count).toBe(1.55);
    }

    {
        const count = (await connection.query('SELECT COUNT(*) as count FROM (select 1) as tmp')).rows[0].count;
        expect(count).toBe(1n);
    }
});
