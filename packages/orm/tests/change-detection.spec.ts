import { expect, test } from '@jest/globals';
import { atomicChange, deserialize, PrimaryKey, Reference, ReflectionClass, serializer } from '@deepkit/type';
import { Formatter } from '../src/formatter.js';
import { DatabaseQueryModel } from '../src/query.js';
import { DatabaseSession } from '../src/database-session.js';
import { MemoryDatabaseAdapter } from '../src/memory-db.js';
import { getClassState, getInstanceStateFromItem } from '../src/identity-map.js';
import { buildChangesFromInstance } from '../src/utils.js';
import { DatabaseEntityRegistry } from '../src/database-adapter.js';
import { EventDispatcher } from '@deepkit/event';
import { DatabasePluginRegistry } from '../src/plugin/plugin.js';
import { Logger } from '@deepkit/logger';

test('change-detection', () => {
    class Image {
        id: number & PrimaryKey = 0;

        constructor(public data: string) {
        }
    }

    class User {
        id: number & PrimaryKey = 0;

        image?: Image & Reference;

        constructor(public username: string) {
        }
    }

    const session = new DatabaseSession(new MemoryDatabaseAdapter, new DatabaseEntityRegistry(), new EventDispatcher(), new DatabasePluginRegistry(), new Logger());

    {
        const formatter = new Formatter(ReflectionClass.from(User), serializer);
        const model = new DatabaseQueryModel<any, any, any>();
        const user = formatter.hydrate(model, { username: 'Peter', id: '2' });
        expect(user.username).toBe('Peter');
        expect(user.id).toBe(2);
        expect(user.image).toBeUndefined();
    }

    {
        const formatter = new Formatter(ReflectionClass.from(User), serializer);
        const model = new DatabaseQueryModel<any, any, any>();
        const user = formatter.hydrate(model, { username: 'Peter', id: '2', image: '1' });
        expect(user.username).toBe('Peter');
        expect(user.id).toBe(2);
        expect(user.image).toBeInstanceOf(Image);
        expect(user.image.id).toBe(1);
        expect(user.image.hasOwnProperty(ReflectionClass.from(Image).getProperty('data').symbol)).toBe(false);
        console.log('user.image', user.image);
        expect(() => user.image.data).toThrow(`Can not access Image.data since class was not completely hydrated`);

        user.username = 'Bar';
        // expect(buildChangesFromInstance(user)).toMatchObject({ $set: { username: 'Bar' } });

        expect(getClassState(ReflectionClass.from(user)).classSchema.getClassType()).toBe(User);
        expect(getClassState(ReflectionClass.from(user.image)).classSchema.getClassType()).toBe(Image);

        expect(getInstanceStateFromItem(user.image).item === user.image).toBe(true);
        expect(getInstanceStateFromItem(user.image).classState.classSchema.getClassType() === Image).toBe(true);

        expect(buildChangesFromInstance(user.image)).toMatchObject({});

        expect(getInstanceStateFromItem(user.image).item === user.image).toBe(true);
        expect(getInstanceStateFromItem(user.image).classState.classSchema.getClassType() === Image).toBe(true);

        user.image.data = 'changed';
        expect(user.image.data).toBe('changed');
        expect(buildChangesFromInstance(user.image)).toMatchObject({ $set: { data: 'changed' } });

        //changing user.image.data doesnt trigger for user
        expect(buildChangesFromInstance(user)).toMatchObject({ $set: { username: 'Bar' } });

        user.image.id = 233;
        expect(buildChangesFromInstance(user)).toMatchObject({ $set: { username: 'Bar', image: user.image } });

        user.image.id = 1;
        expect(buildChangesFromInstance(user)).toMatchObject({ $set: { username: 'Bar' } });

        user.image = session.getReference(Image, 2);
        expect(buildChangesFromInstance(user)).toMatchObject({ $set: { username: 'Bar', image: user.image } });

        user.image = session.getReference(Image, 1);
        expect(buildChangesFromInstance(user)).toMatchObject({ $set: { username: 'Bar' } });

        user.image = undefined;
        expect(buildChangesFromInstance(user)).toMatchObject({ $set: { username: 'Bar', image: undefined } });
    }
});

test('change-detection string', () => {
    class s {
        username!: string & PrimaryKey;
    }

    const item = deserialize<s>({ username: 'Peter' });
    getInstanceStateFromItem(item).markAsPersisted();

    item.username = 'Alex';

    expect(buildChangesFromInstance(item)).toMatchObject({ $set: { username: 'Alex' } });
});

test('change-detection number', () => {
    class s {
        position!: number & PrimaryKey;
    }

    {
        const item = deserialize<s>({ position: 1 });
        getInstanceStateFromItem(item).markAsPersisted();
        item.position = 2;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { position: 2 } });
    }

    {
        const item = deserialize<s>({ position: 1 });
        getInstanceStateFromItem(item).markAsPersisted();

        atomicChange(item).increase('position', 5);
        expect(item.position).toBe(6);

        expect(buildChangesFromInstance(item)).toMatchObject({ $inc: { position: 5 } });
    }
});

test('change-detection array', () => {
    class s {
        id!: number & PrimaryKey;
        tags?: string[];
    }

    {
        const item = deserialize<s>({ id: 1, tags: ['a', 'b', 'c'] });
        getInstanceStateFromItem(item).markAsPersisted();
        item.tags![0] = '000';
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: ['000', 'b', 'c'] } });
    }

    {
        const item = deserialize<s>({ id: 1, tags: ['a', 'b', 'c'] });
        getInstanceStateFromItem(item).markAsPersisted();

        item.tags!.splice(1, 1); //remove b
        expect(item.tags).toEqual(['a', 'c']);

        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: ['a', 'c'] } });

        item.tags = undefined;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: undefined } });
    }
});

test('change-detection object', () => {
    class s {
        id!: number & PrimaryKey;
        tags?: { [name: string]: boolean };
    }

    {
        const item = deserialize<s>({ id: 1, tags: { a: true, b: true } });
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});
        item.tags!.b = false;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: { a: true, b: false } } });
    }

    {
        const item = deserialize<s>({ id: 1, tags: { a: true, b: true } });
        getInstanceStateFromItem(item).markAsPersisted();

        delete item.tags!.b;
        expect(item.tags).toMatchObject({ a: true });

        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: { a: true } } });

        item.tags = undefined;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: undefined } });
    }
});

test('change-detection union', () => {
    class s {
        id!: number & PrimaryKey;
        tags?: { type: 'a', name: string } | { type: 'b', size: number };
    }

    {
        const item = deserialize<s>({ id: 1, tags: { type: 'a', name: 'peter' } });
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});

        item.tags = { type: 'b', size: 5 };
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: { type: 'b', size: 5 } } });

        item.tags = undefined;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: undefined } });
    }
});

test('change-detection enum', () => {
    enum MyEnum {
        start,
        running,
        stopped,
    }

    class s {
        id!: number & PrimaryKey;
        enum?: MyEnum;
    }

    {
        const item = deserialize<s>({ id: 1, enum: MyEnum.running });
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});

        item.enum = MyEnum.stopped;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { enum: MyEnum.stopped } });

        item.enum = undefined;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { enum: undefined } });
    }
});

test('change-detection arrayBuffer', () => {
    class s {
        id!: number & PrimaryKey;
        buffer!: ArrayBuffer;
    }

    {
        const item = deserialize<s>({ id: 1, buffer: new ArrayBuffer(10) });
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});

        new Uint8Array(item.buffer)[5] = 5;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { buffer: item.buffer } });

        new Uint8Array(item.buffer)[5] = 0;
        expect(buildChangesFromInstance(item)).toMatchObject({});
    }
});

test('change-detection typedArray', () => {
    class s {
        id!: number & PrimaryKey;
        buffer!: Uint16Array;
    }

    {
        const item = deserialize<s>({ id: 1, buffer: new Uint16Array(10) });
        expect(item.buffer.byteLength).toBe(20);
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});

        item.buffer[4] = 5;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { buffer: item.buffer } });

        item.buffer[4] = 0;
        expect(buildChangesFromInstance(item)).toMatchObject({});
    }
});

test('change-detection array in array', () => {
    class s {
        id!: number & PrimaryKey;
        tags!: string[][];
    }

    {
        const item = deserialize<s>({ id: 1, tags: [['a', 'b'], ['c']] });
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});

        item.tags = [];
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = [['a'], ['c']];
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = [['a', 'b'], []];
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = [['a', 'b'], ['c']];
        expect(buildChangesFromInstance(item)).toMatchObject({});

        item.tags = [['a', 'b'], ['d']];
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: item.tags } });
    }
});

test('change-detection array in object', () => {
    class s {
        id!: number & PrimaryKey;
        tags!: Record<string, string[]>;
    }

    {
        const item = deserialize<s>({ id: 1, tags: { foo: ['a', 'b'], bar: ['c'] } });
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});

        item.tags = {};
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: ['a'] };
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: ['a', 'b'], bar: ['d'] };
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: ['a', 'b'], bar: ['c'] };
        expect(buildChangesFromInstance(item)).toMatchObject({});
    }
});

test('change-detection object in object', () => {
    class s {
        id!: number & PrimaryKey;
        tags!: Record<string, Record<string, boolean>>;
    }

    {
        const item = deserialize<s>({ id: 1, tags: { foo: { a: true }, bar: { b: false } } });
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});

        item.tags = {};
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: { a: true }, bar: { b: true } };
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: { a: true }, bar: {} };
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: { a: true }, bar: { b: false } };
        expect(buildChangesFromInstance(item)).toMatchObject({});

        item.tags = { foo: {}, bar: { b: false } };
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: { a: true } };
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: item.tags } });
    }
});

test('change-detection class', () => {
    class s {
        id!: number & PrimaryKey;
        config!: { a?: string, b?: string };
    }

    {
        const item = deserialize<s>({ id: 1, config: { a: 'foo', b: 'bar' } });
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});

        item.config = { a: 'bar', b: 'bar' };
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { config: item.config } });

        item.config = { a: undefined, b: 'bar' };
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { config: item.config } });

        item.config = { a: 'foo', b: 'bar2' };
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { config: item.config } });

        item.config = { a: 'foo', b: 'bar' };
        expect(buildChangesFromInstance(item)).toMatchObject({});
    }
});

test('change-detection class in array', () => {
    class s {
        id!: number & PrimaryKey;
        config!: { name: string, value: string }[];
    }

    {
        const item = deserialize<s>({ id: 1, config: [{ name: 'foo', value: 'bar' }, { name: 'foo2', value: 'bar2' }] });
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});

        item.config = [{ name: 'foo', value: 'bar' }];
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo2', value: 'bar2' }];
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo3', value: 'bar' }, { name: 'foo2', value: 'bar2' }];
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo', value: 'bar' }, { name: 'foo4', value: 'bar2' }];
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo4', value: 'bar2' }];
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { config: item.config } });

        item.config = [];
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo', value: 'bar' }, { name: 'foo2', value: 'bar2' }, { name: 'foo3', value: 'bar3' }];
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo', value: 'bar' }, { name: 'foo2', value: 'bar2' }];
        expect(buildChangesFromInstance(item)).toMatchObject({});
    }
});
