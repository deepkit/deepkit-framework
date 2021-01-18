import { expect, test } from '@jest/globals';
import {
    arrayBufferFrom,
    ClassSchema,
    DatabaseName,
    Entity,
    forwardRef,
    getClassSchema,
    getClassSchemaByName,
    getClassTypeFromInstance,
    getDatabaseName,
    getEntityName,
    getGlobalStore,
    getKnownClassSchemasNames,
    hasClassSchemaByName,
    isArrayType,
    isMapType,
    isRegisteredEntity,
    jsonSerializer,
    PropertySchema,
    t,
} from '../index';
import 'reflect-metadata';
import { Buffer } from 'buffer';
import { SimpleModel } from './entities';
import { PageClass } from './document-scenario/PageClass';
import { DocumentClass } from './document-scenario/DocumentClass';
import { resolvePropertySchema } from '../src/jit';


test('getClassSchemaByName', async () => {
    @Entity('getClassSchemaByName')
    class Test {
    }


    expect(getClassSchema(Test).hasCircularDependency()).toBe(false);
    expect(getKnownClassSchemasNames()).toContain('getClassSchemaByName');
    expect(hasClassSchemaByName('getClassSchemaByName')).toBe(true);
    expect(hasClassSchemaByName('getClassSchemaByName_NOTEXISTS')).toBe(false);

    expect(getClassSchemaByName('getClassSchemaByName')).toBeInstanceOf(ClassSchema);
    expect(() => getClassSchemaByName('getClassSchemaByName_NOTEXISTS')).toThrow('No deepkit/type class found with name');
});

test('test getClassTypeFromInstance', async () => {
    {
        class Mother {
            a: any;
        }

        class Base extends Mother {
            b: any;
        }

        @Entity('ding')
        class Ding extends Base {
        }

        expect(() => getClassTypeFromInstance(Base)).toThrow('Target does not seem to be');
        expect(() => getClassTypeFromInstance({})).toThrow('Target does not seem to be');
        expect(() => getClassTypeFromInstance(false)).toThrow('Target does not seem to be');
        expect(() => getClassTypeFromInstance(undefined)).toThrow('Target does not seem to be');
        expect(() => getClassTypeFromInstance(0)).toThrow('Target does not seem to be');
        expect(() => getClassTypeFromInstance('')).toThrow('Target does not seem to be');

        expect(getClassTypeFromInstance(new Base)).toBe(Base);
        expect(getClassTypeFromInstance(new Mother)).toBe(Mother);
        expect(isRegisteredEntity(Mother)).toBe(false);
        expect(isRegisteredEntity(Base)).toBe(false);
        expect(isRegisteredEntity(Ding)).toBe(true);
    }
});

test('test invalid usage', async () => {
    class Config {
    }

    class Base {
        @t.type(() => undefined!)
        ohwe: any;

        @t.type(() => Config)
        config?: any;

        constructor(@t public id: string) {
        }
    }

    expect(() => {
        getClassSchema(Base).getProperty('ohwe').getResolvedClassType();
    }).toThrowError('ForwardRef returns no value');

    expect(getClassSchema(Base).getProperty('config').getResolvedClassType()).toBe(Config);

    //second call uses cached one
    expect(getClassSchema(Base).getProperty('config').getResolvedClassType()).toBe(Config);

    expect(() => {
        getClassSchema(Base).getProperty('id').getResolvedClassType();
    }).toThrowError('No ClassType given for field id');

    expect(() => {
        getClassSchema(Base).getProperty('bla');
    }).toThrowError('Property Base.bla not found');
});

test('test circular', async () => {
    expect(getClassSchema(PageClass).getProperty('children').getResolvedClassType()).toBe(PageClass.PageCollection);
    expect(getClassSchema(PageClass).getProperty('parent').getResolvedClassType()).toBe(PageClass);
    expect(getClassSchema(PageClass).hasCircularDependency()).toBe(true);
    expect(getClassSchema(DocumentClass).hasCircularDependency()).toBe(true);
});

test('test entity database', async () => {
    @Entity('DifferentDataBase', 'differentCollection')
    @DatabaseName('testing1')
    class DifferentDataBase {
        @t.primary.mongoId
        _id?: string;

        @t
        name?: string;
    }

    expect(getClassSchemaByName('DifferentDataBase').classType).toBe(DifferentDataBase);

    class Child extends DifferentDataBase {
    }

    @Entity('DifferentDataBase2', 'differentCollection2')
    @DatabaseName('testing2')
    class Child2 extends DifferentDataBase {
    }

    @Entity('DifferentDataBase3')
    class Child3 extends DifferentDataBase {
    }

    expect(getClassSchema(Child).hasCircularDependency()).toBe(false);
    expect(getClassSchema(Child2).hasCircularDependency()).toBe(false);
    expect(getClassSchema(Child3).hasCircularDependency()).toBe(false);

    expect(getDatabaseName(DifferentDataBase)).toBe('testing1');
    expect(getEntityName(DifferentDataBase)).toBe('DifferentDataBase');

    expect(getDatabaseName(Child2)).toBe('testing2');
    expect(getEntityName(Child2)).toBe('DifferentDataBase2');

    expect(getDatabaseName(Child)).toBe('testing1');
    expect(getEntityName(Child)).toBe('DifferentDataBase');

    expect(getDatabaseName(Child3)).toBe('testing1'); //is inherited
    expect(getEntityName(Child3)).toBe('DifferentDataBase3');
});

test('test uuid', () => {
    const schema = getClassSchema(SimpleModel);
    expect(schema.getProperty('id').type).toBe('uuid');
    expect(schema.getProperty('id').isId).toBe(true);
});

test('test asName', () => {
    class User {
        constructor(
            @t.name('fieldA')
            public parent: string,
            @t.uuid.name('fieldB').optional
            public neighbor?: string,
        ) {
        }
    }

    const user = jsonSerializer.for(User).deserialize({
        fieldA: 'a',
        fieldB: 'b'
    });

    expect(user.parent).toBe('a');
    expect(user.neighbor).toBe('b');
    expect(getClassSchema(User).getProperty('fieldB').isOptional).toBe(true);
});

test('test no entity throw error', () => {

    expect(() => {
        class Model {
        }

        getEntityName(Model);
    }).toThrowError('No @Entity() defined for class Model');
});

test('test No decorated property found', () => {
    expect(() => {
        class Model {
        }

        getClassSchema(Model).getDecoratedPropertySchema();
        getClassSchema(Model).getDecoratedPropertySchema();
    }).toThrowError('No decorated property found');
});

test('test custom decorator', () => {
    let called = false;

    function Decorator(target: Object, property: PropertySchema) {
        called = true;
    }

    class Model {
        @t.use(Decorator) b!: string;
    }

    expect(getClassSchema(Model).getProperty('b').type).toBe('string');
    expect(called).toBe(true);
});

test('test same name', () => {
    expect(() => {
        @Entity('same-name')
        class Sub1 {
        }

        @Entity('same-name')
        class Sub2 {
        }
    }).toThrowError('deepkit/type entity with name \'same-name\' already registered.');
});

test('test decorator circular', () => {
    class Sub {
    }

    {
        class Model {
            @t.type(() => Sub)
            sub?: Sub;
        }

        expect(getClassSchema(Model).hasCircularDependency()).toBe(false);
        const schema = resolvePropertySchema(getClassSchema(Model), 'sub');
        expect(schema.type).toBe('class');
        expect(schema.resolveClassType).toBe(Sub);
    }

    {
        class Model {
            @t.map(t.type(() => Sub))
            sub?: { [l: string]: Sub };
        }

        expect(getClassSchema(Model).getProperty('sub').type).toBe('map');
        expect(getClassSchema(Model).getProperty('sub').getSubType().type).toBe('class');
        expect(getClassSchema(Model).getProperty('sub').getSubType().resolveClassType).toBe(Sub);

        expect(resolvePropertySchema(getClassSchema(Model), 'sub')).toMatchObject({
            type: 'map',
        });
        expect(resolvePropertySchema(getClassSchema(Model), 'sub.foo')).toMatchObject({
            type: 'class',
            resolveClassType: Sub
        });
        expect(isMapType(Model, 'sub')).toBe(true);
    }

    {
        class Model {
            @t.array(t.type(() => Sub))
            sub?: Sub[];
        }

        expect(resolvePropertySchema(getClassSchema(Model), 'sub')).toMatchObject({
            type: 'array',
        });

        expect(resolvePropertySchema(getClassSchema(Model), 'sub.0')).toMatchObject({
            type: 'class',
            resolveClassType: Sub
        });
        expect(isArrayType(Model, 'sub')).toBe(true);
    }
});

test('test properties', () => {
    class DataValue {
    }

    class DataValue2 {
    }

    @Entity('Model')
    class Model {
        @t.primary.mongoId
        _id?: string;

        @t
        name?: string;

        @t.type(DataValue)
        data?: DataValue;
    }

    @Entity('SubModel')
    class SubModel extends Model {
        @t.type(DataValue2)
        data2?: DataValue2;
    }

    expect(getClassSchema(Model).hasPrimaryFields()).toBe(true);
    expect(getClassSchema(Model).getPrimaryFields().length).toBe(1);
    expect(getClassSchema(Model).getPrimaryField()).toBeInstanceOf(PropertySchema);
    expect(() => getClassSchema(DataValue2).getPrimaryField()).toThrow('Class DataValue2 has no primary field');

    expect(getClassSchema(Model).getPropertyOrUndefined('name')).toBeInstanceOf(PropertySchema);
    expect(getClassSchema(Model).getPropertyOrUndefined('NOTHING')).toBeUndefined();
    expect(() => getClassSchema(Model).getDecoratedPropertySchema()).toThrow('No decorated property found');

    expect(getClassSchema(Model).getIndex('asd')).toBeUndefined();
    expect(() => getClassSchema(Model).getDiscriminantPropertySchema()).toThrow('No discriminant property found');

    {
        const { type, resolveClassType } = resolvePropertySchema(getClassSchema(Model), '_id');
        expect(type).toBe('objectId');
        expect(resolveClassType).toBeUndefined();
    }

    {
        const { type, resolveClassType } = resolvePropertySchema(getClassSchema(Model), 'data');
        expect(type).toBe('class');
        expect(resolveClassType).toBe(DataValue);
    }

    expect(() => {
        const { type, resolveClassType } = resolvePropertySchema(getClassSchema(Model), 'data2');
        expect(type).toBeUndefined();
        expect(resolveClassType).toBeUndefined();
    }).toThrow('Property Model.data2 not found');

    {
        const { type, resolveClassType } = resolvePropertySchema(getClassSchema(SubModel), '_id');
        expect(type).toBe('objectId');
        expect(resolveClassType).toBeUndefined();
    }
    {
        const { type, resolveClassType } = resolvePropertySchema(getClassSchema(SubModel), 'data');
        expect(type).toBe('class');
        expect(resolveClassType).toBe(DataValue);
    }
    {
        const { type, resolveClassType } = resolvePropertySchema(getClassSchema(SubModel), 'data2');
        expect(type).toBe('class');
        expect(resolveClassType).toBe(DataValue2);
    }
});

test('more decorator', () => {
    class Model {
        @t
        bool: boolean = false;

        @t.any
        whatever: any;
    }

    {
        const instance = jsonSerializer.for(Model).deserialize({
            bool: 'wow',
            whatever: { 'any': false }
        });

        expect(getClassSchema(Model).getProperty('whatever').type).toBe('any');

        expect(instance.bool).toBe(false);
        expect(instance.whatever).toEqual({ any: false });
    }

    {
        const instance = jsonSerializer.for(Model).deserialize({
            bool: 'true',
        });
        expect(instance.bool).toBe(true);
    }

    {
        const instance = jsonSerializer.for(Model).deserialize({
            bool: '1',
        });
        expect(instance.bool).toBe(true);
    }

    {
        const instance = jsonSerializer.for(Model).deserialize({
            bool: 1,
        });
        expect(instance.bool).toBe(true);
    }

    {
        const instance = jsonSerializer.for(Model).deserialize({
            bool: 'false',
        });
        expect(instance.bool).toBe(false);
    }

    {
        const instance = jsonSerializer.for(Model).deserialize({
            bool: '0',
        });
        expect(instance.bool).toBe(false);
    }

    {
        const instance = jsonSerializer.for(Model).deserialize({
            bool: 0,
        });
        expect(instance.bool).toBe(false);
    }
});

test('more array/map', () => {
    class Model {
        @t.array(Boolean)
        bools?: boolean[];

        @t.array(t.any)
        whatever?: any[];

        @t.map(t.any)
        whatevermap?: { [k: string]: any };
    }

    expect(isArrayType(Model, 'bools')).toBe(true);
    expect(isMapType(Model, 'whatevermap')).toBe(true);
    expect(isMapType(Model, 'whatever')).toBe(false);
});

test('binary', () => {
    class Model {
        @t.type(ArrayBuffer)
        preview: ArrayBuffer = arrayBufferFrom('FooBar', 'utf8');
    }

    const { type, resolveClassType } = resolvePropertySchema(getClassSchema(Model), 'preview');
    expect(type).toBe('arrayBuffer');
    expect(resolveClassType).toBeUndefined();

    const i = new Model();
    expect(Buffer.from(i.preview).toString('utf8')).toBe('FooBar');

    const plain = jsonSerializer.for(Model).serialize(i);
    expect(plain.preview.data).toBe('Rm9vQmFy');
    expect(plain.preview.data).toBe(Buffer.from('FooBar', 'utf8').toString('base64'));

    const back = jsonSerializer.for(Model).deserialize(plain);
    expect(back.preview).toBeInstanceOf(ArrayBuffer);
    expect(Buffer.from(back.preview).toString('utf8')).toBe('FooBar');
    expect(back.preview.byteLength).toBe(6);
});


test('group', () => {
    class Config {
        @t.group('theme') color: string = 'red';
        @t.group('theme', 'text') fontSize: number = 12;

        @t.group('theme', 'text') fontFamily: string = 'Arial';

        @t.group('language') language: string = 'en';
    }

    class User {
        @t username: string = 'username';

        @t.group('confidential') password: string = 'pw';

        @t.group('details') config: Config = new Config;

        @t foo: string = 'bar';
    }

    const schema = getClassSchema(User);
    expect(schema.getProperty('username').groupNames).toEqual([]);
    expect(schema.getProperty('password').groupNames).toEqual(['confidential']);
    expect(schema.getProperty('config').groupNames).toEqual(['details']);

    expect(schema.getPropertiesByGroup('confidential').length).toBe(1);
    expect(schema.getPropertiesByGroup('confidential')[0].name).toBe('password');

    expect(schema.getPropertiesByGroup('details').length).toBe(1);
    expect(schema.getPropertiesByGroup('details')[0].name).toBe('config');

    const user = new User();

    {
        const plain = jsonSerializer.for(User).partialSerialize(user);
        expect(Object.keys(plain)).toEqual(['username', 'password', 'config', 'foo']);
        expect(Object.keys(plain.config)).toEqual(['color', 'fontSize', 'fontFamily', 'language']);
    }

    {
        const plain = jsonSerializer.for(User).partialSerialize(user, { groups: [] });
        expect(Object.keys(plain)).toEqual(['username', 'foo']);
    }

    {
        const plain = jsonSerializer.for(User).partialSerialize(user, { groupsExclude: [] });
        expect(Object.keys(plain)).toEqual(['password', 'config']);
    }

    {
        const plain = jsonSerializer.for(User).partialSerialize(user, { groups: ['confidential'] });
        expect(Object.keys(plain)).toEqual(['password']);
    }

    {
        const plain = jsonSerializer.for(User).serialize(user, { groups: ['confidential'] });
        expect(Object.keys(plain)).toEqual(['password']);
    }

    {
        const plain = jsonSerializer.for(User).partialSerialize(user, { groupsExclude: ['confidential'] });
        expect(Object.keys(plain)).toEqual(['username', 'config', 'foo']);
        expect(Object.keys(plain.config)).toEqual(['color', 'fontSize', 'fontFamily', 'language']);
    }

    {
        const plain = jsonSerializer.for(User).partialSerialize(user, { groupsExclude: ['confidential', 'details'] });
        expect(Object.keys(plain)).toEqual(['username', 'foo']);
    }

    {
        const plain = jsonSerializer.for(User).partialSerialize(user, { groupsExclude: ['theme'] });
        expect(Object.keys(plain)).toEqual(['username', 'password', 'config', 'foo']);
        expect(Object.keys(plain.config)).toEqual(['language']);
    }

    {
        const plain = jsonSerializer.for(User).serialize(user, { groupsExclude: ['theme'] });
        expect(Object.keys(plain)).toEqual(['username', 'password', 'config', 'foo']);
        expect(Object.keys(plain.config)).toEqual(['language']);
    }

    {
        const plain = jsonSerializer.for(User).partialSerialize(user, { groups: ['theme', 'details'] });
        expect(Object.keys(plain)).toEqual(['config']);
        expect(Object.keys(plain.config)).toEqual(['color', 'fontSize', 'fontFamily']);
    }

    {
        const plain = jsonSerializer.for(User).serialize(user, { groups: ['theme', 'details'] });
        expect(Object.keys(plain)).toEqual(['config']);
        expect(Object.keys(plain.config)).toEqual(['color', 'fontSize', 'fontFamily']);
    }

    {
        const plain = jsonSerializer.for(User).partialSerialize(user, { groups: ['text', 'details'] });
        expect(Object.keys(plain)).toEqual(['config']);
        expect(Object.keys(plain.config)).toEqual(['fontSize', 'fontFamily']);
    }

    {
        const plain = jsonSerializer.for(User).serialize(user, { groups: ['text', 'details'] });
        expect(Object.keys(plain)).toEqual(['config']);
        expect(Object.keys(plain.config)).toEqual(['fontSize', 'fontFamily']);
    }

    const plain = { foo: 'bar2', username: 'peter2', password: 'password2', config: { color: 'blue' } };

    {
        const user2 = jsonSerializer.for(User).deserialize(plain);
        expect(user2.foo).toBe('bar2');
        expect(user2.username).toBe('peter2');
        expect(user2.password).toBe('password2');
        expect(user2.config.color).toBe('blue');
        expect(user2.config.fontFamily).toBe('Arial');
    }

    {
        const user2 = jsonSerializer.for(User).deserialize(plain, { groups: ['confidential'] });
        expect(user2.foo).toBe(user.foo);
        expect(user2.username).toBe(user.username);
        expect(user2.password).toBe('password2');
        expect(user2.config.color).toBe(user.config.color);
        expect(user2.config.fontFamily).toBe(user.config.fontFamily);
    }

    {
        const user2 = jsonSerializer.for(User).deserialize(plain, { groups: ['theme', 'details'] });
        expect(user2.foo).toBe(user.foo);
        expect(user2.username).toBe(user.username);
        expect(user2.password).toBe(user.password);
        expect(user2.config.color).toBe('blue');
        expect(user2.config.fontFamily).toBe(user.config.fontFamily);
    }

    {
        const user2 = jsonSerializer.for(User).deserialize(plain, { groupsExclude: ['confidential'] });
        expect(user2.foo).toBe('bar2');
        expect(user2.username).toBe('peter2');
        expect(user2.password).toBe(user.password);
        expect(user2.config.color).toBe('blue');
        expect(user2.config.fontFamily).toBe('Arial');
    }
});

test('f on class, constructor resolution', () => {
    class Connection {
    }

    class Connection2 {
    }

    {
        @t
        class MyServer {
            constructor(private connection: Connection, connection2: Connection2) {
            }
        }

        const schema = getClassSchema(MyServer);

        const properties = schema.getMethodProperties('constructor');
        expect(properties.length).toBe(2);

        expect(properties[0].resolveClassType).toBe(Connection);
        expect(properties[0].isOptional).toBe(false);

        expect(properties[1].resolveClassType).toBe(Connection2);
        expect(properties[1].isOptional).toBe(false);
    }

    {
        @t
        class MyServer {
            constructor(private connection: Connection, @t.optional connection2?: Connection2) {
            }
        }

        const schema = getClassSchema(MyServer);

        const properties = schema.getMethodProperties('constructor');
        expect(properties.length).toBe(2);

        expect(properties[0].resolveClassType).toBe(Connection);
        expect(properties[0].isOptional).toBe(false);

        expect(properties[1].resolveClassType).toBe(Connection2);
        expect(properties[1].isOptional).toBe(true);
    }

    {
        @t
        class MyServer {
            constructor(@t.type(Connection).optional connection2?: Connection2) {
            }
        }

        const schema = getClassSchema(MyServer);
        const properties = schema.getMethodProperties('constructor');
        expect(properties.length).toBe(1);

        expect(properties[0].resolveClassType).toBe(Connection);
        expect(properties[0].isOptional).toBe(true);
    }
});

test('f.data', () => {

    class User {
        @t.data('myData', 'myValue') username: string = '';
    }

    expect(getClassSchema(User).getProperty('username').data['myData']).toBe('myValue');
});


test('isSchemaOf', () => {

    class BaseUser {
        @t username!: string;
    }

    class FrontendUser extends BaseUser {
        @t password?: string;
    }

    class DbUser extends FrontendUser {
        @t id!: string;
    }

    class Nix {
    }

    expect(getClassSchema(BaseUser).isSchemaOf(BaseUser)).toBe(true);
    expect(getClassSchema(BaseUser).isSchemaOf(FrontendUser)).toBe(false);
    expect(getClassSchema(BaseUser).isSchemaOf(DbUser)).toBe(false);
    expect(getClassSchema(BaseUser).isSchemaOf(Nix)).toBe(false);

    expect(getClassSchema(FrontendUser).isSchemaOf(BaseUser)).toBe(true);
    expect(getClassSchema(FrontendUser).isSchemaOf(FrontendUser)).toBe(true);
    expect(getClassSchema(FrontendUser).isSchemaOf(DbUser)).toBe(false);
    expect(getClassSchema(FrontendUser).isSchemaOf(Nix)).toBe(false);

    expect(getClassSchema(DbUser).isSchemaOf(BaseUser)).toBe(true);
    expect(getClassSchema(DbUser).isSchemaOf(FrontendUser)).toBe(true);
    expect(getClassSchema(DbUser).isSchemaOf(DbUser)).toBe(true);
    expect(getClassSchema(DbUser).isSchemaOf(Nix)).toBe(false);

    expect(getClassSchema(DbUser).isSchemaOf(Nix)).toBe(false);
});

test('external schema', () => {
    class Peter {
        id: number = 0;

        constructor(public name: string) {
        }
    }

    expect(getClassSchema(Peter).hasProperty('id')).toBe(false);

    t.schema({
        id: t.number,
        name: t.string,
    }, { classType: Peter });

    expect(getClassSchema(Peter).getProperty('id').type).toBe('number');
});

test('old forwardRef struct for IE11', () => {
    var Children = /** @class */ (function () {
        function Children() {
            // @ts-ignore
            this.name = '';
            // @ts-ignore
            this.birthdate = new Date;
        }
        Children.prototype.go = function () {
        };
        return Children;
    }());

    {
        const schema = t.schema({
            children: t.type(Children)
        });

        expect(schema.getProperty('children').resolveClassType).toBe(Children);
    }

    {
        const schema = t.schema({
            children: t.type(() => Children)
        });

        expect(schema.getProperty('children').resolveClassType).toBe(Children);
    }

    {
        const schema = t.schema({
            children: t.type(forwardRef(() => Children))
        });

        expect(schema.getProperty('children').resolveClassType).toBe(Children);
    }


    getGlobalStore().enableForwardRefDetection = false;

    {
        const schema = t.schema({
            children: t.type(Children)
        });

        expect(schema.getProperty('children').resolveClassType).toBe(Children);
    }

    {
        const schema = t.schema({
            children: t.type(forwardRef(() => Children))
        });

        expect(schema.getProperty('children').resolveClassType).toBe(Children);
    }

    {
        const schema = t.schema({
            children: t.type(() => Children)
        });

        expect(schema.getProperty('children').resolveClassType).toBeInstanceOf(Function);
        expect(schema.getProperty('children').resolveClassType).not.toBe(Children);
    }
});

test('default creates clones', () => {
    {
        const defaultValue: string[] = [];
        const propertySchema = t.array(t.string).optional.default(defaultValue).buildPropertySchema();
        expect(propertySchema.getDefaultValue()).not.toBe(defaultValue);
    }

    {
        const defaultValue: any = {};
        const propertySchema = t.map(t.string).optional.default(defaultValue).buildPropertySchema();
        expect(propertySchema.getDefaultValue()).not.toBe(defaultValue);
    }
});
