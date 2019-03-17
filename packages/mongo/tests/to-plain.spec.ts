import 'jest-extended'
import 'reflect-metadata';
import {ObjectID} from "mongodb";
import {Field, IDField, MongoIdField, UUIDField} from "@marcj/marshal";
import {mongoToPlain, partialMongoToPlain, uuid4Binary} from "../src/mapping";

test('mongo to plain', () => {
    class Model {
        @IDField()
        @MongoIdField()
        _id?: string;

        @Field()
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
        @IDField()
        @MongoIdField()
        _id?: string;

        @UUIDField()
        uuid?: string;

        @Field()
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

