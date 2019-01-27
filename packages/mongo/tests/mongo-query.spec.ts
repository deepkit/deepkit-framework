import 'jest';
import {NumberType, StringType} from "@marcj/marshal";
import {convertPlainQueryToMongo} from "..";

class Simple {
    @NumberType()
    public id!: number;

    @NumberType()
    public price!: number;

    @StringType()
    public label!: string;
}

test('simple', () => {
    const m = convertPlainQueryToMongo(Simple, {
        id: {$qt: '1'}
    });

    expect(m['id']['$qt']).toBe(1);
});

test('simple 2', () => {
    const m = convertPlainQueryToMongo(Simple, {id: {dif: 1}});
    expect(m).toEqual({id: {dif: 1}});
});

test('and', () => {
    const m = convertPlainQueryToMongo(Simple, {$and: [{id: '1'}, {id: '2'}]});
    expect(m).toEqual({$and: [{id: 1}, {id: 2}]});

    expect(m['$and'][0]['id']).toBe(1);
    expect(m['$and'][1]['id']).toBe(2);
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