import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import {
    getClassSchema,
    jsonSerializer,
    PropertySchema,
    PropertyValidator,
    PropertyValidatorError,
    t,
    validate,
    validatedPlainToClass,
    validates,
    validatesFactory,
    ValidationFailed,
    ValidationFailedItem
} from '../index';
import { CustomError, isPlainObject } from '@deepkit/core';
import { fail } from 'assert';

test('test simple', async () => {
    class Page {
        constructor(
            @t public name: string,
            @t public age: number,
        ) {
        }

        test1() {
        }
    }

    const data = { name: 'peter' };

    expect(validates(Page, data)).toBe(false);
    if (validates(Page, data)) {
        data.age = 1;
    }

    const pageValidates = validatesFactory(Page);
    expect(pageValidates(data)).toBe(false);
    if (pageValidates(data)) {
        data.age = 1;
    }

    const errors = validate(Page, { name: 'peter' });
    expect(errors.length).toBe(1);
    expect(errors[0]).toBeInstanceOf(ValidationFailedItem);
    expect(errors[0].message).toBe('Required value is undefined');
    expect(errors[0].path).toBe('age');
});

test('test required', async () => {

    class Model {
        @t
        id: string = '1';

        @t.required
        name!: string;

        @t.optional
        optional?: string;

        @t.map(String).optional
        map?: { [name: string]: string };

        @t.array(String).optional
        array?: string[];
    }

    const instance = new Model;
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: 'Required value is undefined',
        path: 'name'
    }]);

    const schema = getClassSchema(Model);
    expect(schema.getProperty('id').hasDefaultValue).toBe(true);

    expect(validate(Model, {
        name: 'foo',
        map: true
    })).toEqual([{ code: 'invalid_type', message: 'Type is not an object', path: 'map' }]);
    expect(validate(Model, {
        name: 'foo',
        array: 233
    })).toEqual([{ code: 'invalid_type', message: 'Type is not an array', path: 'array' }]);

    instance.name = 'Pete';
    expect(validate(Model, instance)).toEqual([]);
});


test('test deep', async () => {
    class Deep {
        @t.required
        name!: string;
    }

    class Model {
        @t
        id: string = '2';

        @t.type(Deep).required
        deep!: Deep;

        @t.array(Deep)
        deepArray: Deep[] = [];

        @t.map(Deep)
        deepMap: { [name: string]: Deep } = {};
    }

    const instance = new Model;
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: 'Required value is undefined',
        path: 'deep'
    }]);

    instance.deep = new Deep();
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: 'Required value is undefined',
        path: 'deep.name'
    }]);

    instance.deep.name = 'defined';
    instance.deepArray.push(new Deep());
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: 'Required value is undefined',
        path: 'deepArray.0.name'
    }]);

    instance.deepArray[0].name = 'defined';
    instance.deepMap.foo = new Deep();
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: 'Required value is undefined',
        path: 'deepMap.foo.name'
    }]);

    instance.deepMap.foo.name = 'defined';
    expect(validate(Model, instance)).toEqual([]);
});

test('test AddValidator', async () => {
    class MyValidator implements PropertyValidator {
        validate<T>(value: any) {
            if (value.length > 5) {
                throw new PropertyValidatorError('too_long', 'Too long');
            }
        }
    }

    class Model {
        @t.validator(MyValidator)
        id: string = '2';
    }

    expect(validate(Model, { id: '2' })).toEqual([]);
    expect(validate(Model, { id: '123456' })).toEqual([{ code: 'too_long', message: 'Too long', path: 'id' }]);
});

test('test inline validator throw Error', async () => {
    class MyError extends CustomError {
        constructor() {
            super('Too long');
        }
    }

    class Model {
        @t.validator((value: string) => {
            if (value.length > 5) {
                throw new MyError();
            }
        })
        id: string = '2';
    }

    expect(validate(Model, { id: '2' })).toEqual([]);
    expect(validate(Model, { id: '123456' })).toEqual([{ code: 'error', message: 'Too long', path: 'id' }]);
});

test('test inline validator throw string', async () => {
    class Model {
        @t.validator((value: string) => {
            if (value.length > 5) {
                throw 'Too long';
            }
        })
        id: string = '2';
    }

    expect(validate(Model, { id: '2' })).toEqual([]);
    expect(validate(Model, { id: '123456' })).toEqual([{ code: 'error', message: 'Too long', path: 'id' }]);
});

test('test inline validator', async () => {
    class Model {
        @t.validator((value: string, b: any, c: any) => {
            if (value.length > 5) throw new PropertyValidatorError('too_long', 'Too long');
        })
        id: string = '2';
    }

    expect(validate(Model, { id: '2' })).toEqual([]);
    expect(validate(Model, { id: '123456' })).toEqual([{ code: 'too_long', message: 'Too long', path: 'id' }]);
});


test('test inline validator PropertySchema', async () => {
    function validator(value: string, property: PropertySchema) {
        if (property.name !== 'id') throw new PropertyValidatorError('not_id', 'Only on id');
    }

    class Model1 {
        @t.validator(validator)
        id: string = '2';
    }

    class Model2 {
        @t.validator(validator)
        id2: string = '2';
    }

    expect(validate(Model1, { id: '2' })).toEqual([]);
    expect(validate(Model2, { id: '2' })).toEqual([{ code: 'not_id', message: 'Only on id', path: 'id2' }]);
});

test('test uuid', async () => {
    class Model {
        @t.uuid.required
        public id!: string;
    }

    expect(validate(Model, { id: '4cac8ff9-4450-42c9-b736-e4d56f7a832d' })).toEqual([]);
    expect(validate(Model, { id: '4cac8ff9-4450-42c9-b736' })).toEqual([{
        code: 'invalid_uuid',
        message: 'No UUID given',
        path: 'id'
    }]);
    expect(validate(Model, { id: 'xxxx' })).toEqual([{ code: 'invalid_uuid', message: 'No UUID given', path: 'id' }]);
    expect(validate(Model, { id: '' })).toEqual([{ code: 'invalid_uuid', message: 'No UUID given', path: 'id' }]);
    expect(validate(Model, { id: false })).toEqual([{ code: 'invalid_uuid', message: 'No UUID given', path: 'id' }]);
    expect(validate(Model, { id: null })).toEqual([{
        code: 'required',
        message: 'Required value is null',
        path: 'id'
    }]);
    expect(validate(Model, { id: undefined })).toEqual([{
        code: 'required',
        message: 'Required value is undefined',
        path: 'id'
    }]);
});

test('test objectId', async () => {
    class Model {
        @t.mongoId.required
        public id!: string;
    }

    expect(validate(Model, { id: '507f191e810c19729de860ea' })).toEqual([]);
    expect(validate(Model, { id: '507f191e810c19729de860' })).toEqual([{
        code: 'invalid_objectId',
        message: 'No Mongo ObjectID given',
        path: 'id'
    }]);
    expect(validate(Model, { id: 'xxxx' })).toEqual([{
        code: 'invalid_objectId',
        message: 'No Mongo ObjectID given',
        path: 'id'
    }]);
    expect(validate(Model, { id: '' })).toEqual([{
        code: 'invalid_objectId',
        message: 'No Mongo ObjectID given',
        path: 'id'
    }]);
    expect(validate(Model, { id: false })).toEqual([{
        code: 'invalid_objectId',
        message: 'No Mongo ObjectID given',
        path: 'id'
    }]);
    expect(validate(Model, { id: null })).toEqual([{
        code: 'required',
        message: 'Required value is null',
        path: 'id'
    }]);
    expect(validate(Model, { id: undefined })).toEqual([{
        code: 'required',
        message: 'Required value is undefined',
        path: 'id'
    }]);
});

test('test boolean', async () => {
    class Model {
        @t.required
        public bo!: boolean;
    }

    expect(getClassSchema(Model).getProperty('bo').type).toBe('boolean');

    expect(jsonSerializer.for(Model).deserialize({ bo: false }).bo).toBe(false);
    expect(jsonSerializer.for(Model).deserialize({ bo: true }).bo).toBe(true);
    expect(jsonSerializer.for(Model).deserialize({ bo: 'false' }).bo).toBe(false);
    expect(jsonSerializer.for(Model).deserialize({ bo: 'true' }).bo).toBe(true);
    expect(jsonSerializer.for(Model).deserialize({ bo: '1' }).bo).toBe(true);
    expect(jsonSerializer.for(Model).deserialize({ bo: '0' }).bo).toBe(false);
    expect(jsonSerializer.for(Model).deserialize({ bo: 1 }).bo).toBe(true);
    expect(jsonSerializer.for(Model).deserialize({ bo: 0 }).bo).toBe(false);

    expect(validate(Model, { bo: false })).toEqual([]);
    expect(validate(Model, { bo: true })).toEqual([]);
    expect(validate(Model, { bo: 'false' })).toEqual([]);
    expect(validate(Model, { bo: 'true' })).toEqual([]);
    expect(validate(Model, { bo: '1' })).toEqual([]);
    expect(validate(Model, { bo: '0' })).toEqual([]);
    expect(validate(Model, { bo: 1 })).toEqual([]);
    expect(validate(Model, { bo: 0 })).toEqual([]);
    expect(validate(Model, { bo: 0, e: undefined } as any)).toEqual([]);

    expect(validate(Model, { bo: '2' })).toEqual([{ code: 'invalid_boolean', message: 'No Boolean given', path: 'bo' }]);
    expect(validate(Model, { bo: 2 })).toEqual([{ code: 'invalid_boolean', message: 'No Boolean given', path: 'bo' }]);
    expect(validate(Model, { bo: 'asdasd' })).toEqual([{
        code: 'invalid_boolean',
        message: 'No Boolean given',
        path: 'bo'
    }]);
    expect(validate(Model, { bo: 233 })).toEqual([{ code: 'invalid_boolean', message: 'No Boolean given', path: 'bo' }]);
    expect(validate(Model, { bo: {} })).toEqual([{ code: 'invalid_boolean', message: 'No Boolean given', path: 'bo' }]);
    expect(validate(Model, { bo: [] })).toEqual([{ code: 'invalid_boolean', message: 'No Boolean given', path: 'bo' }]);
});

test('test Date', async () => {
    class Model {
        @t.type(Date).required
        public endTime!: Date;
    }

    const date = new Date('2019-03-19T10:41:45.000Z');

    expect(validate(Model, { endTime: '2019-03-19T10:38:59.072Z' })).toEqual([]);
    expect(validate(Model, { endTime: date.toJSON() })).toEqual([]);
    expect(validate(Model, { endTime: 'Tue Mar 19 2019 11:39:10 GMT+0100 (Central European Standard Time)' })).toEqual([]);
    expect(validate(Model, { endTime: date.toString() })).toEqual([]);
    expect(validate(Model, { endTime: new Date() })).toEqual([]);
    expect(validate(Model, { endTime: '' })).toEqual([{
        code: 'invalid_date',
        message: 'No Date string given',
        path: 'endTime'
    }]);
    expect(validate(Model, { endTime: new Date('asdf') })).toEqual([{
        code: 'invalid_date',
        message: 'No valid Date given',
        path: 'endTime'
    }]);
    expect(validate(Model, { endTime: 'asdf' })).toEqual([{
        code: 'invalid_date',
        message: 'No valid Date string given',
        path: 'endTime'
    }]);
    expect(validate(Model, { endTime: null })).toEqual([{
        code: 'required',
        message: 'Required value is null',
        path: 'endTime'
    }]);
    expect(validate(Model, { endTime: undefined })).toEqual([{
        code: 'required',
        message: 'Required value is undefined',
        path: 'endTime'
    }]);

    {
        const o = jsonSerializer.for(Model).deserialize({ endTime: date.toString() });
        expect(o.endTime).toEqual(date);
    }

    {
        const o = jsonSerializer.for(Model).deserialize({ endTime: date.toJSON() });
        expect(o.endTime).toEqual(date);
    }

    {
        const o = jsonSerializer.for(Model).deserialize({ endTime: null });
        expect(o.endTime).toBe(undefined);
    }

    {
        const o = jsonSerializer.for(Model).deserialize({ endTime: undefined });
        expect(o.endTime).toBe(undefined);
    }

    {
        const o = jsonSerializer.for(Model).validatedDeserialize({ endTime: '2019-03-19T10:41:45.000Z' });
        expect(o.endTime).toEqual(date);
    }

    try {
        jsonSerializer.for(Model).validatedDeserialize({ endTime: 'asd' });
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('No valid Date string given');
    }

    try {
        jsonSerializer.for(Model).validatedDeserialize({ endTime: '' });
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('No Date string given');
    }

    try {
        jsonSerializer.for(Model).validatedDeserialize({ endTime: null });
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('Required value is null');
    }

    try {
        jsonSerializer.for(Model).validatedDeserialize({ endTime: undefined });
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('Required value is undefined');
    }

});

test('test string', async () => {
    class Model {
        @t
        id: string = '2';
    }

    expect(validate(Model, { id: '2' })).toEqual([]);
    expect(validate(Model, { id: 2 })).toEqual([{ code: 'invalid_string', message: 'No string given', path: 'id' }]);
    expect(validate(Model, { id: null })).toEqual([{ code: 'required', message: 'Required value is null', path: 'id' }]); //because defaults are applied
    expect(validate(Model, { id: undefined })).toEqual([]); //because defaults are applied
    expect(validate(Model, {})).toEqual([]); //because defaults are applied

    class ModelOptional {
        @t.optional
        id?: string;
    }

    expect(validate(ModelOptional, { id: '2' })).toEqual([]);
    expect(validate(ModelOptional, { id: 2 })).toEqual([{
        code: 'invalid_string',
        message: 'No string given',
        path: 'id'
    }]);
    expect(validate(ModelOptional, { id: null })).toEqual([{ code: 'required', message: 'Required value is null', path: 'id' }]);
    expect(validate(ModelOptional, { id: undefined })).toEqual([]);
    expect(validate(ModelOptional, {})).toEqual([]);
});

test('test number', async () => {
    class Model {
        @t
        id: number = 2;
    }

    expect(validate(Model, { id: 3 })).toEqual([]);
    expect(validate(Model, { id: '3' })).toEqual([]);
    expect(validate(Model, { id: 'a' })).toEqual([{ code: 'invalid_number', message: 'No number given', path: 'id' }]);
    expect(validate(Model, { id: undefined })).toEqual([]); //because defaults are applied
    expect(validate(Model, { id: null })).toEqual([{ code: 'required', message: 'Required value is null', path: 'id' }]); //because defaults are applied
    expect(validate(Model, {})).toEqual([]); //because defaults are applied

    class ModelOptional {
        @t.optional
        id?: number;
    }

    expect(validate(ModelOptional, { id: 3 })).toEqual([]);
    expect(validate(ModelOptional, { id: '3' })).toEqual([]);
    expect(validate(ModelOptional, { id: 'a' })).toEqual([{
        code: 'invalid_number',
        message: 'No number given',
        path: 'id'
    }]);
    expect(validate(ModelOptional, { id: NaN })).toEqual([{ code: 'invalid_number', message: 'No valid number given, got NaN', path: 'id' }]);
    expect(validate(ModelOptional, { id: null })).toEqual([{ code: 'required', message: 'Required value is null', path: 'id' }]);
    expect(validate(ModelOptional, { id: undefined })).toEqual([]);
    expect(validate(ModelOptional, {})).toEqual([]);
});

test('test array', async () => {
    class AClass {
        @t.array(String)
        public tags: string[] = [];
    }

    expect(validate(AClass, { tags: ['Hi'] })).toEqual([]);
    expect(validate(AClass, { tags: ['hi', 2] })).toEqual([{
        code: 'invalid_string',
        message: 'No string given',
        path: 'tags.1'
    }]);
});

test('test map', async () => {

    class AClass {
        @t.map(String)
        public tags: { [k: string]: string } = {};
    }

    expect(validate(AClass, { tags: { 'nix': 'yes' } })).toEqual([]);
    expect(validate(AClass, { tags: { 'nix': 2 } })).toEqual([{
        code: 'invalid_string',
        message: 'No string given',
        path: 'tags.nix'
    }]);
});

test('test decorated', async () => {
    class JobInfo {
        @t
        name: string;

        @t
        value: string;

        constructor(name: string, value: any) {
            this.name = name;
            this.value = value;
        }
    }

    class JobInfos {
        @t
        public thisFieldIsIgnored: string = '';

        protected map: { [name: string]: JobInfo } = {};

        constructor(
            @t.array(JobInfo).optional.decorated.name('items')
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
        @t.type(JobInfos)
        infos: JobInfos = new JobInfos();
    }

    expect(validate(AClass, { infos: [] })).toEqual([]);
    expect(validate(AClass, {})).toEqual([]);
    expect(validate(AClass, { infos: [] })).toEqual([]);

    expect(validate(AClass, { infos: ['string'] })).toEqual([
        { code: 'invalid_type', message: 'Type is not an object', path: 'infos.0' },
    ]);

    expect(validate(AClass, { infos: [{}] })).toEqual([
        { code: 'required', message: 'Required value is undefined', path: 'infos.0.name' },
        { code: 'required', message: 'Required value is undefined', path: 'infos.0.value' },
    ]);

    expect(validate(AClass, {
        infos: [{ name: 'foo', value: 'bar' }]
    })).toEqual([]);

    expect(validate(AClass, jsonSerializer.for(AClass).deserialize({ infos: [] }))).toEqual([]);
    expect(validate(AClass, jsonSerializer.for(AClass).deserialize({}))).toEqual([]);
    expect(validate(AClass, jsonSerializer.for(AClass).deserialize({ infos: [] }))).toEqual([]);

    {
        expect(validate(AClass, { infos: ['string'] })).toEqual([
            { code: 'invalid_type', message: 'Type is not an object', path: 'infos.0' },
        ]);
        const item = jsonSerializer.for(AClass).deserialize({ infos: ['string'] });
        expect(item.infos.all()).toEqual([]);
        expect(validate(AClass, item)).toEqual([]);
    }

    {
        expect(validate(AClass, { infos: [{}] })).toEqual([
            { code: 'required', message: 'Required value is undefined', path: 'infos.0.name' },
            { code: 'required', message: 'Required value is undefined', path: 'infos.0.value' },
        ]);
        const item = jsonSerializer.for(AClass).deserialize({ infos: [{}] });
        expect(item.infos.all()).toEqual([{ name: undefined, value: undefined }]);
        expect(validate(AClass, item)).toEqual([
            { code: 'required', message: 'Required value is undefined', path: 'infos.0.name' },
            { code: 'required', message: 'Required value is undefined', path: 'infos.0.value' },
        ]);
    }

    expect(validate(AClass, jsonSerializer.for(AClass).deserialize({
        infos: [{ name: 'foo', value: 'bar' }]
    }))).toEqual([]);
});

test('test nested validation', async () => {
    // Class definition with validation rules
    class A {
        @t.required
        public x!: string;
    }

    class B {
        @t.required
        public type!: string;

        @t.type(A).required
        public nested!: A;

        @t.map(A).required
        public nestedMap!: { [name: string]: A };

        @t.array(A).required
        public nesteds!: A[];
    }

    expect(validate(B, {
        type: 'test type',
    })).toEqual([
        { 'message': 'Required value is undefined', code: 'required', 'path': 'nested' },
        { 'message': 'Required value is undefined', code: 'required', 'path': 'nestedMap' },
        { 'message': 'Required value is undefined', code: 'required', 'path': 'nesteds' },
    ]);

    expect(validate(B, {
        type: 'test type',
        nested: [{ x: 'test x' }],
        nestedMap: [{ x: 'test x' }],
        nesteds: { x: 'test x' },
    })).toEqual([
        { 'message': 'Type is not an object', code: 'invalid_type', 'path': 'nested' },
        { 'message': 'Type is not an object', code: 'invalid_type', 'path': 'nestedMap' },
        { 'message': 'Type is not an array', code: 'invalid_type', 'path': 'nesteds' },
    ]);

    class BOptional {
        @t.required
        public type!: string;

        @t.type(A).optional
        public nested!: A;
    }

    expect(validate(BOptional, {
        type: 'test type',
    })).toEqual([]);

    expect(validate(BOptional, {
        type: 'test type',
        nested: false,
    })).toEqual([
        { 'message': 'Type is not an object', code: 'invalid_type', 'path': 'nested' },
    ]);

    expect(validate(BOptional, {
        type: 'test type',
        nested: '',
    })).toEqual([
        { 'message': 'Type is not an object', code: 'invalid_type', 'path': 'nested' },
    ]);

});


test('test valdiation on real life case', () => {
    class NodeResourceReservation {
        @t
        reserved: number = 0;

        @t
        total: number = 0;
    }

    class JobAssignedResourcesGpu {
        constructor(
            @t.name('uuid') public uuid: string,
            @t.name('name') public name: string,
            @t.name('memory') public memory: number,
        ) {
        }
    }

    class JobAssignedResources {
        @t
        cpu: number = 0;

        @t
        memory: number = 0;

        @t.array(JobAssignedResourcesGpu)
        gpus: JobAssignedResourcesGpu[] = [];
    }

    class AssignedJobTaskInstance {
        constructor(
            @t.name('jobId') public jobId: string,
            @t.name('jobAccessToken') public jobAccessToken: string,
            @t.name('taskName') public taskName: string,
            @t.name('instance') public instance: number,
            @t.name('assignedResources') public assignedResources: JobAssignedResources,
        ) {
        }
    }

    class NodeGpuResource {
        @t
        reserved: boolean = false;

        /**
         * Value in GB.
         */
        @t
        memory: number = 1;

        constructor(
            @t.name('uuid') public uuid: string,
            @t.name('name') public name: string,
        ) {
        }
    }

    class NodeResources {
        @t
        cpu: NodeResourceReservation = new NodeResourceReservation;

        @t
        memory: NodeResourceReservation = new NodeResourceReservation;

        @t.array(NodeGpuResource)
        gpu: NodeGpuResource[] = [];

        @t.map(AssignedJobTaskInstance)
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

    jsonSerializer.for(NodeResources).deserialize(object);

    expect(isPlainObject(object.assignedJobTaskInstances['a09be358-d6ce-477f-829a-0dc27219de34.0.main'].assignedResources)).toBe(true);

    expect(validate(NodeResources, object)).toEqual([]);
});


test('nullable', () => {
    const s = t.schema({
        username: t.string,
        password: t.string.nullable,
        optional: t.string.optional,
    });

    expect(s.getProperty('username').isOptional).toBe(false);
    expect(s.getProperty('password').isOptional).toBe(false);
    expect(s.getProperty('optional').isOptional).toBe(true);

    expect(validate(s, { username: 'asd' })).toEqual([{ 'message': 'Required value is undefined', code: 'required', 'path': 'password' },]);
    expect(validate(s, { username: 'asd', password: null })).toEqual([]);
    expect(validate(s, { username: 'asd', password: 'null' })).toEqual([]);

    expect(validate(s, { username: 'asd', password: null, optional: null })).toEqual([{ 'message': 'Required value is null', code: 'required', 'path': 'optional' },]);
    expect(validate(s, { username: 'asd', password: null, optional: 'null' })).toEqual([]);
});

test('custom isRequired', () => {
    enum MyEnum {
        first, second
    }

    function isRequired() {
        return (value: any) => {
            if (value === undefined) throw new PropertyValidatorError('no', 'Sollte angegeben werden');
        };
    }

    class MyModel {
        @t.enum(MyEnum).optional.validator(isRequired()) enum?: MyEnum;
    }

    expect(validate(MyModel, { enum: MyEnum.second })).toEqual([]);
    expect(validate(MyModel, {})).toEqual([{ code: 'no', message: 'Sollte angegeben werden', path: 'enum' }]);
    expect(validate(MyModel, { enum: undefined })).toEqual([{ code: 'no', message: 'Sollte angegeben werden', path: 'enum' }]);
    expect(validate(MyModel, { enum: null })).toEqual([{ code: 'required', message: 'Required value is null', path: 'enum' }]);
});

test('custom isRequired null', () => {
    enum MyEnum {
        first, second
    }

    function isRequired() {
        return (value: any) => {
            if (value === null) throw new PropertyValidatorError('no', 'Sollte angegeben werden');
            return undefined;
        };
    }

    class MyModel {
        @t.enum(MyEnum).nullable.validator(isRequired()).required enum!: MyEnum;
    }

    expect(validate(MyModel, { enum: MyEnum.second })).toEqual([]);
    expect(validate(MyModel, {})).toEqual([{ code: 'required', message: 'Required value is undefined', path: 'enum' }]);
    expect(validate(MyModel, { enum: undefined })).toEqual([{ code: 'required', message: 'Required value is undefined', path: 'enum' }]);
    expect(validate(MyModel, { enum: null })).toEqual([{ code: 'no', message: 'Sollte angegeben werden', path: 'enum' }]);
});

test('defaults are not omitted when wrong value', async () => {
    const schema = t.schema({
        log: t.boolean.default(false),
    });

    expect(() => validatedPlainToClass(schema, {log: 'asda'} as any)).toThrow('No Boolean given');
    expect(() => jsonSerializer.for(schema).validatedDeserialize({log: 'asda'} as any)).toThrow('No Boolean given');
});
