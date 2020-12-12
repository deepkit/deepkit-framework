import {expect, test} from '@jest/globals';
import {MongoEnv} from './env-setup';

// jest.setTimeout(213123);

test('nix', () => {});

// test('mongo env, simple', async () => {
//
//     const mongoEnv = new MongoEnv;
//     await mongoEnv.addMongo('test');
//
//     const res = await mongoEnv.executeJson('test', `db.isMaster()`);
//     expect(res.ismaster).toBe(true);
// });

// test('mongo env, replSet', async () => {
//     const mongoEnv = new MongoEnv;
//
//     await Promise.all([
//         mongoEnv.addMongo('primary', 'rs1'),
//         mongoEnv.addMongo('secondary1', 'rs1'),
//         mongoEnv.addMongo('secondary2', 'rs1')
//     ]);
//
//     await mongoEnv.execute('primary', 'rs.initiate()');
//     await mongoEnv.waitUntilBeingPrimary('primary');
//
//     await mongoEnv.addReplicaSet('primary', 'secondary1', 1, 1);
//     await mongoEnv.waitUntilBeingSecondary('secondary1');
//
//     await mongoEnv.addReplicaSet('primary', 'secondary2', 1, 1);
//     await mongoEnv.waitUntilBeingSecondary('secondary2');
//
//     {
//         const res = await mongoEnv.executeJson('primary', `db.isMaster()`);
//         console.log('primary', res);
//         expect(res.ismaster).toBe(true);
//         expect(res.setName).toBe('rs1');
//     }
//
//     {
//         const res = await mongoEnv.executeJson('secondary1', `db.isMaster()`);
//         console.log('secondary1', res);
//         expect(res.ismaster).toBe(false);
//         expect(res.secondary).toBe(true);
//         expect(res.setName).toBe('rs1');
//     }
//
//     {
//         const res = await mongoEnv.executeJson('secondary2', `db.isMaster()`);
//         console.log('secondary2', res);
//         expect(res.ismaster).toBe(false);
//         expect(res.secondary).toBe(true);
//         expect(res.setName).toBe('rs1');
//     }
// });
