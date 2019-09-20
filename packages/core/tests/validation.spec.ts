import 'reflect-metadata';
import 'jest-extended'
import {
    AddValidator,
    Field,
    InlineValidator,
    MongoIdField,
    Optional,
    plainToClass,
    PropertyValidator,
    PropertyValidatorError,
    validate,
    validatedPlainToClass,
    ValidationError,
    ValidationFailed
} from "../";
import {CustomError, isPlainObject} from '@marcj/estdlib';
import {Decorated, FieldAny, FieldArray, getEntitySchema, UUIDField} from "../src/decorators";

test('test simple', async () => {
    class Page {
        constructor(
            @Field() public name: string,
            @Field() public age: number,
        ) {
        }
    }

    const errors = validate(Page, {name: 'peter'});
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
    expect(validate(Model, instance)).toBeArrayOfSize(1);
    expect(validate(Model, instance)).toEqual([{code: 'required', message: "Required value is undefined", path: 'name'}]);

    expect(validate(Model, {
        name: 'foo',
        map: true
    })).toEqual([{code: 'invalid_type', message: "Invalid type. Expected object, but got boolean", path: 'map'}]);
    expect(validate(Model, {
        name: 'foo',
        array: 233
    })).toEqual([{code: 'invalid_type', message: "Invalid type. Expected array, but got number", path: 'array'}]);

    instance.name = 'Pete';
    expect(validate(Model, instance)).toEqual([]);
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
    expect(validate(Model, instance)).toBeArrayOfSize(1);
    expect(validate(Model, instance)).toEqual([{code: 'required', message: "Required value is undefined", path: 'deep'}]);

    instance.deep = new Deep();
    expect(validate(Model, instance)).toEqual([{code: 'required', message: "Required value is undefined", path: 'deep.name'}]);

    instance.deep.name = 'defined';
    instance.deepArray.push(new Deep());
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: "Required value is undefined",
        path: 'deepArray.0.name'
    }]);

    instance.deepArray[0].name = 'defined';
    instance.deepMap.foo = new Deep();
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: "Required value is undefined",
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
        @Field()
        @AddValidator(MyValidator)
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
        @Field()
        @InlineValidator((value: string) => {
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
        @Field()
        @InlineValidator((value: string) => {
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
        @Field()
        @InlineValidator((value: string) => {
            if (value.length > 5) {
                return new PropertyValidatorError('too_long', 'Too long');
            }
        })
        id: string = '2';
    }

    expect(validate(Model, {id: '2'})).toEqual([]);
    expect(validate(Model, {id: '123456'})).toEqual([{code: 'too_long', message: 'Too long', path: 'id'}]);
});

test('test uuid', async () => {
    class Model {
        @UUIDField()
        public id!: string;
    }

    expect(validate(Model, {id: "4cac8ff9-4450-42c9-b736-e4d56f7a832d"})).toEqual([]);
    expect(validate(Model, {id: "4cac8ff9-4450-42c9-b736"})).toEqual([{code: 'invalid_uuid', message: 'No UUID given', path: 'id'}]);
    expect(validate(Model, {id: "xxxx"})).toEqual([{code: 'invalid_uuid', message: 'No UUID given', path: 'id'}]);
    expect(validate(Model, {id: ""})).toEqual([{code: 'invalid_uuid', message: 'No UUID given', path: 'id'}]);
    expect(validate(Model, {id: false})).toEqual([{code: 'invalid_uuid', message: 'No UUID given', path: 'id'}]);
    expect(validate(Model, {id: null})).toEqual([{code: 'required', message: 'Required value is undefined', path: 'id'}]);
    expect(validate(Model, {id: undefined})).toEqual([{code: 'required', message: 'Required value is undefined', path: 'id'}]);
});

test('test objectId', async () => {
    class Model {
        @MongoIdField()
        public id!: string;
    }

    expect(validate(Model, {id: "507f191e810c19729de860ea"})).toEqual([]);
    expect(validate(Model, {id: "507f191e810c19729de860"})).toEqual([{code: 'invalid_objectid', message: 'No Mongo ObjectID given', path: 'id'}]);
    expect(validate(Model, {id: "xxxx"})).toEqual([{code: 'invalid_objectid', message: 'No Mongo ObjectID given', path: 'id'}]);
    expect(validate(Model, {id: ""})).toEqual([{code: 'invalid_objectid', message: 'No Mongo ObjectID given', path: 'id'}]);
    expect(validate(Model, {id: false})).toEqual([{code: 'invalid_objectid', message: 'No Mongo ObjectID given', path: 'id'}]);
    expect(validate(Model, {id: null})).toEqual([{code: 'required', message: 'Required value is undefined', path: 'id'}]);
    expect(validate(Model, {id: undefined})).toEqual([{code: 'required', message: 'Required value is undefined', path: 'id'}]);
});

test('test boolean', async () => {
    class Model {
        @Field()
        public bo!: boolean;
    }

    expect(getEntitySchema(Model).getProperty('bo').type).toBe('boolean');

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
    expect(validate(Model, {bo: 'asdasd'})).toEqual([{code: 'invalid_boolean', message: 'No Boolean given', path: 'bo'}]);
    expect(validate(Model, {bo: 233})).toEqual([{code: 'invalid_boolean', message: 'No Boolean given', path: 'bo'}]);
    expect(validate(Model, {bo: {}})).toEqual([{code: 'invalid_boolean', message: 'No Boolean given', path: 'bo'}]);
    expect(validate(Model, {bo: []})).toEqual([{code: 'invalid_boolean', message: 'No Boolean given', path: 'bo'}]);
});

test('test Date', async () => {
    class Model {
        @Field(Date)
        public endTime!: Date;
    }

    const date = new Date("2019-03-19T10:41:45.000Z");

    expect(validate(Model, {endTime: "2019-03-19T10:38:59.072Z"})).toEqual([]);
    expect(validate(Model, {endTime: date.toJSON()})).toEqual([]);
    expect(validate(Model, {endTime: "Tue Mar 19 2019 11:39:10 GMT+0100 (Central European Standard Time)"})).toEqual([]);
    expect(validate(Model, {endTime: date.toString()})).toEqual([]);
    expect(validate(Model, {endTime: new Date()})).toEqual([]);
    expect(validate(Model, {endTime: ''})).toEqual([{code: 'invalid_date', message: 'No Date string given', path: 'endTime'}]);
    expect(validate(Model, {endTime: new Date('asdf')})).toEqual([{code: 'invalid_date', message: 'No valid Date given', path: 'endTime'}]);
    expect(validate(Model, {endTime: 'asdf'})).toEqual([{code: 'invalid_date', message: 'No valid Date string given', path: 'endTime'}]);
    expect(validate(Model, {endTime: null})).toEqual([{code: 'required', message: 'Required value is undefined', path: 'endTime'}]);
    expect(validate(Model, {endTime: undefined})).toEqual([{code: 'required', message: 'Required value is undefined', path: 'endTime'}]);

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
        expect(error.errors[0].message).toBe('Required value is undefined');
    }

    try {
        validatedPlainToClass(Model, {endTime: undefined});
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

    expect(validate(Model, {id: '2'})).toEqual([]);
    expect(validate(Model, {id: 2})).toEqual([{code: 'invalid_string', message: "No String given", path: 'id'}]);
    expect(validate(Model, {id: null})).toEqual([]);
    expect(validate(Model, {id: undefined})).toEqual([]); //because defaults are applied
    expect(validate(Model, {})).toEqual([]); //because defaults are applied

    class ModelOptional {
        @Field()
        @Optional()
        id?: string;
    }

    expect(validate(ModelOptional, {id: '2'})).toEqual([]);
    expect(validate(ModelOptional, {id: 2})).toEqual([{code: 'invalid_string', message: "No String given", path: 'id'}]);
    expect(validate(ModelOptional, {id: null})).toEqual([]);
    expect(validate(ModelOptional, {id: undefined})).toEqual([]);
    expect(validate(ModelOptional, {})).toEqual([]);
});

test('test number', async () => {
    class Model {
        @Field()
        id: number = 2;
    }

    expect(validate(Model, {id: 3})).toEqual([]);
    expect(validate(Model, {id: '3'})).toEqual([]);
    expect(validate(Model, {id: 'a'})).toEqual([{code: 'invalid_number', message: "No Number given", path: 'id'}]);
    expect(validate(Model, {id: undefined})).toEqual([]); //because defaults are applied
    expect(validate(Model, {id: null})).toEqual([]); //because defaults are applied
    expect(validate(Model, {})).toEqual([]); //because defaults are applied

    class ModelOptional {
        @Field()
        @Optional()
        id?: number;
    }

    expect(validate(ModelOptional, {id: 3})).toEqual([]);
    expect(validate(ModelOptional, {id: '3'})).toEqual([]);
    expect(validate(ModelOptional, {id: 'a'})).toEqual([{code: 'invalid_number', message: "No Number given", path: 'id'}]);
    expect(validate(ModelOptional, {id: null})).toEqual([]);
    expect(validate(ModelOptional, {id: undefined})).toEqual([]);
    expect(validate(ModelOptional, {})).toEqual([]);
});

test('test array', async () => {
    class AClass {
        @Field([String])
        public tags: string[] = [];
    }

    expect(validate(AClass, {tags: ['Hi']})).toEqual([]);
    expect(validate(AClass, {tags: ['hi', 2]})).toEqual([{code: 'invalid_string', message: "No String given", path: 'tags.1'}]);
});

test('test map', async () => {

    class AClass {
        @Field({String})
        public tags: {[k: string]: string} = {};
    }

    expect(validate(AClass, {tags: {'nix': 'yes'}})).toEqual([]);
    expect(validate(AClass, {tags: {'nix': 2}})).toEqual([{code: 'invalid_string', message: "No String given", path: 'tags.nix'}]);
});

test('test decorated', async () => {
    class JobInfo {
        @Field()
        name: string;

        @FieldAny()
        value: any;

        constructor(name: string, value: any) {
            this.name = name;
            this.value = value;
        }
    }

    class JobInfos {
        @Decorated()
        @FieldArray(JobInfo)
        public items: JobInfo[] = [];

        @Field()
        public thisFieldIsIgnored: string = '';

        protected map: { [name: string]: JobInfo } = {};

        constructor(items: JobInfo[] = []) {
            this.items = items;
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
        @Field(JobInfos)
        infos: JobInfos = new JobInfos();
    }

    expect(validate(AClass, {infos: []})).toEqual([]);
    expect(validate(AClass, {})).toEqual([]);
    expect(validate(AClass, {infos: []})).toEqual([]);

    expect(validate(AClass, {infos: ['string']})).toEqual([
        {code: 'required', message: "Required value is undefined", path: 'infos.0.name'},
        {code: 'required', message: "Required value is undefined", path: 'infos.0.value'},
    ]);

    expect(validate(AClass, {infos: [{}]})).toEqual([
        {code: 'required', message: "Required value is undefined", path: 'infos.0.name'},
        {code: 'required', message: "Required value is undefined", path: 'infos.0.value'},
    ]);

    expect(validate(AClass, {
        infos: [{name: 'foo', value: 'bar'}]
    })).toEqual([]);

    expect(validate(AClass, plainToClass(AClass, {infos: []}))).toEqual([]);
    expect(validate(AClass, plainToClass(AClass, {}))).toEqual([]);
    expect(validate(AClass, plainToClass(AClass, {infos: []}))).toEqual([]);

    expect(validate(AClass, plainToClass(AClass, {infos: ['string']}))).toEqual([
        {code: 'required', message: "Required value is undefined", path: 'infos.0.name'},
        {code: 'required', message: "Required value is undefined", path: 'infos.0.value'},
    ]);

    expect(validate(AClass, plainToClass(AClass, {infos: [{}]}))).toEqual([
        {code: 'required', message: "Required value is undefined", path: 'infos.0.name'},
        {code: 'required', message: "Required value is undefined", path: 'infos.0.value'},
    ]);

    expect(validate(AClass, plainToClass(AClass, {
        infos: [{name: 'foo', value: 'bar'}]
    }))).toEqual([]);
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

    expect(validate(B, {
        type: "test type",
    })).toEqual([
        {'message': 'Required value is undefined', code: 'required', 'path': 'nested'},
        {'message': 'Required value is undefined', code: 'required', 'path': 'nestedMap'},
        {'message': 'Required value is undefined', code: 'required', 'path': 'nesteds'},
    ]);

    expect(validate(B, {
        type: "test type",
        nested: [{x: "test x"}],
        nestedMap: [{x: "test x"}],
        nesteds: {x: "test x"},
    })).toEqual([
        {'message': 'Invalid type. Expected object, but got array', code: 'invalid_type', 'path': 'nested'},
        {'message': 'Invalid type. Expected object, but got array', code: 'invalid_type', 'path': 'nestedMap'},
        {'message': 'Invalid type. Expected array, but got object', code: 'invalid_type', 'path': 'nesteds'},
    ]);

    class BOptional {
        @Field()
        public type!: string;

        @Field(A)
        @Optional()
        public nested!: A;
    }

    expect(validate(BOptional, {
        type: "test type",
    })).toEqual([]);

    expect(validate(BOptional, {
        type: "test type",
        nested: false,
    })).toEqual([
        {'message': 'Invalid type. Expected object, but got boolean', code: 'invalid_type', 'path': 'nested'},
    ]);

});


test('test valdiation on real life case', () => {
    class NodeResourceReservation {
        @Field()
        reserved: number = 0;

        @Field()
        total: number = 0;
    }

    class JobAssignedResourcesGpu {
        constructor(
            @Field().asName('uuid') public uuid: string,
            @Field().asName('name') public name: string,
            @Field().asName('memory') public memory: number,
        ) {
        }
    }

    class JobAssignedResources {
        @Field()
        cpu: number = 0;

        @Field()
        memory: number = 0;

        @FieldArray(JobAssignedResourcesGpu)
        gpus: JobAssignedResourcesGpu[] = [];
    }

    class AssignedJobTaskInstance {
        constructor(
            @Field().asName('jobId') public jobId: string,
            @Field().asName('jobAccessToken') public jobAccessToken: string,
            @Field().asName('taskName') public taskName: string,
            @Field().asName('instance') public instance: number,
            @Field().asName('assignedResources') public assignedResources: JobAssignedResources,
        ) {}
    }

    class NodeGpuResource {
        @Field()
        reserved: boolean = false;

        /**
         * Value in GB.
         */
        @Field()
        memory: number = 1;

        constructor(
            @Field().asName('uuid') public uuid: string,
            @Field().asName('name') public name: string,
        ) {
        }
    }
    class NodeResources {
        @Field()
        cpu: NodeResourceReservation = new NodeResourceReservation;

        @Field()
        memory: NodeResourceReservation = new NodeResourceReservation;

        @FieldArray(NodeGpuResource)
        gpu: NodeGpuResource[] = [];

        @Field(AssignedJobTaskInstance).asMap()
        assignedJobTaskInstances: { [taskInstanceId: string]: AssignedJobTaskInstance } = {};
    }

    const object = {
        cpu: { reserved: 4, total: 6 },
        memory: { reserved: 4, total: 4 },
        gpu: [],
        assignedJobTaskInstances: {
            'a09be358-d6ce-477f-829a-0dc27219de34.0.main': {
                assignedResources: { cpu: 4, memory: 4, gpus: [] },
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
