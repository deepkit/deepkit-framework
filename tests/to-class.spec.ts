import 'jest-extended'
import 'reflect-metadata';
import {
    AnyType,
    ClassArray,
    classToPlain,
    cloneClass,
    EnumType,
    Exclude,
    getEntityName,
    getEnumKeys,
    getEnumLabels,
    getIdField,
    getIdFieldValue,
    getValidEnumValue,
    isExcluded,
    isValidEnumValue,
    NumberType,
    plainToClass,
    StringType,
    uuid,
    getReflectionType,
    getParentReferenceClass,
    ParentReference,
    ClassCircular, BooleanType,
    Optional,Class, OnLoad
} from "@marcj/marshal";
import {
    now,
    SimpleModel,
    Plan,
    SubModel,
    CollectionWrapper,
    StringCollectionWrapper,
} from "@marcj/marshal/tests/entities";
import {Binary} from "mongodb";
import {ClassWithUnmetParent, DocumentClass, ImpossibleToMetDocumentClass} from "@marcj/marshal/tests/document-scenario/DocumentClass";
import {PageCollection} from "@marcj/marshal/tests/document-scenario/PageCollection";
import {PageClass} from "@marcj/marshal/tests/document-scenario/PageClass";
import {classToMongo, mongoToClass, plainToMongo} from "../src/mapping";
import * as clone from "clone";

test('test simple model', () => {
    expect(getEntityName(SimpleModel)).toBe('SimpleModel');
    expect(getIdField(SimpleModel)).toBe('id');

    expect(getIdField(SubModel)).toBe(null);

    for (const toClass of [plainToClass, mongoToClass]) {
        const instance = toClass(SimpleModel, {
            id: 'my-super-id',
            name: 'myName',
        });

        expect(instance).toBeInstanceOf(SimpleModel);
        expect(instance.id).toBe('my-super-id');
        expect(instance.name).toBe('myName');
        expect(instance.type).toBe(0);
        expect(instance.plan).toBe(Plan.DEFAULT);
        expect(instance.created).toBeDate();
        expect(instance.created).toBe(now);

        expect(getIdFieldValue(SimpleModel, instance)).toBe('my-super-id');
    }
});

test('test simple model all fields', () => {
    expect(getEntityName(SimpleModel)).toBe('SimpleModel');
    expect(getIdField(SimpleModel)).toBe('id');

    expect(getIdField(SubModel)).toBe(null);

    for (const toClass of [plainToClass, mongoToClass]) {
        const instance = toClass(SimpleModel, {
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

        expect(getIdFieldValue(SimpleModel, instance)).toBeString();

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
    }
});

test('test simple model with not mapped fields', () => {
    expect(isExcluded(SimpleModel, 'excluded', 'mongo')).toBeTrue();
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

    const mongoEntry = plainToMongo(SimpleModel, {
        id: uuid(),
        name: 'myName',
        type: 5,
        yesNo: 'eads',
        notMapped: {a: 'foo'}
    });

    expect(mongoEntry.id).toBeInstanceOf(Binary);
    expect(mongoEntry.name).toBe('myName');
    expect(mongoEntry.type).toBe(5);
    expect(mongoEntry.yesNo).toBe(false);
    expect(mongoEntry.notMapped).toBeUndefined();
    expect(mongoEntry.excluded).toBeUndefined();
    expect(mongoEntry.excludedForPlain).toBe('excludedForPlain');
    expect(mongoEntry.excludedForMongo).toBeUndefined();

    const plainObject = classToPlain(SimpleModel, instance);

    expect(plainObject.id).toBeString();
    expect(plainObject.name).toBe('myName');
    expect(plainObject.type).toBe(5);
    expect(plainObject.notMapped).toBeUndefined();
    expect(plainObject.excluded).toBeUndefined();
    expect(plainObject.excludedForPlain).toBeUndefined();
    expect(plainObject.excludedForMongo).toBe('excludedForMongo');
});

test('test @decorator', async () => {
    for (const toClass of [plainToClass, mongoToClass]) {
        const instance = toClass(SimpleModel, {
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

        const mongo = classToMongo(SimpleModel, instance);
        expect(mongo.name).toBe('myName');
        expect(mongo.stringChildrenCollection).toEqual(['Foo', 'Bar', 'Bar2']);
    }
});

test('test childrenMap', async () => {

    for (const toClass of [plainToClass, mongoToClass]) {
        const instance = toClass(SimpleModel, {
            name: 'myName',
            childrenMap: {foo: {label: 'Foo'}, bar: {label: 'Bar'}}
        });

        expect(instance.childrenMap.foo).toBeInstanceOf(SubModel);
        expect(instance.childrenMap.bar).toBeInstanceOf(SubModel);

        expect(instance.childrenMap.foo.label).toBe('Foo');
        expect(instance.childrenMap.bar.label).toBe('Bar');
    }
});

test('test allowNull', async () => {
    class Model {
        @StringType()
        @Optional()
        name: string | null = null;
    }

    for (const toClass of [plainToClass, mongoToClass]) {
        expect(toClass(Model, {}).name).toBe(null);
        expect(toClass(Model, {name: null}).name).toBe(null);
        expect(toClass(Model, {name: undefined}).name).toBe(null);
    }
});

test('test OnLoad', async () => {
    let ModelRef;

    class Sub {
        @StringType()
        name?: string;

        @AnyType()
        onLoadCallback: (item: Sub) => void;

        @AnyType()
        onFullLoadCallback: (item: Sub) => void;

        @ClassCircular(() => ModelRef)
        @ParentReference()
        parent?: any;

        constructor(name: string, onLoadCallback: (item: Sub) => void, onFullLoadCallback: (item: Sub) => void) {
            this.name = name;
            this.onLoadCallback = onLoadCallback;
            this.onFullLoadCallback = onFullLoadCallback;
        }

        @OnLoad()
        onLoad() {
            this.onLoadCallback(this);
        }

        @OnLoad({fullLoad: true})
        onFullLoad() {
            this.onFullLoadCallback(this);
        }
    }

    class Model {
        @StringType()
        @Optional()
        name: string | null = null;

        @Class(Sub)
        sub?: Sub;

        @Class(Sub)
        sub2?: Sub;
    }

    ModelRef = Model;

    for (const toClass of [plainToClass, mongoToClass]) {
        let onLoadedTriggered = false;
        let onFullLoadedTriggered = false;

        const instance = toClass(Model, {
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
    }
});

test('test setter/getter', async () => {
    class Font {
        name?: string;
    }

    class Model {
        @Exclude()
        private _fonts?: Font[];

        get test() {
            return true;
        }

        @ClassArray(Font)
        get fonts() {
            return this._fonts;
        }

        set fonts(v) {
            this._fonts = v;
        }
    }

    for (const toClass of [plainToClass, mongoToClass]) {
        const instance = toClass(Model, {
            fonts: [{name: 'Arial'}, {name: 'Verdana'}]
        });

        expect(instance.test).toBeTrue();
        expect(instance.fonts!.length).toBe(2);

        const plain = classToPlain(Model, instance);
        expect(plain._fonts).toBeUndefined();
        expect(plain.fonts).toBeArrayOfSize(2);

        const mongo = classToMongo(Model, instance);
        expect(mongo._fonts).toBeUndefined();
        expect(mongo.fonts).toBeArrayOfSize(2);
    }

});

test('test decorator complex', async () => {
    for (const toClass of [plainToClass, mongoToClass]) {
        const instance = toClass(SimpleModel, {
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

        const mongo = classToMongo(SimpleModel, instance);
        expect(mongo.name).toBe('myName');
        expect(mongo.childrenCollection).toEqual([{label: 'Foo'}, {label: 'Bar'}, {label: 'Bar2'}]);
    }
});

test('test @decorator with parent', async () => {
    expect(getReflectionType(DocumentClass, 'pages')).toEqual({type: 'class', typeValue: PageCollection});
    expect(getReflectionType(PageCollection, 'pages')).toEqual({type: 'class', typeValue: PageClass});
    expect(getReflectionType(PageClass, 'parent')).toEqual({type: 'class', typeValue: PageClass});
    expect(getReflectionType(PageClass, 'document')).toEqual({type: 'class', typeValue: DocumentClass});
    expect(getReflectionType(PageClass, 'children')).toEqual({type: 'class', typeValue: PageCollection});

    expect(getParentReferenceClass(PageClass, 'parent')).toBe(PageClass);

    expect(() => {
        const instance = mongoToClass(ClassWithUnmetParent, {
        });
    }).toThrow('ClassWithUnmetParent::parent is defined as');

    expect(() => {
        const instance = mongoToClass(PageClass, {
            name: 'myName'
        });
    }).toThrow('PageClass::document is in constructor has');

    {
        const doc = new DocumentClass();

        const instance = mongoToClass(PageClass, {
            name: 'myName'
        }, [doc]);

        expect(instance.document).toBe(doc);
    }

    expect(() => {
        const instance = mongoToClass(ImpossibleToMetDocumentClass, {
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
    }).toThrow('PageClass::document is in constructor has');

    for (const toClass of [plainToClass, mongoToClass]) {
        const instance = toClass(DocumentClass, {
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
        }).toThrow('PageClass::document is in constructor has');

        const clone = cloneClass(instance.page, [instance]);
        expect(clone).toBeInstanceOf(PageClass);
        expect(clone!.document).toBe(instance);
        expect(clone!.parent).toBeUndefined();

        for (const toPlain of [classToPlain, classToMongo]) {
            const plain = toPlain(DocumentClass, instance);

            expect(plain.name).toBe('myName');
            expect(plain.pages[0].name).toEqual('Foo');
            expect(plain.pages[1].name).toEqual('Bar');
            expect(plain.pages[0].children[0].name).toEqual('Foo.1');
            expect(plain.pages[0].parent).toBeUndefined();

            expect(plain.pages[0].parent).toBeUndefined();
        }
    }
});


test('simple string + number + boolean', () => {

    class Model {
        @StringType()
        name?: string;

        @NumberType()
        age?: string;

        @BooleanType()
        yesNo?: boolean;
    }

    for (const toClass of [plainToClass, mongoToClass]) {
        const instance = toClass(Model, {
            name: 1,
            age: '2',
            yesNo: 'false'
        });
        expect(instance.name).toBe('1');
        expect(instance.age).toBe(2);

        expect(toClass(Model, {yesNo: 'false'}).yesNo).toBeFalse();
        expect(toClass(Model, {yesNo: '0'}).yesNo).toBeFalse();
        expect(toClass(Model, {yesNo: false}).yesNo).toBeFalse();
        expect(toClass(Model, {yesNo: 0}).yesNo).toBeFalse();
        expect(toClass(Model, {yesNo: 'nothing'}).yesNo).toBeFalse();
        expect(toClass(Model, {yesNo: null}).yesNo).toBeNull();

        expect(toClass(Model, {yesNo: 'true'}).yesNo).toBeTrue();
        expect(toClass(Model, {yesNo: '1'}).yesNo).toBeTrue();
        expect(toClass(Model, {yesNo: true}).yesNo).toBeTrue();
        expect(toClass(Model, {yesNo: 1}).yesNo).toBeTrue();
        expect(toClass(Model, {yesNo: null}).yesNo).toBeNull();
    }
});


test('cloneClass', () => {
    class SubModel {
        @StringType()
        name?: string;
    }

    class DataStruct {
        @StringType()
        name?: string;
    }

    class Model {
       @AnyType()
       data: any;

       @Class(DataStruct)
       dataStruct?: DataStruct;

       @ClassArray(SubModel)
       subs?: SubModel[];
    }

    const data = {
        a: 'true'
    };

    const dataStruct = {
        name: 'Foo'
    };

    for (const toClass of [plainToClass, mongoToClass]) {
        const instance = toClass(Model, {
            data: data,
            dataStruct: dataStruct,
            subs: [{name: 'foo'}],
        });

        expect(instance.data).toEqual({a: 'true'});
        expect(instance.data).not.toBe(data);
        expect(instance.dataStruct!.name).toBe('Foo');
        expect(instance.dataStruct).toEqual(dataStruct);
        expect(instance.dataStruct).not.toBe(dataStruct);

        const cloned = cloneClass(instance);
        expect(cloned.data).toEqual({a: 'true'});
        expect(cloned.data).not.toBe(data);
        expect(cloned.dataStruct!.name).toBe('Foo');
        expect(cloned.dataStruct).toEqual(dataStruct);
        expect(cloned.dataStruct).not.toBe(dataStruct);

        expect(cloned.subs![0]).not.toBe(instance.subs![0]);
    }
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
        @EnumType(Enum1)
        enum1?: Enum1;

        @EnumType(Enum2)
        enum2?: Enum2;

        @EnumType(Enum3)
        enum3?: Enum3;

        @EnumType(Enum4)
        enum4?: Enum4;

        @EnumType(Enum4, true)
        enumLabels?: Enum4;
    }

    expect(getEnumLabels(Enum1)).toEqual(['first', 'second']);
    expect(getEnumLabels(Enum2)).toEqual(['first', 'second']);
    expect(getEnumLabels(Enum3)).toEqual(['first', 'second']);
    expect(getEnumLabels(Enum4)).toEqual(['first', 'second']);

    expect(getEnumKeys(Enum1)).toEqual([0, 1]);
    expect(getEnumKeys(Enum2)).toEqual(['z', 'x']);
    expect(getEnumKeys(Enum3)).toEqual([200, 100]);
    expect(getEnumKeys(Enum4)).toEqual(['200', 'x']);

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

    for (const toClass of [plainToClass, mongoToClass]) {
        {
            const instance = toClass(Model, {
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
            const instance = toClass(Model, {
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
            const instance = toClass(Model, {
                enum1: 2
            });
        }).toThrow('Invalid ENUM given in property');

        expect(() => {
            const instance = plainToClass(Model, {
                enum2: 2
            });
        }).toThrow('Invalid ENUM given in property');

        expect(() => {
            const instance = toClass(Model, {
                enum3: 2
            });
        }).toThrow('Invalid ENUM given in property');

        expect(() => {
            const instance = toClass(Model, {
                enum3: 4
            });
        }).toThrow('Invalid ENUM given in property');
    }
});