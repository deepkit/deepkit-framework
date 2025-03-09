import { afterEach, describe, expect, it, jest, test } from '@jest/globals';
import { MongoClient } from '../../src/client/client.js';
import { MongoEnv } from './env-setup.js';
import { asyncOperation, sleep } from '@deepkit/core';
import { IsMasterCommand } from '../../src/client/command/ismaster';
import { MongoConnectionError } from '../../src/client/error';
import { after } from 'node:test';

jest.setTimeout(213123);

test('nix', () => {
});

describe('mongo-env', () => {
    const mongoEnv = new MongoEnv('basics');

    afterEach(() => {
        mongoEnv.closeAll();
    });

    it('should execute json', async () => {
        const mongo = await mongoEnv.addMongo();
        const res = await mongoEnv.executeJson(mongo.name, `db.isMaster()`);
        expect(res.ismaster).toBe(true);
    });

    test('client connect', async () => {
        const a = await mongoEnv.addMongo();

        const client = new MongoClient(a.getUrl());
        await client.connect();
        expect(client.pool.isConnected()).toBe(true);
        expect(client.pool.isWritable()).toBe(true);
        expect(client.pool.getConnectedConnections().length).toBe(1);
        client.close();
        await sleep(0);
    });

    test('client reconnect', async () => {
        const a = await mongoEnv.addMongo();

        const client = new MongoClient(a.getUrl());
        {
            const cmd = await client.execute(new IsMasterCommand());
            expect(client.pool.isConnected()).toBe(true);
            expect(cmd.ismaster).toBe(true);
        }

        a.closeConnections();
        await sleep(0);
        expect(client.pool.isConnected()).toBe(false);

        {
            const cmd = await client.execute(new IsMasterCommand());
            expect(client.pool.isConnected()).toBe(true);
            expect(cmd.ismaster).toBe(true);
        }
    });

    test('client down', async () => {
        const mongo = await mongoEnv.addMongo();
        mongo.connectionDrop = true;
        mongo.stopProxy();

        const client = new MongoClient(mongo.getUrl());

        await expect(client.connect()).rejects.toThrow('Connection failed');
        expect(client.execute(new IsMasterCommand())).rejects.toThrow('Connection failed');
        expect(client.pool.isConnected()).toBe(false);
    });

    test('server down', async () => {
        const mongo = await mongoEnv.addMongo();
        mongo.stopProxy();

        const client = new MongoClient(mongo.getUrl());
        await expect(client.execute(new IsMasterCommand())).rejects.toThrow('Connection failed');
    });

    test('client down - reconnect', async () => {
        const mongo = await mongoEnv.addMongo();

        const client = new MongoClient(mongo.getUrl());
        {
            const cmd = await client.execute(new IsMasterCommand());
            expect(client.pool.isConnected()).toBe(true);
            expect(cmd.ismaster).toBe(true);
        }

        mongo.closeConnections();
        mongo.connectionDrop = true;
        await sleep(0);
        expect(client.pool.isConnected()).toBe(false);

        await expect(client.execute(new IsMasterCommand())).rejects.toThrow(MongoConnectionError);

        mongo.connectionDrop = false;
        await client.execute(new IsMasterCommand());
    });

});

describe('replica set', () => {
    const mongoEnv = new MongoEnv;

    const setup = asyncOperation<void>(async (resolve) => {
        const [primary, secondary1, secondary2] = await Promise.all([
            mongoEnv.addMongo('primary', 'rs1'),
            mongoEnv.addMongo('secondary1', 'rs1'),
            mongoEnv.addMongo('secondary2', 'rs1'),
        ]);

        const init = await mongoEnv.execute('primary', `rs.initiate(${JSON.stringify({
            _id: 'rs1',
            members: [
                { _id: 0, host: primary.name },
            ],
        })}`);
        console.log('rs.initiate', init);
        await mongoEnv.waitUntilBeingPrimary('primary');

        await mongoEnv.addReplicaSet('primary', 'secondary1', 1, 1);
        await mongoEnv.waitUntilBeingSecondary('secondary1');
        resolve();
    });

    after(() => {
        mongoEnv.closeAll();
    });

    it('mongo env, replSet', async () => {
        await setup;
        // await mongoEnv.addReplicaSet('primary', 'secondary2', 1, 1);
        // await mongoEnv.waitUntilBeingSecondary('secondary2');
        //
        // {
        //     const res = await mongoEnv.executeJson('primary', `db.isMaster()`);
        //     console.log('primary', res);
        //     expect(res.ismaster).toBe(true);
        //     expect(res.setName).toBe('rs1');
        // }
        //
        // {
        //     const res = await mongoEnv.executeJson('secondary1', `db.isMaster()`);
        //     console.log('secondary1', res);
        //     expect(res.ismaster).toBe(false);
        //     expect(res.secondary).toBe(true);
        //     expect(res.setName).toBe('rs1');
        // }
        //
        // {
        //     const res = await mongoEnv.executeJson('secondary2', `db.isMaster()`);
        //     console.log('secondary2', res);
        //     expect(res.ismaster).toBe(false);
        //     expect(res.secondary).toBe(true);
        //     expect(res.setName).toBe('rs1');
        // }
    });
});
