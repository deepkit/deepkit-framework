import 'jest-extended'
import 'reflect-metadata';
import {classToPlain, cloneClass, f, getEntityName, getIdField, isExcluded, plainToClass, uuid} from "@marcj/marshal";
import {now, Plan, SimpleModel, StringCollectionWrapper, SubModel,} from "@marcj/marshal/tests/entities";
import {Binary} from "mongodb";
import {classToMongo, mongoToClass, mongoToPlain, plainToMongo} from "../src/mapping";

test('test simple model', () => {
    expect(getEntityName(SimpleModel)).toBe('SimpleModel');
    expect(getIdField(SimpleModel)).toBe('id');

    expect(getIdField(SubModel)).toBe(undefined);

    for (const toClass of [plainToClass, mongoToClass]) {
        const instance = toClass(SimpleModel, {
            name: 'myName',
        });

        expect(instance).toBeInstanceOf(SimpleModel);
        expect(instance.id).not.toBeUndefined();
        expect(instance.name).toBe('myName');
        expect(instance.type).toBe(0);
        expect(instance.plan).toBe(Plan.DEFAULT);
        expect(instance.created).toBeDate();
        expect(instance.created).toBe(now);
    }
});

test('test simple model all fields', () => {
    expect(getEntityName(SimpleModel)).toBe('SimpleModel');
    expect(getIdField(SimpleModel)).toBe('id');

    expect(getIdField(SubModel)).toBe(undefined);

    const instance = mongoToClass(SimpleModel, {
        name: 'myName',
        type: 5,
        plan: 1,
        yesNo: true,
        created: new Date('Sat Oct 13 2018 14:17:35 GMT+0200'),
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
    expect(getEntityName(SimpleModel)).toBe('SimpleModel');
    expect(getIdField(SimpleModel)).toBe('id');

    expect(getIdField(SubModel)).toBe(undefined);

    const mongoItem = plainToMongo(SimpleModel, {
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

    expect(mongoItem).toBeObject();
    expect(mongoItem).not.toBeInstanceOf(SimpleModel);
    expect(mongoItem.id).not.toBeUndefined(); //IT does apply defaults. user should use partialPlainToMongo otherwise
    expect(mongoItem.name).toBe('myName');
    expect(mongoItem.type).toBe(5);
    expect(mongoItem.yesNo).toBe(true);
    expect(mongoItem.plan).toBe(Plan.PRO);
    expect(mongoItem.created).toBeDate();
    expect(mongoItem.created).toEqual(new Date('Sat Oct 13 2018 14:17:35 GMT+0200'));

    expect(mongoItem.children).toBeArrayOfSize(2);

    expect(mongoItem.children[0]).not.toBeInstanceOf(SubModel);
    expect(mongoItem.children[1]).not.toBeInstanceOf(SubModel);

    expect(mongoItem.children[0].label).toBe('fooo');
    expect(mongoItem.children[1].label).toBe('barr');

    expect(mongoItem.childrenMap).toBeObject();
    expect(mongoItem.childrenMap.foo).not.toBeInstanceOf(SubModel);
    expect(mongoItem.childrenMap.foo2).not.toBeInstanceOf(SubModel);

    expect(mongoItem.childrenMap.foo.label).toBe('bar');
    expect(mongoItem.childrenMap.foo2.label).toBe('bar2');

    const plain = mongoToPlain(SimpleModel, mongoItem);
    expect(plain.yesNo).toBeTrue();
    expect(plain.plan).toBe(1);
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
        notMapped: {a: 'foo'},
        excludedForPlain: 'excludedForPlain'
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

test('test @Decorated', async () => {
    const instance = mongoToClass(SimpleModel, {
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

    const instance2 = mongoToClass(SimpleModel, {
        name: 'myName',
        stringChildrenCollection: false
    });

    expect(instance2.name).toBe('myName');
    expect(instance2.stringChildrenCollection).toBeInstanceOf(StringCollectionWrapper);
    expect(instance2.stringChildrenCollection.items).toEqual([]);
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

test('test allowNull', async () => {
    class Model {
        @f.optional()
        name?: string;
    }

    expect(mongoToClass(Model, {}).name).toBe(undefined);
    expect(mongoToClass(Model, {name: null}).name).toBe(undefined);
    expect(mongoToClass(Model, {name: undefined}).name).toBe(undefined);
});
