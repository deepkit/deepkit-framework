import 'jest-extended'
import 'reflect-metadata';
import {
    classToPlain,
    getEntityName,
    getIdField,
    getIdFieldValue, isExcluded,
    plainToClass, plainToMongo, uuid,
} from "../";
import {now, SimpleModel, Plan, SubModel} from "./entities";
import {Binary} from "bson";

test('test simple model', () => {
    expect(getEntityName(SimpleModel)).toBe('SimpleModel');
    expect(getIdField(SimpleModel)).toBe('id');

    expect(getIdField(SubModel)).toBe(null);

    const instance = plainToClass(SimpleModel, {
        id: 'my-super-id',
        name: 'myName',
    });

    console.log(instance);

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
        plan: 'PRO',
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
    expect(isExcluded(SimpleModel, 'excluded', 'class')).toBeTrue();
    expect(isExcluded(SimpleModel, 'excluded', 'mongo')).toBeTrue();
    expect(isExcluded(SimpleModel, 'excluded', 'plain')).toBeTrue();

    expect(isExcluded(SimpleModel, 'excludedForPlain', 'class')).toBeFalse();
    expect(isExcluded(SimpleModel, 'excludedForPlain', 'mongo')).toBeFalse();
    expect(isExcluded(SimpleModel, 'excludedForPlain', 'plain')).toBeTrue();

    expect(isExcluded(SimpleModel, 'excludedForMongo', 'class')).toBeFalse();
    expect(isExcluded(SimpleModel, 'excludedForMongo', 'mongo')).toBeTrue();
    expect(isExcluded(SimpleModel, 'excludedForMongo', 'plain')).toBeFalse();

    const instance = plainToClass(SimpleModel, {
        name: 'myName',
        type: 5,
        notMapped: {a: 'foo'}
    });

    expect(instance).toBeInstanceOf(SimpleModel);
    expect(instance.id).toBeString();
    expect(instance.name).toBe('myName');
    expect(instance.type).toBe(5);
    expect(instance.notMapped).toEqual({a: 'foo'});
    expect(instance.excluded).toBeUndefined();
    expect(instance.excludedForPlain).toBe('excludedForPlain');
    expect(instance.excludedForMongo).toBe('excludedForMongo');


    const mongoEntry = plainToMongo(SimpleModel, {
        id: uuid(),
        name: 'myName',
        type: 5,
        notMapped: {a: 'foo'}
    });

    expect(mongoEntry.id).toBeInstanceOf(Binary);
    expect(mongoEntry.name).toBe('myName');
    expect(mongoEntry.type).toBe(5);
    expect(mongoEntry.notMapped).toEqual({a: 'foo'});
    expect(mongoEntry.excluded).toBeUndefined();
    expect(mongoEntry.excludedForPlain).toBe('excludedForPlain');
    expect(mongoEntry.excludedForMongo).toBeUndefined();

    const plainObject = classToPlain(SimpleModel, instance);

    expect(plainObject.id).toBeString();
    expect(plainObject.name).toBe('myName');
    expect(plainObject.type).toBe(5);
    expect(plainObject.notMapped).toEqual({a: 'foo'});
    expect(plainObject.excluded).toBeUndefined();
    expect(plainObject.excludedForPlain).toBeUndefined();
    expect(plainObject.excludedForMongo).toBe('excludedForMongo');
});