import 'jest-extended';
import 'reflect-metadata';
import {ObjectID} from "mongodb";
import {t} from "@super-hornet/marshal";
import {mongoToPlain, partialMongoToPlain} from "../src/mapping";
import {uuid4Binary} from "../src/compiler-templates";

test('mongo to plain', () => {
    class Model {
        @t.primary.mongoId
        _id?: string;

        @t
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
        @t.primary.mongoId
        _id?: string;

        @t.uuid
        uuid?: string;

        @t
        date?: Date;
    }

    const plain = partialMongoToPlain(Model, {
        uuid: uuid4Binary("12345678-1234-5678-1234-567812345678") as any,
        _id: new ObjectID("5be340cb2ffb5e901a9b62e4") as any,
        date: new Date('2018-11-07 19:45:15.805Z'),
    });

    expect(plain._id).toBe('5be340cb2ffb5e901a9b62e4');
    expect(plain.date).toBe('2018-11-07T19:45:15.805Z');
    expect(plain.uuid).toBe('12345678-1234-5678-1234-567812345678');
});

