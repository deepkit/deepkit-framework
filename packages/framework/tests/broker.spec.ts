import { expect, test } from '@jest/globals';
import { InjectorContext, InjectorModule } from '@deepkit/injector';
import { FrameworkConfig } from '../src/module.config.js';
import { BrokerServer } from '../src/broker/broker.js';

test('basic DI', async () => {
    const module = new InjectorModule()
        .setConfigDefinition(FrameworkConfig)
        .addProvider(BrokerServer);

    const injector = new InjectorContext(module);
    const server = injector.get(BrokerServer);
    expect(server).toBeInstanceOf(BrokerServer);
});

// test('entity channel number', async () => {
//     const kernel = new BrokerKernel();
//     const client = new DirectBroker(kernel);
//
//     @entity.name('model')
//     class Model {
//         id: number = 0;
//         version: number = 0;
//         title: string = '';
//     }
//
//     {
//         const subject = new BehaviorSubject<any>(undefined);
//         const channel = client.entityChannel(Model);
//         await channel.subscribe(v => subject.next(v));
//
//         await channel.publishRemove([23]);
//         await sleep(0);
//         expect(subject.value).toEqual({ type: EntityChannelMessageType.remove, ids: [23] });
//
//         await channel.publishPatch(23, 5, { $set: { username: true } }, { title: 'asd' });
//         await sleep(0);
//         expect(subject.value).toEqual({
//             type: EntityChannelMessageType.patch,
//             id: 23,
//             version: 5,
//             patch: { $set: { username: true } },
//             item: { title: 'asd' }
//         });
//
//         await channel.publishAdd(cast<Model>({ id: 1243, version: 0, title: 'peter' }));
//         await sleep(0);
//         expect(subject.value).toEqual({
//             type: EntityChannelMessageType.add,
//             id: 1243,
//             item: { id: 1243, version: 0, title: 'peter' }
//         });
//     }
// });
//
// test('entity channel uuid', async () => {
//     const kernel = new BrokerKernel();
//     const client = new DirectBroker(kernel);
//
//     @entity.name('modelUuid')
//     class Model {
//         id: string & PrimaryKey & UUID = uuid();
//         version: number = 0;
//         title: string = '';
//     }
//
//     {
//         const subject = new BehaviorSubject<any>(undefined);
//         const channel = client.entityChannel(Model);
//         await channel.subscribe(v => subject.next(v));
//
//         const item = new Model();
//
//         await channel.publishRemove([item.id]);
//         await sleep(0);
//         expect(subject.value).toEqual({ type: EntityChannelMessageType.remove, ids: [item.id] });
//
//         await channel.publishPatch(item.id, 5, { $set: { username: true } }, { title: 'asd' });
//         await sleep(0);
//         expect(subject.value).toEqual({
//             type: EntityChannelMessageType.patch,
//             id: item.id,
//             version: 5,
//             patch: { $set: { username: true } },
//             item: { title: 'asd' }
//         });
//
//         await channel.publishAdd(cast<Model>({ id: item.id, version: 0, title: 'peter' }));
//         await sleep(0);
//         expect(subject.value).toEqual({
//             type: EntityChannelMessageType.add,
//             id: item.id,
//             item: { id: item.id, version: 0, title: 'peter' }
//         });
//     }
// });

// test('in app', () => {
//     function provideBroker(...args: any[]): any {
//         //todo
//     }
//
//
//     type Fn = (a: number, b: {}, c: Database) => any;
//
//     type IsPrimitive<T> = T extends string | number | boolean | undefined | null | symbol | bigint ? true : false;
//
//     type OptionalNonPrimitives<T> = T extends (...args: infer A) => any ?
//         (...args: { [K in keyof A]: IsPrimitive<A[K]> extends true ? A[K] : (A[K] | undefined) }) => any
//         : never;
//
//     type NewFn = OptionalNonPrimitives<Fn>;
//
//     type BrokerCacheQuery<D extends BrokerCacheDefinition<any, any>> = {
//         get(...args: D[1]): Promise<D[0]>;
//     }
//
//     interface BrokerCache {
//         query<D extends BrokerCacheDefinition<any, any>>(cache: D): BrokerCacheQuery<D>;
//     }
//
//     class MemoryBrokerAdapter {}
//
//
//     type User = { id: number, username: string };
//
//     const userCache = defineCache(
//         'user/:id',
//         async (id: number, database: Database): Promise<User> => {
//             return await database.query<User>().filter({ id }).findOne();
//         }
//     );
//
//     const app = new App({
//         providers: [
//             provideBroker(new MemoryBrokerAdapter, userCache)
//         ]
//     });
//
//     app.command('test', async (cache: BrokerCache) => {
//         const user = await cache.query(userCache).get(2);
//     });
//
//     app.command('test', async (userCacheQuery: BrokerCacheQuery<typeof userCache>) => {
//         const user = await userCacheQuery.get(3);
//     });
// });
//
// test('idea2', () =>{
//     type UserCache = BrokerCacheKey<'user/:id', {id: number}, User>;
//
//     const app = new App({
//         providers: [
//             provideBroker(
//                 new MemoryBrokerAdapter,
//                 defineCache<UserCache>(async (options, database: Database) => {
//                     return await database.query<User>().filter({ id: options.id }).findOne();
//                 })
//             )
//         ]
//     });
//
//     app.command('test', async (userCache: BrokerCache<UserCache>) => {
//
//     });
//
// });
