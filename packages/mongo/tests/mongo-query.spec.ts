import 'jest';
import {convertClassQueryToMongo, convertPlainQueryToMongo, propertyClassToMongo} from "..";
import {Field, Decorated} from "@marcj/marshal/src/decorators";

class SimpleConfig {
    @Decorated()
    @Field([String])
    items: string[] = [];

    constructor(items: string[] = []) {
        this.items = items;
    }
}

class Simple {
    @Field()
    public id!: number;

    @Field()
    public price!: number;

    @Field()
    public label!: string;

    @Field(SimpleConfig)
    public config: SimpleConfig = new SimpleConfig;
}

test('simple', () => {
    const fieldNames = {};
    const m = convertPlainQueryToMongo(Simple, {
        id: {$qt: '1'}
    }, fieldNames);

    expect(m['id']['$qt']).toBe(1);
    expect(Object.keys(fieldNames)).toEqual(['id']);
});

test('simple class query', () => {
    const partial = propertyClassToMongo(Simple, 'config', new SimpleConfig(['a', 'b']));
    expect(partial).toEqual(['a', 'b']);
    const fieldNames = {};

    const m = convertClassQueryToMongo(Simple, {
        id: {$qt: '1'},
        config: new SimpleConfig(['a', 'b'])
    }, fieldNames);

    expect(m['id']['$qt']).toBe(1);
    expect(m['config']).toEqual(['a', 'b']);
    expect(Object.keys(fieldNames)).toEqual(['id', 'config']);
});

test('simple class query array', () => {
    const partial = propertyClassToMongo(Simple, 'config', new SimpleConfig(['a', 'b']));
    expect(partial).toEqual(['a', 'b']);
    const fieldNames = {};

    const m = convertClassQueryToMongo(Simple, {
        $and: [{id: {$qt: '1'}}],
        $or: [{id: {$qt: '1'}}],
        $nor: [{id: {$qt: '1'}}],
        $not: [{id: {$qt: '1'}}],
    }, fieldNames);

    expect(m['$and'][0]['id']['$qt']).toBe(1);
    expect(m['$or'][0]['id']['$qt']).toBe(1);
    expect(m['$nor'][0]['id']['$qt']).toBe(1);
    expect(m['$not'][0]['id']['$qt']).toBe(1);
});

test('simple 2', () => {
    const m = convertPlainQueryToMongo(Simple, {id: {dif: 1}});
    expect(m).toEqual({id: {dif: 1}});
});

test('regex', () => {
    const fieldNames = {};
    const m = convertPlainQueryToMongo(Simple, {id: {$regex: /0-9+/}}, fieldNames);
    expect(m).toEqual({id: {$regex: /0-9+/}});
    expect(Object.keys(fieldNames)).toEqual(['id']);
});

test('and', () => {
    const fieldNames = {};
    const m = convertPlainQueryToMongo(Simple, {$and: [{id: '1'}, {id: '2'}]}, fieldNames);
    expect(m).toEqual({$and: [{id: 1}, {id: 2}]});

    expect(m['$and'][0]['id']).toBe(1);
    expect(m['$and'][1]['id']).toBe(2);
    expect(Object.keys(fieldNames)).toEqual(['id']);
});

test('in', () => {
    const m = convertPlainQueryToMongo(Simple, {id: {$in: ['1', '2']}});
    expect(m).toEqual({id: {$in: [1, 2]}});

    const m2 = convertPlainQueryToMongo(Simple, {id: {$nin: ['1', '2']}});
    expect(m2).toEqual({id: {$nin: [1, 2]}});

    const m3 = convertPlainQueryToMongo(Simple, {label: {$all: [1, '2']}});
    expect(m3).toEqual({label: {$all: ['1', '2']}});
});

test('complex', () => {
    const names = {};
    const m = convertPlainQueryToMongo(Simple, {$and: [{price: {$ne: '1.99'}}, {price: {$exists: true}}, {id: {$gt: '0'}}]}, names);

    expect(m).toEqual({$and: [{price: {$ne: 1.99}}, {price: {$exists: true}}, {id: {$gt: 0}}]});
    expect(Object.keys(names)).toEqual(['price', 'id']);
});

test('$or', () => {
    const m = convertPlainQueryToMongo(Simple, {$and: [{$or: [{id: 1}]}]});
    expect(m).toEqual({$and: [{$or: [{id: 1}]}]});
});

test('nested $or', () => {
    const m = convertPlainQueryToMongo(Simple, { $or: [ { id: { $lt: 20 } }, { price: 10 } ] } );
    expect(m).toEqual({ $or: [ { id: { $lt: 20 } }, { price: 10 } ] } );
});

test('not', () => {
    const m = convertPlainQueryToMongo(Simple, {$not: [{price: {$ne: '1.99'}}, {price: {$exists: true}}]});

    expect(m).toEqual({$not: [{price: {$ne: 1.99}}, {price: {$exists: true}}]});
});

test('excluded', () => {
    const excluded = ['$exists', '$mod', '$size', '$type', '$regex', '$where'];

    for (const e of excluded) {
        const obj = {label: {}};
        obj['label'][e] = true;
        const m = convertPlainQueryToMongo(Simple, obj);
        expect(m).toEqual(obj);
    }
});
