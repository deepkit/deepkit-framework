import 'jest-extended'
import 'reflect-metadata';
import {getClassSchema, isOptional, plainToClass, PropertySchema, f} from "..";
import {Buffer} from "buffer";

test('test optional', () => {
    class Model {
        @f.optional() super?: number
    }

    const schema = getClassSchema(Model);
    const prop = schema.getProperty('super');

    expect(prop.isOptional).toBe(true);
    expect(prop.type).toBe('number');
});

test('test binary', () => {
    class User {
        @f.type(Buffer) picture?: Buffer
    }

    const schema = getClassSchema(User);
    expect(schema.getProperty('picture').type).toBe('binary');
});

test('test asName', () => {
    class User {
        constructor(
            @f.asName('fieldA')
            public parent: string,
            @f.uuid().optional().asName('fieldB')
            public neighbor?: string,
        ) {
        }
    }

    const user = plainToClass(User, {
        fieldA: 'a',
        fieldB: 'b'
    });

    const schema = getClassSchema(User);
    expect(schema.getProperty('fieldA')).toBeInstanceOf(PropertySchema);
    expect(schema.getProperty('fieldB')).toBeInstanceOf(PropertySchema);

    expect(user.parent).toBe('a');
    expect(user.neighbor).toBe('b');
    expect(isOptional(User, 'fieldB')).toBe(true);
});

test('test asName easy', () => {
    class User {
        constructor(
            @f public parent: string,
            @f public neighbor?: number,
        ) {
        }
    }

    const schema = getClassSchema(User);
    expect(schema.getProperty('parent').type).toBe('string');
    expect(schema.getProperty('neighbor').type).toBe('number');
});

test('test inheritance', async () => {
    class Base {
        constructor(
            @f.index({}, 'id2')
            public id: string,
        ) {
        }
    }

    class Page extends Base {
        constructor(id: string, @f public name: string) {
            super(id);
        }
    }

    class Between extends Page {

    }

    class SuperPage extends Between {
        @f.optional() super?: number;
    }

    class Super2 extends SuperPage {
    }

    class Super3 extends Super2 {
    }

    // expect(getClassSchema(Base).getProperty('id').type).toBe('string');
    // expect(getClassSchema(Base).getIndex('id2')!.name).toBe('id2');
    //
    // expect(getClassSchema(Page).getProperty('id').type).toBe('string');
    // expect(getClassSchema(Page).getProperty('name').type).toBe('string');
    // expect(getClassSchema(Page).getIndex('id2')!.name).toBe('id2');
    //
    // expect(getClassSchema(SuperPage).getProperty('id').type).toBe('string');
    // expect(getClassSchema(SuperPage).getProperty('name').type).toBe('string');
    expect(getClassSchema(SuperPage).getProperty('super').type).toBe('number');
    // expect(getClassSchema(SuperPage).getIndex('id2')!.name).toBe('id2');
    //
    // expect(getClassSchema(Super3).getProperty('id').type).toBe('string');
    // expect(getClassSchema(Super3).getProperty('name').type).toBe('string');
    // expect(getClassSchema(Super3).getProperty('super').type).toBe('number');
    // expect(getClassSchema(Super3).getIndex('id2')!.name).toBe('id2');
    //
    // expect(getClassSchema(Super2).getProperty('id').type).toBe('string');
    // expect(getClassSchema(Super2).getProperty('name').type).toBe('string');
    // expect(getClassSchema(Super2).getProperty('super').type).toBe('number');
    // expect(getClassSchema(Super2).getIndex('id2')!.name).toBe('id2');
});
