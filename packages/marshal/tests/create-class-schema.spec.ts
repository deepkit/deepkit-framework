import 'jest-extended';
import 'reflect-metadata';
import {classToPlain, createClassSchema, f, plainToClass} from "../index";

test('test createClassSchema', async () => {

    class ExternalClass {
        id!: string;
        title!: string;
        lists!: number[];
        map!: {[name: string]: number};
    }

    const schema = createClassSchema(ExternalClass);

    schema.addProperty('id', f.type(String));
    schema.addProperty('title', f.type(String));
    schema.addProperty('lists', f.array(Number));
    schema.addProperty('map', f.map(Number));

    expect(schema.propertyNames).toEqual(['id', 'title', 'lists', 'map']);

    expect(schema.getProperty('id').type).toEqual('string');
    expect(schema.getProperty('lists').type).toEqual('number');
    expect(schema.getProperty('lists').isArray).toEqual(true);
    expect(schema.getProperty('map').type).toEqual('number');
    expect(schema.getProperty('map').isMap).toEqual(true);

    const obj = plainToClass(ExternalClass, {
        id: '23',
        title: 'test',
        lists: [12, 23],
        map: {test: 123}
    });

    expect(obj).toBeInstanceOf(ExternalClass);
    expect(obj.id).toBe('23');
    expect(obj.title).toBe('test');
    expect(obj.lists).toEqual([12, 23]);
    expect(obj.map).toEqual({test: 123});

    const plain = classToPlain(ExternalClass, obj);
    expect(plain.id).toBe('23');
    expect(plain.title).toBe('test');
    expect(plain.lists).toEqual([12, 23]);
    expect(plain.map).toEqual({test: 123});
});

test('test createClassSchema with constructor', async () => {

    class ExternalClass {
        public name: string = '';

        public converted: string = '';

        constructor(public id: string) {
            this.converted = id;
        }
    }

    const schema = createClassSchema(ExternalClass);

    schema.addMethodProperty('constructor', 0, f.type(String).asName('id'));
    schema.addProperty('name', f.type(String));

    expect(schema.propertyNames).toEqual(['id', 'name']);

    expect(schema.getProperty('id').type).toEqual('string');
    expect(schema.getProperty('name').type).toEqual('string');

    const obj = plainToClass(ExternalClass, {
        id: '23',
        name: 'test',
    });

    expect(obj).toBeInstanceOf(ExternalClass);
    expect(obj.id).toBe('23');
    expect(obj.name).toBe('test');
    expect(obj.converted).toBe('23');
});

test('external class 2', () => {
    class Timestamp {
        seconds: number = 0;
        nanoseconds: number = 0;

        constructor(s: number, n: number) {
            this.seconds = s;
            this.nanoseconds = n;
        }
    }

    const schema = createClassSchema(Timestamp);
    schema.addMethodProperty('constructor', 0, f.type(Number).asName('seconds'));
    schema.addMethodProperty('constructor', 1, f.type(Number).asName('nanoseconds'));

    expect(schema.getProperty('seconds').type).toBe('number');
    expect(schema.getProperty('nanoseconds').type).toBe('number');

    const timestamp = plainToClass(Timestamp, {seconds: 123, nanoseconds: 5});

    expect(timestamp.seconds).toBe(123);
    expect(timestamp.nanoseconds).toBe(5);
});
