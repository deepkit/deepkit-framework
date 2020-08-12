import 'jest';
import 'reflect-metadata';
import {BenchSuite} from '@super-hornet/core';
import {createDatabaseSession} from './utils';
import {Entity, f} from '@super-hornet/marshal';
import {mongoToClass} from '../src/mapping';

jest.setTimeout(100000);

@Entity('user')
export class User {
    @f ready?: boolean;

    @f.array(f.string) tags: string[] = [];

    @f priority: number = 0;

    constructor(
        @f.primary id: number,
        @f public name: string
    ) {
    }
}

test('benchmark serialization user', async () => {
    const plain = {
        name: 'name',
        id: 2,
        tags: ['a', 'b', 'c'],
        priority: 5,
        ready: true,
    }

    const suite = new BenchSuite('mongoToClass user');

    suite.add('mongoToClass', () => {
        mongoToClass(User, plain);
    });
    suite.add('classToMongo', () => {
        mongoToClass(User, plain);
    });

    suite.run();
});

test('benchmark raw', async () => {
    const database = await createDatabaseSession('benchmark-raw');
    await database.getConnection().connect();
    const user = new User(1, 'Peter');
    user.ready = true;
    user.priority = 5;
    user.tags = ['a', 'b', 'c'];
    database.add(user);
    await database.commit();
    const items = await database.query(User).find();
    console.log('items', items);
});
