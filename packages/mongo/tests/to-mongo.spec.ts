import 'jest-extended';
import 'reflect-metadata';
import {arrayBufferFrom, arrayBufferTo, arrayBufferToBase64, jsonSerializer, t,} from '@deepkit/type';
import {Plan, SimpleModel, SubModel} from './entities';
import {Binary, ObjectID} from 'bson';
import {Buffer} from 'buffer';
import {DocumentClass} from './document-scenario/DocumentClass';
import {mongoSerializer} from '../src/mongo-serializer';

test('test simple model', () => {
    const instance = new SimpleModel('myName');
    const mongo = mongoSerializer.for(SimpleModel).serialize(instance);

    expect(mongo['id']).toBeInstanceOf(Binary);
    expect(mongo['name']).toBe('myName');

});

test('test simple model all fields', () => {
    const instance = new SimpleModel('myName');
    instance.plan = Plan.PRO;
    instance.type = 5;
    instance.created = new Date('Sat Oct 13 2018 14:17:35 GMT+0200');
    instance.children.push(new SubModel('fooo'));
    instance.children.push(new SubModel('barr'));

    instance.childrenMap.foo = new SubModel('bar');
    instance.childrenMap.foo2 = new SubModel('bar2');

    const mongo = mongoSerializer.for(SimpleModel).serialize(instance);

    expect(mongo['id']).toBeInstanceOf(Binary);
    expect(mongo['name']).toBe('myName');
    expect(mongo['type']).toBe(5);
    expect(mongo['plan']).toBe(Plan.PRO);
    expect(mongo['created']).toBeDate();
    expect(mongo['children']).toBeArrayOfSize(2);
    expect(mongo['children'][0]).toBeObject();
    expect(mongo['children'][0].label).toBe('fooo');
    expect(mongo['children'][1].label).toBe('barr');

    expect(mongo['childrenMap']).toBeObject();
    expect(mongo['childrenMap'].foo).toBeObject();
    expect(mongo['childrenMap'].foo.label).toBe('bar');
    expect(mongo['childrenMap'].foo2.label).toBe('bar2');
});

test('make sure undefined is undefined', () => {
    expect(undefined).toBeUndefined();
    expect(null).not.toBeUndefined();

    class Model {
        constructor(
            @t.optional
            public name?: string) {
        }
    }

    {
        const mongo = mongoSerializer.for(Model).serialize(new Model('peter'));
        expect(mongo.name).toBe('peter');
    }

    {
        const mongo = mongoSerializer.for(Model).serialize(new Model(undefined));
        expect(mongo.name).toBe(null);
    }

    {
        const mongo = mongoSerializer.for(Model).serialize(new Model());
        expect(mongo.name).toBe(null);
    }

    {
        const mongo = mongoSerializer.for(Model).from(jsonSerializer, {name: 'peter'});
        expect(mongo.name).toBe('peter');
    }

    {
        const mongo = mongoSerializer.for(Model).from(jsonSerializer, {name: undefined});
        expect(mongo.name).toBe(null);
    }

    {
        const mongo = mongoSerializer.for(Model).from(jsonSerializer, {});
        expect(mongo.name).toBe(null);
    }
});

test('convert IDs and invalid values', () => {
    enum Enum {
        first,
        second,
    }

    class Model {
        @t.mongoId
        id2?: string;

        @t.uuid
        uuid?: string;

        @t.enum(Enum)
        enum?: Enum;
    }

    const instance = new Model();
    instance.id2 = '5be340cb2ffb5e901a9b62e4';

    const mongo = mongoSerializer.for(Model).serialize(instance);
    expect(mongo.id2).toBeInstanceOf(ObjectID);
    expect(mongo.id2.toHexString()).toBe('5be340cb2ffb5e901a9b62e4');

    expect(() => {
        const instance = new Model();
        instance.id2 = 'notavalidId';
        const mongo = mongoSerializer.for(Model).serialize(instance);
    }).toThrow('Invalid ObjectID given in property id2');

    expect(() => {
        const instance = new Model();
        instance.uuid = 'notavalidId';
        const mongo = mongoSerializer.for(Model).serialize(instance);
    }).toThrow('Invalid UUID v4 given');
});


test('binary', () => {
    class Model {
        @t.type(ArrayBuffer)
        preview: ArrayBuffer = arrayBufferFrom('FooBar', 'utf8');
    }

    const i = new Model();
    expect(Buffer.from(i.preview).toString('utf8')).toBe('FooBar');

    const mongo = mongoSerializer.for(Model).serialize(i);
    expect(mongo.preview).toBeInstanceOf(Binary);
    expect((mongo.preview as Binary).length()).toBe(6);
});


test('binary from mongo', () => {
    class Model {
        @t.type(ArrayBuffer)
        preview: ArrayBuffer = arrayBufferFrom('FooBar', 'utf8');
    }

    const i = mongoSerializer.for(Model).deserialize({
        preview: new Binary(Buffer.from('FooBar', 'utf8'))
    });

    expect(i.preview.byteLength).toBe(6);
    expect(arrayBufferTo(i.preview, 'utf8')).toBe('FooBar');
});


test('partial 3', () => {
    {
        const i = mongoSerializer.for(SimpleModel).partialSerialize({
            'children': [new SubModel('3')]
        });
        expect(i['children'][0].label).toBe('3');
    }

    {
        const i = mongoSerializer.for(SimpleModel).fromPartial(jsonSerializer, {
            'children': [{label: 3}]
        });
        expect(i['children'][0].label).toBe('3');
    }
});

test('partial with required doesnt throw', () => {
    {
        mongoSerializer.for(SimpleModel).fromPartial(jsonSerializer, {
            'children': [{}]
        });
    }
});


test('partial 6', () => {
    {
        const i = mongoSerializer.for(SimpleModel).partialSerialize({
            'types': [6, 7] as any
        });
        expect(i['types']).toEqual(['6', '7']);
    }
    {
        const i = mongoSerializer.for(SimpleModel).fromPartial(jsonSerializer, {
            'types': [6, 7]
        });
        expect(i['types']).toEqual(['6', '7']);
    }
});

test('partial invalid', () => {

    expect(() => {
        mongoSerializer.for(SimpleModel).fromPartial(jsonSerializer, {
            id: 'invalid-id'
        });
    }).toThrow('Invalid UUID v4 given in property id');

    expect(() => {
        mongoSerializer.for(SimpleModel).partialSerialize({
            id: 'invalid-id'
        });
    }).toThrow('Invalid UUID v4 given in property id');

    expect(() => {
        mongoSerializer.for(DocumentClass).fromPartial(jsonSerializer, {
            _id: 'invalid-id'
        });
    }).toThrow('Invalid ObjectID given in property _id');

    expect(() => {
        mongoSerializer.for(DocumentClass).partialSerialize({
            _id: 'invalid-id'
        });
    }).toThrow('Invalid ObjectID given in property _id');

    {
        const m = mongoSerializer.for(DocumentClass).partialSerialize({
            _id: null as any
        });

        expect(m._id).toBe(null);
    }

    {
        const m =  mongoSerializer.for(DocumentClass).fromPartial(jsonSerializer, {
            _id: null as any,
        });

        expect(m._id).toBe(undefined);
    }

     mongoSerializer.for(DocumentClass).fromPartial(jsonSerializer, {
        _id: undefined
    });
     mongoSerializer.for(DocumentClass).fromPartial(jsonSerializer, {
        _id: undefined
    });
});

test('partial does not fail, that is the job of validation', () => {
    mongoSerializer.for(SimpleModel).from(jsonSerializer, new SimpleModel('peter'));

    mongoSerializer.for(SimpleModel).deserialize({
        name: 'peter',
        children: [new SubModel('p')]
    });

    mongoSerializer.for(SimpleModel).from(jsonSerializer, {
        name: 'peter',
        children: [
            {name: 'p'},
            {age: 2},
            {}
        ]
    });
});


test('partial any does not copy ', () => {
    const anyV = {'peter': 1};

    const m = mongoSerializer.for(SimpleModel).from(jsonSerializer, {
        name: 'peter',
        anyField: anyV
    });

    expect(m.anyField).toBe(anyV);
});

test('partial mongo to plain ', () => {
    class User {
        @t
        name?: string;

        @t.array(String)
        tags?: string[];

        @t.optional
        picture?: ArrayBuffer;

        @t.type(() => User).optional.parentReference
        parent?: User;
    }

    {
        const u = mongoSerializer.for(User).from(jsonSerializer, {
            name: 'peter',
            picture: null,
            tags: {},
            parent: {name: 'Marie'}
        });

        expect(u.name).toBe('peter');
        expect(u.picture).toBe(null);
        expect(u.tags).toEqual([]);
        expect(u.parent).toBe(undefined);
    }

    {
        const u = mongoSerializer.for(User).deserialize({
            name: 'peter',
            picture: null,
            tags: {},
            parent: {name: 'Marie'}
        });

        expect(u.name).toBe('peter');
        expect(u.picture).toBe(undefined);
        expect(u.tags).toEqual([]);
        expect(u.parent).toBe(undefined);
    }

    const bin = arrayBufferFrom('Hello', 'utf8');

    {
        const m = mongoSerializer.for(User).toPartial(jsonSerializer, {
            name: undefined,
            picture: null as any,
            tags: {} as any
        });

        expect(m.name).toBe(undefined);
        expect(m.picture).toBe(undefined);
        expect(m.tags).toBeArray();
    }

    {
        const m = mongoSerializer.for(User).partialSerialize({
            name: undefined,
            picture: null as any,
            parent: new User(),
            tags: {} as any
        });

        expect(m.name).toBe(null);
        expect(m.picture).toBe(null);
        expect(m.parent).toBeUndefined();
        expect(m.tags).toBeArray();
    }

    {
        const m = mongoSerializer.for(User).toPartial(jsonSerializer, {
            picture: new Binary(Buffer.from(bin)),
            name: 'peter'
        });

        expect(m.name).toBe('peter');
        expect(m.picture).toBe(arrayBufferToBase64(bin));
    }

    {
        const m = mongoSerializer.for(User).partialSerialize({
            picture: bin,
            name: 'peter'
        });

        expect(m.name).toBe('peter');
        expect(m.picture).toBeInstanceOf(Binary);
        expect((m.picture as any).buffer.toString('base64')).toBe(arrayBufferToBase64(bin));
    }

    {
        const m =  mongoSerializer.for(User).fromPartial(jsonSerializer, {
            picture: arrayBufferToBase64(bin),
            name: 'peter',
            tags: {} as any
        });

        expect(m.name).toBe('peter');
        expect(m.picture).toBeInstanceOf(Binary);
        expect(m.picture!.buffer.toString('base64')).toBe(arrayBufferToBase64(bin));
        expect(m.tags).toBeArray();
    }
});

test('optional is stored as null and converted back to undefined', () => {
    const s = t.schema({
        username: t.string.optional
    });

    const instance = jsonSerializer.for(s).deserialize({});
    const mongo = mongoSerializer.for(s).serialize(instance);
    expect(mongo.username).toBe(null);

    {
        const instance = mongoSerializer.for(s).deserialize({username: null});
        expect(instance.username).toBe(undefined);
    }

    {
        const instance = mongoSerializer.for(s).deserialize({username: undefined});
        expect(instance.username).toBe(undefined);
    }
});

test('null is stored as null and converted back', () => {
    const s = t.schema({
        username: t.string.nullable
    });

    const instance = new s.classType;
    const mongo = mongoSerializer.for(s).serialize(instance);
    expect(mongo.username).toBe(null);

    {
        const instance = mongoSerializer.for(s).deserialize({username: null});
        expect(instance.username).toBe(null);
    }

    {
        const instance = mongoSerializer.for(s).deserialize({username: undefined});
        expect(instance.username).toBe(null);
    }
});
