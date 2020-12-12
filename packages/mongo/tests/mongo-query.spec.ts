import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {convertClassQueryToMongo, convertPlainQueryToMongo} from '../index';
import {t} from '@deepkit/type';
import {mongoSerializer} from '../src/mongo-serializer';

class SimpleConfig {
    @t.array(t.string).decorated
    items: string[] = [];

    constructor(items: string[] = []) {
        this.items = items;
    }
}

class SimpleConfigRef {
    @t name: string = '';

    constructor(@t.primary public id: number) {
    }
}

class Simple {
    @t
    public id!: number;

    @t
    public price!: number;

    @t
    public label!: string;

    @t.type(SimpleConfig)
    public config: SimpleConfig = new SimpleConfig;

    @t.reference()
    public configRef?: SimpleConfigRef;

    @t.array(t.string)
    public tags: string[] = [];
}

test('simple', () => {
    const fieldNames = {};
    const m = convertPlainQueryToMongo(Simple, {
        id: {$qt: '1'} as any
    }, fieldNames);

    expect(m['id']['$qt']).toBe(1);
    expect(Object.keys(fieldNames)).toEqual(['id']);
});

test('simple class query', () => {
    const partial = mongoSerializer.for(Simple).serializeProperty('config', new SimpleConfig(['a', 'b']));
    expect(partial).toEqual(['a', 'b']);
    const fieldNames = {};

    const m = convertClassQueryToMongo(Simple, {
        id: {$qt: '1'} as any,
        config: new SimpleConfig(['a', 'b'])
    }, fieldNames);

    expect(m.id!['$qt']).toBe(1);
    expect(m['config']).toEqual(['a', 'b']);
    expect(Object.keys(fieldNames)).toEqual(['id', 'config']);
});

test('reference object query', () => {
    const fieldNames = {};

    const m = convertClassQueryToMongo(Simple, {
        configRef: new SimpleConfigRef(2),
    }, fieldNames);

    expect(Object.keys(m)).toEqual(['configRef']);
    expect(m['configRef']).toBe(2);
    expect(Object.keys(fieldNames)).toEqual(['configRef']);
});

test('reference object query $in', () => {
    const fieldNames = {};

    const m = convertClassQueryToMongo(Simple, {
        configRef: {$in: [new SimpleConfigRef(2)]},
    }, fieldNames);

    expect(m['configRef']['$in']).toEqual([2]);
    expect(Object.keys(m)).toEqual(['configRef']);
    expect(Object.keys(fieldNames)).toEqual(['configRef']);
});

test('simple class query array', () => {
    const partial = mongoSerializer.for(Simple).serializeProperty('config', new SimpleConfig(['a', 'b']));
    expect(partial).toEqual(['a', 'b']);
    const fieldNames = {};

    const m = convertClassQueryToMongo(Simple, {
        $and: [{id: {$qt: '1'} as any}],
        $or: [{id: {$qt: '1'} as any}],
        $nor: [{id: {$qt: '1'} as any}],
        $not: [{configRef: {$qt: new SimpleConfigRef(2)}}],
    }, fieldNames);

    expect(m['$and'][0]['id']['$qt']).toBe(1);
    expect(m['$or'][0]['id']['$qt']).toBe(1);
    expect(m['$nor'][0]['id']['$qt']).toBe(1);
    expect(m['$not'][0]['configRef']['$qt']).toBe(2);
    expect(Object.keys(fieldNames)).toEqual(['id', 'configRef']);
});

test('convertClassQueryToMongo customMapping', () => {
    {
        const fieldNames: any = {};
        const m = convertClassQueryToMongo(Simple, {
            $and: [{id: {$join: '1,2,3,4'} as any}],
        }, fieldNames, {
            '$join': (name, value, fieldNamesMap) => {
                return value.split(',').map((v: string) => Number(v));
            }
        });
        expect(fieldNames['id']).toBeUndefined();
        expect(m['$and'][0]['id']).toEqual([1, 2, 3, 4]);
    }

    {
        const fieldNames: any = {};
        const m = convertClassQueryToMongo(Simple, {
            $and: [{id: {$join: '1,2,3,4'} as any}],
        }, fieldNames, {
            '$join': (name, value, fieldNamesMap) => {
                fieldNamesMap[name] = true;
                return value.split(',').map((v: string) => Number(v));
            }
        });
        expect(fieldNames['id']).toBe(true);
    }

    {
        const m = convertClassQueryToMongo(Simple, {
            id: {$join: '1,2,3,4'} as any,
        }, {}, {
            '$join': (name, value) => {
                return value.split(',').map((v: string) => Number(v));
            }
        });
        expect(m['id']).toEqual([1, 2, 3, 4]);
    }

    {
        const m = convertClassQueryToMongo(Simple, {
            id: {$join: '1,2,3,4'} as any,
        }, {}, {
            '$join': (name, value) => {
                return undefined;
            }
        });
        expect(m['id']).toBeUndefined();
    }
});

test('simple 2', () => {
    const m = convertPlainQueryToMongo(Simple, {id: {dif: 1} as any});
    expect(m).toEqual({id: NaN});
});

test('regex', () => {
    const fieldNames = {};
    const m = convertPlainQueryToMongo(Simple, {label: {$regex: /0-9+/}}, fieldNames);
    expect(m).toEqual({label: {$regex: /0-9+/}});
    expect(Object.keys(fieldNames)).toEqual(['label']);
});

test('and', () => {
    const fieldNames = {};
    const m = convertPlainQueryToMongo(Simple, {$and: [{id: '1'} as any, {id: '2'} as any]}, fieldNames);
    expect(m).toEqual({$and: [{id: 1}, {id: 2}]});

    expect(m['$and'][0]['id']).toBe(1);
    expect(m['$and'][1]['id']).toBe(2);
    expect(Object.keys(fieldNames)).toEqual(['id']);
});

test('$in', () => {
    const m = convertPlainQueryToMongo(Simple, {id: {$in: ['1', '2'] as any}});
    expect(m).toEqual({id: {$in: [1, 2]}});

    const m2 = convertPlainQueryToMongo(Simple, {id: {$nin: ['1', '2'] as any}});
    expect(m2).toEqual({id: {$nin: [1, 2]}});
});

test('implicit array item', () => {
    const m = convertPlainQueryToMongo(Simple, {tags: "one"});
    expect(m).toEqual({tags: "one"});

    const m2 = convertPlainQueryToMongo(Simple, {tags: 3 as any});
    expect(m2).toEqual({tags: "3"});
});

test('$all', () => {
    const m = convertPlainQueryToMongo(Simple, {tags: {$all: ['one', 'two', 3] as any}});
    expect(m).toEqual({tags: {$all: ['one', 'two', '3']}});

    const m2 = convertPlainQueryToMongo(Simple, {tags: {$not: {$all: ['one', 'two', 3] as any}}});
    expect(m2).toEqual({tags: {$not: {$all: ['one', 'two', '3']}}});

    const m3 = convertPlainQueryToMongo(Simple, {tags: {$not: {$all: [['one', 'two', 3]] as any}}});
    expect(m3).toEqual({tags: {$not: {$all: [['one', 'two', '3']]}}});
});

test('complex', () => {
    const names = {};
    const m = convertPlainQueryToMongo(Simple, {$and: [{price: {$ne: '1.99'} as any}, {price: {$exists: true}}, {id: {$gt: '0'} as any}]}, names);

    expect(m).toEqual({$and: [{price: {$ne: 1.99}}, {price: {$exists: true}}, {id: {$gt: 0}}]});
    expect(Object.keys(names)).toEqual(['price', 'id']);
});


test('complex 2', () => {
    const names = {};
    const date = new Date();

    class NodeCluster {
        @t connected: boolean = false;
        @t disabled: boolean = false;
        @t lastConnectionTry?: Date;
    }

    const m = convertPlainQueryToMongo(NodeCluster, {
        $and: [
            {connected: false, disabled: {$ne: true}},
            {$or: [{lastConnectionTry: {$exists: false}}, {lastConnectionTry: {$lt: date}}]}
        ]
    }, names);

    expect(m).toEqual({
        $and: [
            {connected: false, disabled: {$ne: true}},
            {$or: [{lastConnectionTry: {$exists: false}}, {lastConnectionTry: {$lt: date}}]}
        ]
    });
    expect(Object.keys(names)).toEqual(['connected', 'disabled', 'lastConnectionTry']);
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
        const obj: any = {label: {}};
        obj['label'][e] = true;
        const m = convertPlainQueryToMongo(Simple, obj);
        expect(m).toEqual(obj);
    }
});
