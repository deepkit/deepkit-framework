import 'reflect-metadata';
import 'jest-extended'
import {Optional, validate, StringType, ArrayType, MapType} from "@marcj/marshal";
import {ValidationPipe} from '../';
import {BadRequestException} from '@nestjs/common';

test('test required', async () => {

    class Model {
        @StringType()
        id: string = '1';

        @StringType()
        name?: string;

        @Optional()
        optional?: string;

        @Optional()
        @MapType()
        map?: {[name: string]: string};

        @Optional()
        @ArrayType()
        array?: string[];
    }

    const instance = new Model;
    expect(await validate(Model, instance)).toBeArrayOfSize(1);
    expect(await validate(Model, instance)).toEqual([{message: "No value given", path: 'name'}]);

    expect(await validate(Model, {name: 'foo', map: true})).toEqual([{message: "No Map given", path: 'map'}]);
    expect(await validate(Model, {name: 'foo', array: 233})).toEqual([{message: "No Array given", path: 'array'}]);

    {
        const pipe = new ValidationPipe();
        const result = await pipe.transform({name: 'Foo'}, {type: 'body'});
        expect(result).toBeUndefined();
    }

    {
        const pipe = new ValidationPipe();
        const result = await pipe.transform({name: 'Foo'}, {type: 'body', metatype: Model});
        expect(result).not.toBeInstanceOf(Model);
        expect(result.id).toBe('1'); //because ValidationPipe is reading default values
    }

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
            expect(error.message).toEqual([{"message": "No value given", "path": "name"}]);
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

