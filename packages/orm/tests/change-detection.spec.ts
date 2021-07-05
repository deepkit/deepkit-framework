import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { atomicChange, getClassSchema, jsonSerializer, t } from '@deepkit/type';
import { Formatter } from '../src/formatter';
import { DatabaseQueryModel } from '../src/query';
import { DatabaseSession } from '../src/database-session';
import { MemoryDatabaseAdapter } from '../src/memory-db';
import { getClassState, getInstanceStateFromItem } from '../src/identity-map';
import { buildChangesFromInstance } from '../src/utils';

test('change-detection', () => {
    class Image {
        @t.primary id: number = 0;

        @t data: string = 'empty';
    }

    class User {
        @t.primary id: number = 0;

        @t.reference().optional image?: Image;

        constructor(@t public username: string) {
        }
    }

    const session = new DatabaseSession(new MemoryDatabaseAdapter);

    {
        const formatter = new Formatter(getClassSchema(User), jsonSerializer);
        const model = new DatabaseQueryModel<any, any, any>();
        const user = formatter.hydrate(model, { username: 'Peter', id: '2' });
        expect(user.username).toBe('Peter');
        expect(user.id).toBe(2);
        expect(user.image).toBeUndefined();
    }

    {
        const formatter = new Formatter(getClassSchema(User), jsonSerializer);
        const model = new DatabaseQueryModel<any, any, any>();
        const user = formatter.hydrate(model, { username: 'Peter', id: '2', image: '1' });
        expect(user.username).toBe('Peter');
        expect(user.id).toBe(2);
        expect(user.image).toBeInstanceOf(Image);
        expect(user.image.id).toBe(1);
        expect(user.image.hasOwnProperty(getClassSchema(Image).getProperty('data').symbol)).toBe(false);
        expect(() => user.image.data).toThrow(`Can not access Image.data since class was not completely hydrated`);

        user.username = 'Bar';
        // expect(buildChangesFromInstance(user)).toMatchObject({ $set: { username: 'Bar' } });

        expect(getClassState(getClassSchema(user)).classSchema.classType).toBe(User);
        expect(getClassState(getClassSchema(user.image)).classSchema.classType).toBe(Image);

        expect(getInstanceStateFromItem(user.image).item === user.image).toBe(true);
        expect(getInstanceStateFromItem(user.image).classState.classSchema.classType === Image).toBe(true);

        expect(buildChangesFromInstance(user.image)).toMatchObject({});

        expect(getInstanceStateFromItem(user.image).item === user.image).toBe(true);
        expect(getInstanceStateFromItem(user.image).classState.classSchema.classType === Image).toBe(true);

        user.image.data = 'changed';
        expect(user.image.data).toBe('changed');
        console.log('----------------------------');
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
    const s = t.schema({
        username: t.string,
    });

    const item = jsonSerializer.for(s).deserialize({ username: 'Peter' });
    getInstanceStateFromItem(item).markAsPersisted();

    item.username = 'Alex';

    expect(buildChangesFromInstance(item)).toMatchObject({ $set: { username: 'Alex' } });
});

test('change-detection number', () => {
    const s = t.schema({
        position: t.number,
    });

    {
        const item = jsonSerializer.for(s).deserialize({ position: 1 });
        getInstanceStateFromItem(item).markAsPersisted();
        item.position = 2;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { position: 2 } });
    }

    {
        const item = jsonSerializer.for(s).deserialize({ position: 1 });
        getInstanceStateFromItem(item).markAsPersisted();

        atomicChange(item).increase('position', 5);
        expect(item.position).toBe(6);

        expect(buildChangesFromInstance(item)).toMatchObject({ $inc: { position: 5 } });
    }
});

test('change-detection array', () => {
    const s = t.schema({
        id: t.number,
        tags: t.array(t.string).optional
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: ['a', 'b', 'c'] });
        getInstanceStateFromItem(item).markAsPersisted();
        item.tags![0] = '000';
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: ['000', 'b', 'c'] } });
    }

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: ['a', 'b', 'c'] });
        getInstanceStateFromItem(item).markAsPersisted();

        item.tags!.splice(1, 1); //remove b
        expect(item.tags).toEqual(['a', 'c']);

        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: ['a', 'c'] } });

        item.tags = undefined;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: undefined } });
    }
});

test('change-detection object', () => {
    const s = t.schema({
        id: t.number,
        tags: t.map(t.boolean).optional
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: { a: true, b: true } });
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});
        item.tags!.b = false;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: { a: true, b: false } } });
    }

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: { a: true, b: true } });
        getInstanceStateFromItem(item).markAsPersisted();

        delete item.tags!.b;
        expect(item.tags).toMatchObject({ a: true });

        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: { a: true } } });

        item.tags = undefined;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { tags: undefined } });
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

    const s = t.schema({
        id: t.number,
        enum: t.enum(MyEnum).optional
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, enum: MyEnum.running });
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});

        item.enum = MyEnum.stopped;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { enum: MyEnum.stopped } });

        item.enum = undefined;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { enum: undefined } });
    }
});

test('change-detection arrayBuffer', () => {
    const s = t.schema({
        id: t.number,
        buffer: t.type(ArrayBuffer)
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, buffer: new ArrayBuffer(10) });
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});

        new Uint8Array(item.buffer)[5] = 5;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { buffer: item.buffer } });

        new Uint8Array(item.buffer)[5] = 0;
        expect(buildChangesFromInstance(item)).toMatchObject({});
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
        getInstanceStateFromItem(item).markAsPersisted();
        expect(buildChangesFromInstance(item)).toMatchObject({});

        item.buffer[4] = 5;
        expect(buildChangesFromInstance(item)).toMatchObject({ $set: { buffer: item.buffer } });

        item.buffer[4] = 0;
        expect(buildChangesFromInstance(item)).toMatchObject({});
    }
});

test('change-detection array in array', () => {
    const s = t.schema({
        id: t.number,
        tags: t.array(t.array(t.string))
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: [['a', 'b'], ['c']] });
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
    const s = t.schema({
        id: t.number,
        tags: t.map(t.array(t.string))
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: { foo: ['a', 'b'], bar: ['c'] } });
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
    const s = t.schema({
        id: t.number,
        tags: t.map(t.map(t.boolean))
    });

    {
        const item = jsonSerializer.for(s).deserialize({ id: 1, tags: { foo: { a: true }, bar: { b: false } } });
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
