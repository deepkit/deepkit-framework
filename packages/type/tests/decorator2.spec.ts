import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { Entity, getClassSchema, jsonSerializer, PropertySchema, t } from '../index';
import { uuid } from '../src/utils';

test('test optional', () => {
    class Model {
        @t.optional super?: number;
    }

    const schema = getClassSchema(Model);
    const prop = schema.getProperty('super');

    expect(prop.isOptional).toBe(true);
    expect(prop.type).toBe('number');
});

test('test @f', () => {
    class Config {
        @t created: Date = new Date;
    }

    class Page {
        @t.map(Config)
        map: { [name: string]: Config } = {};

        @t.array(Config)
        configArray: Config[] = [];

        constructor(
            @t name: string,
            @t.array(String) tags: string[]
        ) {
        }
    }

    const schema = getClassSchema(Page);

    expect(schema.getProperty('name').isMap).toBe(false);
    expect(schema.getProperty('name').isArray).toBe(false);
    expect(schema.getProperty('name').type).toBe('string');

    expect(schema.getProperty('tags').isMap).toBe(false);
    expect(schema.getProperty('tags').isArray).toBe(true);
    expect(schema.getProperty('tags').getSubType().type).toBe('string');

    expect(schema.getProperty('map').type).toBe('map');
    expect(schema.getProperty('map').isMap).toBe(true);
    expect(schema.getProperty('map').getSubType().type).toBe('class');
    expect(schema.getProperty('map').getSubType().getResolvedClassType()).toBe(Config);
    expect(schema.getProperty('map').getSubType().isArray).toBe(false);

    expect(schema.getProperty('configArray').type).toBe('array');
    expect(schema.getProperty('configArray').isArray).toBe(true);
    expect(schema.getProperty('configArray').getSubType().type).toBe('class');
    expect(schema.getProperty('configArray').getSubType().getResolvedClassType()).toBe(Config);
    expect(schema.getProperty('configArray').getSubType().isMap).toBe(false);
    expect(schema.getProperty('configArray').getSubType().isArray).toBe(false);
});


test('test propertySchema serialization classTypeName', () => {
    class Config {
        @t created: Date = new Date;
    }

    class Page {
        @t.type(Config).optional
        config?: Config;
    }

    const schema = getClassSchema(Page);
    const p1 = schema.getProperty('config');
    const j = p1.toJSON();
    expect(j.classTypeName).toBe('Config');
});

test('test propertySchema serialization', () => {
    @Entity('config')
    class Config {
        @t created: Date = new Date;
    }

    class Page {
        @t.primary.uuid
        id: string = uuid();

        @t.optional
        title: string = '';

        @t.map(Config)
        map: { [name: string]: Config } = {};

        @t.map(Config).template(t.string, Config)
        map2: { [name: string]: Config } = {};
    }

    function compare(p1: PropertySchema, p2: PropertySchema) {
        const compare: Partial<keyof PropertySchema>[] = [
            'name',
            'type',
            'isArray',
            'isMap',
            'isOptional',
            'isDecorated',
            'isParentReference',
            'isId',
            'isPartial',
            'methodName',
            'allowLabelsAsValue',
            'resolveClassType',
        ];
        for (const k of compare) {
            expect(p1[k]).toBe(p2[k]);
        }
    }

    const schema = getClassSchema(Page);
    {
        const p1 = schema.getProperty('id');
        const p2 = PropertySchema.fromJSON(p1.toJSON());
        expect(p1.name).toBe('id');
        expect(p1.isId).toBe(true);
        expect(p1.type).toBe('uuid');
        expect(p1.isResolvedClassTypeIsDecorated()).toBe(false);
        compare(p1, p2);
    }

    {
        const p1 = schema.getProperty('title');
        const p2 = PropertySchema.fromJSON(p1.toJSON());
        compare(p1, p2);
        expect(p1.name).toBe('title');
        expect(p1.isId).toBe(false);
        expect(p1.isOptional).toBe(true);
        expect(p1.type).toBe('string');
    }

    {
        const p1 = schema.getProperty('map');
        const p2 = PropertySchema.fromJSON(p1.toJSON());
        expect(p1.name).toBe('map');
        expect(p1.isMap).toBe(true);
        expect(p1.isId).toBe(false);
        expect(p1.getSubType().getResolvedClassType()).toBe(Config);
        expect(p1.getSubType().getResolvedClassTypeForValidType()).toBe(Config);
        expect(p1.getSubType().type).toBe('class');
        compare(p1, p2);
    }

    {
        const p1 = schema.getProperty('map2');
        const p2 = PropertySchema.fromJSON(p1.toJSON());
        expect(p1.name).toBe('map2');
        expect(p1.isId).toBe(false);
        expect(p1.isMap).toBe(true);
        expect(p1.getSubType().getResolvedClassType()).toBe(Config);
        expect(p1.getSubType().getResolvedClassTypeForValidType()).toBe(Config);
        expect(p1.templateArgs![0].type).toEqual('string');
        expect(p1.templateArgs![1].type).toEqual('class');
        expect(p1.templateArgs![1].getResolvedClassTypeForValidType()).toEqual(Config);
        expect(p1.getSubType().type).toBe('class');
        compare(p1, p2);
    }

});

test('test asName', () => {
    class User {
        constructor(
            @t.name('fieldA')
            public parent: string,
            @t.uuid.optional.name('fieldB')
            public neighbor?: string,
        ) {
        }
    }

    const user = jsonSerializer.for(User).deserialize({
        fieldA: 'a',
        fieldB: 'b'
    });

    const schema = getClassSchema(User);
    expect(schema.getProperty('fieldA')).toBeInstanceOf(PropertySchema);
    expect(schema.getProperty('fieldB')).toBeInstanceOf(PropertySchema);

    expect(user.parent).toBe('a');
    expect(user.neighbor).toBe('b');
    expect(schema.getProperty('fieldB').isOptional).toBe(true);
});

test('test asName easy', () => {
    class User {
        constructor(
            @t public parent: string,
            @t public neighbor?: number,
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
            @t.index({}, 'id2')
            public id: string,
        ) {
        }
    }

    class Page extends Base {
        constructor(id: string, @t public name: string) {
            super(id);
        }
    }

    class Between extends Page {

    }

    class SuperPage extends Between {
        @t.optional super?: number;
    }

    class Super2 extends SuperPage {
    }

    class Super3 extends Super2 {
    }

    expect(getClassSchema(Base).getProperty('id').type).toBe('string');

    expect(getClassSchema(Page).getProperty('id').type).toBe('string');
    expect(getClassSchema(Page).getProperty('name').type).toBe('string');

    expect(getClassSchema(SuperPage).getProperty('id').type).toBe('string');
    expect(getClassSchema(SuperPage).getProperty('name').type).toBe('string');
    expect(getClassSchema(SuperPage).getProperty('super').type).toBe('number');

    expect(getClassSchema(Super3).getProperty('id').type).toBe('string');
    expect(getClassSchema(Super3).getProperty('name').type).toBe('string');
    expect(getClassSchema(Super3).getProperty('super').type).toBe('number');

    expect(getClassSchema(Super2).getProperty('id').type).toBe('string');
    expect(getClassSchema(Super2).getProperty('name').type).toBe('string');
    expect(getClassSchema(Super2).getProperty('super').type).toBe('number');
});


test('test invalid @f', () => {
    class Config {
        @t.optional name?: string;
    }

    expect(() => {
        class User1 {
            @t
            // @ts-ignore
            notDefined;
        }
    }).toThrowError('User1::notDefined type mismatch. Given undefined, but declared is Object or undefined.');

    expect(() => {
        // @ts-ignore
        var NOTEXIST;

        class User2 {
            // @ts-ignore
            @t.type(NOTEXIST)
            // @ts-ignore
            notDefined;
        }
    }).toThrowError('User2::notDefined type mismatch. Given undefined, but declared is Object or undefined.');

    expect(() => {
        class User3 {
            @t
            created = new Date;
        }
    }).toThrowError('User3::created type mismatch. Given undefined, but declared is Object or undefined.');

    expect(() => {
        class User4 {
            @t.type(Config)
            config: Config[] = [];
        }
    }).toThrowError('User4::config type mismatch. Given Config, but declared is Array.');

    expect(() => {
        class User5 {
            @t.array(Config).required
            config!: Config;
        }
    }).toThrowError('User5::config type mismatch. Given Array<Config>, but declared is Config.');

    expect(() => {
        class Model {
            @t.array(t.type(() => Config)).required
            sub!: Config;
        }

    }).toThrowError('Model::sub type mismatch. Given Array<Config>, but declared is Config.');

    expect(() => {
        class Model {
            @t.array(() => undefined)
            sub?: Config;
        }

    }).toThrowError('Model::sub type mismatch. Given Array<ForwardedRef>?, but declared is Config.');

    expect(() => {
        class Model {
            @t.map(() => undefined)
            sub?: Config;
        }
    }).toThrowError('Model::sub type mismatch. Given Map<any, ForwardedRef>?, but declared is Config.');

    expect(() => {
        class Model {
            @t.map(Config)
            sub?: Config[];
        }

    }).toThrowError('Model::sub type mismatch. Given Map<any, Config>?, but declared is Array.');

    {
        //works
        class Model {
            @t.any
            any?: { [k: string]: any };
        }
    }
    {
        //works
        class Model {
            @t.map(t.any)
            // @ts-ignore
            any?;
        }
    }

    {
        //works
        class Model {
            @t.type(() => Config)
            sub?: Config;
        }
    }
});


test('nullable', () => {
    class ExampleClass {
        @t label: string = '';
    }

    class ConstructorClass {
        constructor(
            @t.type(ExampleClass).nullable
            public klass1: ExampleClass | null,
            @t.type(ExampleClass).nullable
            public klass2: ExampleClass | null
        ) {
        }
    }

    {
        const clazz = jsonSerializer.for(ConstructorClass).deserialize({ klass1: { label: '1' }, klass2: { label: '2' } });
        expect(clazz).toBeInstanceOf(ConstructorClass);
        expect(clazz.klass1).toBeInstanceOf(ExampleClass);
        expect(clazz.klass2).toBeInstanceOf(ExampleClass);
    }

    {
        const clazz = jsonSerializer.for(ConstructorClass).deserialize({ klass1: null, klass2: { label: '2' } });
        expect(clazz).toBeInstanceOf(ConstructorClass);
        expect(clazz.klass1).toBe(null);
        expect(clazz.klass2).toBeInstanceOf(ExampleClass);
    }

    {
        const clazz = jsonSerializer.for(ConstructorClass).deserialize({ klass1: undefined, klass2: { label: '2' } });
        expect(clazz).toBeInstanceOf(ConstructorClass);
        expect(clazz.klass1).toBe(null);
        expect(clazz.klass2).toBeInstanceOf(ExampleClass);
    }

    {
        const clazz = jsonSerializer.for(ConstructorClass).deserialize({ klass1: null, klass2: null });
        expect(clazz).toBeInstanceOf(ConstructorClass);
        expect(clazz.klass1).toBe(null);
        expect(clazz.klass2).toBe(null);
    }
});


test('null as default value', () => {
    class TestClass {
        constructor(
            @t.type(Number).optional.nullable.default(1.0)
            public v1?: number | null
        ) {
        }
    }

    const testClassSerializer = jsonSerializer.for(TestClass);

    expect(testClassSerializer.validatedDeserialize({ v1: undefined })).toEqual({ v1: 1.0 });
    expect(testClassSerializer.validatedDeserialize({ v1: null })).toEqual({ v1: null });
    expect(testClassSerializer.validatedDeserialize({ v1: 3.14 })).toEqual({ v1: 3.14 });

    const myDbSerializer = new class extends jsonSerializer.fork('my-db-serializer') {
    };
    myDbSerializer.toClass.register('null', (property, compiler) => {
        compiler.addSetter(`${compiler.setVariable('value', property.defaultValue)}()`);
    });

    const testClassDbSerializer = myDbSerializer.for(TestClass);

    expect(testClassDbSerializer.validatedDeserialize({ v1: undefined })).toEqual({ v1: 1.0 });
    expect(testClassDbSerializer.validatedDeserialize({ v1: null })).toEqual({ v1: 1.0 });
    expect(testClassDbSerializer.validatedDeserialize({ v1: 3.14 })).toEqual({ v1: 3.14 });
});

test('verbose undefined type', () => {
    class Class1 {
    }

    class TestClass {
        constructor(
            @t.type(Class1).optional
            public v1: Class1 | undefined,
            @t.type(Number)
            public v2: number
        ) {
        }
    }
});


test('date default', () => {
    class DateClass {
        @t.optional
        public value: Date = new Date('2019-11-03T09:10:38.392Z');
    }

    expect(jsonSerializer.for(DateClass).validatedDeserialize({
        value: '2020-11-03T09:10:39.392Z',
    })).toEqual({ value: new Date('2020-11-03T09:10:39.392Z') });

    expect(jsonSerializer.for(DateClass).validatedDeserialize({
    })).toEqual({ value: new Date('2019-11-03T09:10:38.392Z') });
});


test('missing public in constructor', () => {
    class User {
        @t ready?: boolean;

        @t.array(t.string) tags: string[] = [];

        @t priority: number = 0;

        constructor(
            @t.primary id: number,
            @t public name: string
        ) {
        }
    }

    const schema = getClassSchema(User);
    expect(schema.getMethodProperties('constructor').length).toBe(2);
    expect(schema.getClassProperties().size).toBe(5);
    expect(schema.getProperty('id').methodName).toBe('constructor');
    expect(schema.getProperty('name').methodName).toBe('constructor');

    expect(schema.getMethodProperties('constructor')[0].name).toBe('id');
    expect(schema.getMethodProperties('constructor')[1].name).toBe('name');

    expect(schema.getMethodProperties('constructor')[0].methodName).toBe('constructor');
    expect(schema.getMethodProperties('constructor')[1].methodName).toBe('constructor');
})
