import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createMongoClientFactory, MongoEnv, MongoInstance } from './client/env-setup.js';
import { AutoIncrement, PrimaryKey, ReflectionClass } from '@deepkit/type';
import { FindOptions, MongoClient as MongoMongoClient } from 'mongodb';
import { MongoClient } from '../src/client/client.js';
import { FindCommand } from '../src/client/command/find.js';
import { Database } from '@deepkit/orm';
import { MongoDatabaseAdapter } from '../src/adapter.js';
import { ConsoleLogger, LoggerLevel, MemoryLogger } from '@deepkit/logger';
import { sleep } from '@deepkit/core';

jest.setTimeout(60 * 1000);

test('logger', () => {
    const logger = new ConsoleLogger();
    logger.level = LoggerLevel.debug;
    const client = new MongoClient(`mongodb://primary`, undefined, logger);
    expect(client.logger.level).toBe(LoggerLevel.debug);

    const adapter = new MongoDatabaseAdapter(client);
    expect(client.logger.level).toBe(LoggerLevel.debug);

    const database = new Database(new MongoDatabaseAdapter(client), []);
    expect(client.logger.level).toBe(LoggerLevel.debug);

    database.setLogger(client.logger);
    expect(database.logger.level).toBe(LoggerLevel.debug);
    client.logger.debug('TEST');
    database.logger.debug('TEST');
    database.adapter.logger.debug('TEST');
    database.adapter.client.logger.debug('TEST');
});

describe('replica set, primary secondary', () => {
    const mongoEnv = new MongoEnv;

    let primary: MongoInstance;
    let secondary1: MongoInstance;
    const createClient = createMongoClientFactory(mongoEnv);

    beforeAll(async () => {
        [primary, secondary1] = await Promise.all([
            mongoEnv.addMongo('primary', 'rs1'),
            mongoEnv.addMongo('secondary1', 'rs1'),
        ]);

        await mongoEnv.execute('primary', `rs.initiate(${JSON.stringify({
            _id: 'rs1',
            members: [
                { _id: 0, host: primary.name },
            ],
        })});`);
        await mongoEnv.waitUntilBeingPrimary('primary');
        await mongoEnv.addReplicaSet('primary', 'secondary1', 1, 1);
        await mongoEnv.waitUntilBeingSecondary('secondary1');
        await sleep(0.5);
    });

    beforeEach(async () => {
        await mongoEnv.reset();
    });

    afterAll(async () => {
        createClient.closeAll();
        await mongoEnv.closeAll();
    });

    class User {
        id: number & PrimaryKey & AutoIncrement = 0;

        constructor(public username: string) {
        }
    }

    test('primary - secondary', async () => {
        const client = createClient(`mongodb://primary,secondary1`);
        const database = new Database(new MongoDatabaseAdapter(client), [User]);
        await client.connect();

        // two since handshake + heartbeat
        expect(client.config.hosts[0].type).toBe('primary');
        expect(client.config.hosts[1].type).toBe('secondary');
        expect(client.config.hosts[1].stats.commandsExecuted).toBe(2);
        expect(client.config.hosts[0].stats.commandsExecuted).toBe(2);
        expect(client.config.hosts[1].stats.commandsExecuted).toBe(2);

        const user = new User('peter');
        await database.persist(user);

        // +2 (auto increment + insert)
        expect(client.config.hosts[0].stats.commandsExecuted).toBe(4);
        expect(client.config.hosts[1].stats.commandsExecuted).toBe(2);

        await database.query(User).find();

        // +1 find
        expect(client.config.hosts[0].stats.commandsExecuted).toBe(5);
        expect(client.config.hosts[1].stats.commandsExecuted).toBe(2);

        await database.query(User).withOptions({ readPreference: 'secondary' }).find();

        // +1 find
        expect(client.config.hosts[0].stats.commandsExecuted).toBe(5);
        expect(client.config.hosts[1].stats.commandsExecuted).toBe(3);
    });

    test('transaction write', async () => {
        const client = createClient(`mongodb://primary`);
        const database = new Database(new MongoDatabaseAdapter(client), [User]);

        {
            await database.query(User).deleteMany();
            await database.persist(new User('user1'));

            const session = database.createSession();
            session.useTransaction();
            const user = await session.query(User).findOne();
            expect(user.username).toBe('user1');

            expect(session.hasTransaction()).toBe(true);

            user.username = 'user1 changed';
            await session.flush(); //no transaction commit
            expect(session.hasTransaction()).toBe(true);

            expect(await session.query(User).filter({ username: 'user1 changed' }).has()).toBe(true);

            //in another connection we still have the old changed
            expect(await database.query(User).filter({ username: 'user1 changed' }).has()).toBe(false);

            await session.commit();
            expect(session.hasTransaction()).toBe(false);

            //in another connection we now have the changes
            expect(await database.query(User).filter({ username: 'user1 changed' }).has()).toBe(true);
        }
    });

    test('read only transaction', async () => {
        const client = createClient(`mongodb://primary`);
        const database = new Database(new MongoDatabaseAdapter(client), [User]);
        database.setEventDispatcher(client.eventDispatcher);
        database.setLogger(client.logger);
        await client.connect();

        const session = database.createSession();
        session.useTransaction();

        await session.query(User).withOptions({ readPreference: 'secondary' }).find();
    });

    test('leaky transaction detection', async () => {
        const client = createClient(`mongodb://primary`);
        const logger = new MemoryLogger();
        const database = new Database(new MongoDatabaseAdapter(client), [User]);
        database.setLogger(logger);

        async function doIt() {
            await database.query(User).deleteMany();

            const session = database.createSession();
            session.useTransaction();
            await session.add(new User('user1')).flush();

            const user = await session.query(User).withOptions({ readPreference: 'secondary' }).findOne();
            expect(user.username).toBe('user1');
        }

        await doIt();
        await sleep(0.2);
        (global as any).gc();
        await sleep(0.1);
        expect(logger.memory.messageStrings.some(v => v.includes('Leaking transaction detected'))).toBe(true);
    });

    // test('sticky host for read session', async () => {
    //     const database = new Database(new MongoDatabaseAdapter('mongodb://localhost'));
    //     const logger = new MemoryLogger();
    //     database.setLogger(logger);
    //
    //     const session = database.createSession();
    // });

});

describe.skip('local replica', () => {
    class User {
    }

    /*

    $ mkdir -p ~/mongo-replica/rs1 ~/mongo-replica/rs2
    $ mongod --replSet replicaSet --dbpath ~/mongo-replica/rs1 --port 27018 --bind_ip localhost
    $ mongod --replSet replicaSet --dbpath ~/mongo-replica/rs2 --port 27019 --bind_ip localhost
    $ --port 27018
        rs.initiate({
            _id: "replicaSet",
            members: [
                { _id: 0, host: "localhost:27018" },
                { _id: 1, host: "localhost:27019" }
            ]
        });

     */

    test('official mongo', async () => {
        const client = new MongoMongoClient(`mongodb://localhost:27018`);
        // await client2.connect();

        /*
    {
      ismaster: 1,
      helloOk: true,
      client: {
        driver: { name: 'nodejs', version: '6.14.2' },
        platform: 'Node.js v22.13.1, LE',
        os: {
          name: 'darwin',
          architecture: 'arm64',
          version: '24.3.0',
          type: 'Darwin'
        }
      },
      compression: [ 'none' ]
    }


    supportsOpMsg true {
      find: 'User',
      filter: {},
      lsid: { id: Binary.createFromBase64('s94BZjYeRuKefgyrqWNlpw==', 4) },
      '$clusterTime': {
        clusterTime: new Timestamp({ t: 1741737680, i: 7 }),
        signature: {
          hash: Binary.createFromBase64('AAAAAAAAAAAAAAAAAAAAAAAAAAA=', 0),
          keyId: 0
        }
      },
      readConcern: { level: 'majority' },
      '$readPreference': { mode: 'secondary' }
    }
         */

        const session = client.startSession();
        const db = client.db('myDB');

        const options: FindOptions = { readPreference: 'secondary', session };

        const res1 = await db.collection('users').findOne({ name: 'Alice' }, options);
        const res2 = await db.collection('users').findOne({ name: 'Bob' }, options);
        session.endSession();

        // const rows = await db.collection('User').find()
        //     .withReadConcern('majority')
        //     .withReadPreference(ReadPreference.fromOptions({
        //         readPreference: {
        //             mode: 'secondary',
        //             // tags: [{ a: 'b' }],
        //             maxStalenessSeconds: 90,
        //         }
        //     })!)
        //     .toArray();
        // console.log('rows', rows);
        session.endSession();

        await client.close();
    });

    test('deepkit', async () => {
        const client = new MongoClient(`mongodb://localhost:27018`);
        await client.connect();
        console.log(client.config.shortSummary());

        const reflection = ReflectionClass.from(User);
        const connection = await client.getConnection({ readPreference: 'secondary' });
        const command = new FindCommand(reflection);
        command.options = { readPreference: 'secondary' };
        const rows = await connection.execute(command);

        console.log('rows', rows);
        client.close();
    });
});
