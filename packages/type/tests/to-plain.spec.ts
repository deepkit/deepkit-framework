import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { getClassSchema, jsonSerializer, t } from '../index';
import { Plan, SimpleModel, SubModel } from './entities';

test('test simple model', () => {
    const instance = new SimpleModel('myName');
    const classSchema = getClassSchema(SimpleModel);
    expect(classSchema.getProperty('id').type).toBe('uuid');

    expect(typeof instance['id']).toBe('string');
    const json = jsonSerializer.for(SimpleModel).serialize(instance);

    expect(typeof json['id']).toBe('string');
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

    const json = jsonSerializer.for(SimpleModel).serialize(instance);

    console.log('json', json);

    expect(typeof json['id']).toBe('string');
    expect(json['name']).toBe('myName');
    expect(json['type']).toBe(5);
    expect(json['plan']).toBe(Plan.PRO);
    expect(json['created']).toBe('2018-10-13T12:17:35.000Z');
    expect(json['children'].length).toBe(2);
    expect(json['children'][0]).toBeInstanceOf(Object);
    expect(json['children'][0].label).toBe('fooo');
    expect(json['children'][1].label).toBe('barr');

    expect(json['childrenMap']).toBeInstanceOf(Object);
    expect(json['childrenMap'].foo).toBeInstanceOf(Object);
    expect(json['childrenMap'].foo.label).toBe('bar');
    expect(json['childrenMap'].foo2.label).toBe('bar2');
});


test('nullable', () => {
    const s = t.schema({
        username: t.string,
        password: t.string.nullable,
        optional: t.string.optional,
    });

    const item = new s.classType;
    item.username = 'asd';

    expect(jsonSerializer.for(s).serialize(item)).toEqual({ username: 'asd', password: null });

    item.password = null;
    expect(jsonSerializer.for(s).serialize(item)).toEqual({ username: 'asd', password: null });

    item.optional = undefined;
    expect(jsonSerializer.for(s).serialize(item)).toEqual({ username: 'asd', password: null, optional: null });

    delete item.optional;
    expect(jsonSerializer.for(s).serialize(item)).toEqual({ username: 'asd', password: null });

    item.optional = 'yes';
    expect(jsonSerializer.for(s).serialize(item)).toEqual({ username: 'asd', password: null, optional: 'yes' });

    item.password = 'secret';
    expect(jsonSerializer.for(s).serialize(item)).toEqual({ username: 'asd', password: 'secret', optional: 'yes' });
});
