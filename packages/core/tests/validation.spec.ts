import 'reflect-metadata';
import 'jest-extended'
import {Class, ClassArray, NumberType, StringType, ClassMap, ArrayType, MapType, Optional, validate} from "../";

test('test required', async () => {

    class Model {
        @StringType()
        id: string = '1';

        @StringType()
        name: string;

        @Optional()
        optional: string;

        @Optional()
        @MapType()
        map: {[name: string]: string};

        @Optional()
        @ArrayType()
        array: string[];
    }

    const instance = new Model;
    expect(await validate(Model, instance)).toBeArrayOfSize(1);
    expect(await validate(Model, instance)).toEqual([{message: "No value given", path: 'name'}]);

    expect(await validate(Model, {name: 'foo', map: true})).toEqual([{message: "No Map given", path: 'map'}]);
    expect(await validate(Model, {name: 'foo', array: 233})).toEqual([{message: "No Array given", path: 'array'}]);

    instance.name = 'Pete';
    expect(await validate(Model, instance)).toEqual([]);
});


test('test deep', async () => {

    class Deep {
        @StringType()
        name: string;
    }

    class Model {
        @StringType()
        id: string = '2';

        @Class(Deep)
        deep: Deep;

        @ClassArray(Deep)
        deepArray: Deep[] = [];

        @ClassMap(Deep)
        deepMap: {[name: string]: Deep} = {};
    }

    const instance = new Model;
    expect(await validate(Model, instance)).toBeArrayOfSize(1);
    expect(await validate(Model, instance)).toEqual([{message: "No value given", path: 'deep'}]);

    instance.deep = new Deep();
    expect(await validate(Model, instance)).toEqual([{message: "No value given", path: 'deep.name'}]);

    instance.deep.name = 'defined';
    instance.deepArray.push(new Deep());
    expect(await validate(Model, instance)).toEqual([{message: "No value given", path: 'deepArray.0.name'}]);

    instance.deepArray[0].name = 'defined';
    instance.deepMap.foo = new Deep();
    expect(await validate(Model, instance)).toEqual([{message: "No value given", path: 'deepMap.foo.name'}]);

    instance.deepMap.foo.name = 'defined';
    expect(await validate(Model, instance)).toEqual([]);
});

test('test string', async () => {
    class Model {
        @StringType()
        id: string = '2';
    }

    expect(await validate(Model, {id: '2'})).toEqual([]);
    expect(await validate(Model, {id: 2})).toEqual([{message: "No String given", path: 'id'}]);
    expect(await validate(Model, {id: null})).toEqual([{message: "No String given", path: 'id'}]);
    expect(await validate(Model, {id: undefined})).toEqual([]); //because defaults are applied
    expect(await validate(Model, {})).toEqual([]); //because defaults are applied

    class ModelOptional {
        @StringType()
        @Optional()
        id: string;
    }

    expect(await validate(ModelOptional, {id: '2'})).toEqual([]);
    expect(await validate(ModelOptional, {id: 2})).toEqual([{message: "No String given", path: 'id'}]);
    expect(await validate(ModelOptional, {id: null})).toEqual([{message: "No String given", path: 'id'}]);
    expect(await validate(ModelOptional, {id: undefined})).toEqual([]);
    expect(await validate(ModelOptional, {})).toEqual([]);
});

test('test number', async () => {
    class Model {
        @NumberType()
        id: number = 2;
    }

    expect(await validate(Model, {id: 3})).toEqual([]);
    expect(await validate(Model, {id: '3'})).toEqual([]);
    expect(await validate(Model, {id: 'a'})).toEqual([{message: "No Number given", path: 'id'}]);
    expect(await validate(Model, {id: null})).toEqual([{message: "No Number given", path: 'id'}]);
    expect(await validate(Model, {id: undefined})).toEqual([]); //because defaults are applied
    expect(await validate(Model, {})).toEqual([]); //because defaults are applied

    class ModelOptional {
        @NumberType()
        @Optional()
        id: number;
    }

    expect(await validate(ModelOptional, {id: 3})).toEqual([]);
    expect(await validate(ModelOptional, {id: '3'})).toEqual([]);
    expect(await validate(ModelOptional, {id: 'a'})).toEqual([{message: "No Number given", path: 'id'}]);
    expect(await validate(ModelOptional, {id: null})).toEqual([{message: "No Number given", path: 'id'}]);
    expect(await validate(ModelOptional, {id: undefined})).toEqual([]);
    expect(await validate(ModelOptional, {})).toEqual([]);
});