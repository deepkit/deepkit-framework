import { expect, test } from '@jest/globals';
import { deserialize } from '../src/serializer-facade';
import { createSnapshot } from '../src/snapshot';
import { ReflectionClass, resolveClassType, typeOf } from '../src/reflection/reflection';
import { buildChanges } from '../src/change-detector';
import { atomicChange } from '../src/changes';
import { ReflectionKind } from '../src/reflection/type';

test('change-detection string', () => {
    interface s {
        username: string;
    }

    const item = deserialize<s>({ username: 'Peter' });
    const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);

    expect(snapshot).toEqual({ username: 'Peter' });
    item.username = 'Alex';

    expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { username: 'Alex' } });
});

test('change-detection number', () => {
    interface s {
        position: number;
    }

    {
        const item = deserialize<s>({ position: 1 });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        item.position = 2;
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { position: 2 } });
    }

    {
        const item = deserialize<s>({ position: 1 });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);

        atomicChange(item).increase('position', 5);
        expect(item.position).toBe(6);

        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $inc: { position: 5 } });
    }
});

test('change-detection array', () => {
    interface s {
        id: number;
        tags?: string[];
    }

    {
        const item = deserialize<s>({ id: 1, tags: ['a', 'b', 'c'] });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        item.tags![0] = '000';
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: ['000', 'b', 'c'] } });
    }

    {
        const item = deserialize<s>({ id: 1, tags: ['a', 'b', 'c'] });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);

        item.tags!.splice(1, 1); //remove b
        expect(item.tags).toEqual(['a', 'c']);

        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: ['a', 'c'] } });

        item.tags = undefined;
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: undefined } });
    }
});

test('change-detection object', () => {
    interface s {
        id: number;
        tags?: Record<string, boolean>;
    }

    {
        const item = deserialize<s>({ id: 1, tags: { a: true, b: true } });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        expect(snapshot).toEqual({ id: 1, tags: { a: true, b: true } });
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});
        item.tags!.b = false;
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: { a: true, b: false } } });
    }

    {
        const item = deserialize<s>({ id: 1, tags: { a: true, b: true } });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        expect(snapshot).toEqual({ id: 1, tags: { a: true, b: true } });

        delete item.tags!.b;
        expect(item.tags).toMatchObject({ a: true });

        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: { a: true } } });

        item.tags = undefined;
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: undefined } });
    }

    {
        const item = deserialize<s>({ id: 1, tags: { a: true, b: true } });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        expect(snapshot).toEqual({ id: 1, tags: { a: true, b: true } });

        item.tags!.c = true;

        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: { a: true, b: true, c: true } } });

        item.tags = undefined;
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: undefined } });
    }
});

test('change-detection union', () => {
    interface s {
        id: number;
        tags?: { type: 'a', name: string } | { type: 'b', size: number };
    }

    {
        const item = deserialize<s>({ id: 1, tags: { type: 'a', name: 'peter' } });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});

        item.tags = { type: 'b', size: 5 };
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: { type: 'b', size: 5 } } });

        item.tags = undefined;
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: undefined } });
    }
});

test('change-detection enum', () => {
    enum MyEnum {
        start,
        running,
        stopped,
    }

    interface s {
        id: number;
        enum?: MyEnum;
    }


    {
        const item = deserialize<s>({ id: 1, enum: MyEnum.running });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});

        item.enum = MyEnum.stopped;
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { enum: MyEnum.stopped } });

        item.enum = undefined;
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { enum: undefined } });
    }
});

test('change-detection arrayBuffer', () => {
    interface s {
        id: number;
        buffer: ArrayBuffer;
    }

    {
        const item = deserialize<s>({ id: 1, buffer: new ArrayBuffer(10) });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});

        new Uint8Array(item.buffer)[5] = 5;
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { buffer: item.buffer } });

        new Uint8Array(item.buffer)[5] = 0;
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});
    }
});

test('change-detection typedArray', () => {
    interface s {
        id: number;
        buffer: Uint16Array;
    }

    {
        const item = deserialize<s>({ id: 1, buffer: new Uint16Array(10) });
        expect(item.buffer.byteLength).toBe(20);
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});

        item.buffer[4] = 5;
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { buffer: item.buffer } });

        item.buffer[4] = 0;
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});
    }
});

test('change-detection array in array', () => {
    interface s {
        id: number;
        tags: string[][];
    }

    {
        const item = deserialize<s>({ id: 1, tags: [['a', 'b'], ['c']] });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});

        item.tags = [];
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = [['a'], ['c']];
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = [['a', 'b'], []];
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = [['a', 'b'], ['c']];
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});

        item.tags = [['a', 'b'], ['d']];
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: item.tags } });
    }
});

test('change-detection array in object', () => {

    interface s {
        id: number;
        tags: { [name: string]: string[] };
    }

    {
        const item = deserialize<s>({ id: 1, tags: { foo: ['a', 'b'], bar: ['c'] } });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});

        item.tags = {};
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: ['a'] };
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: ['a', 'b'], bar: ['d'] };
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: ['a', 'b'], bar: ['c'] };
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});
    }
});

test('change-detection object in object', () => {
    interface s {
        id: number;
        tags: { [name: string]: { [name: string]: boolean } };
    }

    {
        const item = deserialize<s>({ id: 1, tags: { foo: { a: true }, bar: { b: false } } });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});

        item.tags = {};
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: { a: true }, bar: { b: true } };
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: { a: true }, bar: {} };
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: { a: true }, bar: { b: false } };
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});

        item.tags = { foo: {}, bar: { b: false } };
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: { a: true } };
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { tags: item.tags } });
    }
});

test('change-detection class', () => {

    interface s {
        id: number;
        config: { a?: string, b?: string };
    }

    expect(ReflectionClass.from(typeOf<s>()).getProperty('config').getResolvedReflectionClass().getProperty('a').type.kind).toBe(ReflectionKind.string);
    expect(ReflectionClass.from(typeOf<s>()).getProperty('config').getResolvedReflectionClass().getProperty('b').type.kind).toBe(ReflectionKind.string);

    {
        const item = deserialize<s>({ id: 1, config: { a: 'foo', b: 'bar' } });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});

        item.config = { a: 'bar', b: 'bar' };
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = { a: undefined, b: 'bar' };
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = { a: 'foo', b: 'bar2' };
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = { a: 'foo', b: 'bar' };
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});
    }
});

test('change-detection class in array', () => {
    interface s {
        id: number;
        config: { name: string, value: string }[];
    }

    expect(resolveClassType(ReflectionClass.from(typeOf<s>()).getProperty('config').getSubType()).getProperty('name').type.kind).toBe(ReflectionKind.string);
    expect(resolveClassType(ReflectionClass.from(typeOf<s>()).getProperty('config').getSubType()).getProperty('value').type.kind).toBe(ReflectionKind.string);

    {
        const item = deserialize<s>({ id: 1, config: [{ name: 'foo', value: 'bar' }, { name: 'foo2', value: 'bar2' }] });
        const snapshot = createSnapshot(ReflectionClass.from(typeOf<s>()), item);
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});

        item.config = [{ name: 'foo', value: 'bar' }];
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo2', value: 'bar2' }];
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo3', value: 'bar' }, { name: 'foo2', value: 'bar2' }];
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo', value: 'bar' }, { name: 'foo4', value: 'bar2' }];
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo4', value: 'bar2' }];
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [];
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo', value: 'bar' }, { name: 'foo2', value: 'bar2' }, { name: 'foo3', value: 'bar3' }];
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo', value: 'bar' }, { name: 'foo2', value: 'bar2' }];
        expect(buildChanges(ReflectionClass.from(typeOf<s>()), snapshot, item)).toMatchObject({});
    }
});
