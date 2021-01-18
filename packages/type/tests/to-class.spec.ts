import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { CollectionWrapper, now, Plan, SimpleModel, StringCollectionWrapper, SubModel } from './entities';
import { isExcluded } from '../src/mapper';
import { getClassSchema, OnLoad, jsonSerializer, resolvePropertySchema, t, uuid, validate, cloneClass } from '../index';
import { ClassWithUnmetParent, DocumentClass } from './document-scenario/DocumentClass';
import { PageClass } from './document-scenario/PageClass';
import { getEnumLabels, getEnumValues, getValidEnumValue, isValidEnumValue } from '@deepkit/core';

test('test simple model', () => {
    const schema = getClassSchema(SimpleModel);
    expect(schema.name).toBe('SimpleModel');
    expect(schema.idField).toBe('id');

    const instance = jsonSerializer.for(SimpleModel).deserialize({
        name: 'myName',
    });

    expect(instance).toBeInstanceOf(SimpleModel);
    expect(instance.id).not.toBeUndefined();
    expect(instance.name).toBe('myName');
    expect(instance.type).toBe(0);
    expect(instance.plan).toBe(Plan.DEFAULT);
    expect(instance.created).toBeInstanceOf(Date);
    expect(instance.created).toBe(now);
});

test('test simple model all fields', () => {

    const instance = jsonSerializer.for(SimpleModel).deserialize({
        name: 'myName',
        type: 5,
        plan: '1',
        yesNo: 'true',
        created: 'Sat Oct 13 2018 14:17:35 GMT+0200',
        children: [
            { label: 'fooo' },
            { label: 'barr' },
        ],
        childrenMap: {
            foo: {
                label: 'bar'
            },
            foo2: {
                label: 'bar2'
            }
        }
    });

    expect(instance).toBeInstanceOf(SimpleModel);
    expect(typeof instance.id).toBe('string');
    expect(instance.name).toBe('myName');
    expect(instance.type).toBe(5);
    expect(instance.yesNo).toBe(true);
    expect(instance.plan).toBe(Plan.PRO);
    expect(instance.created).toBeInstanceOf(Date);
    expect(instance.created).toEqual(new Date('Sat Oct 13 2018 14:17:35 GMT+0200'));

    expect(instance.children.length).toBe(2);

    expect(instance.children[0]).toBeInstanceOf(SubModel);
    expect(instance.children[1]).toBeInstanceOf(SubModel);

    expect(instance.children[0].label).toBe('fooo');
    expect(instance.children[1].label).toBe('barr');

    expect(instance.childrenMap).toBeInstanceOf(Object);
    expect(instance.childrenMap.foo).toBeInstanceOf(SubModel);
    expect(instance.childrenMap.foo2).toBeInstanceOf(SubModel);

    expect(instance.childrenMap.foo.label).toBe('bar');
    expect(instance.childrenMap.foo2.label).toBe('bar2');

    const plain = jsonSerializer.for(SimpleModel).serialize(instance);
    expect(plain.yesNo).toBe(true);
    expect(plain.plan).toBe(1);

    const copy = cloneClass(instance);
    expect(instance !== copy).toBe(true);
    expect(instance.children[0] !== copy.children[0]).toBe(true);
    expect(instance.children[1] !== copy.children[1]).toBe(true);
    expect(instance.childrenMap.foo !== copy.childrenMap.foo).toBe(true);
    expect(instance.childrenMap.foo2 !== copy.childrenMap.foo2).toBe(true);
    expect(instance.created !== copy.created).toBe(true);

    expect(plain).toEqual(jsonSerializer.for(SimpleModel).serialize(copy));
});

test('test simple model all fields plainToMongo', () => {
    expect(getClassSchema(SubModel).idField).toBe(undefined);

    const item = jsonSerializer.for(SimpleModel).deserialize({
        name: 'myName',
        type: 5,
        plan: 1,
        yesNo: '1',
        created: 'Sat Oct 13 2018 14:17:35 GMT+0200',
        children: [
            { label: 'fooo' },
            { label: 'barr' },
        ],
        childrenMap: {
            foo: {
                label: 'bar'
            },
            foo2: {
                label: 'bar2'
            }
        }
    });

    expect(item).toBeInstanceOf(Object);
    expect(item.id).not.toBeUndefined();
    expect(item.name).toBe('myName');
    expect(item.type).toBe(5);
    expect(item.yesNo).toBe(true);
    expect(item.plan).toBe(Plan.PRO);
    expect(item.created).toBeInstanceOf(Date);
    expect(item.created).toEqual(new Date('Sat Oct 13 2018 14:17:35 GMT+0200'));

    expect(item.children.length).toBe(2);

    expect(item.children[0]).toBeInstanceOf(SubModel);
    expect(item.children[1]).toBeInstanceOf(SubModel);

    expect(item.children[0].label).toBe('fooo');
    expect(item.children[1].label).toBe('barr');

    expect(item.childrenMap).toBeInstanceOf(Object);
    expect(item.childrenMap.foo).toBeInstanceOf(SubModel);
    expect(item.childrenMap.foo2).toBeInstanceOf(SubModel);

    expect(item.childrenMap.foo.label).toBe('bar');
    expect(item.childrenMap.foo2.label).toBe('bar2');

    const plain = jsonSerializer.for(SimpleModel).serialize(item);
    expect(plain.yesNo).toBe(true);
    expect(plain.plan).toBe(1);
});

test('test simple model with not mapped fields', () => {
    const schema = getClassSchema(SimpleModel);
    expect(isExcluded(schema, 'excluded', 'database')).toBe(true);
    expect(isExcluded(schema, 'excluded', 'json')).toBe(true);

    expect(isExcluded(schema, 'excludedForPlain', 'mongo')).toBe(false);
    expect(isExcluded(schema, 'excludedForPlain', 'json')).toBe(true);

    expect(isExcluded(schema, 'excludedForMongo', 'mongo')).toBe(true);
    expect(isExcluded(schema, 'excludedForMongo', 'json')).toBe(false);

    const instance = jsonSerializer.for(SimpleModel).deserialize({
        name: 'myName',
        type: 5,
        yesNo: '1',
        notMapped: { a: 'foo' }
    });

    expect(instance).toBeInstanceOf(SimpleModel);
    expect(typeof instance.id).toBe('string');
    expect(instance.name).toBe('myName');
    expect(instance.type).toBe(5);
    expect(instance.yesNo).toBe(true);
    expect(instance.notMapped).toEqual({});
    expect(instance.excluded).toBe('default');
    expect(instance.excludedForPlain).toBe('excludedForPlain');
    expect(instance.excludedForMongo).toBe('excludedForMongo');

    const item = jsonSerializer.for(SimpleModel).deserialize({
        id: uuid(),
        name: 'myName',
        type: 5,
        yesNo: 'eads',
        notMapped: { a: 'foo' },
        excludedForPlain: 'excludedForPlain'
    });

    expect(typeof item.id).toBe('string');
    expect(item.name).toBe('myName');
    expect(item.type).toBe(5);
    expect(item.yesNo).toBe(false);
    expect(item.notMapped).toEqual({}); //has the default
    expect(item.excluded).toBe('default');
    expect(item.excludedForPlain).toBe('excludedForPlain');
    expect(item.excludedForMongo).toBe('excludedForMongo');

    const plainObject = jsonSerializer.for(SimpleModel).serialize(instance);

    expect(typeof plainObject.id).toBe('string');
    expect(plainObject.name).toBe('myName');
    expect(plainObject.type).toBe(5);
    expect(plainObject.notMapped).toBeUndefined();
    expect(plainObject.excluded).toBeUndefined();
    expect(plainObject.excludedForPlain).toBeUndefined();
    expect(plainObject.excludedForMongo).toBe('excludedForMongo');
});

test('test @Decorated', async () => {
    const instance = jsonSerializer.for(SimpleModel).deserialize({
        name: 'myName',
        stringChildrenCollection: ['Foo', 'Bar']
    });

    expect(instance.name).toBe('myName');
    expect(instance.stringChildrenCollection).toBeInstanceOf(StringCollectionWrapper);
    expect(instance.stringChildrenCollection.items).toEqual(['Foo', 'Bar']);

    instance.stringChildrenCollection.add('Bar2');
    expect(instance.stringChildrenCollection.items[2]).toBe('Bar2');

    const plain = jsonSerializer.for(SimpleModel).serialize(instance);
    expect(plain.name).toBe('myName');
    expect(plain.stringChildrenCollection).toEqual(['Foo', 'Bar', 'Bar2']);

    const mongo = jsonSerializer.for(SimpleModel).serialize(instance);
    expect(mongo.name).toBe('myName');
    expect(mongo.stringChildrenCollection).toEqual(['Foo', 'Bar', 'Bar2']);

    const instance2 = jsonSerializer.for(SimpleModel).deserialize({
        name: 'myName',
        stringChildrenCollection: false
    });

    expect(instance2.name).toBe('myName');
    expect(instance2.stringChildrenCollection).toBeInstanceOf(StringCollectionWrapper);
    expect(instance2.stringChildrenCollection.items).toEqual([]);
});

test('test childrenMap', async () => {
    const instance = jsonSerializer.for(SimpleModel).deserialize({
        name: 'myName',
        childrenMap: { foo: { label: 'Foo' }, bar: { label: 'Bar' } }
    });

    expect(instance.childrenMap.foo).toBeInstanceOf(SubModel);
    expect(instance.childrenMap.bar).toBeInstanceOf(SubModel);

    expect(instance.childrenMap.foo.label).toBe('Foo');
    expect(instance.childrenMap.bar.label).toBe('Bar');
});

test('test allowNull', async () => {
    class Model {
        @t.optional
        name?: string;
    }

    expect(jsonSerializer.for(Model).deserialize({}).name).toBe(undefined);
    expect(jsonSerializer.for(Model).deserialize({ name: null }).name).toBe(undefined);
    expect(jsonSerializer.for(Model).deserialize({ name: undefined }).name).toBe(undefined);
});

test('test OnLoad', async () => {
    // @ts-ignore
    let ModelRef;

    class Sub {
        // @ts-ignore
        @t.type(() => ModelRef).parentReference
        parent?: any;

        constructor(
            @t public name: string,
            @t.any public onLoadCallback: (item: Sub) => void,
            @t.any public onFullLoadCallback: (item: Sub) => void,
        ) {
        }

        @OnLoad()
        onLoad() {
            console.log('onLoad');
            this.onLoadCallback(this);
        }

        @OnLoad({ fullLoad: true })
        onFullLoad() {
            console.log('onFullLoad');
            this.onFullLoadCallback(this);
        }
    }

    class Model {
        @t.optional
        name?: string;

        @t.type(Sub)
        sub?: Sub;

        @t.type(Sub)
        sub2?: Sub;
    }

    ModelRef = Model;

    let onLoadedTriggered = false;
    let onFullLoadedTriggered = false;

    const instance = jsonSerializer.for(Model).deserialize({
        name: 'Root',

        sub: {
            name: 'Hi',

            //on regular "OnLoad()" parent-references are not loaded yet
            onLoadCallback: (item: Sub) => {
                expect(item.parent.sub2).toBeUndefined();
                onLoadedTriggered = true;
            },
            //on full "OnLoad({fullLoad: true})" all parent-references are loaded
            onFullLoadCallback: (item: Sub) => {
                expect(item.parent.sub2).toBeInstanceOf(Sub);
                onFullLoadedTriggered = true;
            },
        },

        sub2: {
            name: 'Hi2',
            onLoadCallback: (item: Sub) => {
            },
            onFullLoadCallback: (item: Sub) => {
            },
        },
    });

    expect(instance.name).toBe('Root');
    expect(onLoadedTriggered).toBe(true);
    expect(onFullLoadedTriggered).toBe(true);
});

test('test setter/getter', async () => {
    class Font {
        name?: string;
    }

    class Model {
        private _fonts: Font[] = [];

        get test() {
            return true;
        }

        @t.array(Font)
        get fonts(): Font[] {
            return this._fonts;
        }

        set fonts(v) {
            this._fonts = v;
        }
    }

    const instance = jsonSerializer.for(Model).deserialize({
        fonts: [{ name: 'Arial' }, { name: 'Verdana' }]
    });

    expect(instance.test).toBe(true);
    expect(instance.fonts!.length).toBe(2);

    const plain = jsonSerializer.for(Model).serialize(instance);
    expect((plain as any)._fonts).toBeUndefined();
    expect(plain.fonts.length).toBe(2);

    const mongo = jsonSerializer.for(Model).serialize(instance);
    expect((mongo as any)._fonts).toBeUndefined();
    expect(mongo.fonts.length).toBe(2);
});

test('test decorator complex', async () => {
    const instance = jsonSerializer.for(SimpleModel).deserialize({
        name: 'myName',
        childrenCollection: [{ label: 'Foo' }, { label: 'Bar' }]
    });

    expect(instance.name).toBe('myName');
    expect(instance.childrenCollection).toBeInstanceOf(CollectionWrapper);
    expect(instance.childrenCollection.items[0]).toBeInstanceOf(SubModel);
    expect(instance.childrenCollection.items[1]).toBeInstanceOf(SubModel);
    expect(instance.childrenCollection.items[0].label).toBe('Foo');
    expect(instance.childrenCollection.items[1].label).toBe('Bar');
    expect(instance.childrenCollection.items[1].constructorUsed).toBe(true);

    instance.childrenCollection.add(new SubModel('Bar2'));
    expect(instance.childrenCollection.items[2].label).toEqual('Bar2');

    const plain = jsonSerializer.for(SimpleModel).serialize(instance);

    expect(plain.name).toBe('myName');
    expect(plain.childrenCollection).toEqual([{ label: 'Foo' }, { label: 'Bar' }, { label: 'Bar2' }]);

    const mongo = jsonSerializer.for(SimpleModel).serialize(instance);
    expect(mongo.name).toBe('myName');
    expect(mongo.childrenCollection).toEqual([{ label: 'Foo' }, { label: 'Bar' }, { label: 'Bar2' }]);
});

test('test @Decorated with parent', async () => {
    expect(resolvePropertySchema(getClassSchema(DocumentClass), 'pages')).toMatchObject({
        type: 'class',
        resolveClassType: DocumentClass.PageCollection
    });
    expect(resolvePropertySchema(getClassSchema(DocumentClass.PageCollection), 'pages')).toMatchObject({
        type: 'array',
    });
    expect(resolvePropertySchema(getClassSchema(DocumentClass.PageCollection), 'pages.123')).toMatchObject({
        type: 'class',
        resolveClassType: PageClass
    });
    expect(resolvePropertySchema(getClassSchema(PageClass), 'parent')).toMatchObject({
        type: 'class',
        resolveClassType: PageClass
    });
    expect(resolvePropertySchema(getClassSchema(PageClass), 'children')).toMatchObject({
        type: 'class',
        resolveClassType: PageClass.PageCollection
    });

    expect(() => {
        const instance = jsonSerializer.for(ClassWithUnmetParent).deserialize({});
    }).toThrow('ClassWithUnmetParent.parent is defined as');

    const instance = jsonSerializer.for(DocumentClass).deserialize({
        name: 'myName',
        page: {
            name: 'RootPage',
            children: [
                { name: 'RootPage.1' },
                { name: 'RootPage.2' },
                { name: 'RootPage.3' },
            ]
        },
        pages: [
            {
                name: 'Foo',
                children: [
                    {
                        name: 'Foo.1',
                        children: [
                            { name: 'Foo.1.1' },
                            { name: 'Foo.1.2' },
                            { name: 'Foo.1.3' },
                        ]
                    }
                ]
            },
            { name: 'Bar' }
        ]
    });

    expect(instance.name).toBe('myName');

    expect(instance.page).toBeInstanceOf(PageClass);
    expect(instance.page!.children.get(0)!.parent).toBe(instance.page);
    expect(instance.page!.children.get(1)!.parent).toBe(instance.page);
    expect(instance.page!.children.get(2)!.parent).toBe(instance.page);

    expect(instance.pages).toBeInstanceOf(DocumentClass.PageCollection);
    expect(instance.pages.count()).toBe(2);
    expect(instance.pages.get(0)).toBeInstanceOf(PageClass);
    expect(instance.pages.get(1)).toBeInstanceOf(PageClass);

    expect(instance.pages.get(0)!.name).toBe('Foo');
    expect(instance.pages.get(1)!.name).toBe('Bar');
    expect(instance.pages.get(0)!.parent).toBeUndefined();
    expect(instance.pages.get(1)!.parent).toBeUndefined();

    expect(instance.pages.get(0)!.children).toBeInstanceOf(PageClass.PageCollection);

    const foo_1 = instance.pages.get(0)!.children.get(0);
    expect(foo_1).toBeInstanceOf(PageClass);
    expect(foo_1!.name).toBe('Foo.1');

    expect(foo_1!.parent).not.toBeUndefined();
    expect(foo_1!.parent!.name).toBe('Foo');
    expect(foo_1!.parent).toBe(instance.pages.get(0));

    expect(foo_1!.children.count()).toBe(3);
    const foo_1_1 = foo_1!.children.get(0);
    const foo_1_2 = foo_1!.children.get(1);
    const foo_1_3 = foo_1!.children.get(2);

    expect(foo_1_1).toBeInstanceOf(PageClass);
    expect(foo_1_2).toBeInstanceOf(PageClass);
    expect(foo_1_3).toBeInstanceOf(PageClass);

    expect(foo_1_1!.parent).toBeInstanceOf(PageClass);
    expect(foo_1_2!.parent).toBeInstanceOf(PageClass);
    expect(foo_1_3!.parent).toBeInstanceOf(PageClass);

    expect(foo_1_1!.parent).toBe(foo_1);
    expect(foo_1_2!.parent).toBe(foo_1);
    expect(foo_1_3!.parent).toBe(foo_1);

    expect(foo_1_1!.parent!.name).toBe('Foo.1');
    expect(foo_1_2!.parent!.name).toBe('Foo.1');
    expect(foo_1_3!.parent!.name).toBe('Foo.1');

    const clone = cloneClass(instance.page, { parents: [instance] });
    expect(clone).toBeInstanceOf(PageClass);
    expect(clone!.parent).toBeUndefined();

    const plain = jsonSerializer.for(DocumentClass).serialize(instance) as any;

    expect(plain.name).toBe('myName');
    expect(plain.pages[0].name).toEqual('Foo');
    expect(plain.pages[1].name).toEqual('Bar');
    expect(plain.pages[0].children[0].name).toEqual('Foo.1');
    expect(plain.pages[0].parent).toBeUndefined();

    expect(plain.pages[0].parent).toBeUndefined();
});


test('simple string + number + boolean', () => {
    class Model {
        @t
        name?: string;

        @t
        age?: number;

        @t
        yesNo?: boolean;
    }

    const instance = jsonSerializer.for(Model).deserialize({
        name: 1,
        age: '2',
        yesNo: 'false'
    });
    expect(instance.name).toBe('1');
    expect(instance.age).toBe(2);

    expect(jsonSerializer.for(Model).deserialize({ yesNo: 'false' }).yesNo).toBe(false);
    expect(jsonSerializer.for(Model).deserialize({ yesNo: '0' }).yesNo).toBe(false);
    expect(jsonSerializer.for(Model).deserialize({ yesNo: false }).yesNo).toBe(false);
    expect(jsonSerializer.for(Model).deserialize({ yesNo: 0 }).yesNo).toBe(false);
    expect(jsonSerializer.for(Model).deserialize({ yesNo: 'nothing' }).yesNo).toBeUndefined();
    expect(jsonSerializer.for(Model).deserialize({ yesNo: null }).yesNo).toBeUndefined();
    expect(jsonSerializer.for(Model).deserialize({ yesNo: undefined }).yesNo).toBeUndefined();

    expect(jsonSerializer.for(Model).deserialize({ yesNo: 'true' }).yesNo).toBe(true);
    expect(jsonSerializer.for(Model).deserialize({ yesNo: '1' }).yesNo).toBe(true);
    expect(jsonSerializer.for(Model).deserialize({ yesNo: true }).yesNo).toBe(true);
    expect(jsonSerializer.for(Model).deserialize({ yesNo: 1 }).yesNo).toBe(true);
    expect(jsonSerializer.for(Model).deserialize({ yesNo: null }).yesNo).toBeUndefined();
});


test('cloneClass', () => {
    class SubModel {
        @t
        name?: string;
    }

    class DataStruct {
        @t
        name?: string;
    }

    class Model {
        @t.any
        data: any;

        @t.type(DataStruct)
        dataStruct?: DataStruct;

        @t.array(SubModel)
        subs?: SubModel[];
    }

    const data = {
        a: 'true'
    };

    const dataStruct = {
        name: 'Foo'
    };

    const instance = jsonSerializer.for(Model).deserialize({
        data: data,
        dataStruct: dataStruct,
        subs: [{ name: 'foo' }],
    });

    expect(instance.data).toEqual({ a: 'true' });
    expect(instance.data).toBe(data); //any doesnt clone
    expect(instance.dataStruct!.name).toBe('Foo');
    expect(instance.dataStruct).toEqual(dataStruct);
    expect(instance.dataStruct).not.toBe(dataStruct);

    const cloned = cloneClass(instance);
    expect(cloned.data).toEqual({ a: 'true' });
    expect(cloned.data).toBe(data); //any doesnt clone
    expect(cloned.dataStruct!.name).toBe('Foo');
    expect(cloned.dataStruct).toEqual(dataStruct);
    expect(cloned.dataStruct).not.toBe(dataStruct);

    expect(cloned.subs![0]).not.toBe(instance.subs![0]);
});

test('enums', () => {
    enum Enum1 {
        first,
        second,
    }

    enum Enum2 {
        first = 'z',
        second = 'x',
    }

    enum Enum3 {
        first = 200,
        second = 100,
    }

    enum Enum4 {
        first = '200',
        second = 'x',
    }

    class Model {
        @t.enum(Enum1).optional
        enum1?: Enum1;

        @t.enum(Enum2).optional
        enum2?: Enum2;

        @t.enum(Enum3).optional
        enum3?: Enum3;

        @t.enum(Enum4).optional
        enum4?: Enum4;

        @t.enum(Enum4, true).optional
        enumLabels?: Enum4;
    }

    //todo, move tests to estdlib.ts
    expect(getEnumLabels(Enum1)).toEqual(['first', 'second']);
    expect(getEnumLabels(Enum2)).toEqual(['first', 'second']);
    expect(getEnumLabels(Enum3)).toEqual(['first', 'second']);
    expect(getEnumLabels(Enum4)).toEqual(['first', 'second']);

    expect(getEnumValues(Enum1)).toEqual([0, 1]);
    expect(getEnumValues(Enum2)).toEqual(['z', 'x']);
    expect(getEnumValues(Enum3)).toEqual([200, 100]);
    expect(getEnumValues(Enum4)).toEqual(['200', 'x']);

    expect(isValidEnumValue(Enum1, 'first')).toBe(false);
    expect(isValidEnumValue(Enum1, 'second')).toBe(false);
    expect(isValidEnumValue(Enum1, 0)).toBe(true);
    expect(isValidEnumValue(Enum1, 1)).toBe(true);
    expect(isValidEnumValue(Enum1, '0')).toBe(true);
    expect(isValidEnumValue(Enum1, '1')).toBe(true);
    expect(isValidEnumValue(Enum1, 2)).toBe(false);
    expect(isValidEnumValue(Enum1, '2')).toBe(false);

    expect(getValidEnumValue(Enum1, 1)).toBe(1);
    expect(getValidEnumValue(Enum1, '1')).toBe(1);
    expect(getValidEnumValue(Enum1, '2')).toBeUndefined();

    expect(isValidEnumValue(Enum2, 'first')).toBe(false);
    expect(isValidEnumValue(Enum2, 'second')).toBe(false);
    expect(isValidEnumValue(Enum2, 'z')).toBe(true);
    expect(isValidEnumValue(Enum2, 'x')).toBe(true);

    expect(getValidEnumValue(Enum2, 1)).toBeUndefined();
    expect(getValidEnumValue(Enum2, 'x')).toBe('x');
    expect(getValidEnumValue(Enum2, '2')).toBeUndefined();

    expect(isValidEnumValue(Enum3, 'first')).toBe(false);
    expect(isValidEnumValue(Enum3, 'second')).toBe(false);
    expect(isValidEnumValue(Enum3, '200')).toBe(true);
    expect(isValidEnumValue(Enum3, '100')).toBe(true);
    expect(isValidEnumValue(Enum3, 200)).toBe(true);
    expect(isValidEnumValue(Enum3, 100)).toBe(true);

    expect(isValidEnumValue(Enum4, 'first')).toBe(false);
    expect(isValidEnumValue(Enum4, 'second')).toBe(false);
    expect(isValidEnumValue(Enum4, '200')).toBe(true);
    expect(isValidEnumValue(Enum4, 200)).toBe(true);
    expect(isValidEnumValue(Enum4, 'x')).toBe(true);

    expect(isValidEnumValue(Enum4, 'first', true)).toBe(true);
    expect(isValidEnumValue(Enum4, 'second', true)).toBe(true);

    expect(getValidEnumValue(Enum4, 1)).toBeUndefined();
    expect(getValidEnumValue(Enum4, 200)).toBe('200');
    expect(getValidEnumValue(Enum4, '200')).toBe('200');
    expect(getValidEnumValue(Enum4, '2')).toBeUndefined();
    expect(getValidEnumValue(Enum4, 'first', true)).toBe('200');
    expect(getValidEnumValue(Enum4, 'second', true)).toBe('x');

    {
        const instance = jsonSerializer.for(Model).deserialize({
            enum1: 1,
            enum2: 'x',
            enum3: 100,
            enum4: 'x',
            enumLabels: 'x'
        });

        expect(instance.enum1).toBe(Enum1.second);
        expect(instance.enum2).toBe(Enum2.second);
        expect(instance.enum3).toBe(Enum3.second);
        expect(instance.enum4).toBe(Enum4.second);
        expect(instance.enumLabels).toBe(Enum4.second);
    }

    {
        const instance = jsonSerializer.for(Model).deserialize({
            enum1: '1',
            enum2: 'x',
            enum3: '100',
            enum4: 'x',
            enumLabels: 'second',
        });

        expect(instance.enum1).toBe(Enum1.second);
        expect(instance.enum2).toBe(Enum2.second);
        expect(instance.enum3).toBe(Enum3.second);
        expect(instance.enum4).toBe(Enum4.second);
        expect(instance.enumLabels).toBe(Enum4.second);
    }

    expect(() => {
        const instance = jsonSerializer.for(Model).deserialize({
            enum1: 2
        });
    }).toThrow('Invalid ENUM given in property');

    expect(() => {
        const instance = jsonSerializer.for(Model).deserialize({
            enum2: 2
        });
    }).toThrow('Invalid ENUM given in property');

    expect(() => {
        const instance = jsonSerializer.for(Model).deserialize({
            enum3: 2
        });
    }).toThrow('Invalid ENUM given in property');

    expect(() => {
        const instance = jsonSerializer.for(Model).deserialize({
            enum3: 4
        });
    }).toThrow('Invalid ENUM given in property');

    expect(validate(Model, {
        enum1: 2
    })).toEqual([{
        code: 'invalid_enum', message: 'Invalid enum value received. Allowed: 0,1', path: 'enum1'
    }]);

    expect(validate(Model, {
        enumLabels: 55
    })).toEqual([{
        code: 'invalid_enum', message: 'Invalid enum value received. Allowed: 200,x,first,second', path: 'enumLabels'
    }]);

    expect(validate(Model, {
        enum3: 4
    })).toEqual([{
        code: 'invalid_enum', message: 'Invalid enum value received. Allowed: 200,100', path: 'enum3'
    }]);

    expect(validate(Model, {
        enum1: 0
    })).toEqual([]);

    expect(validate(Model, {
        enum1: 1
    })).toEqual([]);

    expect(validate(Model, {
        enumLabels: 200
    })).toEqual([]);

    expect(validate(Model, {
        enumLabels: 'x'
    })).toEqual([]);

    expect(validate(Model, {
        enumLabels: 'first'
    })).toEqual([]);

    expect(validate(Model, {
        enumLabels: 'second'
    })).toEqual([]);
});

test('enums arrays', () => {
    enum Enum1 {
        first,
        second,
    }

    enum Enum2 {
        first = 'z',
        second = 'x',
    }

    class Model {
        @t.array(t.enum(Enum1))
        enum1: Enum1[] = [];

        @t.array(t.enum(Enum2))
        enum2: Enum2[] = [];
    }

    jsonSerializer.for(Model).deserialize({
        enum1: [1]
    });

    jsonSerializer.for(Model).deserialize({
        enum2: ['z']
    });

    const schema = getClassSchema(Model);
    expect(schema.getProperty('enum1').type).toBe('array');
    expect(schema.getProperty('enum1').isArray).toBe(true);
    expect(schema.getProperty('enum1').getSubType().type).toBe('enum');
    expect(schema.getProperty('enum1').getSubType().isArray).toBe(false);

    jsonSerializer.for(Model).deserialize({
        enum2: ['x', 'z']
    });

    expect(() => {
        jsonSerializer.for(Model).deserialize({
            enum1: [2]
        });
    }).toThrow('Invalid ENUM given in property');

    expect(jsonSerializer.for(Model).deserialize({
        enum2: 2
    }).enum2).toEqual([]);

    expect(validate(Model, {
        enum1: [1]
    })).toEqual([]);

    expect(validate(Model, {
        enum2: ['z']
    })).toEqual([]);

    expect(validate(Model, {
        enum2: ['nope']
    })).toEqual([
        { code: 'invalid_enum', message: 'Invalid enum value received. Allowed: z,x', path: 'enum2.0' }
    ]);
});

test('nullable', () => {
    const s = t.schema({
        username: t.string,
        password: t.string.nullable,
        optional: t.string.optional,
    });

    expect(jsonSerializer.for(s).deserialize({ username: 'asd' })).toEqual({ username: 'asd', password: null });
    expect(jsonSerializer.for(s).deserialize({ username: 'asd', password: undefined })).toEqual({ username: 'asd', password: null });
    expect(jsonSerializer.for(s).deserialize({ username: 'asd', password: null })).toEqual({ username: 'asd', password: null });
    expect(jsonSerializer.for(s).deserialize({ username: 'asd', password: 'null' })).toEqual({ username: 'asd', password: 'null' });

    expect(jsonSerializer.for(s).deserialize({ username: 'asd', optional: null })).toEqual({ username: 'asd', password: null, optional: undefined });
    expect(jsonSerializer.for(s).deserialize({ username: 'asd', optional: 'null' })).toEqual({ username: 'asd', password: null, optional: 'null' });
});


test('nullable with default', () => {
    const s = t.schema({
        username: t.string,
        password: t.string.nullable.default(null),
    });

    expect(jsonSerializer.for(s).deserialize({ username: 'asd' })).toEqual({ username: 'asd', password: null });
    expect(jsonSerializer.for(s).deserialize({ username: 'asd', password: null })).toEqual({ username: 'asd', password: null });
    expect(jsonSerializer.for(s).deserialize({ username: 'asd', password: 'foo' })).toEqual({ username: 'asd', password: 'foo' });
});

test('nullable container', () => {
    const s = t.schema({
        tags: t.array(t.string).nullable,
        tagMap: t.map(t.string).nullable,
        tagPartial: t.partial({ name: t.string }).nullable,
    });

    const s2 = s.getProperty('tagPartial').getResolvedClassSchema();
    expect(s2.getProperty('name').type).toBe('string');

    expect(jsonSerializer.for(s).deserialize({ tags: null, tagMap: null, tagPartial: null })).toEqual({ tags: null, tagMap: null, tagPartial: null });
    expect(jsonSerializer.for(s).deserialize({})).toEqual({ tags: null, tagMap: null, tagPartial: null });
});
