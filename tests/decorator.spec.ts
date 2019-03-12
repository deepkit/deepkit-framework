import 'jest-extended'
import {
    AnyType,
    ArrayType,
    BooleanType,
    Class,
    DatabaseName,
    Entity,
    ID,
    MapType,
    MongoIdType,
    StringType,
    getCollectionName,
    getDatabaseName,
    getEntityName,
    getReflectionType,
    isArrayType,
    isMapType,
    plainToClass,
    ClassMap,
    ClassArray,
    ClassCircular,
    ClassArrayCircular,
    ClassMapCircular,
    ParentReference,
    getParentReferenceClass,
    BinaryType,
    classToPlain,
    RegisteredEntities,
    ClassType
} from "../";
import {Buffer} from "buffer";

test('test entity database', async () => {

    @Entity('DifferentDataBase', 'differentCollection')
    @DatabaseName('testing1')
    class DifferentDataBase {
        @ID()
        @MongoIdType()
        _id?: string;

        @StringType()
        name?: string;
    }

    expect(RegisteredEntities['DifferentDataBase']).toBe(DifferentDataBase);

    class Child extends DifferentDataBase {}

    @Entity('DifferentDataBase2', 'differentCollection2')
    @DatabaseName('testing2')
    class Child2 extends DifferentDataBase {}

    @Entity('DifferentDataBase3')
    class Child3 extends DifferentDataBase {}

    expect(getDatabaseName(DifferentDataBase)).toBe('testing1');
    expect(getEntityName(DifferentDataBase)).toBe('DifferentDataBase');
    expect(getCollectionName(DifferentDataBase)).toBe('differentCollection');

    expect(getDatabaseName(Child2)).toBe('testing2');
    expect(getEntityName(Child2)).toBe('DifferentDataBase2');
    expect(getCollectionName(Child2)).toBe('differentCollection2');

    expect(getDatabaseName(Child)).toBe('testing1');
    expect(getEntityName(Child)).toBe('DifferentDataBase');
    expect(getCollectionName(Child)).toBe('differentCollection');

    expect(getDatabaseName(Child3)).toBe('testing1'); //is inherited
    expect(getEntityName(Child3)).toBe('DifferentDataBase3');
    expect(getCollectionName(Child3)).toBe('DifferentDataBase3s');
});

test('test no entity throw error', () => {

    expect(() => {
        class Model {}
        getEntityName(Model);
    }).toThrowError('No @Entity() defined for class class Model');

    expect(() => {
        class Model {}
        getCollectionName(Model);
    }).toThrowError('No @Entity() defined for class class Model');
});

test('test decorator errors', () => {
    class Sub {}

    expect(() => {
        class Model {
            @Class(<any>undefined)
            sub?: Sub;
        }
    }).toThrowError('Model::sub has @Class but argument is empty.');

    expect(() => {
        class Model {
            @ClassMap(<any>undefined)
            sub?: Sub;
        }
    }).toThrowError('Model::sub has @ClassMap but argument is empty.');

    expect(() => {
        class Model {
            @ClassArray(<any>undefined)
            sub?: Sub;
        }
    }).toThrowError('Model::sub has @ClassArray but argument is empty.');
});

test('test decorator ParentReference without class', () => {
    class Sub {}

    expect(() => {
        class Model {
            @ParentReference()
            sub?: Sub;
        }
        getParentReferenceClass(Model, 'sub');
    }).toThrowError('Model::sub has @ParentReference but no @Class defined.');
});

test('test decorator circular', () => {
    class Sub {}

    {
        class Model {
            @ClassCircular(() => Sub)
            sub?: Sub;
        }
        expect(getReflectionType(Model, 'sub')).toEqual({type: 'class', typeValue: Sub});
    }

    {
        class Model {
            @ClassMapCircular(() => Sub)
            sub?: Sub;
        }
        expect(getReflectionType(Model, 'sub')).toEqual({type: 'class', typeValue: Sub});
        expect(isMapType(Model, 'sub')).toBeTrue();
    }

    {
        class Model {
            @ClassArrayCircular(() => Sub)
            sub?: Sub;
        }
        expect(getReflectionType(Model, 'sub')).toEqual({type: 'class', typeValue: Sub});
        expect(isArrayType(Model, 'sub')).toBeTrue();
    }
});



test('test properties', () => {
    class DataValue { }
    class DataValue2 { }

    @Entity('Model')
    class Model {
        @ID()
        @MongoIdType()
        _id?: string;

        @StringType()
        name?: string;

        @Class(DataValue)
        data?: DataValue;
    }

    @Entity('SubModel')
    class SubModel extends Model {
        @Class(DataValue2)
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
        @BooleanType()
        bool: boolean = false;

        @AnyType()
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
        @BooleanType()
        @ArrayType()
        bools?: boolean[];

        @AnyType()
        @MapType()
        whatever?: any[];
    }

    expect(isArrayType(Model, 'bools')).toBeTrue();
    expect(isMapType(Model, 'whatever')).toBeTrue();
});

test('binary', () => {
    class Model {
        @BinaryType()
        preview: Buffer = new Buffer('FooBar', 'utf8');
    }

    const {type, typeValue} = getReflectionType(Model, 'preview');
    expect(type).toBe('binary');
    expect(typeValue).toBeUndefined();

    const i = new Model();
    expect(i.preview.toString('utf8')).toBe('FooBar');

    const plain = classToPlain(Model, i);
    expect(plain.preview).toBe('Rm9vQmFy');
    expect(plain.preview).toBe(new Buffer('FooBar', 'utf8').toString('base64'));

    const back = plainToClass(Model, plain);
    expect(back.preview).toBeInstanceOf(Buffer);
    expect(back.preview.toString('utf8')).toBe('FooBar');
    expect(back.preview.length).toBe(6);
});
