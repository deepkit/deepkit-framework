import 'jest-extended'
import {
    classToPlain,
    DatabaseName,
    Entity,
    Field,
    getDatabaseName,
    getEntityName,
    getEntitySchema,
    getParentReferenceClass,
    getReflectionType,
    IDField,
    isArrayType,
    isMapType,
    MongoIdField,
    ParentReference,
    plainToClass,
    RegisteredEntities,
    FieldAny, FieldMap, forwardRef, FieldArray, Index,
} from "../";
import {Buffer} from "buffer";
import {SimpleModel} from "./entities";
import {PageClass} from "./document-scenario/PageClass";
import {DocumentClass} from "./document-scenario/DocumentClass";
import {PageCollection} from "./document-scenario/PageCollection";

test('test invalid usage', async () => {
    class Config {}

    class Base {
        @Field(forwardRef(() => undefined))
        ohwe: any;

        @Field(forwardRef(() => Config))
        config?: any;

        constructor(@Field() public id: string) {}
    }

    expect(() => {
        getEntitySchema(Base).getProperty('ohwe').getResolvedClassType();
    }).toThrowError('ForwardRef returns no value');

    expect(getEntitySchema(Base).getProperty('config').getResolvedClassType()).toBe(Config);

    //second call uses cached one
    expect(getEntitySchema(Base).getProperty('config').getResolvedClassType()).toBe(Config);

    expect(() => {
        getEntitySchema(Base).getProperty('id').getResolvedClassType();
    }).toThrowError('No classType given for id');

    expect(() => {
        getEntitySchema(Base).getProperty('bla');
    }).toThrowError('Property bla not found');
});

test('test circular', async () => {
    expect(getEntitySchema(PageClass).getProperty('children').getResolvedClassType()).toBe(PageCollection);
    expect(getEntitySchema(PageClass).getProperty('parent').getResolvedClassType()).toBe(PageClass);
    expect(getEntitySchema(PageClass).getProperty('document').getResolvedClassType()).toBe(DocumentClass);
});

test('test inheritance', async () => {
    class Base {
        constructor(
            @Field()
            @Index({}, 'id2')
            public id: string,
        ) {}
    }

    class Page extends Base {
        constructor(id: string, @Field() public name: string) {
            super(id);
        }
    }

    class Between extends Page {

    }

    class SuperPage extends Between {
        @Field()
        super?: number
    }

    class Super2 extends SuperPage {}
    class Super3 extends Super2 {}

    expect(getEntitySchema(Base).getProperty('id').type).toBe('string');
    expect(getEntitySchema(Base).getIndex('id2')!.name).toBe('id2');

    expect(getEntitySchema(Page).getProperty('id').type).toBe('string');
    expect(getEntitySchema(Page).getProperty('name').type).toBe('string');
    expect(getEntitySchema(Page).getIndex('id2')!.name).toBe('id2');

    expect(getEntitySchema(SuperPage).getProperty('id').type).toBe('string');
    expect(getEntitySchema(SuperPage).getProperty('name').type).toBe('string');
    expect(getEntitySchema(SuperPage).getProperty('super').type).toBe('number');
    expect(getEntitySchema(SuperPage).getIndex('id2')!.name).toBe('id2');

    expect(getEntitySchema(Super3).getProperty('id').type).toBe('string');
    expect(getEntitySchema(Super3).getProperty('name').type).toBe('string');
    expect(getEntitySchema(Super3).getProperty('super').type).toBe('number');
    expect(getEntitySchema(Super3).getIndex('id2')!.name).toBe('id2');

    expect(getEntitySchema(Super2).getProperty('id').type).toBe('string');
    expect(getEntitySchema(Super2).getProperty('name').type).toBe('string');
    expect(getEntitySchema(Super2).getProperty('super').type).toBe('number');
    expect(getEntitySchema(Super2).getIndex('id2')!.name).toBe('id2');


});

test('test entity database', async () => {
    @Entity('DifferentDataBase', 'differentCollection')
    @DatabaseName('testing1')
    class DifferentDataBase {
        @IDField()
        @MongoIdField()
        _id?: string;

        @Field()
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
    const schema = getEntitySchema(SimpleModel);
    expect(schema.getProperty('id').type).toBe('uuid');
    expect(schema.getProperty('id').isId).toBe(true);
});

test('test binary', () => {
    class User {
        @Field(Buffer)
        picture?: Buffer
    }
    const schema = getEntitySchema(User);
    expect(schema.getProperty('picture').type).toBe('binary');
});

test('test @Field', () => {
    class Config {
        @Field()
        created: Date = new Date;
    }

    class Page {
        @Field({Config})
        map: { [name: string]: Config } = {};

        @Field([Config])
        configArray: Config[] = [];

        constructor(
            @Field() name: string,
            @Field([String]) tags: string[]
        ) {
        }
    }

    const schema = getEntitySchema(Page);

    expect(schema.getProperty('name').isMap).toBe(false);
    expect(schema.getProperty('name').isArray).toBe(false);
    expect(schema.getProperty('name').type).toBe('string');

    expect(schema.getProperty('tags').isMap).toBe(false);
    expect(schema.getProperty('tags').isArray).toBe(true);
    expect(schema.getProperty('tags').type).toBe('string');

    expect(schema.getProperty('map').type).toBe('class');
    expect(schema.getProperty('map').isMap).toBe(true);
    expect(schema.getProperty('map').getResolvedClassType()).toBe(Config);
    expect(schema.getProperty('map').isArray).toBe(false);

    expect(schema.getProperty('configArray').type).toBe('class');
    expect(schema.getProperty('configArray').isArray).toBe(true);
    expect(schema.getProperty('configArray').getResolvedClassType()).toBe(Config);
    expect(schema.getProperty('configArray').isMap).toBe(false);
});

test('test invalid @Field', () => {
    class Config {
        @Field()
        name?: string;
    }

    expect(() => {
        class User {
            @Field()
            notDefined;
        }
    }).toThrowError('User::notDefined type mismatch. Given undefined, but declared is Object or undefined.');

    expect(() => {
        var NOTEXIST;

        class User {
            @Field(NOTEXIST)
            notDefined;
        }
    }).toThrowError('User::notDefined type mismatch. Given undefined, but declared is Object or undefined.');

    expect(() => {
        class User {
            @Field()
            created = new Date;
        }
    }).toThrowError('User::created type mismatch. Given undefined, but declared is Object or undefined.');

    expect(() => {
        class User {
            @Field(Config)
            config: Config[] = [];
        }
    }).toThrowError('User::config type mismatch. Given Config, but declared is Array.');

    expect(() => {
        class User {
            @Field([Config])
            config?: Config;
        }
    }).toThrowError('User::config type mismatch. Given Config[], but declared is Config.');

    expect(() => {
        class User {
            @Field(Config)
            config: { [k: string]: Config } = {};
        }
    }).toThrowError('User::config type mismatch. Given Config, but declared is Object or undefined');

    expect(() => {
        class Model {
            @Field([forwardRef(() => Config)])
            sub?: Config;
        }

    }).toThrowError('Model::sub type mismatch. Given ForwardedRef[], but declared is Config.');

    expect(() => {
        class Model {
            @FieldArray(forwardRef(() => Config))
            sub?: Config;
        }

    }).toThrowError('Model::sub type mismatch. Given ForwardedRef[], but declared is Config.');

    expect(() => {
        class Model {
            @FieldMap(forwardRef(() => Config))
            sub?: Config;
        }
    }).toThrowError('Model::sub type mismatch. Given {[key: string]: ForwardedRef}, but declared is Config.');

    expect(() => {
        class Model {
            @Field({Config})
            sub?: Config[];
        }

    }).toThrowError('Model::sub type mismatch. Given {[key: string]: Config}, but declared is Array.');

    expect(() => {
        class Model {
            @FieldAny()
            any?: any[];
        }
    }).toThrowError('Model::any type mismatch. Given Any, but declared is Array.');

    {
        //works
        class Model {
            @FieldAny()
            any?: { [k: string]: any };
        }
    }
    {
        //works
        class Model {
            @FieldAny({})
            any?;
        }
    }

    {
        //works
        class Model {
            @Field(forwardRef(() => Config))
            sub?: Config;
        }
    }
});

test('test no entity throw error', () => {

    expect(() => {
        class Model {
        }

        getEntityName(Model);
    }).toThrowError('No @Entity() defined for class class Model');
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
    }).toThrowError('Model::sub has @ParentReference but no @Class defined.');
});

test('test decorator circular', () => {
    class Sub {
    }

    {
        class Model {
            @Field(forwardRef(() => Sub))
            sub?: Sub;
        }

        expect(getReflectionType(Model, 'sub')).toEqual({type: 'class', typeValue: Sub});
    }

    {
        class Model {
            @FieldMap(forwardRef(() => Sub))
            sub?: { [l: string]: Sub };
        }

        expect(getReflectionType(Model, 'sub')).toEqual({type: 'class', typeValue: Sub});
        expect(isMapType(Model, 'sub')).toBeTrue();
    }

    {
        class Model {
            @Field([forwardRef(() => Sub)])
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
        @IDField()
        @MongoIdField()
        _id?: string;

        @Field()
        name?: string;

        @Field(DataValue)
        data?: DataValue;
    }

    @Entity('SubModel')
    class SubModel extends Model {
        @Field(DataValue2)
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
        @Field()
        bool: boolean = false;

        @FieldAny()
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
        @Field([Boolean])
        bools?: boolean[];

        @FieldAny([])
        whatever?: any[];

        @FieldAny({})
        whatevermap?: {[k: string]: any};
    }

    expect(isArrayType(Model, 'bools')).toBeTrue();
    expect(isMapType(Model, 'whatevermap')).toBeTrue();
    expect(isMapType(Model, 'whatever')).toBeFalse();
});

test('binary', () => {
    class Model {
        @Field(Buffer)
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
