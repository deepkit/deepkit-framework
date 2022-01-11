import { expect, test } from '@jest/globals';
import { AutoIncrement, Entity, float32, int16, int32, int8, integer, MySQL, PrimaryKey, Reference, typeOf, uint16, uint32, uint8, Unique } from '@deepkit/type';
import { schemaMigrationRoundTrip } from '@deepkit/sql';
import { MySQLDatabaseAdapter } from '../src/mysql-adapter';
import { DatabaseEntityRegistry } from '@deepkit/orm/dist/cjs/src/database-adapter';

test('mysql custom type', async () => {
    class post {
        id: number & AutoIncrement & PrimaryKey = 0;
        slug: string & MySQL<{ type: 'VARCHAR(255)' }> = '';
        content: string = '';
    }

    const adapter = new MySQLDatabaseAdapter({ host: 'localhost', user: 'root', database: 'default', password: process.env.MYSQL_PW });
    const [postTable] = adapter.platform.createTables(DatabaseEntityRegistry.from([post]));

    expect(postTable.getColumn('slug').type).toBe('varchar');
    expect(postTable.getColumn('slug').size).toBe(255);

    await schemaMigrationRoundTrip([post], adapter);
});

test('mysql default expression', async () => {
    class post {
        id: number & AutoIncrement & PrimaryKey = 0;
        str: string & MySQL<{ type: 'VARCHAR(255)', default: 'abc' }> = '';
        no: number & MySQL<{ default: 34.5 }> = 3;
        json: any & MySQL<{ default: {} }> = {};
        created: Date & MySQL<{ defaultExpr: 'NOW()' }> = new Date;
        opt?: boolean;
    }

    const adapter = new MySQLDatabaseAdapter({ host: 'localhost', user: 'root', database: 'default', password: process.env.MYSQL_PW });
    const [postTable] = adapter.platform.createTables(DatabaseEntityRegistry.from([post]));

    expect(postTable.getColumn('str').defaultValue).toBe('abc');
    expect(postTable.getColumn('no').defaultValue).toBe(34.5);
    expect(postTable.getColumn('created').defaultExpression).toBe('NOW()');

    await schemaMigrationRoundTrip([post], adapter);
});

test('mysql numbers', async () => {
    class post {
        id: integer & AutoIncrement & PrimaryKey = 0;
        int8: int8 = 0;
        uint8: uint8 = 0;
        int16: int16 = 0;
        uint16: uint16 = 0;
        int32: int32 = 0;
        uint32: uint32 = 0;
        float32: float32 = 0;
        default: number = 0;
    }

    const adapter = new MySQLDatabaseAdapter({ host: 'localhost', user: 'root', database: 'default', password: process.env.MYSQL_PW });
    const [postTable] = adapter.platform.createTables(DatabaseEntityRegistry.from([post]));

    const DDL = await schemaMigrationRoundTrip([post], adapter);

    expect(DDL).toContain(`
CREATE TABLE \`post\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`int8\` tinyint DEFAULT 0 NOT NULL,
    \`uint8\` tinyint UNSIGNED DEFAULT 0 NOT NULL,
    \`int16\` smallint DEFAULT 0 NOT NULL,
    \`uint16\` smallint UNSIGNED DEFAULT 0 NOT NULL,
    \`int32\` int DEFAULT 0 NOT NULL,
    \`uint32\` int UNSIGNED DEFAULT 0 NOT NULL,
    \`float32\` float DEFAULT 0 NOT NULL,
    \`default\` double DEFAULT 0 NOT NULL,
    PRIMARY KEY (\`id\`)
)`);

});

interface User extends Entity<{ name: 'user' }> {
    id: number & AutoIncrement & PrimaryKey;
    username: string & Unique;
    created: Date;
    deleted: boolean;
    logins: number;
}

interface Post extends Entity<{ name: 'post' }> {
    id: number & AutoIncrement & PrimaryKey;
    user: User & Reference,
    created: Date,
    slag: string & Unique,
    title: string,
    content: string,
}

test('mysql', async () => {
    await schemaMigrationRoundTrip([typeOf<User>(), typeOf<Post>()], new MySQLDatabaseAdapter({
        host: 'localhost',
        user: 'root',
        database: 'default',
        password: process.env.MYSQL_PW
    }));
});
