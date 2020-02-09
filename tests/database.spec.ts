import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {Exchange, ExchangeDatabase, ExchangeNotifyPolicy} from "..";
import {remove} from "fs-extra";
import {Database, Connection} from '@marcj/marshal-mongo';
import {ClassType} from '@marcj/estdlib';
import {f, uuid, Entity} from '@marcj/marshal';
import {ExchangeServer} from "../src/exchange-server";

let i = 0;

@Entity('incrementEntity')
class IncrementEntity {
    @f.uuid().primary()
    public id: string = uuid();

    @f
    public version: number = 0;

    @f
    public i: number = 0;
}

async function createExchangeDatabase(name?: string) {
    i++;
    const dbName = 'database-test-' + (name || i);
    const connection = new Connection('localhost', dbName);
    const localDir = '/tmp/deepkit/testing/';
    await remove(localDir);

    const exchangeServer = new ExchangeServer('auto');
    await exchangeServer.start();

    const exchange = new Exchange(exchangeServer.path);

    const notifyPolicy = new class implements ExchangeNotifyPolicy {
        notifyChanges<T>(classType: ClassType<T>): boolean {
            return true;
        }
    };

    const database = new Database(connection, dbName);
    await (await database.connection.connect()).db(dbName).dropDatabase();
    const exchangeDatabase = new ExchangeDatabase(notifyPolicy, database, exchange);

    return {exchangeDatabase: exchangeDatabase, database, disconnect: async function () {
        await exchange.disconnect();
        await database.close();
    }};
}

test('test increment', async () => {
    const {exchangeDatabase, database, disconnect} = await createExchangeDatabase('increment');

    const item = new IncrementEntity;
    await exchangeDatabase.add(item);

    const start = performance.now();
    const times = 1_000;
    const all: Promise<any>[] = [];
    for (let i = 0; i < times; i++) {
        all.push(exchangeDatabase.increase(IncrementEntity, {}, {i: 1}));
    }

    await Promise.all(all);
    console.log('increment took for ', times, performance.now() - start, 'ms', ', per item=', (performance.now() - start) / times, 'ms');
    console.log('result item', await database.query(IncrementEntity).filter({id: item.id}).findOne());
    disconnect();
});
