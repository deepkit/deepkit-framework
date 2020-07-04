import 'jest-extended'
import 'reflect-metadata';
import {ObjectID} from "mongodb";
import {f} from "@super-hornet/marshal";
import {mongoToPlain, partialMongoToPlain} from "../src/mapping";
import {uuid4Binary} from "../src/compiler-templates";

test('mongo to plain', () => {
    class Model {
        @f.primary().mongoId()
        _id?: string;

        @f
        date?: Date;
    }

    const plain = mongoToPlain(Model, {
        _id: new ObjectID("5be340cb2ffb5e901a9b62e4"),
        date: new Date('2018-11-07 19:45:15.805Z'),
    });

    expect(plain._id).toBe('5be340cb2ffb5e901a9b62e4');
    expect(plain.date).toBe('2018-11-07T19:45:15.805Z');
});

test('mongo to plain partial', () => {
    class Model {
        @f.primary().mongoId()
        _id?: string;

        @f.uuid()
        uuid?: string;

        @f
        date?: Date;
    }

    const plain = partialMongoToPlain(Model, {
        uuid: uuid4Binary("12345678-1234-5678-1234-567812345678"),
        _id: new ObjectID("5be340cb2ffb5e901a9b62e4"),
        date: new Date('2018-11-07 19:45:15.805Z'),
    });

    expect(plain._id).toBe('5be340cb2ffb5e901a9b62e4');
    expect(plain.date).toBe('2018-11-07T19:45:15.805Z');
    expect(plain.uuid).toBe('12345678-1234-5678-1234-567812345678');
});

