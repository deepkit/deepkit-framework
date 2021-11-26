import { expect, test } from '@jest/globals';
import { ReceiveType, ReflectionClass } from '../../../src/reflection/reflection';
import { AutoIncrement, BackReference, MongoId, PrimaryKey, Reference, stringifyType, UUID } from '../../../src/reflection/type';
import { cast, serialize } from '../../../src/serializer-facade';
import { resolvePacked } from '../../../src/reflection/processor';

(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

/**
 * When the value is not existent anymore (don't confuse with being undefined.).
 * Equal to check with `in`.
 */
export const RoundTripExcluded: unique symbol = Symbol('NoValue');

export function roundTrip<T>(value: T | any, type?: ReceiveType<T>): T {
    console.log('roundTrip', stringifyType(resolvePacked(type!)));
    const json = serialize(value, {}, undefined, type);
    const res = cast<T>(json, {}, undefined, type);
    return res;
}

export function serializeToJson<T>(value: T | any, type?: ReceiveType<T>): T {
    const json = serialize(value, {}, undefined, type);
    return json;
}

export function deserializeFromJson<T>(value: T, type?: ReceiveType<T>): T {
    const res = cast<T>(value, {}, undefined, type);
    return res;
}

enum MyEnum {
    a, b, c
}

class Config {
    color: string = '#fff';
    big: boolean = false;
}

class Model {
    id: number = 0;
    title: string = '';
    config?: Config;
}

test('basics with value', () => {
    expect(roundTrip<string>('asd')).toBe('asd');
    expect(roundTrip<number>(22)).toBe(22);
    expect(roundTrip<boolean>(false)).toBe(false);
    expect(roundTrip<Date>(new Date)).toBeInstanceOf(Date);
});

test('model', () => {
    {
        const item = new Model;
        item.id = 23;
        item.title = '2322';
        const back = roundTrip<Model>(item);
        expect(back).toEqual({ id: 23, title: '2322' });
        expect(back).toBeInstanceOf(Model);
    }
});

test('with implicit default value', () => {
    const defaultDate = new Date;

    class Product {
        id: number = 0;

        created: Date = defaultDate;
    }

    //having a default value doesn't mean we are optional;
    expect(ReflectionClass.from(Product).getProperty('created')!.isOptional()).toBe(false);

    expect(roundTrip<Product>( { id: 23 } as any)).toEqual({ id: 23, created: defaultDate });
    expect(roundTrip<Product>({ id: 23, created: undefined } as any)).toEqual({ id: 23, created: defaultDate });

    expect(roundTrip<Partial<Product>>({ id: 23 } as any)).toEqual({ id: 23 });
    expect(roundTrip<Partial<Product>>({ id: 23, created: undefined } as any)).toEqual({ id: 23 });

    //not set properties are omitted
    expect('created' in roundTrip<Partial<Product>>({ id: 23 } as any)).toEqual(false);

    //we need to keep undefined values otherwise there is not way to reset a value
    //for JSON/BSON on the transport layer is null used to communicate the fact that we set explicitly `created` to undefined
    expect('created' in roundTrip<Partial<Product>>({ id: 23, created: undefined } as any)).toEqual(true);
});

test('partial keeps explicitely undefined fields', () => {
    expect(roundTrip<Partial<Model>>({})).toEqual({});
    expect('name' in roundTrip<Partial<Model>>({})).toBe(false);
    expect(roundTrip<Partial<Model>>({ title: undefined })).toEqual({ title: undefined });

    {
        const item = serializeToJson<Partial<Model>>({ title: undefined });
        console.log('item', item);
    }

    {
        const item = roundTrip<Partial<Model>>({ title: undefined });
        expect('title' in item).toBe(true); //all fields in partial become optional
    }

    {
        const item = roundTrip<Partial<Model>>({});
        expect('title' in item).toBe(false);
    }

    class Purchase {
        id: number & PrimaryKey & AutoIncrement = 0;

        sentAt?: Date;
        canceledAt?: Date;
    }

    expect(roundTrip<Partial<Purchase>>({ sentAt: undefined })).toEqual({ sentAt: undefined });
    expect('sentAt' in roundTrip<Partial<Purchase>>({ sentAt: undefined })).toEqual(true);
});

test('map removes undefined when not allowed', () => {
    expect(roundTrip<Record<string, string>>({})).toEqual({});
    expect(roundTrip<Record<string, string>>({ foo: 'bar' })).toEqual({ foo: 'bar' });
    expect(roundTrip<Record<string, string>>({ foo: undefined } as any)).toEqual({});
    expect('foo' in roundTrip<Record<string, string>>({ foo: undefined } as any)).toEqual(false);
});

// test('map allows undefined when allowed', () => {
//     expect(roundTrip<Record<string, string | undefined>>({})).toEqual({});
//     expect(roundTrip<Record<string, string | undefined>>({ foo: 'bar' })).toEqual({ foo: 'bar' });
//     expect(roundTrip<Record<string, string | undefined>>({ foo: undefined } as any)).toEqual({ foo: undefined });
//     expect('foo' in roundTrip<Record<string, string | undefined>>({ foo: undefined } as any)).toEqual(true);
// });
//
// test('bigint', () => {
//     expect(roundTrip<bigint>(0n)).toEqual(0n);
//     expect(roundTrip<bigint>(5n)).toEqual(5n);
//     expect(roundTrip<bigint>(12n)).toEqual(12n);
//     expect(roundTrip<bigint>(12012020202020202020202020202020202020n)).toEqual(12012020202020202020202020202020202020n);
//     expect(roundTrip<bigint>(16n ** 16n ** 2n)).toEqual(16n ** 16n ** 2n);
//     expect(roundTrip<bigint>(16n ** 16n ** 3n)).toEqual(16n ** 16n ** 3n);
// });
// //
// // test('propertyDefinition', () => {
// //     const property = t.string.optional.default('asd').buildPropertySchema();
// //     const json = property.toJSONNonReference();
// //     expect(roundTrip(propertyDefinition, json)).toEqual(json);
// // });
//
// test('union basics', () => {
//     expect(roundTrip<string | number>('asd')).toEqual('asd');
//     expect(roundTrip<string | number>(23)).toEqual(23);
//
//     expect(roundTrip<boolean | number>(true)).toEqual(true);
//     expect(roundTrip<boolean | number>(23)).toEqual(23);
//
//     expect(roundTrip<bigint | number>(23)).toEqual(23);
//     expect(roundTrip<bigint | number>(23n)).toEqual(23n);
//
//     expect(roundTrip<string | Model>(new Model)).toBeInstanceOf(Model);
//     {
//         const item = new Model;
//         item.id = 23;
//         item.title = '23';
//         const back = roundTrip<string | Model>(item);
//         expect(back).toEqual({ id: 23, title: '23' });
//     }
//
//     {
//         const item = new Model;
//         item.id = 23;
//         item.title = '23';
//         const back = roundTrip<Model>(item);
//         expect(back).toEqual({ id: 23, title: '23' });
//     }
//
//     expect(roundTrip<string | Model>('asd')).toEqual('asd');
//
//     expect(roundTrip<string | Model | undefined>(undefined)).toEqual(undefined);
//     expect(roundTrip<string | Model | undefined>(null)).toEqual(undefined);
//
//     expect(roundTrip<string | Model | null>(undefined)).toEqual(null);
//     expect(roundTrip<string | Model | null>(null)).toEqual(null);
// });
//
// test('union 2', () => {
//     interface s {
//         type: 'm';
//         name: string;
//     }
//
//     expect(deserializeFromJson<undefined | s>({ type: 'm', name: 'Peter' })).toEqual({ type: 'm', name: 'Peter' });
//     expect(deserializeFromJson<undefined | s>({ name: 'Peter' } as any)).toEqual({ type: 'm', name: 'Peter' });
//
//     expect(serializeToJson<undefined | s>({ type: 'm', name: 'Peter' })).toEqual({ type: 'm', name: 'Peter' });
//     expect(serializeToJson<undefined | s>({ name: 'Peter' } as any)).toEqual({ type: 'm', name: 'Peter' });
//
//     expect(roundTrip<undefined | s>({ type: 'm', name: 'Peter' })).toEqual({ type: 'm', name: 'Peter' });
//     expect(roundTrip<undefined | s>({ name: 'Peter' } as any)).toEqual({ type: 'm', name: 'Peter' });
// });
//
// test('union 3', () => {
//     expect(roundTrip<string | Model>('asd')).toBe('asd');
//     expect(roundTrip<string | Model>({ title: 'foo' } as any)).toBeInstanceOf(Model);
//
//     expect(deserializeFromJson<string | Model>('asd')).toBe('asd');
//     expect(deserializeFromJson<string | Model>({ title: 'foo' } as any)).toEqual({ id: 0, title: 'foo' });
//
//     expect(deserializeFromJson<string | Model | undefined>(undefined)).toBe(undefined);
//     expect(deserializeFromJson<string | Model | null>(null)).toBe(null);
//
//     expect(serializeToJson<string | Model>('asd')).toBe('asd');
//     expect(serializeToJson<string | Model>({ title: 'foo' } as any)).toEqual({ title: 'foo' });
//
//     expect(serializeToJson<string | Model | undefined>(undefined)).toBe(null);
//     expect(serializeToJson<string | Model | null>(null)).toBe(null);
// });
//
// test('model 1', () => {
//     class Model {
//         //filter is not used yet
//         filter?: Record<any, any>;
//
//         skip?: number;
//
//         itemsPerPage: number = 50;
//
//         limit?: number;
//
//         parameters: { [name: string]: any } = {};
//
//         sort?: Record<any, any>;
//     }
//
//     {
//         const model = { filter: { $regex: /Peter/ }, itemsPerPage: 50, parameters: {} };
//         expect(roundTrip<Model>(model as any)).toEqual(model);
//     }
//
//     {
//         const model = {
//             itemsPerPage: 50,
//             parameters: { teamName: 'Team a' },
//             filter: undefined,
//             skip: undefined,
//             limit: undefined,
//             sort: undefined
//         };
//         expect(roundTrip<Model>(model as any)).toEqual(model);
//     }
// });
//
// class Team {
//     id: number & PrimaryKey & AutoIncrement = 0;
//     version: number = 0;
//     lead: User & Reference | undefined;
//
//     constructor(public name: string) {
//     }
// }
//
// class User {
//     id: number & PrimaryKey & AutoIncrement = 0;
//     version: number = 0;
//     teams: Team[] & BackReference<UserTeam> = [];
//
//     constructor(public name: string) {
//     }
// }
//
// class UserTeam {
//     id: number & PrimaryKey & AutoIncrement = 0;
//
//     version: number = 0;
//
//     constructor(
//         public team: Team & Reference,
//         public user: User & Reference,
//     ) {
//     }
// }
//
// test('relation 1', () => {
//     {
//         const user = new User('foo');
//         expect(roundTrip<User>(user)).toEqual(user);
//     }
//
//     {
//         const team = new Team('foo');
//         expect(roundTrip<Team>(team)).toEqual(team);
//     }
//
//     {
//         const team = new Team('foo');
//         const user = new User('foo');
//         user.id = 12;
//         team.lead = user;
//         expect(serializeToJson<Team>(team)).toEqual(team);
//         expect(deserializeFromJson<Team>(team)).toEqual(team);
//         expect(roundTrip<Team>(team)).toEqual(team);
//     }
//
//     {
//         const team = new Team('foo');
//         team.id = 1;
//         team.version = 2;
//         //todo, restore that
//         // team.lead = createReference(User, { id: 12 });
//         const json = { id: 1, version: 2, name: 'foo', lead: 12 as any };
//
//         expect(serializeToJson<Team>(team)).toEqual(json);
//         expect(deserializeFromJson<Team>(json)).toEqual(team);
//         expect(roundTrip<Team>(team)).toEqual(team);
//     }
// });
//
//
// test('relation 2', () => {
//     //todo: restore that
//     // {
//     //     const user = new User('foo');
//     //     user.teams = unpopulatedSymbol as any; //emulates an unpopulated relation
//     //     const user2 = cloneClass(user);
//     //     user2.teams = [];
//     //     expect(roundTrip<User>(user)).toEqual(user2);
//     // }
//
//     {
//         const user = new User('foo');
//         user.teams.push(new Team('bar'));
//         expect(serializeToJson<User>(user)).toEqual(user);
//         expect(roundTrip<User>(user)).toEqual(user);
//     }
//
//     {
//         const items: User[] = [
//             cast<User>({
//                 name: 'Peter 1',
//                 id: '3f217d3d-4dc4-478f-a969-31e02de37190',
//                 version: 0,
//             }),
//             cast<User>({
//                 name: 'Peter 2',
//                 id: '48f7e8a2-3342-4cee-8de0-c41dcb557454',
//                 version: 0,
//             }),
//             cast<User>({
//                 name: 'Marc 1',
//                 id: 'f673a85b-c31d-41b5-8ccd-67f2bbc2d02e',
//                 version: 0,
//             })
//         ];
//
//         expect(roundTrip<User[]>(items)).toEqual(items);
//     }
// });
//
// test('invalid', () => {
//     expect(roundTrip<string & UUID>(new Model as any)).toEqual(RoundTripExcluded);
// });
//
// test('regex', () => {
//     expect(roundTrip<any>(/foo/)).toEqual(/foo/);
// });
//
// test('explicitely set undefined on optional triggers default value', () => {
//     class Product {
//         id: number = 0;
//         created?: Date = new Date;
//     }
//
//     //no value means the default triggers
//     expect(roundTrip<Product>({ id: 23 }).created).toBeInstanceOf(Date);
//
//     //this is important for database patches
//     expect(roundTrip<Product>({ id: 23, created: undefined }).created).toBe(undefined);
//     expect('created' in roundTrip<Product>({ id: 23, created: undefined })).toBe(true);
// });
//
// test('partial explicitely set undefined on optional is handled', () => {
//     class Product {
//         id: number = 0;
//         created?: Date = new Date;
//     }
//
//     //no value means the default triggers
//     expect(roundTrip<Partial<Product>>({ id: 23 }).created).toBe(undefined);
//
//     //this is important for database patches
//     expect(roundTrip<Partial<Product>>({ id: 23, created: undefined }).created).toBe(undefined);
//     expect('created' in roundTrip<Partial<Product>>({ id: 23, created: undefined })).toBe(true);
// });
//
// test('partial explicitely set undefined on required is not ignored', () => {
//     class Product {
//         id: number = 0;
//         created: Date = new Date;
//     }
//
//     //no value means the default triggers
//     expect(roundTrip<Partial<Product>>({ id: 23 }).created).toBe(undefined);
//
//     //this is important for database patches
//     //important to keep undefined, as t.partial() makes all properties optional, no matter what it originally was, otherwise it would be a partial
//     expect(roundTrip<Partial<Product>>({ id: 23, created: undefined }).created).toBe(undefined);
//     expect('created' in roundTrip<Partial<Product>>({ id: 23, created: undefined } as any)).toBe(true);
// });
//
// test('explicitely set undefined on required is ignored', () => {
//     class Product {
//         id: number = 0;
//         created: Date = new Date;
//     }
//
//     expect(roundTrip<Product>({ id: 23 } as any).created).toBeInstanceOf(Date);
//     expect(roundTrip<Product>({ id: 23, created: undefined } as any).created).toBeInstanceOf(Date);
// });
//
// test('partial does not return the model on root', () => {
//     expect(roundTrip<Partial<Model>>({ id: 23 } as any)).toEqual({ id: 23 });
//     expect(roundTrip<Partial<Model>>({ id: 23 } as any)).not.toBeInstanceOf(Model);
// });
//
// test('partial returns the model at second level', () => {
//     const config = new Config;
//     config.color = 'red';
//
//     expect(roundTrip<Partial<Model>>({ id: 23, config: config } as any)).toEqual({
//         id: 23,
//         config: { big: false, color: 'red' }
//     });
//     expect(roundTrip<Partial<Model>>({ id: 23, config: config } as any).config).toBeInstanceOf(Config);
// });
//
// test('partial allowed undefined', () => {
//     class Product {
//         id: number = 0;
//         created?: Date;
//     }
//
//     expect(roundTrip<Partial<Product>>({ id: 23, created: undefined } as any)).not.toBeInstanceOf(Product);
//
//     expect(roundTrip<Partial<Product>>({ id: 23 } as any).created).toBe(undefined);
//     expect('created' in roundTrip<Partial<Product>>({ id: 23 } as any)).toBe(false);
//
//     //important for database patches
//     expect(roundTrip<Partial<Product>>({ id: 23, created: undefined } as any).created).toBe(undefined);
//     expect('created' in roundTrip<Partial<Product>>({ id: 23, created: undefined } as any)).toBe(true);
// });
//
// test('optional basics', () => {
//     expect(roundTrip<string | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<string | undefined>(null)).toBe(undefined);
//
//     expect(roundTrip<number | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<number | undefined>(null)).toBe(undefined);
//
//     expect(roundTrip<boolean | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<boolean | undefined>(null)).toBe(undefined);
//
//     expect(roundTrip<UUID | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<UUID | undefined>(null)).toBe(undefined);
//
//     expect(roundTrip<MongoId | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<MongoId | undefined>(null)).toBe(undefined);
//
//     expect(roundTrip<Date | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<Date | undefined>(null)).toBe(undefined);
//
//     expect(roundTrip<Record<string, string> | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<Record<string, string> | undefined>(null)).toBe(undefined);
//
//     expect(roundTrip<any[] | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<any[] | undefined>(null)).toBe(undefined);
//
//     expect(roundTrip<Partial<{ a: string }> | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<Partial<{ a: string }> | undefined>(null)).toBe(undefined);
//
//     // expect(roundTrip(t.patch({a: t.string}).optional, undefined)).toBe(undefined);
//     // expect(roundTrip(t.patch({a: t.string}).optional, null)).toBe(undefined);
//
//     expect(roundTrip<'a' | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<'a' | undefined>(null)).toBe(undefined);
//
//     expect(roundTrip<MyEnum | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<MyEnum | undefined>(null)).toBe(undefined);
//
//     expect(roundTrip<Model | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<Model | undefined>(null)).toBe(undefined);
//
//     expect(roundTrip<ArrayBuffer | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<ArrayBuffer | undefined>(null)).toBe(undefined);
//
//     expect(roundTrip<Uint8Array | undefined>(undefined)).toBe(undefined);
//     expect(roundTrip<Uint8Array | undefined>(null)).toBe(undefined);
// });
//
// test('nullable container', () => {
//     interface s {
//         tags: string[] | null;
//         tagMap: Record<string, string> | null;
//         tagPartial: Partial<{ name: string }> | null;
//     }
//
//     expect(roundTrip<s>({ tags: null, tagMap: null, tagPartial: null })).toEqual({ tags: null, tagMap: null, tagPartial: null });
//     expect(roundTrip<s>({} as any)).toEqual({ tags: null, tagMap: null, tagPartial: null });
//
//     expect(serializeToJson<s>({} as any)).toEqual({ tags: null, tagMap: null, tagPartial: null });
// });
//
// // test('map serializes default', () => {
// //     const defaultMap = {};
// //     expect(serializeToJson(t.map(t.any).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
// //     expect(serializeToJson(t.map(t.any).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);
// //
// //     expect(serializeToJson(t.map(t.any).optional.default(defaultMap), null)).toBeInstanceOf(Object);
// //     expect(serializeToJson(t.map(t.any).optional.default(defaultMap), null)).not.toBe(defaultMap);
// // });
// //
// // test('serialize default', () => {
// //     expect(serializeToJson(t.string.optional.default('123'), undefined)).toBe('123');
// //     expect(serializeToJson(t.string.optional.default('123'), null)).toBe('123');
// //
// //     expect(serializeToJson(t.number.optional.default(123), undefined)).toBe(123);
// //     expect(serializeToJson(t.number.optional.default(123), null)).toBe(123);
// //
// //     expect(serializeToJson(t.boolean.optional.default(false), undefined)).toBe(false);
// //     expect(serializeToJson(t.boolean.optional.default(false), null)).toBe(false);
// //
// //     expect(serializeToJson(t.uuid.optional.default('5c58e474-82ad-4e92-ad9f-487bbc11e8ed'), undefined)).toBe('5c58e474-82ad-4e92-ad9f-487bbc11e8ed');
// //     expect(serializeToJson(t.uuid.optional.default('5c58e474-82ad-4e92-ad9f-487bbc11e8ed'), null)).toBe('5c58e474-82ad-4e92-ad9f-487bbc11e8ed');
// //
// //     expect(serializeToJson(t.mongoId.optional.default('507f1f77bcf86cd799439011'), undefined)).toBe('507f1f77bcf86cd799439011');
// //     expect(serializeToJson(t.mongoId.optional.default('507f1f77bcf86cd799439011'), null)).toBe('507f1f77bcf86cd799439011');
// //
// //     expect(serializeToJson(t.date.optional.default(new Date), undefined)).toBeInstanceOf(Date);
// //     expect(serializeToJson(t.date.optional.default(new Date), null)).toBeInstanceOf(Date);
// //
// //     const defaultMap = {};
// //     expect(serializeToJson(t.map(t.any).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
// //     expect(serializeToJson(t.map(t.any).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);
// //     expect(serializeToJson(t.map(t.any).optional.default(defaultMap), null)).toBeInstanceOf(Object);
// //     expect(serializeToJson(t.map(t.any).optional.default(defaultMap), null)).not.toBe(defaultMap);
// //
// //     const defaultArray: any[] = [];
// //     expect(serializeToJson(t.array(t.any).optional.default(defaultArray), undefined)).not.toBe(defaultArray);
// //     expect(serializeToJson(t.array(t.any).optional.default(defaultArray), undefined)).toBeInstanceOf(Array);
// //     expect(serializeToJson(t.array(t.any).optional.default(defaultArray), null)).toBeInstanceOf(Array);
// //     expect(serializeToJson(t.array(t.any).optional.default(defaultArray), null)).not.toBe(defaultArray);
// //
// //     expect(serializeToJson(t.partial({ a: t.string }).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
// //     expect(serializeToJson(t.partial({ a: t.string }).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);
// //     expect(serializeToJson(t.partial({ a: t.string }).optional.default(defaultMap), null)).not.toBe(defaultMap);
// //     expect(serializeToJson(t.partial({ a: t.string }).optional.default(defaultMap), null)).toBeInstanceOf(Object);
// //
// //     expect(serializeToJson(t.union(t.string).optional.default('asd'), undefined)).toBe('asd');
// //     expect(serializeToJson(t.union(t.string).optional.default('asd'), null)).toBe('asd');
// //
// //     expect(serializeToJson(t.literal('a').optional.default('a'), undefined)).toBe('a');
// //     expect(serializeToJson(t.literal('a').optional.default('a'), null)).toBe('a');
// //
// //     expect(serializeToJson(t.enum(MyEnum).optional.default(MyEnum.b), undefined)).toBe(MyEnum.b);
// //     expect(serializeToJson(t.enum(MyEnum).optional.default(MyEnum.b), null)).toBe(MyEnum.b);
// //
// //     expect(serializeToJson(t.type(Model).optional.default(() => new Model), undefined)).toBeInstanceOf(Object);
// //     expect(serializeToJson(t.type(Model).optional.default(() => new Model), null)).toBeInstanceOf(Object);
// // });
// //
// // test('deserialize default', () => {
// //     expect(deserializeFromJson(t.string.optional.default('123'), undefined)).toBe('123');
// //     expect(deserializeFromJson(t.string.optional.default('123'), null)).toBe('123');
// //
// //     expect(deserializeFromJson(t.number.optional.default(123), undefined)).toBe(123);
// //     expect(deserializeFromJson(t.number.optional.default(123), null)).toBe(123);
// //
// //     expect(deserializeFromJson(t.boolean.optional.default(false), undefined)).toBe(false);
// //     expect(deserializeFromJson(t.boolean.optional.default(false), null)).toBe(false);
// //
// //     expect(deserializeFromJson(t.uuid.optional.default('5c58e474-82ad-4e92-ad9f-487bbc11e8ed'), undefined)).toBe('5c58e474-82ad-4e92-ad9f-487bbc11e8ed');
// //     expect(deserializeFromJson(t.uuid.optional.default('5c58e474-82ad-4e92-ad9f-487bbc11e8ed'), null)).toBe('5c58e474-82ad-4e92-ad9f-487bbc11e8ed');
// //
// //     expect(deserializeFromJson(t.mongoId.optional.default('507f1f77bcf86cd799439011'), undefined)).toBe('507f1f77bcf86cd799439011');
// //     expect(deserializeFromJson(t.mongoId.optional.default('507f1f77bcf86cd799439011'), null)).toBe('507f1f77bcf86cd799439011');
// //
// //     expect(deserializeFromJson(t.date.optional.default(new Date), undefined)).toBeInstanceOf(Date);
// //     expect(deserializeFromJson(t.date.optional.default(new Date), null)).toBeInstanceOf(Date);
// //
// //     const defaultMap = {};
// //     expect(deserializeFromJson(t.map(t.any).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
// //     expect(deserializeFromJson(t.map(t.any).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);
// //     expect(deserializeFromJson(t.map(t.any).optional.default(defaultMap), null)).toBeInstanceOf(Object);
// //     expect(deserializeFromJson(t.map(t.any).optional.default(defaultMap), null)).not.toBe(defaultMap);
// //
// //     const defaultArray: any[] = [];
// //     expect(deserializeFromJson(t.array(t.any).optional.default(defaultArray), undefined)).not.toBe(defaultArray);
// //     expect(deserializeFromJson(t.array(t.any).optional.default(defaultArray), undefined)).toBeInstanceOf(Array);
// //     expect(deserializeFromJson(t.array(t.any).optional.default(defaultArray), null)).toBeInstanceOf(Array);
// //     expect(deserializeFromJson(t.array(t.any).optional.default(defaultArray), null)).not.toBe(defaultArray);
// //
// //     expect(deserializeFromJson(t.partial({ a: t.string }).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
// //     expect(deserializeFromJson(t.partial({ a: t.string }).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);
// //     expect(deserializeFromJson(t.partial({ a: t.string }).optional.default(defaultMap), null)).not.toBe(defaultMap);
// //     expect(deserializeFromJson(t.partial({ a: t.string }).optional.default(defaultMap), null)).toBeInstanceOf(Object);
// //
// //     expect(deserializeFromJson(t.union(t.string).optional.default('asd'), undefined)).toBe('asd');
// //     expect(deserializeFromJson(t.union(t.string).optional.default('asd'), null)).toBe('asd');
// //
// //     expect(deserializeFromJson(t.literal('a').optional.default('a'), undefined)).toBe('a');
// //     expect(deserializeFromJson(t.literal('a').optional.default('a'), null)).toBe('a');
// //
// //     expect(deserializeFromJson(t.enum(MyEnum).optional.default(MyEnum.b), undefined)).toBe(MyEnum.b);
// //     expect(deserializeFromJson(t.enum(MyEnum).optional.default(MyEnum.b), null)).toBe(MyEnum.b);
// //
// //     const defaultModel = new Model;
// //     expect(deserializeFromJson(t.type(Model).optional.default(() => new Model), undefined)).not.toBe(defaultModel);
// //     expect(deserializeFromJson(t.type(Model).optional.default(() => new Model), undefined)).toBeInstanceOf(Model);
// //     expect(deserializeFromJson(t.type(Model).optional.default(() => new Model), null)).not.toBe(defaultModel);
// //     expect(deserializeFromJson(t.type(Model).optional.default(() => new Model), null)).toBeInstanceOf(Model);
// // });
// //
// // test('default basics', () => {
// //     expect(roundTrip(t.string.optional.default('123'), undefined)).toBe('123');
// //     expect(roundTrip(t.string.optional.default('123'), null)).toBe('123');
// //
// //     expect(roundTrip(t.number.optional.default(123), undefined)).toBe(123);
// //     expect(roundTrip(t.number.optional.default(123), null)).toBe(123);
// //
// //     expect(roundTrip(t.boolean.optional.default(false), undefined)).toBe(false);
// //     expect(roundTrip(t.boolean.optional.default(false), null)).toBe(false);
// //
// //     expect(roundTrip(t.uuid.optional.default('5c58e474-82ad-4e92-ad9f-487bbc11e8ed'), undefined)).toBe('5c58e474-82ad-4e92-ad9f-487bbc11e8ed');
// //     expect(roundTrip(t.uuid.optional.default('5c58e474-82ad-4e92-ad9f-487bbc11e8ed'), null)).toBe('5c58e474-82ad-4e92-ad9f-487bbc11e8ed');
// //
// //     expect(roundTrip(t.mongoId.optional.default('507f1f77bcf86cd799439011'), undefined)).toBe('507f1f77bcf86cd799439011');
// //     expect(roundTrip(t.mongoId.optional.default('507f1f77bcf86cd799439011'), null)).toBe('507f1f77bcf86cd799439011');
// //
// //     expect(roundTrip(t.date.optional.default(new Date), undefined)).toBeInstanceOf(Date);
// //     expect(roundTrip(t.date.optional.default(new Date), null)).toBeInstanceOf(Date);
// //
// //     const defaultMap = {};
// //     expect(roundTrip(t.map(t.any).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
// //     expect(roundTrip(t.map(t.any).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);
// //     expect(roundTrip(t.map(t.any).optional.default(defaultMap), null)).toBeInstanceOf(Object);
// //     expect(roundTrip(t.map(t.any).optional.default(defaultMap), null)).not.toBe(defaultMap);
// //
// //     const defaultArray: any[] = [];
// //     expect(roundTrip(t.array(t.any).optional.default(defaultArray), undefined)).not.toBe(defaultArray);
// //     expect(roundTrip(t.array(t.any).optional.default(defaultArray), undefined)).toBeInstanceOf(Array);
// //     expect(roundTrip(t.array(t.any).optional.default(defaultArray), null)).toBeInstanceOf(Array);
// //     expect(roundTrip(t.array(t.any).optional.default(defaultArray), null)).not.toBe(defaultArray);
// //
// //     expect(roundTrip(t.partial({ a: t.string }).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
// //     expect(roundTrip(t.partial({ a: t.string }).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);
// //     expect(roundTrip(t.partial({ a: t.string }).optional.default(defaultMap), null)).not.toBe(defaultMap);
// //     expect(roundTrip(t.partial({ a: t.string }).optional.default(defaultMap), null)).toBeInstanceOf(Object);
// //
// //     expect(roundTrip(t.union(t.string).optional.default('asd'), undefined)).toBe('asd');
// //     expect(roundTrip(t.union(t.string).optional.default('asd'), null)).toBe('asd');
// //
// //     expect(roundTrip(t.literal('a').optional.default('a'), undefined)).toBe('a');
// //     expect(roundTrip(t.literal('a').optional.default('a'), null)).toBe('a');
// //
// //     expect(roundTrip(t.enum(MyEnum).optional.default(MyEnum.b), undefined)).toBe(MyEnum.b);
// //     expect(roundTrip(t.enum(MyEnum).optional.default(MyEnum.b), null)).toBe(MyEnum.b);
// //
// //     const defaultModel = new Model;
// //     expect(roundTrip(t.type(Model).optional.default(defaultModel), undefined)).not.toBe(defaultModel);
// //     expect(roundTrip(t.type(Model).optional.default(defaultModel), undefined)).toBeInstanceOf(Model);
// //     expect(roundTrip(t.type(Model).optional.default(defaultModel), null)).not.toBe(defaultModel);
// //     expect(roundTrip(t.type(Model).optional.default(defaultModel), null)).toBeInstanceOf(Model);
// // });
//
// test('nullable basics', () => {
//     expect(roundTrip<string | null>(undefined)).toBe(null);
//     expect(roundTrip<string | null>(null)).toBe(null);
//
//     expect(roundTrip<number | null>(undefined)).toBe(null);
//     expect(roundTrip<number | null>(null)).toBe(null);
//
//     expect(roundTrip<boolean | null>(undefined)).toBe(null);
//     expect(roundTrip<boolean | null>(null)).toBe(null);
//
//     expect(roundTrip<Date | null>(undefined)).toBe(null);
//     expect(roundTrip<Date | null>(null)).toBe(null);
//
//     expect(roundTrip<UUID | null>(undefined)).toBe(null);
//     expect(roundTrip<UUID | null>(null)).toBe(null);
//
//     expect(roundTrip<MongoId | null>(undefined)).toBe(null);
//     expect(roundTrip<MongoId | null>(null)).toBe(null);
//
//     expect(roundTrip<Record<string, string> | null>(undefined)).toBe(null);
//     expect(roundTrip<Record<string, string> | null>(null)).toBe(null);
//
//     expect(roundTrip<any[] | null>(undefined)).toBe(null);
//     expect(roundTrip<any[] | null>(null)).toBe(null);
//
//     expect(roundTrip<Partial<{ a: string }> | null>(undefined)).toBe(null);
//     expect(roundTrip<Partial<{ a: string }> | null>(null)).toBe(null);
//
//     expect(roundTrip<'a' | null>(undefined)).toBe('a');
//     expect(roundTrip<'a' | null>(null)).toBe(null);
//
//     expect(roundTrip<MyEnum | null>(undefined)).toBe(null);
//     expect(roundTrip<MyEnum | null>(null)).toBe(null);
//
//     expect(roundTrip<Model | null>(undefined)).toBe(null);
//     expect(roundTrip<Model | null>(null)).toBe(null);
//
//     expect(roundTrip<ArrayBuffer | null>(undefined)).toBe(null);
//     expect(roundTrip<ArrayBuffer | null>(null)).toBe(null);
//
//     expect(roundTrip<Uint8Array | null>(undefined)).toBe(null);
//     expect(roundTrip<Uint8Array | null>(null)).toBe(null);
// });
//
// test('constructor argument', () => {
//     class Product {
//         id: number = 0;
//
//         constructor(public title: string) {
//         }
//     }
//
//     class Purchase {
//         id: number = 0;
//
//         constructor(public product: Product) {
//         }
//     }
//
//     {
//         const item = roundTrip<Purchase>({ id: 4, product: new Product('asd') });
//         expect(item.product).toBeInstanceOf(Product);
//     }
// });
//
// test('omit circular reference 1', () => {
//     class Model {
//         another?: Model;
//
//         constructor(
//             public id: number = 0
//         ) {
//         }
//     }
//
//     expect(ReflectionClass.from(Model).hasCircularReference()).toBe(true);
//
//     {
//         const model = new Model(1);
//         const model2 = new Model(2);
//         model.another = model2;
//         const plain = serializeToJson<Model>(model);
//         expect(plain.another).toBeInstanceOf(Object);
//         expect(plain.another!.id).toBe(2);
//     }
//
//     {
//         const model = new Model(1);
//         model.another = model;
//         const plain = serializeToJson<Model>(model);
//         expect(plain.another).toBe(undefined);
//     }
// });
//
// test('omit circular reference 2', () => {
//     class Config {
//         constructor(public model: Model) {
//         }
//     }
//
//     class Model {
//         id: number = 0;
//         config?: Config;
//     }
//
//     expect(ReflectionClass.from(Model).hasCircularReference()).toBe(true);
//     expect(ReflectionClass.from(Config).hasCircularReference()).toBe(true);
//
//     {
//         const model = new Model;
//         const config = new Config(model);
//         model.config = config;
//         const plain = serializeToJson<Model>(model);
//         expect(plain.config).toBeInstanceOf(Object);
//         expect(plain.config!.model).toBe(undefined);
//     }
//
//     {
//         const model = new Model;
//         const model2 = new Model;
//         const config = new Config(model2);
//         model.config = config;
//         const plain = serializeToJson<Model>(model);
//         expect(plain.config).toBeInstanceOf(Object);
//         expect(plain.config!.model).toBeInstanceOf(Object);
//     }
// });
//
// test('omit circular reference 3', () => {
//     class User {
//         id: number = 0;
//
//         public images: Image[] = [];
//
//         constructor(public name: string) {
//         }
//     }
//
//     class Image {
//         id: number = 0;
//
//         constructor(
//             public user: User,
//             public title: string,
//         ) {
//             if (user.images && !user.images.includes(this)) {
//                 user.images.push(this);
//             }
//         }
//     }
//
//     expect(ReflectionClass.from(User).hasCircularReference()).toBe(true);
//     expect(ReflectionClass.from(Image).hasCircularReference()).toBe(true);
//
//     {
//         const user = new User('foo');
//         const image = new Image(user, 'bar');
//         {
//             const plain = serializeToJson<User>(user);
//             expect(plain.images.length).toBe(1);
//             expect(plain.images[0]).toBeInstanceOf(Object);
//             expect(plain.images[0].title).toBe('bar');
//         }
//
//         {
//             const plain = serializeToJson<Image>(image);
//             expect(plain.user).toBeInstanceOf(Object);
//             expect(plain.user.name).toBe('foo');
//         }
//     }
//
//     {
//         const user = new User('foo');
//         const plain = serializeToJson<User>(user);
//         expect(plain.images.length).toBe(0);
//     }
// });
//
// test('promise', () => {
//     //make sure promise is automatically forwarded to its first generic type
//     expect(serializeToJson<Promise<string>>('1')).toBe('1');
//     expect(deserializeFromJson<Promise<string>>('1' as any)).toBe('1');
//     expect(roundTrip<Promise<string>>('1' as any)).toBe('1');
// });
