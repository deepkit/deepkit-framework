import 'reflect-metadata';
import 'jest-extended'
import {validate, f} from "@super-hornet/marshal";
import {ValidationPipe} from '../';
import {BadRequestException} from '@nestjs/common';

test('test required', async () => {

    class Model {
        @f
        id: string = '1';

        @f
        name?: string;

        @f.optional()
        optional?: string;

        @f.map(String).optional()
        map?: {[name: string]: string};

        @f.array(String).optional()
        array?: string[];
    }

    const instance = new Model;
    expect(await validate(Model, instance)).toBeArrayOfSize(1);
    expect(await validate(Model, instance)).toEqual([{code: 'required', message: "Required value is undefined or null", path: 'name'}]);

    expect(await validate(Model, {name: 'foo', map: true})).toEqual([{code: 'invalid_type', message: "Type is not an object", path: 'map'}]);
    expect(await validate(Model, {name: 'foo', array: 233})).toEqual([{code: 'invalid_type',  message: "Type is not an array", path: 'array'}]);

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
            expect(error.message).toEqual({"error": "Bad Request", "message": [{"message": "Required value is undefined or null", "code": "required", "path": "name"}], "statusCode": 400});
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

