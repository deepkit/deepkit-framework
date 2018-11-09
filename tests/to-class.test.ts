import 'jest-extended'
import 'reflect-metadata';
import {
    AnyType,
    ClassArray,
    classToMongo,
    classToPlain, cloneClass, EnumType, Exclude,
    getEntityName, getEnumKeys, getEnumLabels,
    getIdField,
    getIdFieldValue, getValidEnumValue, isExcluded, isValidEnumValue, mongoToClass, NumberType, MongoIdType,
    plainToClass, plainToMongo, StringType, uuid, UUIDType,
} from "../";
import {now, SimpleModel, Plan, SubModel, CollectionWrapper, StringCollectionWrapper} from "./entities";
import {Binary} from "bson";

test('test simple model', () => {
    expect(getEntityName(SimpleModel)).toBe('SimpleModel');
    expect(getIdField(SimpleModel)).toBe('id');

    expect(getIdField(SubModel)).toBe(null);

    const instance = plainToClass(SimpleModel, {
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
});

test('test simple model all fields', () => {
    expect(getEntityName(SimpleModel)).toBe('SimpleModel');
    expect(getIdField(SimpleModel)).toBe('id');

    expect(getIdField(SubModel)).toBe(null);

    const instance = plainToClass(SimpleModel, {
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
    expect(instance.notMapped).toEqual({a: 'foo'});
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

test('test decorator', async () => {
    {
        const instance = mongoToClass(SimpleModel, {
            name: 'myName',
            stringChildrenCollection: ['Foo', 'Bar']
        });

        expect(instance.name).toBe('myName');
        expect(instance.stringChildrenCollection).toBeInstanceOf(StringCollectionWrapper);
        expect(instance.stringChildrenCollection.items).toEqual(['Foo', 'Bar']);

        instance.stringChildrenCollection.add('Bar2');
        expect(instance.stringChildrenCollection.items[2]).toBe('Bar2');
    }

    {
        const instance = plainToClass(SimpleModel, {
            name: 'myName',
            stringChildrenCollection: ['Foo', 'Bar']
        });

        expect(instance.name).toBe('myName');
        expect(instance.stringChildrenCollection).toBeInstanceOf(StringCollectionWrapper);
        expect(instance.stringChildrenCollection.items).toEqual(['Foo', 'Bar']);

        const plain = classToPlain(SimpleModel, instance);
        expect(plain.name).toBe('myName');
        expect(plain.stringChildrenCollection).toEqual(['Foo', 'Bar']);

        const mongo = classToMongo(SimpleModel, instance);
        expect(mongo.name).toBe('myName');
        expect(mongo.stringChildrenCollection).toEqual(['Foo', 'Bar']);
    }
});

test('test childrenMap', async () => {

    const instance = mongoToClass(SimpleModel, {
        name: 'myName',
        childrenMap: {foo: {label: 'Foo'}, bar: {label: 'Bar'}}
    });

    expect(instance.childrenMap.foo).toBeInstanceOf(SubModel);
    expect(instance.childrenMap.bar).toBeInstanceOf(SubModel);

    expect(instance.childrenMap.foo.label).toBe('Foo');
    expect(instance.childrenMap.bar.label).toBe('Bar');
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

    const instance = plainToClass(Model, {
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

});

test('test decorator complex', async () => {
    {
        const instance = mongoToClass(SimpleModel, {
            name: 'myName',
            childrenCollection: [{label: 'Foo'}, {label: 'Bar'}]
        });

        expect(instance.name).toBe('myName');
        expect(instance.childrenCollection).toBeInstanceOf(CollectionWrapper);
        expect(instance.childrenCollection.items[0]).toBeInstanceOf(SubModel);
        expect(instance.childrenCollection.items[1]).toBeInstanceOf(SubModel);
        expect(instance.childrenCollection.items[0].label).toBe('Foo');
        expect(instance.childrenCollection.items[1].label).toBe('Bar');
        console.log(instance.childrenCollection.items[1]);
        expect(instance.childrenCollection.items[1].constructorUsed).toBeTrue();

        instance.childrenCollection.add(new SubModel('Bar2'));
        expect(instance.childrenCollection.items[2].label).toEqual('Bar2');
    }

    {
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

        const plain = classToPlain(SimpleModel, instance);
        expect(plain.name).toBe('myName');
        expect(plain.childrenCollection).toEqual([{label: 'Foo'}, {label: 'Bar'}]);

        const mongo = classToMongo(SimpleModel, instance);
        expect(mongo.name).toBe('myName');
        expect(mongo.childrenCollection).toEqual([{label: 'Foo'}, {label: 'Bar'}]);
    }
});

test('simple string + number', () => {

    class Model {
        @StringType()
        name?: string;

        @NumberType()
        age?: string;
    }

    const instance = plainToClass(Model, {
        name: 1,
        age: '2'
    });

    expect(instance.name).toBe('1');
    expect(instance.age).toBe(2);
});


test('cloneClass', () => {
    class SubModel {
        @StringType()
        name?: string;
    }

    class Model {
       @AnyType()
       data: any;

       @ClassArray(SubModel)
       subs?: SubModel[];
    }

    const data = {
        a: 'true'
    };

    const instance = plainToClass(Model, {
        data: data,
        subs: [{name: 'foo'}]
    });

    expect(instance.data).toEqual({a: 'true'});
    expect(instance.data).not.toBe(data);

    const cloned = cloneClass(instance);
    expect(cloned.data).toEqual({a: 'true'});
    expect(cloned.data).not.toBe(data);

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
});