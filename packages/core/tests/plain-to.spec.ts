import 'jest-extended'
import 'reflect-metadata';
import {Plan, SimpleModel, StringCollectionWrapper, SubModel} from "./entities";
import {
    classToPlain,
    getReflectionType,
    getResolvedReflection,
    partialClassToPlain,
    partialPlainToClass,
    plainToClass
} from "../src/mapper";
import {EnumType, Field, forwardRef, Optional, ParentReference} from "..";
import {DocumentClass} from "./document-scenario/DocumentClass";
import {PageClass} from "./document-scenario/PageClass";
import {PageCollection} from "./document-scenario/PageCollection";

test('getResolvedReflection simple', () => {
    expect(getResolvedReflection(SimpleModel, 'id')!.resolvedClassType).toBe(SimpleModel);
    expect(getResolvedReflection(SimpleModel, 'id')!.resolvedPropertyName).toBe('id');
    expect(getResolvedReflection(SimpleModel, 'id')!.type).toBe('uuid');
    expect(getResolvedReflection(SimpleModel, 'id')!.typeValue).toBeUndefined();
    expect(getResolvedReflection(SimpleModel, 'id')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'id')!.map).toBe(false);

    expect(getResolvedReflection(SimpleModel, 'plan')!.resolvedClassType).toBe(SimpleModel);
    expect(getResolvedReflection(SimpleModel, 'plan')!.resolvedPropertyName).toBe('plan');
    expect(getResolvedReflection(SimpleModel, 'plan')!.type).toBe('enum');
    expect(getResolvedReflection(SimpleModel, 'plan')!.typeValue).toBe(Plan);
    expect(getResolvedReflection(SimpleModel, 'plan')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'plan')!.map).toBe(false);

    expect(getResolvedReflection(SimpleModel, 'children')!.resolvedClassType).toBe(SimpleModel);
    expect(getResolvedReflection(SimpleModel, 'children')!.resolvedPropertyName).toBe('children');
    expect(getResolvedReflection(SimpleModel, 'children')!.type).toBe('class');
    expect(getResolvedReflection(SimpleModel, 'children')!.typeValue).toBe(SubModel);
    expect(getResolvedReflection(SimpleModel, 'children')!.array).toBe(true);
    expect(getResolvedReflection(SimpleModel, 'children')!.map).toBe(false);

    expect(getResolvedReflection(SimpleModel, 'childrenMap')!.resolvedClassType).toBe(SimpleModel);
    expect(getResolvedReflection(SimpleModel, 'childrenMap')!.resolvedPropertyName).toBe('childrenMap');
    expect(getResolvedReflection(SimpleModel, 'childrenMap')!.type).toBe('class');
    expect(getResolvedReflection(SimpleModel, 'childrenMap')!.typeValue).toBe(SubModel);
    expect(getResolvedReflection(SimpleModel, 'childrenMap')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'childrenMap')!.map).toBe(true);
});

test('getResolvedReflection deep', () => {
    expect(getResolvedReflection(SimpleModel, 'children.0.label')!.resolvedClassType).toBe(SubModel);
    expect(getResolvedReflection(SimpleModel, 'children.0.label')!.resolvedPropertyName).toBe('label');
    expect(getResolvedReflection(SimpleModel, 'children.0.label')!.type).toBe('string');
    expect(getResolvedReflection(SimpleModel, 'children.0.label')!.typeValue).toBeUndefined();
    expect(getResolvedReflection(SimpleModel, 'children.0.label')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'children.0.label')!.map).toBe(false);

    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.label')!.resolvedClassType).toBe(SubModel);
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.label')!.resolvedPropertyName).toBe('label');
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.label')!.type).toBe('string');
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.label')!.typeValue).toBeUndefined();
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.label')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.label')!.map).toBe(false);

    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo.unknown')).toBeUndefined();

    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo')!.resolvedClassType).toBe(SimpleModel);
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo')!.resolvedPropertyName).toBe('childrenMap');
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo')!.type).toBe('class');
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo')!.typeValue).toBe(SubModel);
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'childrenMap.foo')!.map).toBe(false);
});


test('getResolvedReflection deep decorator', () => {
    expect(getResolvedReflection(SimpleModel, 'childrenCollection.0')!).toEqual({
        resolvedClassType: SimpleModel,
        resolvedPropertyName: 'childrenCollection',
        type: 'class',
        typeValue: SubModel,
        array: false,
        map: false,
    });

    expect(getResolvedReflection(SimpleModel, 'childrenCollection.0.label')!).toEqual({
        resolvedClassType: SubModel,
        resolvedPropertyName: 'label',
        type: 'string',
        typeValue: undefined,
        array: false,
        map: false,
    });
});

test('getResolvedReflection decorator string', () => {
    expect(getReflectionType(SimpleModel, 'stringChildrenCollection')).toEqual({
        type: 'class',
        typeValue: StringCollectionWrapper
    });
    expect(getResolvedReflection(SimpleModel, 'stringChildrenCollection')!.resolvedClassType).toBe(SimpleModel);
    expect(getResolvedReflection(SimpleModel, 'stringChildrenCollection')!.resolvedPropertyName).toBe('stringChildrenCollection');
    expect(getResolvedReflection(SimpleModel, 'stringChildrenCollection')!.type).toBe('class');
    expect(getResolvedReflection(SimpleModel, 'stringChildrenCollection')!.typeValue).toBe(StringCollectionWrapper);
    expect(getResolvedReflection(SimpleModel, 'stringChildrenCollection')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'stringChildrenCollection')!.map).toBe(false);
});

test('getResolvedReflection deep decorator string', () => {
    expect(getResolvedReflection(SimpleModel, 'stringChildrenCollection.0')!.resolvedClassType).toBe(SimpleModel);
    expect(getResolvedReflection(SimpleModel, 'stringChildrenCollection.0')!.resolvedPropertyName).toBe('stringChildrenCollection');
    expect(getResolvedReflection(SimpleModel, 'stringChildrenCollection.0')!.type).toBe('string');
    expect(getResolvedReflection(SimpleModel, 'stringChildrenCollection.0')!.typeValue).toBeUndefined();
    expect(getResolvedReflection(SimpleModel, 'stringChildrenCollection.0')!.array).toBe(false);
    expect(getResolvedReflection(SimpleModel, 'stringChildrenCollection.0')!.map).toBe(false);
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
    expect(document['pages.0.name']).toBe('5');
    expect(document['pages.0.children.0.name']).toBe('6');
    expect(document['pages.0.children']).toBeInstanceOf(PageCollection);
    expect(document['pages.0.children'].get(0).name).toBe('7');

    expect(getResolvedReflection(DocumentClass, 'pages.0.name')).toEqual({
        resolvedClassType: PageClass,
        resolvedPropertyName: 'name',
        type: 'string',
        typeValue: undefined,
        array: false,
        map: false,
    });

    expect(getResolvedReflection(DocumentClass, 'pages.0.children')).toEqual({
        resolvedClassType: PageClass,
        resolvedPropertyName: 'children',
        type: 'class',
        typeValue: PageCollection,
        array: false,
        map: false,
    });

    expect(getResolvedReflection(DocumentClass, 'pages.0.children.0.name')).toEqual({
        resolvedClassType: PageClass,
        resolvedPropertyName: 'name',
        type: 'string',
        typeValue: undefined,
        array: false,
        map: false,
    });
});

test('test enum labels', () => {

    enum MyEnum {
        first,
        second,
        third,
    }

    class Model {
        @EnumType(MyEnum)
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
        @EnumType(MyEnum, true)
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
    class Config {}

    class User {
        @Field()
        name?: string;

        @Field([String])
        tags?: string[];

        @Field()
        config?: Config;

        @Field(forwardRef(() => User))
        @ParentReference()
        @Optional()
        parent?: User;
    }

    {
        const u = plainToClass(User, {
            name: 'peter',
            tags: {},
            parent: {name: 'Marie'}
        });

        expect(u.name).toBe('peter');
        expect(u.tags).toEqual([]);
        expect(u.parent).toBeUndefined();
    }

    {
        const user = new User();
        user.name = null as any;
        user.tags = {} as any;
        user.parent = {} as any;

        const u = classToPlain(User, user);

        expect(u.name).toBe(null);
        expect(u.tags).toEqual([]);
        expect(u.parent).toBeUndefined();
    }

    {
        const m = partialClassToPlain(User, {
            name: undefined,
            picture: null,
            tags: {}
        });

        expect(m.name).toBe(undefined);
        expect(m.tags).toBeArray()
    }

    expect(() => {
        const m = partialPlainToClass(User, {
            name: undefined,
            picture: null,
            parent: new User(),
            tags: {}
        });
    }).toThrow('User::parent is already in target format. Are you calling plainToClass() with an class instance?');

    expect(() => {
        const user = new User();
        user.config = {} as any;

        const m = classToPlain(User, user);
    }).toThrow('Could not convert User::config since target is not a class instance of Config. Got Object');
});
