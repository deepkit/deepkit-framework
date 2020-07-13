import 'jest-extended';
import 'reflect-metadata';
import {
    plainToClass,
    PropertyValidator,
    PropertyValidatorError,
    validate,
    validatedPlainToClass,
    validates,
    validatesFactory,
    ValidationError,
    ValidationFailed
} from "../index";
import {CustomError, isPlainObject} from '@super-hornet/core';
import {getClassSchema, f} from "../src/decorators";

test('test simple', async () => {
    class Page {
        constructor(
            @f public name: string,
            @f public age: number,
        ) {
        }

        test1() {}
    }

    const data = {name: 'peter'};

    expect(validates(Page, data)).toBe(false);
    if (validates(Page, data)) {
        data.age = 1;
    }

    const pageValidates = validatesFactory(Page);
    expect(pageValidates(data)).toBe(false);
    if (pageValidates(data)) {
        data.age = 1;
    }

    const errors = validate(Page, {name: 'peter'});
    expect(errors.length).toBe(1);
    expect(errors[0]).toBeInstanceOf(ValidationError);
    expect(errors[0].message).toBe('Required value is undefined or null');
    expect(errors[0].path).toBe('age');
});

test('test required', async () => {

    class Model {
        @f
        id: string = '1';

        @f
        name?: string;

        @f.optional()
        optional?: string;

        @f.map(String).optional()
        map?: { [name: string]: string };

        @f.array(String).optional()
        array?: string[];
    }

    const instance = new Model;
    expect(validate(Model, instance)).toBeArrayOfSize(1);
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: "Required value is undefined or null",
        path: 'name'
    }]);

    const schema = getClassSchema(Model);
    expect(schema.getProperty('id').hasDefaultValue).toBe(true);

    expect(validate(Model, {
        name: 'foo',
        map: true
    })).toEqual([{code: 'invalid_type', message: "Type is not an object", path: 'map'}]);
    expect(validate(Model, {
        name: 'foo',
        array: 233
    })).toEqual([{code: 'invalid_type', message: "Type is not an array", path: 'array'}]);

    instance.name = 'Pete';
    expect(validate(Model, instance)).toEqual([]);
});


test('test deep', async () => {
    class Deep {
        @f
        name?: string;
    }

    class Model {
        @f
        id: string = '2';

        @f.type(Deep)
        deep?: Deep;

        @f.array(Deep)
        deepArray: Deep[] = [];

        @f.map(Deep)
        deepMap: { [name: string]: Deep } = {};
    }

    const instance = new Model;
    expect(validate(Model, instance)).toBeArrayOfSize(1);
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: "Required value is undefined or null",
        path: 'deep'
    }]);

    instance.deep = new Deep();
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: "Required value is undefined or null",
        path: 'deep.name'
    }]);

    instance.deep.name = 'defined';
    instance.deepArray.push(new Deep());
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: "Required value is undefined or null",
        path: 'deepArray.0.name'
    }]);

    instance.deepArray[0].name = 'defined';
    instance.deepMap.foo = new Deep();
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: "Required value is undefined or null",
        path: 'deepMap.foo.name'
    }]);

    instance.deepMap.foo.name = 'defined';
    expect(validate(Model, instance)).toEqual([]);
});

test('test AddValidator', async () => {
    class MyValidator implements PropertyValidator {
        validate<T>(value: any): PropertyValidatorError | void {
            if (value.length > 5) {
                return new PropertyValidatorError('too_long', 'Too long');
            }
        }
    }

    class Model {
        @f.validator(MyValidator)
        id: string = '2';
    }

    expect(validate(Model, {id: '2'})).toEqual([]);
    expect(validate(Model, {id: '123456'})).toEqual([{code: 'too_long', message: 'Too long', path: 'id'}]);
});

test('test inline validator throw Error', async () => {
    class MyError extends CustomError {
        constructor() {
            super('Too long');
        }
    }

    class Model {
        @f.validator((value: string) => {
            if (value.length > 5) {
                throw new MyError();
            }
        })
        id: string = '2';
    }

    expect(validate(Model, {id: '2'})).toEqual([]);
    expect(validate(Model, {id: '123456'})).toEqual([{code: 'error', message: 'Too long', path: 'id'}]);
});

test('test inline validator throw string', async () => {
    class Model {
        @f.validator((value: string) => {
            if (value.length > 5) {
                throw 'Too long';
            }
        })
        id: string = '2';
    }

    expect(validate(Model, {id: '2'})).toEqual([]);
    expect(validate(Model, {id: '123456'})).toEqual([{code: 'error', message: 'Too long', path: 'id'}]);
});

test('test inline validator', async () => {
    class Model {
        @f.validator((value: string, b: any, c: any) => {
            if (value.length > 5) throw new PropertyValidatorError('too_long', 'Too long');
        })
        id: string = '2';
    }

    expect(validate(Model, {id: '2'})).toEqual([]);
    expect(validate(Model, {id: '123456'})).toEqual([{code: 'too_long', message: 'Too long', path: 'id'}]);
});

test('test uuid', async () => {
    class Model {
        @f.uuid()
        public id!: string;
    }

    expect(validate(Model, {id: "4cac8ff9-4450-42c9-b736-e4d56f7a832d"})).toEqual([]);
    expect(validate(Model, {id: "4cac8ff9-4450-42c9-b736"})).toEqual([{
        code: 'invalid_uuid',
        message: 'No UUID given',
        path: 'id'
    }]);
    expect(validate(Model, {id: "xxxx"})).toEqual([{code: 'invalid_uuid', message: 'No UUID given', path: 'id'}]);
    expect(validate(Model, {id: ""})).toEqual([{code: 'invalid_uuid', message: 'No UUID given', path: 'id'}]);
    expect(validate(Model, {id: false})).toEqual([{code: 'invalid_uuid', message: 'No UUID given', path: 'id'}]);
    expect(validate(Model, {id: null})).toEqual([{
        code: 'required',
        message: 'Required value is undefined or null',
        path: 'id'
    }]);
    expect(validate(Model, {id: undefined})).toEqual([{
        code: 'required',
        message: 'Required value is undefined or null',
        path: 'id'
    }]);
});

test('test objectId', async () => {
    class Model {
        @f.mongoId()
        public id!: string;
    }

    expect(validate(Model, {id: "507f191e810c19729de860ea"})).toEqual([]);
    expect(validate(Model, {id: "507f191e810c19729de860"})).toEqual([{
        code: 'invalid_objectId',
        message: 'No Mongo ObjectID given',
        path: 'id'
    }]);
    expect(validate(Model, {id: "xxxx"})).toEqual([{
        code: 'invalid_objectId',
        message: 'No Mongo ObjectID given',
        path: 'id'
    }]);
    expect(validate(Model, {id: ""})).toEqual([{
        code: 'invalid_objectId',
        message: 'No Mongo ObjectID given',
        path: 'id'
    }]);
    expect(validate(Model, {id: false})).toEqual([{
        code: 'invalid_objectId',
        message: 'No Mongo ObjectID given',
        path: 'id'
    }]);
    expect(validate(Model, {id: null})).toEqual([{
        code: 'required',
        message: 'Required value is undefined or null',
        path: 'id'
    }]);
    expect(validate(Model, {id: undefined})).toEqual([{
        code: 'required',
        message: 'Required value is undefined or null',
        path: 'id'
    }]);
});

test('test boolean', async () => {
    class Model {
        @f
        public bo!: boolean;
    }

    expect(getClassSchema(Model).getProperty('bo').type).toBe('boolean');

    expect(plainToClass(Model, {bo: false}).bo).toBe(false);
    expect(plainToClass(Model, {bo: true}).bo).toBe(true);
    expect(plainToClass(Model, {bo: 'false'}).bo).toBe(false);
    expect(plainToClass(Model, {bo: 'true'}).bo).toBe(true);
    expect(plainToClass(Model, {bo: '1'}).bo).toBe(true);
    expect(plainToClass(Model, {bo: '0'}).bo).toBe(false);
    expect(plainToClass(Model, {bo: 1}).bo).toBe(true);
    expect(plainToClass(Model, {bo: 0}).bo).toBe(false);

    expect(validate(Model, {bo: false})).toEqual([]);
    expect(validate(Model, {bo: true})).toEqual([]);
    expect(validate(Model, {bo: 'false'})).toEqual([]);
    expect(validate(Model, {bo: 'true'})).toEqual([]);
    expect(validate(Model, {bo: '1'})).toEqual([]);
    expect(validate(Model, {bo: '0'})).toEqual([]);
    expect(validate(Model, {bo: 1})).toEqual([]);
    expect(validate(Model, {bo: 0})).toEqual([]);
    expect(validate(Model, {bo: 0, e: undefined})).toEqual([]);

    expect(validate(Model, {bo: '2'})).toEqual([{code: 'invalid_boolean', message: 'No Boolean given', path: 'bo'}]);
    expect(validate(Model, {bo: 2})).toEqual([{code: 'invalid_boolean', message: 'No Boolean given', path: 'bo'}]);
    expect(validate(Model, {bo: 'asdasd'})).toEqual([{
        code: 'invalid_boolean',
        message: 'No Boolean given',
        path: 'bo'
    }]);
    expect(validate(Model, {bo: 233})).toEqual([{code: 'invalid_boolean', message: 'No Boolean given', path: 'bo'}]);
    expect(validate(Model, {bo: {}})).toEqual([{code: 'invalid_boolean', message: 'No Boolean given', path: 'bo'}]);
    expect(validate(Model, {bo: []})).toEqual([{code: 'invalid_boolean', message: 'No Boolean given', path: 'bo'}]);
});

test('test Date', async () => {
    class Model {
        @f.type(Date)
        public endTime!: Date;
    }

    const date = new Date("2019-03-19T10:41:45.000Z");

    expect(validate(Model, {endTime: "2019-03-19T10:38:59.072Z"})).toEqual([]);
    expect(validate(Model, {endTime: date.toJSON()})).toEqual([]);
    expect(validate(Model, {endTime: "Tue Mar 19 2019 11:39:10 GMT+0100 (Central European Standard Time)"})).toEqual([]);
    expect(validate(Model, {endTime: date.toString()})).toEqual([]);
    expect(validate(Model, {endTime: new Date()})).toEqual([]);
    expect(validate(Model, {endTime: ''})).toEqual([{
        code: 'invalid_date',
        message: 'No Date string given',
        path: 'endTime'
    }]);
    expect(validate(Model, {endTime: new Date('asdf')})).toEqual([{
        code: 'invalid_date',
        message: 'No valid Date given',
        path: 'endTime'
    }]);
    expect(validate(Model, {endTime: 'asdf'})).toEqual([{
        code: 'invalid_date',
        message: 'No valid Date string given',
        path: 'endTime'
    }]);
    expect(validate(Model, {endTime: null})).toEqual([{
        code: 'required',
        message: 'Required value is undefined or null',
        path: 'endTime'
    }]);
    expect(validate(Model, {endTime: undefined})).toEqual([{
        code: 'required',
        message: 'Required value is undefined or null',
        path: 'endTime'
    }]);

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
        expect(o.endTime).toBe(undefined);
    }

    {
        const o = plainToClass(Model, {endTime: undefined});
        expect(o.endTime).toBe(undefined);
    }

    {
        const o = validatedPlainToClass(Model, {endTime: '2019-03-19T10:41:45.000Z'});
        expect(o.endTime).toEqual(date);
    }

    try {
        validatedPlainToClass(Model, {endTime: 'asd'});
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('No valid Date string given');
    }

    try {
        validatedPlainToClass(Model, {endTime: ''});
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('No Date string given');
    }

    try {
        validatedPlainToClass(Model, {endTime: null});
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('Required value is undefined or null');
    }

    try {
        validatedPlainToClass(Model, {endTime: undefined});
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('Required value is undefined or null');
    }

});

test('test string', async () => {
    class Model {
        @f
        id: string = '2';
    }

    expect(validate(Model, {id: '2'})).toEqual([]);
    expect(validate(Model, {id: 2})).toEqual([{code: 'invalid_string', message: "No string given", path: 'id'}]);
    expect(validate(Model, {id: null})).toEqual([]);
    expect(validate(Model, {id: undefined})).toEqual([]); //because defaults are applied
    expect(validate(Model, {})).toEqual([]); //because defaults are applied

    class ModelOptional {
        @f.optional()
        id?: string;
    }

    expect(validate(ModelOptional, {id: '2'})).toEqual([]);
    expect(validate(ModelOptional, {id: 2})).toEqual([{
        code: 'invalid_string',
        message: "No string given",
        path: 'id'
    }]);
    expect(validate(ModelOptional, {id: null})).toEqual([]);
    expect(validate(ModelOptional, {id: undefined})).toEqual([]);
    expect(validate(ModelOptional, {})).toEqual([]);
});

test('test number', async () => {
    class Model {
        @f
        id: number = 2;
    }

    expect(validate(Model, {id: 3})).toEqual([]);
    expect(validate(Model, {id: '3'})).toEqual([]);
    expect(validate(Model, {id: 'a'})).toEqual([{code: 'invalid_number', message: "No number given", path: 'id'}]);
    expect(validate(Model, {id: undefined})).toEqual([]); //because defaults are applied
    expect(validate(Model, {id: null})).toEqual([]); //because defaults are applied
    expect(validate(Model, {})).toEqual([]); //because defaults are applied

    class ModelOptional {
        @f.optional()
        id?: number;
    }

    expect(validate(ModelOptional, {id: 3})).toEqual([]);
    expect(validate(ModelOptional, {id: '3'})).toEqual([]);
    expect(validate(ModelOptional, {id: 'a'})).toEqual([{
        code: 'invalid_number',
        message: "No number given",
        path: 'id'
    }]);
    expect(validate(ModelOptional, {id: null})).toEqual([]);
    expect(validate(ModelOptional, {id: undefined})).toEqual([]);
    expect(validate(ModelOptional, {})).toEqual([]);
});

test('test array', async () => {
    class AClass {
        @f.array(String)
        public tags: string[] = [];
    }

    expect(validate(AClass, {tags: ['Hi']})).toEqual([]);
    expect(validate(AClass, {tags: ['hi', 2]})).toEqual([{
        code: 'invalid_string',
        message: "No string given",
        path: 'tags.1'
    }]);
});

test('test map', async () => {

    class AClass {
        @f.map(String)
        public tags: { [k: string]: string } = {};
    }

    expect(validate(AClass, {tags: {'nix': 'yes'}})).toEqual([]);
    expect(validate(AClass, {tags: {'nix': 2}})).toEqual([{
        code: 'invalid_string',
        message: "No string given",
        path: 'tags.nix'
    }]);
});

test('test decorated', async () => {
    class JobInfo {
        @f
        name: string;

        @f
        value: string;

        constructor(name: string, value: any) {
            this.name = name;
            this.value = value;
        }
    }

    class JobInfos {
        @f
        public thisFieldIsIgnored: string = '';

        protected map: { [name: string]: JobInfo } = {};

        constructor(
            @f.array(JobInfo).optional().decorated().asName('items')
            public items: JobInfo[] = []
        ) {
        }

        public all(): JobInfo[] {
            return this.items;
        }

        public add(name: string, value: any) {
            if (this.map[name]) {
                this.map[name].value = value;
            } else {
                this.map[name] = new JobInfo(name, value);
                this.items.push(this.map[name]);
            }
        }

        public remove(name: string) {
            if (!this.map[name]) return;

            const index = this.items.indexOf(this.map[name]);
            this.items.splice(index, 1);
            delete this.map[name];
        }
    }

    class AClass {
        @f.type(JobInfos)
        infos: JobInfos = new JobInfos();
    }

    expect(validate(AClass, {infos: []})).toEqual([]);
    expect(validate(AClass, {})).toEqual([]);
    expect(validate(AClass, {infos: []})).toEqual([]);

    expect(validate(AClass, {infos: ['string']})).toEqual([
        {code: 'invalid_type', message: "Type is not an object", path: 'infos.0'},
    ]);

    expect(validate(AClass, {infos: [{}]})).toEqual([
        {code: 'required', message: "Required value is undefined or null", path: 'infos.0.name'},
        {code: 'required', message: "Required value is undefined or null", path: 'infos.0.value'},
    ]);

    expect(validate(AClass, {
        infos: [{name: 'foo', value: 'bar'}]
    })).toEqual([]);

    expect(validate(AClass, plainToClass(AClass, {infos: []}))).toEqual([]);
    expect(validate(AClass, plainToClass(AClass, {}))).toEqual([]);
    expect(validate(AClass, plainToClass(AClass, {infos: []}))).toEqual([]);

    {
        expect(validate(AClass, {infos: ['string']})).toEqual([
            {code: 'invalid_type', message: "Type is not an object", path: 'infos.0'},
        ]);
        const item = plainToClass(AClass, {infos: ['string']});
        expect(item.infos.all()).toEqual([]);
        expect(validate(AClass, item)).toEqual([]);
    }

    {
        expect(validate(AClass, {infos: [{}]})).toEqual([
            {code: 'required', message: "Required value is undefined or null", path: 'infos.0.name'},
            {code: 'required', message: "Required value is undefined or null", path: 'infos.0.value'},
        ]);
        const item = plainToClass(AClass, {infos: [{}]});
        expect(item.infos.all()).toEqual([{name: undefined, value: undefined}]);
        expect(validate(AClass, item)).toEqual([
            {code: 'required', message: "Required value is undefined or null", path: 'infos.0.name'},
            {code: 'required', message: "Required value is undefined or null", path: 'infos.0.value'},
        ]);
    }

    expect(validate(AClass, plainToClass(AClass, {
        infos: [{name: 'foo', value: 'bar'}]
    }))).toEqual([]);
});

test('test nested validation', async () => {
    // Class definition with validation rules
    class A {
        @f
        public x!: string;
    }

    class B {
        @f
        public type!: string;

        @f.type(A)
        public nested!: A;

        @f.map(A)
        public nestedMap!: { [name: string]: A };

        @f.array(A)
        public nesteds!: A[];
    }

    expect(validate(B, {
        type: "test type",
    })).toEqual([
        {'message': 'Required value is undefined or null', code: 'required', 'path': 'nested'},
        {'message': 'Required value is undefined or null', code: 'required', 'path': 'nestedMap'},
        {'message': 'Required value is undefined or null', code: 'required', 'path': 'nesteds'},
    ]);

    expect(validate(B, {
        type: "test type",
        nested: [{x: "test x"}],
        nestedMap: [{x: "test x"}],
        nesteds: {x: "test x"},
    })).toEqual([
        {'message': 'Type is not an object', code: 'invalid_type', 'path': 'nested'},
        {'message': 'Type is not an object', code: 'invalid_type', 'path': 'nestedMap'},
        {'message': 'Type is not an array', code: 'invalid_type', 'path': 'nesteds'},
    ]);

    class BOptional {
        @f
        public type!: string;

        @f.type(A).optional()
        public nested!: A;
    }

    expect(validate(BOptional, {
        type: "test type",
    })).toEqual([]);

    expect(validate(BOptional, {
        type: "test type",
        nested: false,
    })).toEqual([
        {'message': 'Type is not an object', code: 'invalid_type', 'path': 'nested'},
    ]);

    expect(validate(BOptional, {
        type: "test type",
        nested: '',
    })).toEqual([
        {'message': 'Type is not an object', code: 'invalid_type', 'path': 'nested'},
    ]);

});


test('test valdiation on real life case', () => {
    class NodeResourceReservation {
        @f
        reserved: number = 0;

        @f
        total: number = 0;
    }

    class JobAssignedResourcesGpu {
        constructor(
            @f.asName('uuid') public uuid: string,
            @f.asName('name') public name: string,
            @f.asName('memory') public memory: number,
        ) {
        }
    }

    class JobAssignedResources {
        @f
        cpu: number = 0;

        @f
        memory: number = 0;

        @f.array(JobAssignedResourcesGpu)
        gpus: JobAssignedResourcesGpu[] = [];
    }

    class AssignedJobTaskInstance {
        constructor(
            @f.asName('jobId') public jobId: string,
            @f.asName('jobAccessToken') public jobAccessToken: string,
            @f.asName('taskName') public taskName: string,
            @f.asName('instance') public instance: number,
            @f.asName('assignedResources') public assignedResources: JobAssignedResources,
        ) {
        }
    }

    class NodeGpuResource {
        @f
        reserved: boolean = false;

        /**
         * Value in GB.
         */
        @f
        memory: number = 1;

        constructor(
            @f.asName('uuid') public uuid: string,
            @f.asName('name') public name: string,
        ) {
        }
    }

    class NodeResources {
        @f
        cpu: NodeResourceReservation = new NodeResourceReservation;

        @f
        memory: NodeResourceReservation = new NodeResourceReservation;

        @f.array(NodeGpuResource)
        gpu: NodeGpuResource[] = [];

        @f.map(AssignedJobTaskInstance)
        assignedJobTaskInstances: { [taskInstanceId: string]: AssignedJobTaskInstance } = {};
    }

    const object = {
        cpu: {reserved: 4, total: 6},
        memory: {reserved: 4, total: 4},
        gpu: [],
        assignedJobTaskInstances: {
            'a09be358-d6ce-477f-829a-0dc27219de34.0.main': {
                assignedResources: {cpu: 4, memory: 4, gpus: []},
                instance: 0,
                taskName: 'main',
                jobAccessToken: 'af82a082-493f-4b1b-ad25-1948ccbe32cb',
                jobId: 'a09be358-d6ce-477f-829a-0dc27219de34'
            }
        }
    };

    plainToClass(NodeResources, object);

    expect(isPlainObject(object.assignedJobTaskInstances['a09be358-d6ce-477f-829a-0dc27219de34.0.main'].assignedResources)).toBeTrue();

    expect(validate(NodeResources, object)).toEqual([]);
});
