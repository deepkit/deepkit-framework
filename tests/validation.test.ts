import 'reflect-metadata';
import {Class, ClassArray, NumberType, StringType, ClassMap, ArrayType, MapType} from "../src/decorators";
import {Optional, validate} from "../src/validation";
import {ValidationPipe} from '../nest';
import {BadRequestException} from '@nestjs/common';

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

    {
        const pipe = new ValidationPipe();
        const result = await pipe.transform({name: 'Foo', optional: 'two'}, {type: 'body', metatype: Model});
        expect(result).not.toBeInstanceOf(Model);
        expect(result.id).toBe('1'); //because ValidationPipe is reading default values
    }

    {
        const pipe = new ValidationPipe({transform: true});
        const result = await pipe.transform({name: 'Foo', optional: 'two'}, {type: 'body', metatype: Model});
        expect(result).toBeInstanceOf(Model);
    }

    {
        const pipe = new ValidationPipe({transform: true});
        try {
            const result = await pipe.transform({optional: 'two'}, {type: 'body', metatype: Model});
            fail('no exception thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            expect(error.message).toEqual({"error": "Bad Request", "message": [{"message": "No value given", "path": "name"}], "statusCode": 400});
        }
    }

    {
        const pipe = new ValidationPipe({transform: true, disableErrorMessages: true});
        try {
            const result = await pipe.transform({optional: 'two'}, {type: 'body', metatype: Model});
            fail('no exception thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            expect(error.message).toEqual({"error": "Bad Request", "statusCode": 400});
        }
    }

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