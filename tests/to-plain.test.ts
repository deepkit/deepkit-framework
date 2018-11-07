import 'jest-extended'
import 'reflect-metadata';
import {classToPlain, DateType, ID, mongoToPlain, ObjectIdType,} from "../";
import {Plan, SimpleModel, SubModel} from "./entities";
import {ObjectID} from "bson";

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
    expect(json['plan']).toBe('PRO');
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

test('mongo to plain', () => {
    class Model {
        @ID()
        @ObjectIdType()
        _id: string;

        @DateType()
        date: Date;
    }

    const plain = mongoToPlain(Model, {
        _id: new ObjectID("5be340cb2ffb5e901a9b62e4"),
        date: new Date('2018-11-07 19:45:15.805Z'),
    });

    expect(plain._id).toBe('5be340cb2ffb5e901a9b62e4');
    expect(plain.date).toBe('2018-11-07T19:45:15.805Z');
});