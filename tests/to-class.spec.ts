import 'jest-extended'
import 'reflect-metadata';
import {CollectionWrapper, now, Plan, SimpleModel, StringCollectionWrapper, SubModel} from "./entities";
import {classToPlain, cloneClass, isExcluded, plainToClass} from '../src/mapper';
import {f, getClassSchema, OnLoad, ParentReference, resolvePropertyCompilerSchema, uuid, validate} from "..";
import {ClassWithUnmetParent, DocumentClass, ImpossibleToMetDocumentClass} from "./document-scenario/DocumentClass";
import {PageClass} from './document-scenario/PageClass';
import {getEnumLabels, getEnumValues, getValidEnumValue, isValidEnumValue} from '@marcj/estdlib';
import {PageCollection} from "./document-scenario/PageCollection";

test('test simple model', () => {
    const schema = getClassSchema(SimpleModel);
    expect(schema.name).toBe('SimpleModel');
    expect(schema.idField).toBe('id');

    const instance = plainToClass(SimpleModel, {
        name: 'myName',
    });

    expect(instance).toBeInstanceOf(SimpleModel);
    expect(instance.id).not.toBeUndefined();
    expect(instance.name).toBe('myName');
    expect(instance.type).toBe(0);
    expect(instance.plan).toBe(Plan.DEFAULT);
    expect(instance.created).toBeDate();
    expect(instance.created).toBe(now);
});

test('test simple model all fields', () => {

    const instance = plainToClass(SimpleModel, {
        name: 'myName',
        type: 5,
        plan: '1',
        yesNo: 'true',
        created: 'Sat Oct 13 2018 14:17:35 GMT+0200',
        children: [
            {label: 'fooo'},
            {label: 'barr'},
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
    expect(instance.id).toBeString();
    expect(instance.name).toBe('myName');
    expect(instance.type).toBe(5);
    expect(instance.yesNo).toBe(true);
    expect(instance.plan).toBe(Plan.PRO);
    expect(instance.created).toBeDate();
    expect(instance.created).toEqual(new Date('Sat Oct 13 2018 14:17:35 GMT+0200'));

    expect(instance.children).toBeArrayOfSize(2);

    expect(instance.children[0]).toBeInstanceOf(SubModel);
    expect(instance.children[1]).toBeInstanceOf(SubModel);

    expect(instance.children[0].label).toBe('fooo');
    expect(instance.children[1].label).toBe('barr');

    expect(instance.childrenMap).toBeObject();
    expect(instance.childrenMap.foo).toBeInstanceOf(SubModel);
    expect(instance.childrenMap.foo2).toBeInstanceOf(SubModel);

    expect(instance.childrenMap.foo.label).toBe('bar');
    expect(instance.childrenMap.foo2.label).toBe('bar2');

    const plain = classToPlain(SimpleModel, instance);
    expect(plain.yesNo).toBeTrue();
    expect(plain.plan).toBe(1);

    const copy = cloneClass(instance);
    expect(instance !== copy).toBeTrue();
    expect(instance.children[0] !== copy.children[0]).toBeTrue();
    expect(instance.children[1] !== copy.children[1]).toBeTrue();
    expect(instance.childrenMap.foo !== copy.childrenMap.foo).toBeTrue();
    expect(instance.childrenMap.foo2 !== copy.childrenMap.foo2).toBeTrue();
    expect(instance.created !== copy.created).toBeTrue();

    expect(plain).toEqual(classToPlain(SimpleModel, copy));
});

test('test simple model all fields plainToMongo', () => {
    expect(getClassSchema(SubModel).idField).toBe(undefined);

    const item = plainToClass(SimpleModel, {
        name: 'myName',
        type: 5,
        plan: 1,
        yesNo: '1',
        created: 'Sat Oct 13 2018 14:17:35 GMT+0200',
        children: [
            {label: 'fooo'},
            {label: 'barr'},
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

    expect(item).toBeObject();
    expect(item.id).not.toBeUndefined();
    expect(item.name).toBe('myName');
    expect(item.type).toBe(5);
    expect(item.yesNo).toBe(true);
    expect(item.plan).toBe(Plan.PRO);
    expect(item.created).toBeDate();
    expect(item.created).toEqual(new Date('Sat Oct 13 2018 14:17:35 GMT+0200'));

    expect(item.children).toBeArrayOfSize(2);

    expect(item.children[0]).toBeInstanceOf(SubModel);
    expect(item.children[1]).toBeInstanceOf(SubModel);

    expect(item.children[0].label).toBe('fooo');
    expect(item.children[1].label).toBe('barr');

    expect(item.childrenMap).toBeObject();
    expect(item.childrenMap.foo).toBeInstanceOf(SubModel);
    expect(item.childrenMap.foo2).toBeInstanceOf(SubModel);

    expect(item.childrenMap.foo.label).toBe('bar');
    expect(item.childrenMap.foo2.label).toBe('bar2');

    const plain = classToPlain(SimpleModel, item);
    expect(plain.yesNo).toBeTrue();
    expect(plain.plan).toBe(1);
});

test('test simple model with not mapped fields', () => {
    expect(isExcluded(SimpleModel, 'excluded', 'database')).toBeTrue();
    expect(isExcluded(SimpleModel, 'excluded', 'plain')).toBeTrue();

    expect(isExcluded(SimpleModel, 'excludedForPlain', 'mongo')).toBeFalse();
    expect(isExcluded(SimpleModel, 'excludedForPlain', 'plain')).toBeTrue();

    expect(isExcluded(SimpleModel, 'excludedForMongo', 'mongo')).toBeTrue();
    expect(isExcluded(SimpleModel, 'excludedForMongo', 'plain')).toBeFalse();

    const instance = plainToClass(SimpleModel, {
        name: 'myName',
        type: 5,
        yesNo: '1',
        notMapped: {a: 'foo'}
    });

    expect(instance).toBeInstanceOf(SimpleModel);
    expect(instance.id).toBeString();
    expect(instance.name).toBe('myName');
    expect(instance.type).toBe(5);
    expect(instance.yesNo).toBe(true);
    expect(instance.notMapped).toEqual({});
    expect(instance.excluded).toBe('default');
    expect(instance.excludedForPlain).toBe('excludedForPlain');
    expect(instance.excludedForMongo).toBe('excludedForMongo');

    const item = plainToClass(SimpleModel, {
        id: uuid(),
        name: 'myName',
        type: 5,
        yesNo: 'eads',
        notMapped: {a: 'foo'},
        excludedForPlain: 'excludedForPlain'
    });

    expect(item.id).toBeString();
    expect(item.name).toBe('myName');
    expect(item.type).toBe(5);
    expect(item.yesNo).toBe(false);
    expect(item.notMapped).toEqual({}); //has the default
    expect(item.excluded).toBe('default');
    expect(item.excludedForPlain).toBe('excludedForPlain');
    expect(item.excludedForMongo).toBe('excludedForMongo');

    const plainObject = classToPlain(SimpleModel, instance);

    expect(plainObject.id).toBeString();
    expect(plainObject.name).toBe('myName');
    expect(plainObject.type).toBe(5);
    expect(plainObject.notMapped).toBeUndefined();
    expect(plainObject.excluded).toBeUndefined();
    expect(plainObject.excludedForPlain).toBeUndefined();
    expect(plainObject.excludedForMongo).toBe('excludedForMongo');
});

test('test @Decorated', async () => {
    const instance = plainToClass(SimpleModel, {
        name: 'myName',
        stringChildrenCollection: ['Foo', 'Bar']
    });

    expect(instance.name).toBe('myName');
    expect(instance.stringChildrenCollection).toBeInstanceOf(StringCollectionWrapper);
    expect(instance.stringChildrenCollection.items).toEqual(['Foo', 'Bar']);

    instance.stringChildrenCollection.add('Bar2');
    expect(instance.stringChildrenCollection.items[2]).toBe('Bar2');

    const plain = classToPlain(SimpleModel, instance);
    expect(plain.name).toBe('myName');
    expect(plain.stringChildrenCollection).toEqual(['Foo', 'Bar', 'Bar2']);

    const mongo = classToPlain(SimpleModel, instance);
    expect(mongo.name).toBe('myName');
    expect(mongo.stringChildrenCollection).toEqual(['Foo', 'Bar', 'Bar2']);

    const instance2 = plainToClass(SimpleModel, {
        name: 'myName',
        stringChildrenCollection: false
    });

    expect(instance2.name).toBe('myName');
    expect(instance2.stringChildrenCollection).toBeInstanceOf(StringCollectionWrapper);
    expect(instance2.stringChildrenCollection.items).toEqual([]);
});

test('test childrenMap', async () => {
    const instance = plainToClass(SimpleModel, {
        name: 'myName',
        childrenMap: {foo: {label: 'Foo'}, bar: {label: 'Bar'}}
    });

    expect(instance.childrenMap.foo).toBeInstanceOf(SubModel);
    expect(instance.childrenMap.bar).toBeInstanceOf(SubModel);

    expect(instance.childrenMap.foo.label).toBe('Foo');
    expect(instance.childrenMap.bar.label).toBe('Bar');
});

test('test allowNull', async () => {
    class Model {
        @f.optional()
        name?: string;
    }

    expect(plainToClass(Model, {}).name).toBe(undefined);
    expect(plainToClass(Model, {name: null}).name).toBe(undefined);
    expect(plainToClass(Model, {name: undefined}).name).toBe(undefined);
});

test('test OnLoad', async () => {
    let ModelRef;

    class Sub {
        @f.forward(() => ModelRef)
        @ParentReference()
        parent?: any;

        constructor(
            @f public name: string,
            @f.any() public onLoadCallback: (item: Sub) => void,
            @f.any() public onFullLoadCallback: (item: Sub) => void,
        ) {
        }

        @OnLoad()
        onLoad() {
            console.log('onLoad');
            this.onLoadCallback(this);
        }

        @OnLoad({fullLoad: true})
        onFullLoad() {
            console.log('onFullLoad');
            this.onFullLoadCallback(this);
        }
    }

    class Model {
        @f.optional()
        name?: string;

        @f.type(Sub)
        sub?: Sub;

        @f.type(Sub)
        sub2?: Sub;
    }

    ModelRef = Model;

    let onLoadedTriggered = false;
    let onFullLoadedTriggered = false;

    const instance = plainToClass(Model, {
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

        @f.array(Font)
        get fonts(): Font[] {
            return this._fonts;
        }

        set fonts(v) {
            this._fonts = v;
        }
    }

    const instance = plainToClass(Model, {
        fonts: [{name: 'Arial'}, {name: 'Verdana'}]
    });

    expect(instance.test).toBeTrue();
    expect(instance.fonts!.length).toBe(2);

    const plain = classToPlain(Model, instance);
    expect(plain._fonts).toBeUndefined();
    expect(plain.fonts).toBeArrayOfSize(2);

    const mongo = classToPlain(Model, instance);
    expect(mongo._fonts).toBeUndefined();
    expect(mongo.fonts).toBeArrayOfSize(2);
});

test('test decorator complex', async () => {
    const instance = plainToClass(SimpleModel, {
        name: 'myName',
        childrenCollection: [{label: 'Foo'}, {label: 'Bar'}]
    });

    expect(instance.name).toBe('myName');
    expect(instance.childrenCollection).toBeInstanceOf(CollectionWrapper);
    expect(instance.childrenCollection.items[0]).toBeInstanceOf(SubModel);
    expect(instance.childrenCollection.items[1]).toBeInstanceOf(SubModel);
    expect(instance.childrenCollection.items[0].label).toBe('Foo');
    expect(instance.childrenCollection.items[1].label).toBe('Bar');
    expect(instance.childrenCollection.items[1].constructorUsed).toBeTrue();

    instance.childrenCollection.add(new SubModel('Bar2'));
    expect(instance.childrenCollection.items[2].label).toEqual('Bar2');

    const plain = classToPlain(SimpleModel, instance);

    expect(plain.name).toBe('myName');
    expect(plain.childrenCollection).toEqual([{label: 'Foo'}, {label: 'Bar'}, {label: 'Bar2'}]);

    const mongo = classToPlain(SimpleModel, instance);
    expect(mongo.name).toBe('myName');
    expect(mongo.childrenCollection).toEqual([{label: 'Foo'}, {label: 'Bar'}, {label: 'Bar2'}]);
});

test('test @Decorated with parent', async () => {
    expect(resolvePropertyCompilerSchema(getClassSchema(DocumentClass), 'pages')).toMatchObject({
        type: 'class',
        resolveClassType: PageCollection
    });
    expect(resolvePropertyCompilerSchema(getClassSchema(PageCollection), 'pages')).toMatchObject({
        type: 'class',
        resolveClassType: PageClass
    });
    expect(resolvePropertyCompilerSchema(getClassSchema(PageClass), 'parent')).toMatchObject({
        type: 'class',
        resolveClassType: PageClass
    });
    expect(resolvePropertyCompilerSchema(getClassSchema(PageClass), 'document')).toMatchObject({
        type: 'class',
        resolveClassType: DocumentClass
    });
    expect(resolvePropertyCompilerSchema(getClassSchema(PageClass), 'children')).toMatchObject({
        type: 'class',
        resolveClassType: PageCollection
    });

    expect(() => {
        const instance = plainToClass(ClassWithUnmetParent, {});
    }).toThrow('ClassWithUnmetParent::parent is defined as');

    expect(() => {
        const instance = plainToClass(PageClass, {
            name: 'myName'
        });
    }).toThrow('PageClass::document is defined as @ParentReference() and NOT @f.optional(),');

    {
        const doc = new DocumentClass();

        const instance = plainToClass(PageClass, {
            name: 'myName'
        }, [doc]);

        expect(instance.document).toBe(doc);
    }

    expect(() => {
        const instance = plainToClass(ImpossibleToMetDocumentClass, {
            name: 'myName',
            pages: [
                {
                    name: 'Foo',
                    children: [
                        {
                            name: 'Foo.1'
                        }
                    ]
                },
                {name: 'Bar'}
            ]
        });
    }).toThrow('PageClass::document is defined as');

    const instance = plainToClass(DocumentClass, {
        name: 'myName',
        page: {
            name: 'RootPage',
            children: [
                {name: 'RootPage.1'},
                {name: 'RootPage.2'},
                {name: 'RootPage.3'},
            ]
        },
        pages: [
            {
                name: 'Foo',
                children: [
                    {
                        name: 'Foo.1',
                        children: [
                            {name: 'Foo.1.1'},
                            {name: 'Foo.1.2'},
                            {name: 'Foo.1.3'},
                        ]
                    }
                ]
            },
            {name: 'Bar'}
        ]
    });

    expect(instance.name).toBe('myName');

    expect(instance.page).toBeInstanceOf(PageClass);
    expect(instance.page!.children.get(0)!.parent).toBe(instance.page);
    expect(instance.page!.children.get(1)!.parent).toBe(instance.page);
    expect(instance.page!.children.get(2)!.parent).toBe(instance.page);

    expect(instance.pages).toBeInstanceOf(PageCollection);
    expect(instance.pages.count()).toBe(2);
    expect(instance.pages.get(0)).toBeInstanceOf(PageClass);
    expect(instance.pages.get(1)).toBeInstanceOf(PageClass);

    expect(instance.pages.get(0)!.name).toBe('Foo');
    expect(instance.pages.get(1)!.name).toBe('Bar');
    expect(instance.pages.get(0)!.parent).toBeUndefined();
    expect(instance.pages.get(1)!.parent).toBeUndefined();

    expect(instance.pages.get(0)!.document).toBe(instance);
    expect(instance.pages.get(1)!.document).toBe(instance);

    expect(instance.pages.get(0)!.children).toBeInstanceOf(PageCollection);

    const foo_1 = instance.pages.get(0)!.children.get(0);
    expect(foo_1).toBeInstanceOf(PageClass);
    expect(foo_1!.name).toBe('Foo.1');
    expect(foo_1!.document).toBe(instance);

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

    expect(foo_1_1!.document).toBe(instance);
    expect(foo_1_2!.document).toBe(instance);
    expect(foo_1_3!.document).toBe(instance);

    expect(foo_1_1!.parent!.name).toBe('Foo.1');
    expect(foo_1_2!.parent!.name).toBe('Foo.1');
    expect(foo_1_3!.parent!.name).toBe('Foo.1');

    expect(() => {
        const clone = cloneClass(instance.page);
    }).toThrow('PageClass::document is defined as');

    const clone = cloneClass(instance.page, [instance]);
    expect(clone).toBeInstanceOf(PageClass);
    expect(clone!.document).toBe(instance);
    expect(clone!.parent).toBeUndefined();

    const plain = classToPlain(DocumentClass, instance);

    expect(plain.name).toBe('myName');
    expect(plain.pages[0].name).toEqual('Foo');
    expect(plain.pages[1].name).toEqual('Bar');
    expect(plain.pages[0].children[0].name).toEqual('Foo.1');
    expect(plain.pages[0].parent).toBeUndefined();

    expect(plain.pages[0].parent).toBeUndefined();
});


test('simple string + number + boolean', () => {
    class Model {
        @f
        name?: string;

        @f
        age?: number;

        @f
        yesNo?: boolean;
    }

    const instance = plainToClass(Model, {
        name: 1,
        age: '2',
        yesNo: 'false'
    });
    expect(instance.name).toBe('1');
    expect(instance.age).toBe(2);

    expect(plainToClass(Model, {yesNo: 'false'}).yesNo).toBeFalse();
    expect(plainToClass(Model, {yesNo: '0'}).yesNo).toBeFalse();
    expect(plainToClass(Model, {yesNo: false}).yesNo).toBeFalse();
    expect(plainToClass(Model, {yesNo: 0}).yesNo).toBeFalse();
    expect(plainToClass(Model, {yesNo: 'nothing'}).yesNo).toBeUndefined();
    expect(plainToClass(Model, {yesNo: null}).yesNo).toBeUndefined();
    expect(plainToClass(Model, {yesNo: undefined}).yesNo).toBeUndefined();

    expect(plainToClass(Model, {yesNo: 'true'}).yesNo).toBeTrue();
    expect(plainToClass(Model, {yesNo: '1'}).yesNo).toBeTrue();
    expect(plainToClass(Model, {yesNo: true}).yesNo).toBeTrue();
    expect(plainToClass(Model, {yesNo: 1}).yesNo).toBeTrue();
    expect(plainToClass(Model, {yesNo: null}).yesNo).toBeUndefined();
});


test('cloneClass', () => {
    class SubModel {
        @f
        name?: string;
    }

    class DataStruct {
        @f
        name?: string;
    }

    class Model {
        @f.any()
        data: any;

        @f.type(DataStruct)
        dataStruct?: DataStruct;

        @f.array(SubModel)
        subs?: SubModel[];
    }

    const data = {
        a: 'true'
    };

    const dataStruct = {
        name: 'Foo'
    };

    const instance = plainToClass(Model, {
        data: data,
        dataStruct: dataStruct,
        subs: [{name: 'foo'}],
    });

    expect(instance.data).toEqual({a: 'true'});
    expect(instance.data).toBe(data); //any doesnt clone
    expect(instance.dataStruct!.name).toBe('Foo');
    expect(instance.dataStruct).toEqual(dataStruct);
    expect(instance.dataStruct).not.toBe(dataStruct);

    const cloned = cloneClass(instance);
    expect(cloned.data).toEqual({a: 'true'});
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
        @f.enum(Enum1).optional()
        enum1?: Enum1;

        @f.enum(Enum2).optional()
        enum2?: Enum2;

        @f.enum(Enum3).optional()
        enum3?: Enum3;

        @f.enum(Enum4).optional()
        enum4?: Enum4;

        @f.enum(Enum4, true).optional()
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

    expect(isValidEnumValue(Enum1, 'first')).toBeFalse();
    expect(isValidEnumValue(Enum1, 'second')).toBeFalse();
    expect(isValidEnumValue(Enum1, 0)).toBeTrue();
    expect(isValidEnumValue(Enum1, 1)).toBeTrue();
    expect(isValidEnumValue(Enum1, '0')).toBeTrue();
    expect(isValidEnumValue(Enum1, '1')).toBeTrue();
    expect(isValidEnumValue(Enum1, 2)).toBeFalse();
    expect(isValidEnumValue(Enum1, '2')).toBeFalse();

    expect(getValidEnumValue(Enum1, 1)).toBe(1);
    expect(getValidEnumValue(Enum1, '1')).toBe(1);
    expect(getValidEnumValue(Enum1, '2')).toBeUndefined();

    expect(isValidEnumValue(Enum2, 'first')).toBeFalse();
    expect(isValidEnumValue(Enum2, 'second')).toBeFalse();
    expect(isValidEnumValue(Enum2, 'z')).toBeTrue();
    expect(isValidEnumValue(Enum2, 'x')).toBeTrue();

    expect(getValidEnumValue(Enum2, 1)).toBeUndefined();
    expect(getValidEnumValue(Enum2, 'x')).toBe('x');
    expect(getValidEnumValue(Enum2, '2')).toBeUndefined();

    expect(isValidEnumValue(Enum3, 'first')).toBeFalse();
    expect(isValidEnumValue(Enum3, 'second')).toBeFalse();
    expect(isValidEnumValue(Enum3, '200')).toBeTrue();
    expect(isValidEnumValue(Enum3, '100')).toBeTrue();
    expect(isValidEnumValue(Enum3, 200)).toBeTrue();
    expect(isValidEnumValue(Enum3, 100)).toBeTrue();

    expect(isValidEnumValue(Enum4, 'first')).toBeFalse();
    expect(isValidEnumValue(Enum4, 'second')).toBeFalse();
    expect(isValidEnumValue(Enum4, '200')).toBeTrue();
    expect(isValidEnumValue(Enum4, 200)).toBeTrue();
    expect(isValidEnumValue(Enum4, 'x')).toBeTrue();

    expect(isValidEnumValue(Enum4, 'first', true)).toBeTrue();
    expect(isValidEnumValue(Enum4, 'second', true)).toBeTrue();

    expect(getValidEnumValue(Enum4, 1)).toBeUndefined();
    expect(getValidEnumValue(Enum4, 200)).toBe('200');
    expect(getValidEnumValue(Enum4, '200')).toBe('200');
    expect(getValidEnumValue(Enum4, '2')).toBeUndefined();
    expect(getValidEnumValue(Enum4, 'first', true)).toBe('200');
    expect(getValidEnumValue(Enum4, 'second', true)).toBe('x');

    {
        const instance = plainToClass(Model, {
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
        const instance = plainToClass(Model, {
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
        const instance = plainToClass(Model, {
            enum1: 2
        });
    }).toThrow('Invalid ENUM given in property');

    expect(() => {
        const instance = plainToClass(Model, {
            enum2: 2
        });
    }).toThrow('Invalid ENUM given in property');

    expect(() => {
        const instance = plainToClass(Model, {
            enum3: 2
        });
    }).toThrow('Invalid ENUM given in property');

    expect(() => {
        const instance = plainToClass(Model, {
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
        @f.enum(Enum1).asArray()
        enum1: Enum1[] = [];

        @f.enum(Enum2).asArray()
        enum2: Enum2[] = [];
    }

    plainToClass(Model, {
        enum1: [1]
    });

    plainToClass(Model, {
        enum2: ['z']
    });

    const schema = getClassSchema(Model);
    expect(schema.getProperty('enum1').type).toBe('enum');
    expect(schema.getProperty('enum1').isArray).toBe(true);

    plainToClass(Model, {
        enum2: ['x', 'z']
    });

    expect(() => {
        plainToClass(Model, {
            enum1: [2]
        });
    }).toThrow('Invalid ENUM given in property');

    expect(plainToClass(Model, {
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
        {code: 'invalid_enum', message: 'Invalid enum value received. Allowed: z,x', path: 'enum2.0'}
    ]);
});
