import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { Plan, SimpleModel, StringCollectionWrapper, SubModel } from './entities';
import { getClassSchema, jsonSerializer, t } from '../index';
import { resolvePropertySchema } from '../src/jit';

test('resolvePropertySchema simple', () => {
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'id')!.type).toBe('uuid');
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'id')!.resolveClassType).toBeUndefined();
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'id')!.isArray).toBe(false);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'id')!.isArray).toBe(false);

    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'plan')!.type).toBe('enum');
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'plan')!.resolveClassType).toBe(Plan);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'plan')!.isArray).toBe(false);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'plan')!.isMap).toBe(false);

    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'children')!.isArray).toBe(true);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'children')!.isMap).toBe(false);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'children')!.getSubType().type).toBe('class');
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'children')!.getSubType().resolveClassType).toBe(SubModel);

    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap')!.isArray).toBe(false);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap')!.isMap).toBe(true);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap')!.getSubType().type).toBe('class');
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap')!.getSubType().resolveClassType).toBe(SubModel);
});

test('resolvePropertySchema deep', () => {
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'children.0.label')!.type).toBe('string');
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'children.0.label')!.resolveClassType).toBeUndefined();
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'children.0.label')!.isArray).toBe(false);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'children.0.label')!.isMap).toBe(false);

    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo.label')!.type).toBe('string');
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo.label')!.resolveClassType).toBeUndefined();
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo.label')!.isArray).toBe(false);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo.label')!.isMap).toBe(false);

    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo.queue.added')).not.toBeUndefined();
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo.queue.added')!.type).toBe('date');

    expect(() => resolvePropertySchema(getClassSchema(SimpleModel), '')).toThrow('Invalid path  in class SimpleModel');
    expect(() => resolvePropertySchema(getClassSchema(SimpleModel), 'unknown.unknown')).toThrow('Invalid path unknown.unknown in class SimpleModel');
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap')).not.toBeUndefined();
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'selfChild.childrenMap')).not.toBeUndefined();
    expect(() => resolvePropertySchema(getClassSchema(SimpleModel), 'yesNo.unknown')).toThrow('Invalid path yesNo.unknown in class SimpleModel');
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'types.index')).not.toBeUndefined();
    expect(() => resolvePropertySchema(getClassSchema(SimpleModel), 'selfChild.unknown')).toThrow('Property SimpleModel.unknown not found');
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo')).not.toBeUndefined();
    expect(() => resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo.unknown')).toThrow('Property SubModel.unknown not found');
    expect(() => resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo.queue.unknown')).toThrow('Property JobTaskQueue.unknown not found');

    expect(() => resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo.unknown')).toThrow('Property SubModel.unknown not found');
    expect(() => resolvePropertySchema(getClassSchema(SimpleModel), 'child.unknown')).toThrow('Property SubModel.unknown not found');

    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo')!.type).toBe('class');
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo')!.resolveClassType).toBe(SubModel);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo')!.isArray).toBe(false);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenMap.foo')!.isMap).toBe(false);

    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenCollection.0')).not.toBeUndefined();
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenCollection.0')!.type).toBe('class');
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenCollection.0')!.resolveClassType).toBe(SubModel);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenCollection.0')!.isArray).toBe(false);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'childrenCollection.0')!.isMap).toBe(false);
});


test('resolvePropertySchema decorator string', () => {
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'stringChildrenCollection')).toMatchObject({
        type: 'class',
        resolveClassType: StringCollectionWrapper
    });
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'stringChildrenCollection')!.type).toBe('class');
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'stringChildrenCollection')!.resolveClassType).toBe(StringCollectionWrapper);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'stringChildrenCollection')!.isArray).toBe(false);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'stringChildrenCollection')!.isMap).toBe(false);
});

test('resolvePropertySchema deep decorator string', () => {
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'stringChildrenCollection.0')!.type).toBe('string');
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'stringChildrenCollection.0')!.resolveClassType).toBeUndefined();
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'stringChildrenCollection.0')!.isArray).toBe(false);
    expect(resolvePropertySchema(getClassSchema(SimpleModel), 'stringChildrenCollection.0')!.isMap).toBe(false);
});

test('plain-to test simple model', () => {
    const instance = jsonSerializer.for(SimpleModel).deserialize({
        //todo, this should throw an error
        id: '21313',
        name: 'Hi'
    });

    expect(instance.id).toBe('21313');
    expect(instance.name).toBe('Hi');
});


test('partial', () => {
    const instance = jsonSerializer.for(SimpleModel).partialDeserialize({
        name: 'Hi',
        children: [
            { label: 'Foo' }
        ]
    });

    expect(instance).not.toBeInstanceOf(SimpleModel);
    expect((instance as any)['id']).toBeUndefined();
    expect((instance as any)['type']).toBeUndefined();
    expect(instance.name).toBe('Hi');
    expect(instance.children[0]).toBeInstanceOf(SubModel);
    expect(instance.children[0].label).toBe('Foo');
});


test('partial 3', () => {
    const i2 = jsonSerializer.for(SimpleModel).partialDeserialize({
        'children': [{ 'label': 3 }]
    });
    expect(i2['children'][0]).toBeInstanceOf(SubModel);
    expect(i2['children'][0].label).toBe('3');
});


test('partial 6', () => {
    const i = jsonSerializer.for(SimpleModel).partialDeserialize({
        'types': [6, 7]
    });
    expect(i['types']).toEqual(['6', '7']);
});

test('test enum string', () => {
    enum MyEnum {
        waiting = 'waiting',
        downloading = 'downloading',
        extracting = 'extracting',
        verifying = 'verifying',
        done = 'done',
    }

    class Model {
        @t.enum(MyEnum)
        enum: MyEnum = MyEnum.waiting;
    }

    expect(jsonSerializer.for(Model).deserialize({ enum: MyEnum.waiting }).enum).toBe(MyEnum.waiting);
    expect(jsonSerializer.for(Model).deserialize({ enum: MyEnum.downloading }).enum).toBe(MyEnum.downloading);
    expect(jsonSerializer.for(Model).deserialize({ enum: 'waiting' }).enum).toBe(MyEnum.waiting);
    expect(jsonSerializer.for(Model).deserialize({ enum: 'extracting' }).enum).toBe(MyEnum.extracting);
    expect(jsonSerializer.for(Model).deserialize({ enum: 'verifying' }).enum).toBe(MyEnum.verifying);
});

test('test enum labels', () => {

    enum MyEnum {
        first,
        second,
        third,
    }

    class Model {
        @t.enum(MyEnum)
        enum: MyEnum = MyEnum.third;
    }

    expect(jsonSerializer.for(Model).deserialize({ enum: MyEnum.first }).enum).toBe(MyEnum.first);
    expect(jsonSerializer.for(Model).deserialize({ enum: MyEnum.second }).enum).toBe(MyEnum.second);
    expect(jsonSerializer.for(Model).deserialize({ enum: 0 }).enum).toBe(MyEnum.first);
    expect(jsonSerializer.for(Model).deserialize({ enum: 1 }).enum).toBe(MyEnum.second);
    expect(jsonSerializer.for(Model).deserialize({ enum: 2 }).enum).toBe(MyEnum.third);

    expect(() => {
        expect(jsonSerializer.for(Model).deserialize({ enum: 'first' }).enum).toBe(MyEnum.first);
    }).toThrow('Invalid ENUM given in property enum: first, valid: 0,1,2');


    class ModelWithLabels {
        @t.enum(MyEnum, true)
        enum: MyEnum = MyEnum.third;
    }

    expect(jsonSerializer.for(ModelWithLabels).deserialize({ enum: MyEnum.first }).enum).toBe(MyEnum.first);
    expect(jsonSerializer.for(ModelWithLabels).deserialize({ enum: MyEnum.second }).enum).toBe(MyEnum.second);
    expect(jsonSerializer.for(ModelWithLabels).deserialize({ enum: 0 }).enum).toBe(MyEnum.first);
    expect(jsonSerializer.for(ModelWithLabels).deserialize({ enum: 1 }).enum).toBe(MyEnum.second);
    expect(jsonSerializer.for(ModelWithLabels).deserialize({ enum: 2 }).enum).toBe(MyEnum.third);

    expect(jsonSerializer.for(ModelWithLabels).deserialize({ enum: 'first' }).enum).toBe(MyEnum.first);
    expect(jsonSerializer.for(ModelWithLabels).deserialize({ enum: 'second' }).enum).toBe(MyEnum.second);
    expect(jsonSerializer.for(ModelWithLabels).deserialize({ enum: 'third' }).enum).toBe(MyEnum.third);

    expect(() => {
        expect(jsonSerializer.for(ModelWithLabels).deserialize({ enum: 'Hi' }).enum).toBe(MyEnum.first);
    }).toThrow('Invalid ENUM given in property enum: Hi, valid: 0,1,2,first,second,third');

});


test('partial edge cases', () => {
    class Config {
    }

    class User {
        @t.required
        name!: string;

        @t.array(String).required
        tags!: string[];

        @t.required
        config!: Config;

        @t.type(() => User).optional.parentReference
        parent?: User;
    }

    // {
    //     const u = jsonSerializer.for(User).deserialize({
    //         name: 'peter',
    //         tags: {},
    //         parent: {name: 'Marie'}
    //     });
    //
    //     expect(u.name).toBe('peter');
    //     expect(u.tags).toEqual(undefined);
    //     expect(u.parent).toBeUndefined();
    // }
    //
    // {
    //     const user = new User();
    //     user.name = null as any;
    //     user.tags = {} as any;
    //     user.parent = {} as any;
    //
    //     const u = jsonSerializer.for(User).serialize(user);
    //
    //     expect(u.name).toBe(null);
    //     //we dont transform when coming from class. We trust TS system, if the user overwrites, its his fault.
    //     expect(u.tags).toEqual({});
    //     expect(u.parent).toBeUndefined();
    // }

    {
        const m = jsonSerializer.for(User).partialSerialize({
            name: undefined,
            picture: null,
            tags: {} as any
        });

        expect(m.name).toBe(null); //serialize converts undefined to null, since there's no such thing as undefined in JSON
        expect(m['picture']).toBe(undefined);
        expect(m.tags).toEqual([]);
    }

    const m = jsonSerializer.for(User).partialDeserialize({
        name: undefined,
        picture: null,
        parent: new User(),
        tags: {} as any
    });

    {
        const user = new User();
        user.config = {} as any;

        const m = jsonSerializer.for(User).serialize(user);
        expect(user.config).toEqual({});
    }
});
