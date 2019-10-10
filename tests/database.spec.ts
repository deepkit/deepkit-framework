import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {Exchange, ExchangeDatabase, ExchangeNotifyPolicy} from "..";
import {remove} from "fs-extra";
import {createConnection} from 'typeorm';
import {Database, getTypeOrmEntity} from '@marcj/marshal-mongo';
import { ClassType } from '@marcj/estdlib';
import { Field, uuid, Entity, UUIDField } from '@marcj/marshal';
import {ExchangeServer} from "../src/exchange-server";

let i = 0;

@Entity('incrementEntity')
class IncrementEntity {
    @UUIDField().asId()
    public id: string = uuid();

    @Field()
    public version: number = 0;

    @Field()
    public i: number = 0;
}

async function createExchangeDatabase(name?: string): Promise<[ExchangeDatabase, Function]> {
    i++;
    const connection = await createConnection({
        type: "mongodb",
        host: "localhost",
        port: 27017,
        name: 'database-test-' + (name || i),
        database: "database-test-" + (name || i),
        useNewUrlParser: true,
        synchronize: true,
        entities: [getTypeOrmEntity(IncrementEntity)]
    });

    const localDir = '/tmp/deepkit/testing/';
    await remove(localDir);

    const exchangeServer = new ExchangeServer();
    await exchangeServer.start();

    const exchange = new Exchange(exchangeServer.port);

    const notifyPolicy = new class implements ExchangeNotifyPolicy {
        notifyChanges<T>(classType: ClassType<T>): boolean {
            return true;
        }
    };

    const database = new Database(connection, "database-test-" + (name || i));
    await database.dropDatabase("database-test-" + (name || i));
    const accountDb = new ExchangeDatabase(notifyPolicy, database, exchange);

    return [accountDb, async function () {
        await exchange.disconnect();
        await database.close();
    }];
}

test('test increment', async () => {
    const [db, disconnect] = await createExchangeDatabase('increment');

    const item = new IncrementEntity;
    await db.add(IncrementEntity, item);

    const start = performance.now();
    const times = 1_000;
    const all: Promise<any>[] = [];
    for (let i = 0; i < times; i++) {
        all.push(db.increase(IncrementEntity, {}, {i: 1}));
    }

    await Promise.all(all);
    console.log('increment took for ', times, performance.now() - start, 'ms', ', per item=', (performance.now() - start) / times, 'ms');
    console.log('result item', await db.get(IncrementEntity, {id: item.id}));
    disconnect();
});
