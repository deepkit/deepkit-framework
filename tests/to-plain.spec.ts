import 'jest-extended'
import 'reflect-metadata';
import {ObjectID} from "mongodb";
import {DateType, ID, MongoIdType} from "@marcj/marshal";
import {mongoToPlain} from "../src/mapping";

test('mongo to plain', () => {
    class Model {
        @ID()
        @MongoIdType()
        _id?: string;

        @DateType()
        date?: Date;
    }

    const plain = mongoToPlain(Model, {
        _id: new ObjectID("5be340cb2ffb5e901a9b62e4"),
        date: new Date('2018-11-07 19:45:15.805Z'),
    });

    expect(plain._id).toBe('5be340cb2ffb5e901a9b62e4');
    expect(plain.date).toBe('2018-11-07T19:45:15.805Z');
});