import 'jest-extended'
import {ClassSchemas, classToPlain, createClassSchema, f, plainToClass} from "../index";

test('test createClassSchema', async () => {

    class ExternalClass {
        id!: string;
        title!: string;
        lists!: number[];
        map!: {[name: string]: number};
    }

    const schema = createClassSchema(ExternalClass);
    expect([...ClassSchemas.keys()]).toBeArrayOfSize(1);

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
