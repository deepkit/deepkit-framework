import 'jest-extended';
import 'reflect-metadata';
import {ObjectID} from 'mongodb';
import {jsonSerializer, t} from '@deepkit/type';
import {mongoSerializer, uuid4Binary} from '../src/mongo-serializer';

test('mongo to plain', () => {
    class Model {
        @t.primary.mongoId
        _id?: string;

        @t
        date?: Date;
    }

    const plain = mongoSerializer.for(Model).to(jsonSerializer, {
        _id: new ObjectID('5be340cb2ffb5e901a9b62e4'),
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

    const plain = mongoSerializer.for(Model).to(jsonSerializer, {
        uuid: uuid4Binary('12345678-1234-5678-1234-567812345678') as any,
        _id: new ObjectID('5be340cb2ffb5e901a9b62e4') as any,
        date: new Date('2018-11-07 19:45:15.805Z'),
    });

    expect(plain._id).toBe('5be340cb2ffb5e901a9b62e4');
    expect(plain.date).toBe('2018-11-07T19:45:15.805Z');
    expect(plain.uuid).toBe('12345678-1234-5678-1234-567812345678');
});

