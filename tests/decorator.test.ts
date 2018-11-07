import {
    AnyType,
    ArrayType,
    BooleanType,
    Class,
    DatabaseName,
    Entity,
    ID, MapType,
    ObjectIdType,
    StringType
} from "../src/decorators";
import {
    getCollectionName,
    getDatabaseName,
    getEntityName,
    getReflectionType,
    isArrayType, isMapType,
    plainToClass
} from "../src/mapper";
import {types} from "util";
import isMap = module

test('test entity database', async () => {
    @Entity('DifferentDataBase', 'differentCollection')
    @DatabaseName('testing1')
    class DifferentDataBase {
        @ID()
        @ObjectIdType()
        _id: string;

        @StringType()
        name: string;
    }

    class Child extends DifferentDataBase {}

    @Entity('DifferentDataBase2', 'differentCollection2')
    @DatabaseName('testing2')
    class Child2 extends DifferentDataBase {}

    expect(getDatabaseName(DifferentDataBase)).toBe('testing1');
    expect(getEntityName(DifferentDataBase)).toBe('DifferentDataBase');
    expect(getCollectionName(DifferentDataBase)).toBe('differentCollection');

    expect(getDatabaseName(Child2)).toBe('testing2');
    expect(getEntityName(Child2)).toBe('DifferentDataBase2');
    expect(getCollectionName(Child2)).toBe('differentCollection2');

    expect(getDatabaseName(Child)).toBe('testing1');
    expect(getEntityName(Child)).toBe('DifferentDataBase');
    expect(getCollectionName(Child)).toBe('differentCollection');
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
test('test properties', () => {

    class DataValue { }
    class DataValue2 { }

    @Entity('Model')
    class Model {
        @ID()
        @ObjectIdType()
        _id: string;

        @StringType()
        name: string;

        @Class(DataValue)
        data: DataValue;
    }

    @Entity('SubModel')
    class SubModel extends Model {
        @Class(DataValue2)
        data2: DataValue2;
    }

    {
        const {type, typeValue} = getReflectionType(Model, '_id');
        expect(type).toBe('objectId');
        expect(typeValue).toBeNull()
    }

    {
        const {type, typeValue} = getReflectionType(Model, 'data');
        expect(type).toBe('class');
        expect(typeValue).toBe(DataValue)
    }

    {
        const {type, typeValue} = getReflectionType(Model, 'data2');
        expect(type).toBeNull();
        expect(typeValue).toBeNull();
    }

    {
        const {type, typeValue} = getReflectionType(SubModel, '_id');
        expect(type).toBe('objectId');
        expect(typeValue).toBeNull()
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

    const instance = plainToClass(Model, {
        bool: 'wow',
        whatever: {'any': false}
    });

    expect(instance.bool).toBeTrue();
    expect(instance.whatever).toEqual({any: false});
});

test('more array/map', () => {
    class Model {
        @BooleanType()
        @ArrayType()
        bools: boolean[];

        @AnyType()
        @MapType()
        whatever: any[];
    }

    expect(isArrayType(Model, 'bools')).toBeTrue();
    expect(isMapType(Model, 'whatever')).toBeTrue();
});