import 'jest-extended';
import 'reflect-metadata';
import {classToPlain, createClassSchema, t, plainToClass} from '../index';

test('test createClassSchema', async () => {

    class ExternalClass {
        id!: string;
        title!: string;
        lists!: number[];
        map!: {[name: string]: number};
    }

    const schema = createClassSchema(ExternalClass);

    schema.addProperty('id', t.type(String));
    schema.addProperty('title', t.type(String));
    schema.addProperty('lists', t.array(Number));
    schema.addProperty('map', t.map(Number));

    expect(schema.propertyNames).toEqual(['id', 'title', 'lists', 'map']);

    expect(schema.getProperty('id').type).toEqual('string');
    expect(schema.getProperty('lists').isArray).toEqual(true);
    expect(schema.getProperty('lists').getSubType().type).toEqual('number');
    expect(schema.getProperty('map').isMap).toEqual(true);
    expect(schema.getProperty('map').getSubType().type).toEqual('number');

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

    schema.addMethodProperty('constructor', 0, t.type(String).name('id'));
    schema.addProperty('name', t.type(String));

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
    schema.addMethodProperty('constructor', 0, t.type(Number).name('seconds'));
    schema.addMethodProperty('constructor', 1, t.type(Number).name('nanoseconds'));

    expect(schema.getProperty('seconds').type).toBe('number');
    expect(schema.getProperty('nanoseconds').type).toBe('number');

    const timestamp = plainToClass(Timestamp, {seconds: 123, nanoseconds: 5});

    expect(timestamp.seconds).toBe(123);
    expect(timestamp.nanoseconds).toBe(5);
});

test('createClassSchemaFrom', () => {
    const schema = t.schema('User', {
        username: t.string,
        password: t.string,
        roles: t.array(t.number),
    });

    expect(schema.getProperty('username').type).toBe('string');
    expect(schema.getProperty('roles').type).toBe('array');
    expect(schema.getProperty('roles').getSubType().type).toBe('number');
});

test('createClassSchemaFrom complex', () => {
    const schema = t.schema({
        username: t.string,
        password: t.string,
        image: {
            path: t.string
        },
        groups: t.array({
            name: t.string
        })
    });

    expect(schema.getProperty('username').type).toBe('string');
    expect(schema.getProperty('image').type).toBe('class');
    expect(schema.getProperty('image').getResolvedClassSchema().getClassName()).toBe('image');
    expect(schema.getProperty('image').getResolvedClassSchema().getProperty('path').type).toBe('string');

    expect(schema.getProperty('groups').type).toBe('array');
    expect(schema.getProperty('groups').getSubType().type).toBe('class');
    expect(schema.getProperty('groups').getSubType().getResolvedClassSchema().getProperty('name').type).toBe('string');

    plainToClass(schema.classType, {asdad: 'd'});

    {
        const instance = plainToClass(schema, {username: "asd", image: {path: "image.jpg"}, groups: [{name: "foo"}]});
        console.log('instance', instance);
        expect(instance.username).toBe("asd");
        expect(instance.groups[0].name).toBe("foo");
        expect(instance.image.path).toBe("image.jpg");
    }

    {
        const instance = plainToClass(schema.classType, {username: "asd", image: {path: "image.jpg"}, groups: [{name: "foo"}]});
        expect(instance.username).toBe("asd");
        expect(instance.groups[0].name).toBe("foo");
        expect(instance.image.path).toBe("image.jpg");
    }
});
