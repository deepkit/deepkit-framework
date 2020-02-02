import 'jest-extended'
import 'reflect-metadata';
import {JobTaskQueue, Plan, SimpleModel, StringCollectionWrapper, SubModel} from "./entities";
import {
    classToPlain,
    partialClassToPlain,
    partialPlainToClass,
    plainToClass
} from "../src/mapper";
import {f, getClassSchema, ParentReference, PropertySchema} from "..";
import {DocumentClass} from "./document-scenario/DocumentClass";
import {PageClass} from "./document-scenario/PageClass";
import {PageCollection} from "./document-scenario/PageCollection";
import {printToClassJitFunction, resolvePropertyCompilerSchema} from "../src/jit";

test('resolvePropertyCompilerSchema simple', () => {
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'id')!.type).toBe('uuid');
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'id')!.resolveClassType).toBeUndefined();
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'id')!.isArray).toBe(false);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'id')!.isArray).toBe(false);

    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'plan')!.type).toBe('enum');
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'plan')!.resolveClassType).toBe(Plan);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'plan')!.isArray).toBe(false);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'plan')!.isMap).toBe(false);

    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'children')!.type).toBe('class');
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'children')!.resolveClassType).toBe(SubModel);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'children')!.isArray).toBe(true);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'children')!.isMap).toBe(false);

    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap')!.type).toBe('class');
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap')!.resolveClassType).toBe(SubModel);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap')!.isArray).toBe(false);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap')!.isMap).toBe(true);
});

test('resolvePropertyCompilerSchema deep', () => {
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'children.0.label')!.type).toBe('string');
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'children.0.label')!.resolveClassType).toBeUndefined();
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'children.0.label')!.isArray).toBe(false);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'children.0.label')!.isMap).toBe(false);

    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo.label')!.type).toBe('string');
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo.label')!.resolveClassType).toBeUndefined();
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo.label')!.isArray).toBe(false);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo.label')!.isMap).toBe(false);

    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo.queue.added')).not.toBeUndefined();
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo.queue.added')!.type).toBe('date');

    expect(() => resolvePropertyCompilerSchema(getClassSchema(SimpleModel), '')).toThrow('Invalid path  in class SimpleModel');
    expect(() => resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'unknown.unknown')).toThrow('Invalid path unknown.unknown in class SimpleModel');
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap')).not.toBeUndefined();
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'selfChild.childrenMap')).not.toBeUndefined();
    expect(() => resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'yesNo.unknown')).toThrow('Invalid path yesNo.unknown in class SimpleModel');
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'types.index')).not.toBeUndefined();
    expect(() => resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'selfChild.unknown')).toThrow('Property SimpleModel.unknown not found');
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo')).not.toBeUndefined();
    expect(() => resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo.unknown')).toThrow('Property SubModel.unknown not found');
    expect(() => resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo.queue.unknown')).toThrow('Property JobTaskQueue.unknown not found');

    expect(() => resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo.unknown')).toThrow('Property SubModel.unknown not found');
    expect(() => resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'child.unknown')).toThrow('Property SubModel.unknown not found');

    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo')!.type).toBe('class');
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo')!.resolveClassType).toBe(SubModel);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo')!.isArray).toBe(false);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenMap.foo')!.isMap).toBe(false);

    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenCollection.0')).not.toBeUndefined();
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenCollection.0')!.type).toBe('class');
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenCollection.0')!.resolveClassType).toBe(SubModel);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenCollection.0')!.isArray).toBe(false);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'childrenCollection.0')!.isMap).toBe(false);
});


test('resolvePropertyCompilerSchema decorator string', () => {
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'stringChildrenCollection')).toMatchObject({
        type: 'class',
        resolveClassType: StringCollectionWrapper
    });
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'stringChildrenCollection')!.type).toBe('class');
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'stringChildrenCollection')!.resolveClassType).toBe(StringCollectionWrapper);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'stringChildrenCollection')!.isArray).toBe(false);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'stringChildrenCollection')!.isMap).toBe(false);
});

test('resolvePropertyCompilerSchema deep decorator string', () => {
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'stringChildrenCollection.0')!.type).toBe('string');
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'stringChildrenCollection.0')!.resolveClassType).toBeUndefined();
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'stringChildrenCollection.0')!.isArray).toBe(false);
    expect(resolvePropertyCompilerSchema(getClassSchema(SimpleModel), 'stringChildrenCollection.0')!.isMap).toBe(false);
});

test('plain-to test simple model', () => {

    const instance = plainToClass(SimpleModel, {
        //todo, this should throw an error
        id: '21313',
        name: 'Hi'
    });

    expect(instance.id).toBe('21313');
    expect(instance.name).toBe('Hi');
});


test('partial', () => {
    const instance = partialPlainToClass(SimpleModel, {
        name: 'Hi',
        children: [
            {label: 'Foo'}
        ]
    });

    expect(instance).not.toBeInstanceOf(SimpleModel);
    expect(instance['id']).toBeUndefined();
    expect(instance['type']).toBeUndefined();
    expect(instance.name).toBe('Hi');
    expect(instance.children[0]).toBeInstanceOf(SubModel);
    expect(instance.children[0].label).toBe('Foo');
});


test('partial 2', () => {
    const instance = partialPlainToClass(SimpleModel, {
        name: 'Hi',
        'children.0.label': 'Foo'
    });

    expect(instance).not.toBeInstanceOf(SimpleModel);
    expect(instance['id']).toBeUndefined();
    expect(instance['type']).toBeUndefined();
    expect(instance.name).toBe('Hi');
    expect(instance['children.0.label']).toBe('Foo');

    expect(partialPlainToClass(SimpleModel, {
        'children.0.label': 2
    })).toEqual({'children.0.label': '2'});

    const i2 = partialPlainToClass(SimpleModel, {
        'children.0': {'label': 3}
    });
    expect(i2['children.0']).toBeInstanceOf(SubModel);
    expect(i2['children.0'].label).toBe('3');
});


test('partial 3', () => {
    const i2 = partialPlainToClass(SimpleModel, {
        'children': [{'label': 3}]
    });
    expect(i2['children'][0]).toBeInstanceOf(SubModel);
    expect(i2['children'][0].label).toBe('3');
});


test('partial 4', () => {
    const i2 = partialPlainToClass(SimpleModel, {
        'stringChildrenCollection.0': 4
    });
    expect(i2['stringChildrenCollection.0']).toBe('4');
});

test('partial 5', () => {
    const i2 = partialPlainToClass(SimpleModel, {
        'childrenMap.foo.label': 5
    });
    expect(i2['childrenMap.foo.label']).toBe('5');
});


test('partial 6', () => {
    const i = partialPlainToClass(SimpleModel, {
        'types': [6, 7]
    });
    expect(i['types']).toEqual(['6', '7']);
});

test('partial 7', () => {
    const i = partialPlainToClass(SimpleModel, {
        'types.0': [7]
    });
    expect(i['types.0']).toEqual('7');
});

test('partial document', () => {
    const docParent = new DocumentClass();
    const document = partialPlainToClass(DocumentClass, {
        'pages.0.name': 5,
        'pages.0.children.0.name': 6,
        'pages.0.children': [{name: 7}],
    }, [docParent]);
    console.log('document', document);
    expect(document['pages.0.name']).toBe('5');
    expect(document['pages.0.children.0.name']).toBe('6');
    expect(document['pages.0.children']).toBeInstanceOf(PageCollection);
    expect(document['pages.0.children'].get(0).name).toBe('7');

    {
        const prop = resolvePropertyCompilerSchema(getClassSchema(DocumentClass), 'pages.0.name');
        expect(prop.type).toBe('string');
        expect(prop.resolveClassType).toBe(undefined);
        expect(prop.isPartial).toBe(false);
        expect(prop.isArray).toBe(false);
        expect(prop.isMap).toBe(false);
    }

    {
        const prop = resolvePropertyCompilerSchema(getClassSchema(DocumentClass), 'pages.0.children');
        expect(prop.type).toBe('class');
        expect(prop.resolveClassType).toBe(PageCollection);
        expect(prop.isPartial).toBe(false);
        expect(prop.isArray).toBe(false);
        expect(prop.isMap).toBe(false);
    }

    {
        const prop = resolvePropertyCompilerSchema(getClassSchema(DocumentClass), 'pages.0.children.0.name');
        expect(prop.type).toBe('string');
        expect(prop.resolveClassType).toBe(undefined);
        expect(prop.isPartial).toBe(false);
        expect(prop.isArray).toBe(false);
        expect(prop.isMap).toBe(false);
    }
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
        @f.enum(MyEnum)
        enum: MyEnum = MyEnum.waiting;
    }

    expect(plainToClass(Model, {enum: MyEnum.waiting}).enum).toBe(MyEnum.waiting);
    expect(plainToClass(Model, {enum: MyEnum.downloading}).enum).toBe(MyEnum.downloading);
    expect(plainToClass(Model, {enum: 'waiting'}).enum).toBe(MyEnum.waiting);
    expect(plainToClass(Model, {enum: 'extracting'}).enum).toBe(MyEnum.extracting);
    expect(plainToClass(Model, {enum: 'verifying'}).enum).toBe(MyEnum.verifying);
});

test('test enum labels', () => {

    enum MyEnum {
        first,
        second,
        third,
    }

    class Model {
        @f.enum(MyEnum)
        enum: MyEnum = MyEnum.third;
    }

    expect(plainToClass(Model, {enum: MyEnum.first}).enum).toBe(MyEnum.first);
    expect(plainToClass(Model, {enum: MyEnum.second}).enum).toBe(MyEnum.second);
    expect(plainToClass(Model, {enum: 0}).enum).toBe(MyEnum.first);
    expect(plainToClass(Model, {enum: 1}).enum).toBe(MyEnum.second);
    expect(plainToClass(Model, {enum: 2}).enum).toBe(MyEnum.third);

    expect(() => {
        expect(plainToClass(Model, {enum: 'first'}).enum).toBe(MyEnum.first);
    }).toThrow('Invalid ENUM given in property enum: first, valid: 0,1,2');


    class ModelWithLabels {
        @f.enum(MyEnum, true)
        enum: MyEnum = MyEnum.third;
    }

    expect(plainToClass(ModelWithLabels, {enum: MyEnum.first}).enum).toBe(MyEnum.first);
    expect(plainToClass(ModelWithLabels, {enum: MyEnum.second}).enum).toBe(MyEnum.second);
    expect(plainToClass(ModelWithLabels, {enum: 0}).enum).toBe(MyEnum.first);
    expect(plainToClass(ModelWithLabels, {enum: 1}).enum).toBe(MyEnum.second);
    expect(plainToClass(ModelWithLabels, {enum: 2}).enum).toBe(MyEnum.third);

    expect(plainToClass(ModelWithLabels, {enum: 'first'}).enum).toBe(MyEnum.first);
    expect(plainToClass(ModelWithLabels, {enum: 'second'}).enum).toBe(MyEnum.second);
    expect(plainToClass(ModelWithLabels, {enum: 'third'}).enum).toBe(MyEnum.third);

    expect(() => {
        expect(plainToClass(ModelWithLabels, {enum: 'Hi'}).enum).toBe(MyEnum.first);
    }).toThrow('Invalid ENUM given in property enum: Hi, valid: 0,1,2,first,second,third');

});


test('partial edge cases', () => {
    class Config {
    }

    class User {
        @f
        name?: string;

        @f.array(String)
        tags?: string[];

        @f
        config?: Config;

        @f.forward(() => User).optional()
        @ParentReference()
        parent?: User;
    }

    // {
    //     const u = plainToClass(User, {
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
    //     const u = classToPlain(User, user);
    //
    //     expect(u.name).toBe(null);
    //     //we dont transform when coming from class. We trust TS system, if the user overwrites, its his fault.
    //     expect(u.tags).toEqual({});
    //     expect(u.parent).toBeUndefined();
    // }

    {
        const m = partialClassToPlain(User, {
            name: undefined,
            picture: null,
            tags: {}
        });

        expect(m.name).toBe(undefined);
        expect(m['picture']).toBe(undefined);
        expect(m.tags).toBeUndefined();
    }

    const m = partialPlainToClass(User, {
        name: undefined,
        picture: null,
        parent: new User(),
        tags: {}
    });

    {
        const user = new User();
        user.config = {} as any;

        const m = classToPlain(User, user);
        expect(user.config).toEqual({});
    }
});
