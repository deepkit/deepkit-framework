import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { buildChanges } from '../src/change-detector';
import { atomicChange } from '../src/changes';
import { t } from '../src/decorators';
import { jsonSerializer } from '../src/json-serializer';
import { createSnapshot } from '../src/snapshot';

test('change-detection string', () => {
    const s = t.schema({
        username: t.string,
    });

    const item = jsonSerializer.for(s).deserialize({ username: 'Peter' });
    const snapshot = createSnapshot(s, item);

    item.username = 'Alex';

    expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { username: 'Alex' } });
});

test('change-detection number', () => {
    const s = t.schema({
        position: t.number,
    });

    {
        const item = jsonSerializer.for(s).deserialize({ position: 1 });
        const snapshot = createSnapshot(s, item);
        item.position = 2;
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { position: 2 } });
    }

    {
        const item = jsonSerializer.for(s).deserialize({ position: 1 });
        const snapshot = createSnapshot(s, item);

        atomicChange(item).increase('position', 5);
        expect(item.position).toBe(6);

        expect(buildChanges(s, snapshot, item)).toMatchObject({ $inc: { position: 5 } });
    }
});

test('change-detection array', () => {
    const s = t.schema({
        id: t.number,
        tags: t.array(t.string).optional
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: ['a', 'b', 'c'] });
        const snapshot = createSnapshot(s, item);
        item.tags![0] = '000';
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: ['000', 'b', 'c'] } });
    }

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: ['a', 'b', 'c'] });
        const snapshot = createSnapshot(s, item);

        item.tags!.splice(1, 1); //remove b
        expect(item.tags).toEqual(['a', 'c']);

        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: ['a', 'c'] } });

        item.tags = undefined;
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: undefined } });
    }
});

test('change-detection object', () => {
    const s = t.schema({
        id: t.number,
        tags: t.map(t.boolean).optional
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: { a: true, b: true } });
        const snapshot = createSnapshot(s, item);
        expect(buildChanges(s, snapshot, item)).toMatchObject({});
        item.tags!.b = false;
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: { a: true, b: false } } });
    }

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: { a: true, b: true } });
        const snapshot = createSnapshot(s, item);

        delete item.tags!.b;
        expect(item.tags).toMatchObject({ a: true });

        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: { a: true } } });

        item.tags = undefined;
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: undefined } });
    }
});

test('change-detection union', () => {
    const s = t.schema({
        id: t.number,
        tags: t.union(t.schema({
            type: t.literal('a'),
            name: t.string,
        }), t.schema({
            type: t.literal('b'),
            size: t.number,
        })).optional
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: { type: 'a', name: 'peter' } });
        const snapshot = createSnapshot(s, item);
        expect(buildChanges(s, snapshot, item)).toMatchObject({});

        item.tags = { type: 'b', size: 5 };
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: { type: 'b', size: 5 } } });

        item.tags = undefined;
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: undefined } });
    }
});

test('change-detection enum', () => {
    enum MyEnum {
        start,
        running,
        stopped,
    }

    const s = t.schema({
        id: t.number,
        enum: t.enum(MyEnum).optional
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, enum: MyEnum.running });
        const snapshot = createSnapshot(s, item);
        expect(buildChanges(s, snapshot, item)).toMatchObject({});

        item.enum = MyEnum.stopped;
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { enum: MyEnum.stopped } });

        item.enum = undefined;
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { enum: undefined } });
    }
});

test('change-detection arrayBuffer', () => {
    const s = t.schema({
        id: t.number,
        buffer: t.type(ArrayBuffer)
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, buffer: new ArrayBuffer(10) });
        const snapshot = createSnapshot(s, item);
        expect(buildChanges(s, snapshot, item)).toMatchObject({});

        new Uint8Array(item.buffer)[5] = 5;
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { buffer: item.buffer } });

        new Uint8Array(item.buffer)[5] = 0;
        expect(buildChanges(s, snapshot, item)).toMatchObject({});
    }
});

test('change-detection typedArray', () => {
    const s = t.schema({
        id: t.number,
        buffer: t.type(Uint16Array)
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, buffer: new Uint16Array(10) });
        expect(item.buffer.byteLength).toBe(20);
        const snapshot = createSnapshot(s, item);
        expect(buildChanges(s, snapshot, item)).toMatchObject({});

        item.buffer[4] = 5;
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { buffer: item.buffer } });

        item.buffer[4] = 0;
        expect(buildChanges(s, snapshot, item)).toMatchObject({});
    }
});

test('change-detection array in array', () => {
    const s = t.schema({
        id: t.number,
        tags: t.array(t.array(t.string))
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: [['a', 'b'], ['c']] });
        const snapshot = createSnapshot(s, item);
        expect(buildChanges(s, snapshot, item)).toMatchObject({});

        item.tags = [];
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = [['a'], ['c']];
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = [['a', 'b'], []];
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = [['a', 'b'], ['c']];
        expect(buildChanges(s, snapshot, item)).toMatchObject({});

        item.tags = [['a', 'b'], ['d']];
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: item.tags } });
    }
});

test('change-detection array in object', () => {
    const s = t.schema({
        id: t.number,
        tags: t.map(t.array(t.string))
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: { foo: ['a', 'b'], bar: ['c'] } });
        const snapshot = createSnapshot(s, item);
        expect(buildChanges(s, snapshot, item)).toMatchObject({});

        item.tags = {};
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: ['a'] };
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: ['a', 'b'], bar: ['d'] };
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: ['a', 'b'], bar: ['c'] };
        expect(buildChanges(s, snapshot, item)).toMatchObject({});
    }
});

test('change-detection object in object', () => {
    const s = t.schema({
        id: t.number,
        tags: t.map(t.map(t.boolean))
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: { foo: { a: true }, bar: { b: false } } });
        const snapshot = createSnapshot(s, item);
        expect(buildChanges(s, snapshot, item)).toMatchObject({});

        item.tags = {};
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: { a: true }, bar: { b: true } };
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: { a: true }, bar: {} };
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: { a: true }, bar: { b: false } };
        expect(buildChanges(s, snapshot, item)).toMatchObject({});

        item.tags = { foo: {}, bar: { b: false } };
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: item.tags } });

        item.tags = { foo: { a: true } };
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { tags: item.tags } });
    }
});

test('change-detection class', () => {
    const s = t.schema({
        id: t.number,
        config: t.type({
            a: t.string.optional,
            b: t.string.optional,
        })
    });

    expect(s.getProperty('config').getResolvedClassSchema().getProperty('a').type).toBe('string');
    expect(s.getProperty('config').getResolvedClassSchema().getProperty('b').type).toBe('string');

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, config: { a: 'foo', b: 'bar' } });
        const snapshot = createSnapshot(s, item);
        expect(buildChanges(s, snapshot, item)).toMatchObject({});

        item.config = { a: 'bar', b: 'bar' };
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = { a: undefined, b: 'bar' };
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = { a: 'foo', b: 'bar2' };
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = { a: 'foo', b: 'bar' };
        expect(buildChanges(s, snapshot, item)).toMatchObject({});
    }
});

test('change-detection class in array', () => {
    const s = t.schema({
        id: t.number,
        config: t.array({
            name: t.string,
            value: t.string,
        })
    });

    expect(s.getProperty('config').getSubType().getResolvedClassSchema().getProperty('name').type).toBe('string');
    expect(s.getProperty('config').getSubType().getResolvedClassSchema().getProperty('value').type).toBe('string');

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, config: [{ name: 'foo', value: 'bar' }, { name: 'foo2', value: 'bar2' }] });
        const snapshot = createSnapshot(s, item);
        expect(buildChanges(s, snapshot, item)).toMatchObject({});

        item.config = [{ name: 'foo', value: 'bar' }];
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo2', value: 'bar2' }];
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo3', value: 'bar' }, { name: 'foo2', value: 'bar2' }];
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo', value: 'bar' }, { name: 'foo4', value: 'bar2' }];
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo4', value: 'bar2' }];
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [];
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo', value: 'bar' }, { name: 'foo2', value: 'bar2' }, { name: 'foo3', value: 'bar3' }];
        expect(buildChanges(s, snapshot, item)).toMatchObject({ $set: { config: item.config } });

        item.config = [{ name: 'foo', value: 'bar' }, { name: 'foo2', value: 'bar2' }];
        expect(buildChanges(s, snapshot, item)).toMatchObject({});
    }
});
