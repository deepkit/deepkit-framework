import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createMongoClientFactory, MongoEnv, MongoInstance } from './client/env-setup.js';
import { AutoIncrement, PrimaryKey, ReflectionClass } from '@deepkit/type';
import { MongoClient as MongoMongoClient, ReadPreference } from 'mongodb';
import { MongoClient } from '../src/client/client.js';
import { FindCommand } from '../src/client/command/find.js';
import { Database } from '@deepkit/orm';
import { MongoDatabaseAdapter } from '../src/adapter.js';

jest.setTimeout(60 * 1000);

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
        await mongoEnv.execute('primary', `rs.secondaryOk();`);
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

        constructor(public name: string) {
        }
    }

    it('primary ', async () => {
        const client = createClient(`mongodb://primary`);
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

        await database.query(User).with({ readPreference: 'secondary' }).find();

        // +1 find
        expect(client.config.hosts[0].stats.commandsExecuted).toBe(5);
        expect(client.config.hosts[1].stats.commandsExecuted).toBe(3);
    });
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

    it('official mongo', async () => {
        const client2 = new MongoMongoClient(`mongodb://localhost:27018`);
        // await client2.connect();
        const db = client2.db('test');

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
        const rows = await db.collection('User').find()
            .withReadConcern('majority')
            .withReadPreference(ReadPreference.fromOptions({
                readPreference: {
                    mode: 'secondary',
                    // tags: [{ a: 'b' }],
                    maxStalenessSeconds: 90,
                }
            })!)
            .toArray();
        console.log('rows', rows);

        await client2.close();
    });

    it('deepkit', async () => {
        const client = new MongoClient(`mongodb://localhost:27018`);
        await client.connect();
        console.log(client.config.shortSummary());

        const reflection = ReflectionClass.from(User);
        const connection = await client.getConnection({ readPreference: 'secondary' });
        const command = new FindCommand(reflection);
        command.commandOptions = { readPreference: 'secondary' };
        const rows = await connection.execute(command);

        console.log('rows', rows);
        client.close();
    });
});
