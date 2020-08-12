import 'jest-extended';
import 'reflect-metadata';
import {f, getClassSchema, plainToClass, t} from '@super-hornet/marshal';
import {Formatter} from '../src/formatter';
import {DatabaseQueryModel} from '../src/query';
import {buildChangeOld, buildChanges} from '../src/change-detector';
import {DatabaseSession} from '../src/database-session';
import {MemoryDatabaseAdapter} from '../src/memory-db';
import {getInstanceState} from '../src/identity-map';
import {BenchSuite} from '@super-hornet/core';
import {getJITConverterForSnapshot} from '../src/converter';

class MarshalModel {
    @f ready: boolean = true;

    @f.array(f.string) tags: string[] = ['a', 'b', 'c'];

    @f priority: number = 6;

    constructor(
        @f public id: number,
        @f public name: string
    ) {
    }
}

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
        const formatter = new Formatter('plain');
        const model = new DatabaseQueryModel<any, any, any>();
        const user = formatter.hydrate(getClassSchema(User), model, {username: 'Peter', id: '2'});
        expect(user.username).toBe('Peter');
        expect(user.id).toBe(2);
        expect(user.image).toBeUndefined();
    }

    {
        const formatter = new Formatter('plain');
        const model = new DatabaseQueryModel<any, any, any>();
        const user = formatter.hydrate(getClassSchema(User), model, {username: 'Peter', id: '2', image: '1'});
        expect(user.username).toBe('Peter');
        expect(user.id).toBe(2);
        expect(user.image).toBeInstanceOf(Image);
        expect(user.image.id).toBe(1);
        expect(user.image.hasOwnProperty(getClassSchema(Image).getProperty('data').symbol)).toBe(false);
        expect(() => user.image.data).toThrow(`Can not access Image.data since class was not completely hydrated`);

        user.username = 'Bar';
        expect(buildChanges(user)).toEqual({username: 'Bar'});

        expect(buildChanges(user.image)).toEqual({});
        user.image.data = 'changed';
        expect(user.image.data).toBe('changed');
        expect(buildChanges(user.image)).toEqual({data: 'changed'});

        user.image = session.getReference(Image, 2);
        expect(buildChanges(user)).toEqual({username: 'Bar', image: user.image});

        user.image = session.getReference(Image, 1);
        expect(buildChanges(user)).toEqual({username: 'Bar'});

        user.image = undefined;
        expect(buildChanges(user)).toEqual({username: 'Bar', image: undefined});
    }
});

test('snapshot creation perf', () => {
    const s = getClassSchema(MarshalModel);

    const item = plainToClass(s, {name: 'Peter'});
    const bench = new BenchSuite('change detector');

    bench.add('jit', () => {
        const bla = getJITConverterForSnapshot(s)(item);
    });

    const jit = getJITConverterForSnapshot(s);
    bench.add('jit saved', () => {
        const bla = jit(item);
    });

    bench.run();
});

test('change-detection model perf', () => {
    const s = getClassSchema(MarshalModel);

    const item = plainToClass(s, {id: 1, name: 'Peter'});
    getInstanceState(item).markAsPersisted();
    expect(item.tags).toEqual(['a', 'b', 'c']);

    item.name = 'Alex';
    item.tags = ['a', 'b', 'c'];

    // expect(buildChanges(item)).toEqual({name: 'Alex'});

    const bench = new BenchSuite('change detector');

    bench.add('buildChangeOld', () => {
        buildChangeOld(item);
    });

    bench.add('buildChanges', () => {
        buildChanges(item);
    });

    bench.run();
});

test('change-detection string', () => {
    const s = t.schema({
        username: t.string,
    });

    const item = plainToClass(s, {username: 'Peter'});
    getInstanceState(item).markAsPersisted();

    item.username = 'Alex';

    expect(buildChanges(item)).toEqual({username: 'Alex'});
});

test('change-detection array', () => {
    const s = t.schema({
        id: t.number,
        tags: t.array(t.string).optional
    });

    {
        const item = plainToClass(s, {id: 1, tags: ['a', 'b', 'c']});
        getInstanceState(item).markAsPersisted();
        item.tags![0] = '000';
        expect(buildChanges(item)).toEqual({tags: ['000', 'b', 'c']});
    }

    {
        const item = plainToClass(s, {id: 1, tags: ['a', 'b', 'c']});
        getInstanceState(item).markAsPersisted();

        item.tags!.splice(1, 1); //remove b
        expect(item.tags).toEqual(['a', 'c']);

        expect(buildChanges(item)).toEqual({tags: ['a', 'c']});

        item.tags = undefined;
        expect(buildChanges(item)).toEqual({tags: undefined});
    }
});

test('change-detection object', () => {
    const s = t.schema({
        id: t.number,
        tags: t.map(t.boolean).optional
    });

    {
        const item = plainToClass(s, {id: 1, tags: {a: true, b: true}});
        getInstanceState(item).markAsPersisted();
        expect(buildChanges(item)).toEqual({});
        item.tags!.b = false;
        expect(buildChanges(item)).toEqual({tags: {a: true, b: false}});
    }

    {
        const item = plainToClass(s, {id: 1, tags: {a: true, b: true}});
        getInstanceState(item).markAsPersisted();

        delete item.tags!.b;
        expect(item.tags).toEqual({a: true});

        expect(buildChanges(item)).toEqual({tags: {a: true}});

        item.tags = undefined;
        expect(buildChanges(item)).toEqual({tags: undefined});
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
        }))
    });

    const item = plainToClass(s, {id: 1, tags: {type: 'a', name: 'peter'}});
    if (item.tags.type === 'a') {
        // item.tags.name
    }
    // item.tags
});

test('change-detection enum', () => {
    const s = t.schema({
        id: t.number,
        tags: t.array(t.string)
    });
});

test('change-detection typedArray', () => {
    const s = t.schema({
        id: t.number,
        tags: t.array(t.string)
    });
});

test('change-detection arrayBuffer', () => {
    const s = t.schema({
        id: t.number,
        tags: t.array(t.string)
    });
});

test('change-detection array in array', () => {
    const s = t.schema({
        id: t.number,
        tags: t.array(t.array(t.string))
    });


});