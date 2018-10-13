import 'jest-extended'
import 'reflect-metadata';
import {classToMongo, classToPlain} from "../";
import {Plan, SimpleModel, SubModel} from "./entities";
import {Binary} from "bson";

test('test simple model', () => {
    const instance = new SimpleModel('myName');
    const mongo = classToMongo(SimpleModel, instance);

    expect(mongo['id']).toBeInstanceOf(Binary);
    expect(mongo['name']).toBe('myName');

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

    const mongo = classToMongo(SimpleModel, instance);

    expect(mongo['id']).toBeInstanceOf(Binary);
    expect(mongo['name']).toBe('myName');
    expect(mongo['type']).toBe(5);
    expect(mongo['plan']).toBe('PRO');
    expect(mongo['created']).toBeDate();
    expect(mongo['children']).toBeArrayOfSize(2);
    expect(mongo['children'][0]).toBeObject();
    expect(mongo['children'][0].label).toBe('fooo');
    expect(mongo['children'][1].label).toBe('barr');

    expect(mongo['childrenMap']).toBeObject();
    expect(mongo['childrenMap'].foo).toBeObject();
    expect(mongo['childrenMap'].foo.label).toBe('bar');
    expect(mongo['childrenMap'].foo2.label).toBe('bar2');
});