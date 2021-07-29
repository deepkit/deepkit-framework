import { expect, test } from '@jest/globals';
import { MongoClient } from '../../src/client/client';
import { HostType } from '../../src/client/host';
import { IsMasterCommand } from '../../src/client/command/ismaster';
import { sleep } from '@deepkit/core';

test('connect invalid', async () => {
    const client = new MongoClient('mongodb://invalid/');

    await expect(client.connect()).rejects.toThrow('getaddrinfo');
    client.close();
});

test('connect handshake', async () => {
    const client = new MongoClient('mongodb://localhost/');
    await client.connect();

    const type = client.config.hosts[0].getType();
    const rightType = type === HostType.primary || type === HostType.standalone;
    expect(rightType).toBe(true);

    client.close();
});

test('connect isMaster command', async () => {
    const client = new MongoClient('mongodb://localhost/');

    const response = await client.execute(new IsMasterCommand);

    expect(response.ismaster).toBe(true);
    client.close();
});


// test('connect with username/password', async () => {
//     const client = new MongoClient('mongodb://marc:password@localhost');
//     expect(client.config.authUser).toBe('marc');
//     expect(client.config.authPassword).toBe('password');
//
//     const response = await client.execute(new IsMasterCommand);
//     expect(response.ismaster).toBe(true);
//
//     client.close();
// });

// test('connect atlas', async () => {
//     const client = new MongoClient('mongodb+srv://admin:xxx@cluster0.8yylk.mongodb.net/testdb?retryWrites=true&w=majority');
//     expect(client.config.authUser).toBe('admin');
//     expect(client.config.authPassword).toBe('xxx');
//     expect(client.config.options.checkServerIdentity).toBe(true);
//     expect(client.config.options.retryWrites).toBe(true);
//     expect(client.config.options.readPreference).toBe('primary');
//     expect(client.config.options.w).toBe('majority');
//     expect(client.config.isSrv).toBe(true);
//     expect(client.config.srvDomain).toBe('cluster0.8yylk.mongodb.net');
//
//     const hosts = await client.config.getHosts();
//     expect(hosts.length).toBe(3);
//     expect(hosts[0].hostname).toBe('cluster0-shard-00-00.8yylk.mongodb.net');
//     expect(hosts[1].hostname).toBe('cluster0-shard-00-01.8yylk.mongodb.net');
//     expect(hosts[2].hostname).toBe('cluster0-shard-00-02.8yylk.mongodb.net');
//     expect(client.config.options.replicaSet).toBe('atlas-c2ym07-shard-0');
//     expect(client.config.options.authSource).toBe('admin');
//
//     await client.connect();
//
//     console.log(hosts);
//
//     // const User = t.class({
//     //     _id: t.mongoId.primary,
//     //     username: t.string,
//     //     tags: t.array(t.string),
//     //     priority: t.number,
//     // });
//     //
//     // const documents: ExtractClassType<typeof User>[] = [];
//     // for (let i = 0; i < 100; i++) {
//     //     const user = new User();
//     //     user.username = 'Peter ' + i;
//     //     user.tags = ['a', 'b', 'c'];
//     //     user.priority = i;
//     //     documents.push(user);
//     // }
//     //
//     // await client.execute(new InsertCommand(User, documents));
//
//     client.close();
// });
//
//
// test('load balancing', () => {
//     const client = new MongoClient('mongodb+srv://admin:xxx@cluster0.8yylk.mongodb.net/testdb?retryWrites=true&w=majority');
//
//
// });



test('connection pool', async () => {
    const client = new MongoClient('mongodb://localhost?maxPoolSize=10');

    {
        const c1 = await client.connectionPool.getConnection();
        const c2 = await client.connectionPool.getConnection();

        expect(c1 === c2).toBe(false);

        c1.release();
        c2.release();

        const c3 = await client.connectionPool.getConnection();
        expect(c3 === c1).toBe(true);
    }

    {
        const c1 = await client.connectionPool.getConnection();
        const c2 = await client.connectionPool.getConnection();
        const c3 = await client.connectionPool.getConnection();
        const c4 = await client.connectionPool.getConnection();
        const c5 = await client.connectionPool.getConnection();
        const c6 = await client.connectionPool.getConnection();
        const c7 = await client.connectionPool.getConnection();
        const c8 = await client.connectionPool.getConnection();
        const c9 = await client.connectionPool.getConnection();
        const c10 = await client.connectionPool.getConnection();
        // this blocks
        let c11: any;
        client.connectionPool.getConnection().then((c) => {
            c11 = c;
            expect(c11.id).toBe(1);
        });
        let c12: any;
        client.connectionPool.getConnection().then((c) => {
            c12 = c;
            expect(c12.id).toBe(2);
        });
        await sleep(0.01);
        expect(c11).toBe(undefined);
        expect(c12).toBe(undefined);

        c1.release();
        await sleep(0.01);
        expect(c11).toBe(c1);

        c2.release();
        await sleep(0.01);
        expect(c12).toBe(c2);
    }
});
