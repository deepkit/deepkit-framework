import 'reflect-metadata';
import 'jest-extended'
import {
    AddValidator,
    Field,
    InlineValidator,
    Optional, plainToClass,
    PropertyValidator,
    PropertyValidatorError,
    validate, validatedPlainToClass,
    ValidationError, ValidationFailed
} from "../";

test('test simple', async () => {
    class Page {
        constructor(
            @Field() public name: string,
            @Field() public age: number,
        ) {
        }
    }

    const errors = await validate(Page, {name: 'peter'});
    expect(errors.length).toBe(1);
    expect(errors[0]).toBeInstanceOf(ValidationError);
    expect(errors[0].message).toBe('Required value is undefined');
    expect(errors[0].path).toBe('age');
});

test('test required', async () => {

    class Model {
        @Field()
        id: string = '1';

        @Field()
        name?: string;

        @Optional()
        optional?: string;

        @Optional()
        @Field({String})
        map?: { [name: string]: string };

        @Optional()
        @Field([String])
        array?: string[];
    }

    const instance = new Model;
    expect(await validate(Model, instance)).toBeArrayOfSize(1);
    expect(await validate(Model, instance)).toEqual([{message: "Required value is undefined", path: 'name'}]);

    expect(await validate(Model, {
        name: 'foo',
        map: true
    })).toEqual([{message: "Invalid type. Expected object, but got boolean", path: 'map'}]);
    expect(await validate(Model, {
        name: 'foo',
        array: 233
    })).toEqual([{message: "Invalid type. Expected array, but got number", path: 'array'}]);

    instance.name = 'Pete';
    expect(await validate(Model, instance)).toEqual([]);
});


test('test deep', async () => {

    class Deep {
        @Field()
        name?: string;
    }

    class Model {
        @Field()
        id: string = '2';

        @Field(Deep)
        deep?: Deep;

        @Field([Deep])
        deepArray: Deep[] = [];

        @Field({Deep})
        deepMap: { [name: string]: Deep } = {};
    }

    const instance = new Model;
    expect(await validate(Model, instance)).toBeArrayOfSize(1);
    expect(await validate(Model, instance)).toEqual([{message: "Required value is undefined", path: 'deep'}]);

    instance.deep = new Deep();
    expect(await validate(Model, instance)).toEqual([{message: "Required value is undefined", path: 'deep.name'}]);

    instance.deep.name = 'defined';
    instance.deepArray.push(new Deep());
    expect(await validate(Model, instance)).toEqual([{
        message: "Required value is undefined",
        path: 'deepArray.0.name'
    }]);

    instance.deepArray[0].name = 'defined';
    instance.deepMap.foo = new Deep();
    expect(await validate(Model, instance)).toEqual([{
        message: "Required value is undefined",
        path: 'deepMap.foo.name'
    }]);

    instance.deepMap.foo.name = 'defined';
    expect(await validate(Model, instance)).toEqual([]);
});

test('test AddValidator', async () => {
    class MyValidator implements PropertyValidator {
        async validate<T>(value: any): Promise<PropertyValidatorError | void> {
            if (value.length > 5) {
                return new PropertyValidatorError('Too long');
            }
        }
    }

    class Model {
        @Field()
        @AddValidator(MyValidator)
        id: string = '2';
    }

    expect(await validate(Model, {id: '2'})).toEqual([]);
    expect(await validate(Model, {id: '123456'})).toEqual([{message: 'Too long', path: 'id'}]);
});

test('test inline validator', async () => {
    class Model {
        @Field()
        @InlineValidator(async (value: string) => {
            if (value.length > 5) {
                throw new Error('Too long');
            }
        })
        id: string = '2';
    }

    expect(await validate(Model, {id: '2'})).toEqual([]);
    expect(await validate(Model, {id: '123456'})).toEqual([{message: 'Too long', path: 'id'}]);
});

test('test Date', async () => {
    class Model {
        @Field(Date)
        public endTime!: Date;
    }

    const date = new Date("2019-03-19T10:41:45.000Z");

    expect(await validate(Model, {endTime: "2019-03-19T10:38:59.072Z"})).toEqual([]);
    expect(await validate(Model, {endTime: date.toJSON()})).toEqual([]);
    expect(await validate(Model, {endTime: "Tue Mar 19 2019 11:39:10 GMT+0100 (Central European Standard Time)"})).toEqual([]);
    expect(await validate(Model, {endTime: date.toString()})).toEqual([]);
    expect(await validate(Model, {endTime: ''})).toEqual([{message: 'No Date string given', path: 'endTime'}]);
    expect(await validate(Model, {endTime: 'asdf'})).toEqual([{message: 'No valid Date string given', path: 'endTime'}]);
    expect(await validate(Model, {endTime: null})).toEqual([{message: 'Required value is null', path: 'endTime'}]);
    expect(await validate(Model, {endTime: undefined})).toEqual([{message: 'Required value is undefined', path: 'endTime'}]);

    {
        const o = plainToClass(Model, {endTime: date.toString()});
        expect(o.endTime).toEqual(date);
    }

    {
        const o = plainToClass(Model, {endTime: date.toJSON()});
        expect(o.endTime).toEqual(date);
    }

    {
        const o = plainToClass(Model, {endTime: null});
        expect(o.endTime).toBe(null);
    }

    {
        const o = plainToClass(Model, {endTime: undefined});
        expect(o.endTime).toBe(undefined);
    }

    {
        const o = await validatedPlainToClass(Model, {endTime: '2019-03-19T10:41:45.000Z'});
        expect(o.endTime).toEqual(date);
    }

    try {
        await validatedPlainToClass(Model, {endTime: 'asd'});
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('No valid Date string given');
    }

    try {
        await validatedPlainToClass(Model, {endTime: ''});
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('No Date string given');
    }

    try {
        await validatedPlainToClass(Model, {endTime: null});
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('Required value is null');
    }

    try {
        await validatedPlainToClass(Model, {endTime: undefined});
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('Required value is undefined');
    }

});

test('test string', async () => {
    class Model {
        @Field()
        id: string = '2';
    }

    expect(await validate(Model, {id: '2'})).toEqual([]);
    expect(await validate(Model, {id: 2})).toEqual([{message: "No String given", path: 'id'}]);
    expect(await validate(Model, {id: null})).toEqual([{message: "Required value is null", path: 'id'}]);
    expect(await validate(Model, {id: undefined})).toEqual([]); //because defaults are applied
    expect(await validate(Model, {})).toEqual([]); //because defaults are applied

    class ModelOptional {
        @Field()
        @Optional()
        id?: string;
    }

    expect(await validate(ModelOptional, {id: '2'})).toEqual([]);
    expect(await validate(ModelOptional, {id: 2})).toEqual([{message: "No String given", path: 'id'}]);
    expect(await validate(ModelOptional, {id: null})).toEqual([{message: "No String given", path: 'id'}]);
    expect(await validate(ModelOptional, {id: undefined})).toEqual([]);
    expect(await validate(ModelOptional, {})).toEqual([]);
});

test('test number', async () => {
    class Model {
        @Field()
        id: number = 2;
    }

    expect(await validate(Model, {id: 3})).toEqual([]);
    expect(await validate(Model, {id: '3'})).toEqual([]);
    expect(await validate(Model, {id: 'a'})).toEqual([{message: "No Number given", path: 'id'}]);
    expect(await validate(Model, {id: null})).toEqual([{message: "Required value is null", path: 'id'}]);
    expect(await validate(Model, {id: undefined})).toEqual([]); //because defaults are applied
    expect(await validate(Model, {})).toEqual([]); //because defaults are applied

    class ModelOptional {
        @Field()
        @Optional()
        id?: number;
    }

    expect(await validate(ModelOptional, {id: 3})).toEqual([]);
    expect(await validate(ModelOptional, {id: '3'})).toEqual([]);
    expect(await validate(ModelOptional, {id: 'a'})).toEqual([{message: "No Number given", path: 'id'}]);
    expect(await validate(ModelOptional, {id: null})).toEqual([{message: "No Number given", path: 'id'}]);
    expect(await validate(ModelOptional, {id: undefined})).toEqual([]);
    expect(await validate(ModelOptional, {})).toEqual([]);
});

test('test nested validation', async () => {
    // Class definition with validation rules
    class A {
        @Field()
        public x!: string;
    }

    class B {
        @Field()
        public type!: string;

        @Field(A)
        public nested!: A;

        @Field({A})
        public nestedMap!: { [name: string]: A };

        @Field([A])
        public nesteds!: A[];
    }

    expect(await validate(B, {
        type: "test type",
    })).toEqual([
        {'message': 'Required value is undefined', 'path': 'nested'},
        {'message': 'Required value is undefined', 'path': 'nestedMap'},
        {'message': 'Required value is undefined', 'path': 'nesteds'},
    ]);

    expect(await validate(B, {
        type: "test type",
        nested: [{x: "test x"}],
        nestedMap: [{x: "test x"}],
        nesteds: {x: "test x"},
    })).toEqual([
        {'message': 'Invalid type. Expected object, but got array', 'path': 'nested'},
        {'message': 'Invalid type. Expected object, but got array', 'path': 'nestedMap'},
        {'message': 'Invalid type. Expected array, but got object', 'path': 'nesteds'},
    ]);

    class BOptional {
        @Field()
        public type!: string;

        @Field(A)
        @Optional()
        public nested!: A;
    }

    expect(await validate(BOptional, {
        type: "test type",
    })).toEqual([]);

    expect(await validate(BOptional, {
        type: "test type",
        nested: false,
    })).toEqual([
        {'message': 'Invalid type. Expected object, but got boolean', 'path': 'nested'},
    ]);

});
