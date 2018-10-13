import 'jest-extended'
import 'reflect-metadata';
import {
    getEntityName,
    getIdField,
    getIdFieldValue,
    plainToClass,
} from "../";
import {now, SimpleModel, Plan, SubModel} from "./entities";

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