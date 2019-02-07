import 'jest-extended';
import 'reflect-metadata';
import { classToPlain } from '../';
import { Plan, SimpleModel, SubModel } from './entities';

test('test simple model', () => {
    const instance = new SimpleModel('myName');
    const json = classToPlain(SimpleModel, instance);

    expect(json['id']).toBeString();
    expect(json['name']).toBe('myName');
});

test('test simple model all fields', () => {
    const instance = new SimpleModel('myName');
    instance.plan = Plan.PRO;
    instance.type = 5;
    instance.created = new Date('Sat Oct 13 2018 14:17:35 GMT+0200');
    instance.children.push(new SubModel('fooo'));
    instance.children.push(new SubModel('barr'));

    instance.childrenMap.foo = new SubModel('bar');
    instance.childrenMap.foo2 = new SubModel('bar2');

    const json = classToPlain(SimpleModel, instance);

    console.log('json', json);

    expect(json['id']).toBeString();
    expect(json['name']).toBe('myName');
    expect(json['type']).toBe(5);
    expect(json['plan']).toBe(Plan.PRO);
    expect(json['created']).toBe('2018-10-13T12:17:35.000Z');
    expect(json['children']).toBeArrayOfSize(2);
    expect(json['children'][0]).toBeObject();
    expect(json['children'][0].label).toBe('fooo');
    expect(json['children'][1].label).toBe('barr');

    expect(json['childrenMap']).toBeObject();
    expect(json['childrenMap'].foo).toBeObject();
    expect(json['childrenMap'].foo.label).toBe('bar');
    expect(json['childrenMap'].foo2.label).toBe('bar2');
});
