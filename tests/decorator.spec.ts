import 'jest-extended'
import 'reflect-metadata';
import {
    classToPlain,
    DatabaseName,
    Entity,
    f,
    getDatabaseName,
    getEntityName,
    getClassSchema,
    getParentReferenceClass,
    getReflectionType,
    isArrayType,
    isMapType,
    ParentReference,
    plainToClass,
    RegisteredEntities,
    isOptional,
    isRegisteredEntity, PropertySchema,
} from "../";
import {Buffer} from "buffer";
import {SimpleModel} from "./entities";
import {PageClass} from "./document-scenario/PageClass";
import {DocumentClass} from "./document-scenario/DocumentClass";
import {PageCollection} from "./document-scenario/PageCollection";
import {getClassTypeFromInstance} from '../src/decorators';

test('test invalid usage decorator', async () => {
    expect(() => {
        @f
        class Base {
            ohwe: any;
        }
    }).toThrow('Could not resolve property name for class property on Base');
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
        @f.forward(() => undefined!)
        ohwe: any;

        @f.forward(() => Config)
        config?: any;

        constructor(@f public id: string) {
        }
    }

    expect(() => {
        getClassSchema(Base).getProperty('ohwe').getResolvedClassType();
    }).toThrowError('ForwardRef returns no value');

    expect(() => {
        getReflectionType(Base, 'ohwe');
    }).toThrowError('Base::ohwe: Error: ForwardRef returns no value. () => undefined');

    expect(getClassSchema(Base).getProperty('config').getResolvedClassType()).toBe(Config);

    //second call uses cached one
    expect(getClassSchema(Base).getProperty('config').getResolvedClassType()).toBe(Config);

    expect(() => {
        getClassSchema(Base).getProperty('id').getResolvedClassType();
    }).toThrowError('No classType given for id');

    expect(() => {
        getClassSchema(Base).getProperty('bla');
    }).toThrowError('Property bla not found');
});

test('test circular', async () => {
    expect(getClassSchema(PageClass).getProperty('children').getResolvedClassType()).toBe(PageCollection);
    expect(getClassSchema(PageClass).getProperty('parent').getResolvedClassType()).toBe(PageClass);
    expect(getClassSchema(PageClass).getProperty('document').getResolvedClassType()).toBe(DocumentClass);
});

test('test entity database', async () => {
    @Entity('DifferentDataBase', 'differentCollection')
    @DatabaseName('testing1')
    class DifferentDataBase {
        @f.primary().mongoId()
        _id?: string;

        @f
        name?: string;
    }

    expect(RegisteredEntities['DifferentDataBase']).toBe(DifferentDataBase);

    class Child extends DifferentDataBase {
    }

    @Entity('DifferentDataBase2', 'differentCollection2')
    @DatabaseName('testing2')
    class Child2 extends DifferentDataBase {
    }

    @Entity('DifferentDataBase3')
    class Child3 extends DifferentDataBase {
    }

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
            @f.uuid().asName('fieldB').optional()
            public neighbor?: string,
        ) {
        }
    }

    const user = plainToClass(User, {
        fieldA: 'a',
        fieldB: 'b'
    });

    expect(user.parent).toBe('a');
    expect(user.neighbor).toBe('b');
    expect(isOptional(User, 'fieldB')).toBe(true);
});

test('test no entity throw error', () => {

    expect(() => {
        class Model {
        }

        getEntityName(Model);
    }).toThrowError('No @Entity() defined for class Model');
});

test('test decorator ParentReference without class', () => {
    class Sub {
    }

    expect(() => {
        class Model {
            @ParentReference()
            sub?: Sub;
        }

        getParentReferenceClass(Model, 'sub');
        expect(getClassSchema(Model).getProperty('sub').isResolvedClassTypeIsDecorated()).toBe(false);
    }).toThrowError('Model::sub has @ParentReference but no @Entity defined.');
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
        @f.use(Decorator) b!: string;
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
    }).toThrowError('Marshal entity with name \'same-name\' already registered.');
});

test('test decorator circular', () => {
    class Sub {
    }

    {
        class Model {
            @f.forward(() => Sub)
            sub?: Sub;
        }

        expect(getReflectionType(Model, 'sub')).toEqual({type: 'class', typeValue: Sub});
    }

    {
        class Model {
            @f.forwardMap(() => Sub)
            sub?: { [l: string]: Sub };
        }

        expect(getReflectionType(Model, 'sub')).toEqual({type: 'class', typeValue: Sub});
        expect(isMapType(Model, 'sub')).toBeTrue();
    }

    {
        class Model {
            @f.forwardArray(() => Sub)
            sub?: Sub[];
        }

        expect(getReflectionType(Model, 'sub')).toEqual({type: 'class', typeValue: Sub});
        expect(isArrayType(Model, 'sub')).toBeTrue();
    }
});

test('test properties', () => {
    class DataValue {
    }

    class DataValue2 {
    }

    @Entity('Model')
    class Model {
        @f.primary().mongoId()
        _id?: string;

        @f
        name?: string;

        @f.type(DataValue)
        data?: DataValue;
    }

    @Entity('SubModel')
    class SubModel extends Model {
        @f.type(DataValue2)
        data2?: DataValue2;
    }

    {
        const {type, typeValue} = getReflectionType(Model, '_id');
        expect(type).toBe('objectId');
        expect(typeValue).toBeUndefined()
    }

    {
        const {type, typeValue} = getReflectionType(Model, 'data');
        expect(type).toBe('class');
        expect(typeValue).toBe(DataValue)
    }

    {
        const {type, typeValue} = getReflectionType(Model, 'data2');
        expect(type).toBeUndefined();
        expect(typeValue).toBeUndefined();
    }

    {
        const {type, typeValue} = getReflectionType(SubModel, '_id');
        expect(type).toBe('objectId');
        expect(typeValue).toBeUndefined()
    }
    {
        const {type, typeValue} = getReflectionType(SubModel, 'data');
        expect(type).toBe('class');
        expect(typeValue).toBe(DataValue)
    }
    {
        const {type, typeValue} = getReflectionType(SubModel, 'data2');
        expect(type).toBe('class');
        expect(typeValue).toBe(DataValue2)
    }
});

test('more decorator', () => {
    class Model {
        @f
        bool: boolean = false;

        @f.any()
        whatever: any;
    }

    {
        const instance = plainToClass(Model, {
            bool: 'wow',
            whatever: {'any': false}
        });

        expect(instance.bool).toBeFalse();
        expect(instance.whatever).toEqual({any: false});
    }

    {
        const instance = plainToClass(Model, {
            bool: 'true',
        });
        expect(instance.bool).toBeTrue();
    }

    {
        const instance = plainToClass(Model, {
            bool: '1',
        });
        expect(instance.bool).toBeTrue();
    }

    {
        const instance = plainToClass(Model, {
            bool: 1,
        });
        expect(instance.bool).toBeTrue();
    }

    {
        const instance = plainToClass(Model, {
            bool: 'false',
        });
        expect(instance.bool).toBeFalse();
    }

    {
        const instance = plainToClass(Model, {
            bool: '0',
        });
        expect(instance.bool).toBeFalse();
    }

    {
        const instance = plainToClass(Model, {
            bool: 0,
        });
        expect(instance.bool).toBeFalse();
    }
});

test('more array/map', () => {
    class Model {
        @f.array(Boolean)
        bools?: boolean[];

        @f.any().asArray()
        whatever?: any[];

        @f.any().asMap()
        whatevermap?: { [k: string]: any };
    }

    expect(isArrayType(Model, 'bools')).toBeTrue();
    expect(isMapType(Model, 'whatevermap')).toBeTrue();
    expect(isMapType(Model, 'whatever')).toBeFalse();
});

test('binary', () => {
    class Model {
        @f.type(Buffer)
        preview: Buffer = Buffer.from('FooBar', 'utf8');
    }

    const {type, typeValue} = getReflectionType(Model, 'preview');
    expect(type).toBe('binary');
    expect(typeValue).toBeUndefined();

    const i = new Model();
    expect(i.preview.toString('utf8')).toBe('FooBar');

    const plain = classToPlain(Model, i);
    expect(plain.preview).toBe('Rm9vQmFy');
    expect(plain.preview).toBe(Buffer.from('FooBar', 'utf8').toString('base64'));

    const back = plainToClass(Model, plain);
    expect(back.preview).toBeInstanceOf(Buffer);
    expect(back.preview.toString('utf8')).toBe('FooBar');
    expect(back.preview.length).toBe(6);
});
