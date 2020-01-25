import 'jest';
import {convertClassQueryToMongo, convertPlainQueryToMongo, propertyClassToMongo} from "..";
import {f} from "@marcj/marshal/src/decorators";

class SimpleConfig {
    @f.array(String).decorated()
    items: string[] = [];

    constructor(items: string[] = []) {
        this.items = items;
    }
}
class SimpleConfigRef {
    @f name: string = '';

    constructor(@f.primary() public id: number) {
    }
}

class Simple {
    @f
    public id!: number;

    @f
    public price!: number;

    @f
    public label!: string;

    @f.type(SimpleConfig)
    public config: SimpleConfig = new SimpleConfig;

    @f.reference()
    public configRef?: SimpleConfigRef;
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

test('reference object query', () => {
    const fieldNames = {};

    const m = convertClassQueryToMongo(Simple, {
        configRef: new SimpleConfigRef(2),
    }, fieldNames);

    expect(m['configRefId']).toBe(2);
    expect(Object.keys(m)).toEqual(['configRefId']);
    expect(Object.keys(fieldNames)).toEqual(['configRefId']);
});

test('reference object query $in', () => {
    const fieldNames = {};

    const m = convertClassQueryToMongo(Simple, {
        configRef: {$in: [new SimpleConfigRef(2)]},
    }, fieldNames);

    expect(m['configRefId']['$in']).toEqual([2]);
    expect(Object.keys(m)).toEqual(['configRefId']);
    expect(Object.keys(fieldNames)).toEqual(['configRefId']);
});

test('simple class query array', () => {
    const partial = propertyClassToMongo(Simple, 'config', new SimpleConfig(['a', 'b']));
    expect(partial).toEqual(['a', 'b']);
    const fieldNames = {};

    const m = convertClassQueryToMongo(Simple, {
        $and: [{id: {$qt: '1'}}],
        $or: [{id: {$qt: '1'}}],
        $nor: [{id: {$qt: '1'}}],
        $not: [{configRef: {$qt: new SimpleConfigRef(2)}}],
    }, fieldNames);

    expect(m['$and'][0]['id']['$qt']).toBe(1);
    expect(m['$or'][0]['id']['$qt']).toBe(1);
    expect(m['$nor'][0]['id']['$qt']).toBe(1);
    expect(m['$not'][0]['configRefId']['$qt']).toBe(2);
    expect(Object.keys(fieldNames)).toEqual(['id', 'configRefId']);
});

test('convertClassQueryToMongo customMapping', () => {
    {
        const fieldNames = {};
        const m = convertClassQueryToMongo(Simple, {
            $and: [{id: {$join: '1,2,3,4'}}],
        }, fieldNames, {
            '$join': (name, value, fieldNamesMap) => {
                return value.split(',').map(v => Number(v));
            }
        });
        expect(fieldNames['id']).toBeUndefined();
        expect(m['$and'][0]['id']).toEqual([1, 2, 3, 4]);
    }

    {
        const fieldNames = {};
        const m = convertClassQueryToMongo(Simple, {
            $and: [{id: {$join: '1,2,3,4'}}],
        }, fieldNames, {
            '$join': (name, value, fieldNamesMap) => {
                fieldNamesMap[name] = true;
                return value.split(',').map(v => Number(v));
            }
        });
        expect(fieldNames['id']).toBe(true);
    }

    {
        const m = convertClassQueryToMongo(Simple, {
            id: {$join: '1,2,3,4'},
        }, {}, {
            '$join': (name, value) => {
                return value.split(',').map(v => Number(v));
            }
        });
        expect(m['id']).toEqual([1, 2, 3, 4]);
    }

    {
        const m = convertClassQueryToMongo(Simple, {
            id: {$join: '1,2,3,4'},
        }, {}, {
            '$join': (name, value) => {
                return undefined;
            }
        });
        expect(m['id']).toBeUndefined();
    }
});

test('simple 2', () => {
    const m = convertPlainQueryToMongo(Simple, {id: {dif: 1}});
    expect(m).toEqual({id: NaN});
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
    const m = convertPlainQueryToMongo(Simple, {$or: [{id: {$lt: 20}}, {price: 10}]});
    expect(m).toEqual({$or: [{id: {$lt: 20}}, {price: 10}]});
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
