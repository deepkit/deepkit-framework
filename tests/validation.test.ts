import 'reflect-metadata';
import {Class, ClassArray, NumberType, StringType, ClassMap} from "../src/decorators";
import {Optional, validate} from "../src/validation";

test('test required', async () => {

    class Model {
        @StringType()
        id: string;

        @Optional()
        optional: string;
    }

    const instance = new Model;
    expect(await validate(Model, instance)).toBeArrayOfSize(1);
    expect(await validate(Model, instance)).toEqual([{message: "No value given", path: 'id'}]);

    instance.id = '2';
    expect(await validate(Model, instance)).toBeArrayOfSize(0);
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
    expect(await validate(Model, {id: undefined})).toEqual([{message: "No value given", path: 'id'}]);
    expect(await validate(Model, {})).toEqual([{message: "No value given", path: 'id'}]);

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
    expect(await validate(Model, {id: undefined})).toEqual([{message: "No value given", path: 'id'}]);
    expect(await validate(Model, {})).toEqual([{message: "No value given", path: 'id'}]);

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