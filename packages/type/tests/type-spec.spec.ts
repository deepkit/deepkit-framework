import { expect, test } from '@jest/globals';
import { ReceiveType, ReflectionClass, resolveReceiveType, typeOf } from '../src/reflection/reflection.js';
import { AutoIncrement, BackReference, findMember, isReferenceType, MapName, MongoId, PrimaryKey, Reference, UUID } from '../src/reflection/type.js';
import { cast, cloneClass, serialize } from '../src/serializer-facade.js';
import { createReference } from '../src/reference.js';
import { unpopulatedSymbol } from '../src/core.js';

(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

function roundTrip<T>(value: T | any, type?: ReceiveType<T>): T {
    const t = resolveReceiveType(type);
    // console.log('roundTrip', stringifyType(t));
    const json = serialize(value, {}, undefined, undefined, type);
    const res = cast<T>(json, {}, undefined, undefined, type);
    return res;
}

function serializeToJson<T>(value: T | any, type?: ReceiveType<T>): T {
    const json = serialize(value, {}, undefined, undefined, type);
    return json;
}

function deserializeFromJson<T>(value: any, type?: ReceiveType<T>): T {
    const res = cast<T>(value, {}, undefined, undefined, type);
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

    expect(roundTrip<Product>({ id: 23 } as any)).toEqual({ id: 23, created: defaultDate });
    expect(deserializeFromJson<Product>({ id: 23, created: undefined } as any)).toEqual({ id: 23, created: defaultDate });
    expect(roundTrip<Product>({ id: 23, created: undefined } as any)).toEqual({ id: 23, created: defaultDate });

    expect(roundTrip<Partial<Product>>({ id: 23 } as any)).toEqual({ id: 23 });
    expect(roundTrip<Partial<Product>>({ id: 23, created: undefined } as any)).toEqual({ id: 23 });

    //not set properties are omitted
    expect('created' in roundTrip<Partial<Product>>({ id: 23 } as any)).toEqual(false);

    //we need to keep undefined values otherwise there is not way to reset a value
    //for JSON/BSON on the transport layer is null used to communicate the fact that we set explicitly `created` to undefined
    expect('created' in serializeToJson<Partial<Product>>({ id: 23, created: undefined } as any)).toEqual(true);
    expect('created' in roundTrip<Partial<Product>>({ id: 23, created: undefined } as any)).toEqual(true);
});

test('partial keeps explicitely undefined fields', () => {
    expect(roundTrip<Partial<Model>>({})).toEqual({});
    expect('name' in roundTrip<Partial<Model>>({})).toBe(false);
    expect(roundTrip<Partial<Model>>({ title: undefined })).toEqual({ title: undefined });

    {
        const item = serializeToJson<Partial<Model>>({ title: undefined });
        expect(item).toEqual({ title: null });
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

test('record removes undefined when not allowed', () => {
    expect(roundTrip<Record<string, string>>({})).toEqual({});
    expect(roundTrip<Record<string, string>>({ foo: 'bar' })).toEqual({ foo: 'bar' });
    expect(roundTrip<Record<string, string>>({ foo: undefined } as any)).toEqual({});
    expect('foo' in roundTrip<Record<string, string>>({ foo: undefined } as any)).toEqual(false);
});

test('record allows undefined when allowed', () => {
    expect(serializeToJson<Record<string, string | undefined>>({})).toEqual({});
    expect(serializeToJson<Record<string, string | undefined>>({ foo: 'bar' })).toEqual({ foo: 'bar' });
    expect(serializeToJson<Record<string, string | undefined>>({ foo: undefined } as any)).toEqual({ foo: null });
    expect('foo' in serializeToJson<Record<string, string | undefined>>({ foo: undefined } as any)).toEqual(true);

    expect(roundTrip<Record<string, string | undefined>>({})).toEqual({});
    expect(roundTrip<Record<string, string | undefined>>({ foo: 'bar' })).toEqual({ foo: 'bar' });
    expect(roundTrip<Record<string, string | undefined>>({ foo: undefined } as any)).toEqual({ foo: undefined });
    expect('foo' in roundTrip<Record<string, string | undefined>>({ foo: undefined } as any)).toEqual(true);
});

test('bigint', () => {
    expect(roundTrip<bigint>(0n)).toEqual(0n);
    expect(roundTrip<bigint>(5n)).toEqual(5n);
    expect(roundTrip<bigint>(12n)).toEqual(12n);
    expect(roundTrip<bigint>(12012020202020202020202020202020202020n)).toEqual(12012020202020202020202020202020202020n);
    expect(roundTrip<bigint>(16n ** 16n ** 2n)).toEqual(16n ** 16n ** 2n);
    expect(roundTrip<bigint>(16n ** 16n ** 3n)).toEqual(16n ** 16n ** 3n);
});

test('union basics', () => {
    expect(roundTrip<string | number>('asd')).toEqual('asd');
    expect(roundTrip<string | number>(23)).toEqual(23);

    expect(roundTrip<boolean | number>(true)).toEqual(true);
    expect(roundTrip<boolean | number>(23)).toEqual(23);

    expect(roundTrip<bigint | number>(23)).toEqual(23);
    expect(roundTrip<bigint | number>(23n)).toEqual(23n);

    expect(roundTrip<string | Model>(new Model)).toBeInstanceOf(Model);
    {
        const item = new Model;
        item.id = 23;
        item.title = '23';
        const back = roundTrip<string | Model>(item);
        expect(back).toEqual({ id: 23, title: '23' });
    }

    {
        const item = new Model;
        item.id = 23;
        item.title = '23';
        const back = roundTrip<Model>(item);
        expect(back).toEqual({ id: 23, title: '23' });
    }

    expect(roundTrip<string | Model>('asd')).toEqual('asd');

    expect(roundTrip<string | Model | undefined>(undefined)).toEqual(undefined);
    expect(roundTrip<string | Model | undefined>(null)).toEqual(undefined);

    expect(roundTrip<string | Model | null>(undefined)).toEqual(null);
    expect(roundTrip<string | Model | null>(null)).toEqual(null);
});

test('union 2', () => {
    interface s {
        type: 'm';
        name: string;
    }

    expect(deserializeFromJson<undefined | s>({ type: 'm', name: 'Peter' })).toEqual({ type: 'm', name: 'Peter' });
    expect(serializeToJson<undefined | s>({ type: 'm', name: 'Peter' })).toEqual({ type: 'm', name: 'Peter' });
    expect(roundTrip<undefined | s>({ type: 'm', name: 'Peter' })).toEqual({ type: 'm', name: 'Peter' });
});

test('union 3', () => {
    expect(deserializeFromJson<string | Model>('asd')).toBe('asd');
    expect(deserializeFromJson<string | Model>({ id: 0, title: 'foo' } as any)).toEqual({ id: 0, title: 'foo' });

    expect(deserializeFromJson<string | Model | undefined>(undefined)).toBe(undefined);
    expect(deserializeFromJson<string | Model | null>(null)).toBe(null);

    expect(serializeToJson<string | Model>('asd')).toBe('asd');
    expect(serializeToJson<string | Model>({ id: 0, title: 'foo' } as any)).toEqual({ id: 0, title: 'foo' });

    expect(serializeToJson<string | Model | undefined>(undefined)).toBe(null);
    expect(serializeToJson<string | Model | null>(null)).toBe(null);

    expect(roundTrip<string | Model>('asd')).toBe('asd');
    expect(roundTrip<string | Model>({ id: 0, title: 'foo' } as any)).toBeInstanceOf(Model);
});

test('model 1', () => {
    class Model {
        //filter is not used yet
        filter?: Record<string, string | number | boolean | RegExp>;

        skip?: number;

        itemsPerPage: number = 50;

        limit?: number;

        parameters: { [name: string]: any } = {};

        sort?: Record<any, any>;
    }

    {
        const model = { filter: { $regex: /Peter/ }, itemsPerPage: 50, parameters: {} };
        expect(roundTrip<Model>(model as any)).toEqual(model);
    }

    {
        const o = { parameters: { teamName: 'Team a' } };
        expect(serializeToJson<Model>(o)).toEqual(o);
    }

    {
        const model = {
            itemsPerPage: 50,
            parameters: { teamName: 'Team a' },
            filter: undefined,
            skip: undefined,
            limit: undefined,
            sort: undefined
        };
        expect(roundTrip<Model>(model as any)).toEqual(model);
    }
});

class Team {
    id: number & PrimaryKey & AutoIncrement = 0;
    version: number = 0;
    lead?: User & Reference;

    constructor(public name: string) {
    }
}

class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    version: number = 0;
    teams: Team[] & BackReference<{ via: typeof UserTeam }> = [];

    constructor(public name: string) {
    }
}

class UserTeam {
    id: number & PrimaryKey & AutoIncrement = 0;

    version: number = 0;

    constructor(
        public team: Team & Reference,
        public user: User & Reference,
    ) {
    }
}

test('relation 1', () => {
    const team = ReflectionClass.from(Team);
    const user = ReflectionClass.from(User);
    //they have to be different, otherwise User would have the Reference annotations applied
    expect(team.getProperty('lead').type === user.type).toBe(false);
    expect(isReferenceType(user.type)).toBe(false);


    {
        const user = new User('foo');
        expect(roundTrip<User>(user)).toEqual(user);
    }

    {
        const team = new Team('foo');
        expect(roundTrip<Team>(team)).toEqual(team);
    }

    {
        const team = new Team('foo');
        const user = new User('foo');
        user.id = 12;
        team.lead = user;
        expect(serializeToJson<Team>(team)).toEqual(team);
        expect(deserializeFromJson<Team>(team)).toEqual(team);
        expect(roundTrip<Team>(team)).toEqual(team);
    }

    {
        const team = new Team('foo');
        team.id = 1;
        team.version = 2;
        team.lead = createReference(User, { id: 12 });
        const json = { id: 1, version: 2, name: 'foo', lead: 12 as any };

        expect(serializeToJson<Team>(team)).toEqual(json);
        const back = deserializeFromJson<Team>(json);
        expect(back).toEqual(team);
        expect(back.lead).toBeInstanceOf(User);
        expect(back.lead!.id).toBe(12);
        expect(roundTrip<Team>(team)).toEqual(team);
    }
});


test('relation 2', () => {
    {
        const user = new User('foo');
        user.teams = unpopulatedSymbol as any; //emulates an unpopulated relation
        const user2 = cloneClass(user);
        user2.teams = [];
        expect(roundTrip<User>(user)).toEqual(user2);
    }

    {
        const user = new User('foo');
        user.teams.push(new Team('bar'));
        expect(serializeToJson<User>(user)).toEqual(user);
        expect(roundTrip<User>(user)).toEqual(user);
    }

    {
        const items: User[] = [
            cast<User>({
                name: 'Peter 1',
                id: 1,
                version: 0,
            }),
            cast<User>({
                name: 'Peter 2',
                id: 2,
                version: 0,
            }),
            cast<User>({
                name: 'Marc 1',
                id: 3,
                version: 0,
            })
        ];

        expect(roundTrip<User[]>(items)).toEqual(items);
    }
});

// test('invalid', () => {
//     expect(roundTrip<UUID>(new Model as any)).toEqual(RoundTripExcluded);
// });

test('regex', () => {
    expect(roundTrip<RegExp>(/foo/)).toEqual(/foo/);
});

test('explicitly set undefined on optional triggers default value', () => {
    class Product {
        id: number = 0;
        created?: Date = new Date;
    }

    //no value means the default triggers
    expect(roundTrip<Product>({ id: 23 }).created).toBeInstanceOf(Date);

    //this is important for database patches
    expect(roundTrip<Product>({ id: 23, created: undefined }).created).toBe(undefined);
    expect('created' in roundTrip<Product>({ id: 23, created: undefined })).toBe(true);
});

test('partial explicitly set undefined on optional is handled', () => {
    class Product {
        id: number = 0;
        created?: Date = new Date;
    }

    //no value means the default triggers
    expect(roundTrip<Partial<Product>>({ id: 23 }).created).toBe(undefined);

    //this is important for database patches
    expect(roundTrip<Partial<Product>>({ id: 23, created: undefined }).created).toBe(undefined);
    expect('created' in roundTrip<Partial<Product>>({ id: 23, created: undefined })).toBe(true);
});

test('partial explicitly set undefined on required is not ignored', () => {
    class Product {
        id: number = 0;
        created: Date = new Date;
    }

    //no value means the default triggers
    expect(roundTrip<Partial<Product>>({ id: 23 }).created).toBe(undefined);

    //this is important for database patches
    //important to keep undefined, as t.partial() makes all properties optional, no matter what it originally was, otherwise it would be a partial
    expect(roundTrip<Partial<Product>>({ id: 23, created: undefined }).created).toBe(undefined);
    expect('created' in roundTrip<Partial<Product>>({ id: 23, created: undefined } as any)).toBe(true);
});

test('explicitely set undefined on required is ignored', () => {
    class Product {
        id: number = 0;
        created: Date = new Date;
    }

    expect(roundTrip<Product>({ id: 23 } as any).created).toBeInstanceOf(Date);
    expect(roundTrip<Product>({ id: 23, created: undefined } as any).created).toBeInstanceOf(Date);
});

test('partial does not return the model on root', () => {
    expect(roundTrip<Partial<Model>>({ id: 23 } as any)).toEqual({ id: 23 });
    expect(roundTrip<Partial<Model>>({ id: 23 } as any)).not.toBeInstanceOf(Model);
});

test('partial returns the model at second level', () => {
    const config = new Config;
    config.color = 'red';

    expect(roundTrip<Partial<Model>>({ id: 23, config: config } as any)).toEqual({
        id: 23,
        config: { big: false, color: 'red' }
    });
    expect(roundTrip<Partial<Model>>({ id: 23, config: config } as any).config).toBeInstanceOf(Config);
});

test('partial allowed undefined', () => {
    class Product {
        id: number = 0;
        created?: Date;
    }

    expect(roundTrip<Partial<Product>>({ id: 23, created: undefined } as any)).not.toBeInstanceOf(Product);

    expect(roundTrip<Partial<Product>>({ id: 23 } as any).created).toBe(undefined);
    expect('created' in roundTrip<Partial<Product>>({ id: 23 } as any)).toBe(false);

    //important for database patches
    expect(roundTrip<Partial<Product>>({ id: 23, created: undefined } as any).created).toBe(undefined);
    expect('created' in roundTrip<Partial<Product>>({ id: 23, created: undefined } as any)).toBe(true);
});

test('optional basics', () => {
    expect(roundTrip<string | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<string | undefined>(null)).toBe(undefined);

    expect(roundTrip<number | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<number | undefined>(null)).toBe(undefined);

    expect(roundTrip<boolean | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<boolean | undefined>(null)).toBe(undefined);

    expect(roundTrip<UUID | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<UUID | undefined>(null)).toBe(undefined);

    expect(roundTrip<MongoId | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<MongoId | undefined>(null)).toBe(undefined);

    expect(roundTrip<Date | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<Date | undefined>(null)).toBe(undefined);

    expect(roundTrip<Record<string, string> | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<Record<string, string> | undefined>(null)).toBe(undefined);

    expect(roundTrip<any[] | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<any[] | undefined>(null)).toBe(undefined);

    expect(roundTrip<Partial<{ a: string }> | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<Partial<{ a: string }> | undefined>(null)).toBe(undefined);

    // expect(roundTrip(t.patch({a: t.string}).optional, undefined)).toBe(undefined);
    // expect(roundTrip(t.patch({a: t.string}).optional, null)).toBe(undefined);

    expect(roundTrip<'a' | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<'a' | undefined>(null)).toBe(undefined);

    expect(roundTrip<MyEnum | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<MyEnum | undefined>(null)).toBe(undefined);

    expect(roundTrip<Model | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<Model | undefined>(null)).toBe(undefined);

    expect(roundTrip<ArrayBuffer | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<ArrayBuffer | undefined>(null)).toBe(undefined);

    expect(roundTrip<Uint8Array | undefined>(undefined)).toBe(undefined);
    expect(roundTrip<Uint8Array | undefined>(null)).toBe(undefined);
});

test('nullable container', () => {
    interface s {
        tags: string[] | null;
        tagMap: Record<string, string> | null;
        tagPartial: Partial<{ name: string }> | null;
    }

    expect(roundTrip<s>({ tags: null, tagMap: null, tagPartial: null })).toEqual({ tags: null, tagMap: null, tagPartial: null });
    expect(roundTrip<s>({} as any)).toEqual({ tags: null, tagMap: null, tagPartial: null });

    expect(serializeToJson<s>({} as any)).toEqual({ tags: null, tagMap: null, tagPartial: null });
});

test('nullable basics', () => {
    expect(roundTrip<string | null>(undefined)).toBe(null);
    expect(roundTrip<string | null>(null)).toBe(null);

    expect(roundTrip<number | null>(undefined)).toBe(null);
    expect(roundTrip<number | null>(null)).toBe(null);

    expect(roundTrip<boolean | null>(undefined)).toBe(null);
    expect(roundTrip<boolean | null>(null)).toBe(null);

    expect(roundTrip<Date | null>(undefined)).toBe(null);
    expect(roundTrip<Date | null>(null)).toBe(null);

    expect(roundTrip<UUID | null>(undefined)).toBe(null);
    expect(roundTrip<UUID | null>(null)).toBe(null);

    expect(roundTrip<MongoId | null>(undefined)).toBe(null);
    expect(roundTrip<MongoId | null>(null)).toBe(null);

    expect(roundTrip<Record<string, string> | null>(undefined)).toBe(null);
    expect(roundTrip<Record<string, string> | null>(null)).toBe(null);

    expect(roundTrip<any[] | null>(undefined)).toBe(null);
    expect(roundTrip<any[] | null>(null)).toBe(null);

    expect(roundTrip<Partial<{ a: string }> | null>(undefined)).toBe(null);
    expect(roundTrip<Partial<{ a: string }> | null>(null)).toBe(null);

    expect(roundTrip<'a' | null>(undefined)).toBe(null);
    expect(roundTrip<'a' | null>(null)).toBe(null);

    expect(roundTrip<MyEnum | null>(undefined)).toBe(null);
    expect(roundTrip<MyEnum | null>(null)).toBe(null);

    expect(roundTrip<Model | null>(undefined)).toBe(null);
    expect(roundTrip<Model | null>(null)).toBe(null);

    expect(roundTrip<ArrayBuffer | null>(undefined)).toBe(null);
    expect(roundTrip<ArrayBuffer | null>(null)).toBe(null);

    expect(roundTrip<Uint8Array | null>(undefined)).toBe(null);
    expect(roundTrip<Uint8Array | null>(null)).toBe(null);
});

test('constructor argument', () => {
    class Product {
        id: number = 0;

        constructor(public title: string) {
        }
    }

    class Purchase {
        id: number = 0;

        constructor(public product: Product) {
        }
    }

    {
        const item = roundTrip<Purchase>({ id: 4, product: new Product('asd') });
        expect(item.product).toBeInstanceOf(Product);
    }
});

test('omit circular reference 1', () => {
    class Model {
        another?: Model;

        constructor(
            public id: number = 0
        ) {
        }
    }

    expect(ReflectionClass.from(Model).hasCircularReference()).toBe(true);

    {
        const model = new Model(1);
        const model2 = new Model(2);
        model.another = model2;
        const plain = serializeToJson<Model>(model);
        expect(plain.another).toBeInstanceOf(Object);
        expect(plain.another!.id).toBe(2);
    }

    {
        const model = new Model(1);
        model.another = model;
        const plain = serializeToJson<Model>(model);
        expect(plain.another).toBe(undefined);
    }
});

test('omit circular reference 2', () => {
    class Config {
        constructor(public model: Model) {
        }
    }

    class Model {
        id: number = 0;
        config?: Config;
    }

    expect(ReflectionClass.from(Model).hasCircularReference()).toBe(true);
    expect(ReflectionClass.from(Config).hasCircularReference()).toBe(true);

    {
        const model = new Model;
        const config = new Config(model);
        model.config = config;
        const plain = serializeToJson<Model>(model);
        expect(plain.config).toBeInstanceOf(Object);
        expect(plain.config!.model).toBe(undefined);
    }

    {
        const model = new Model;
        const model2 = new Model;
        const config = new Config(model2);
        model.config = config;
        const plain = serializeToJson<Model>(model);
        expect(plain.config).toBeInstanceOf(Object);
        expect(plain.config!.model).toBeInstanceOf(Object);
    }
});

test('omit circular reference 3', () => {
    class User {
        id: number = 0;

        public images: Image[] = [];

        constructor(public name: string) {
        }
    }

    class Image {
        id: number = 0;

        constructor(
            public user: User,
            public title: string,
        ) {
            if (user.images && !user.images.includes(this)) {
                user.images.push(this);
            }
        }
    }

    expect(ReflectionClass.from(User).hasCircularReference()).toBe(true);
    expect(ReflectionClass.from(Image).hasCircularReference()).toBe(true);

    {
        const user = new User('foo');
        const image = new Image(user, 'bar');
        {
            const plain = serializeToJson<User>(user);
            expect(plain.images.length).toBe(1);
            expect(plain.images[0]).toBeInstanceOf(Object);
            expect(plain.images[0].title).toBe('bar');
        }

        {
            const plain = serializeToJson<Image>(image);
            expect(plain.user).toBeInstanceOf(Object);
            expect(plain.user.name).toBe('foo');
        }
    }

    {
        const user = new User('foo');
        const plain = serializeToJson<User>(user);
        expect(plain.images.length).toBe(0);
    }
});

test('promise', () => {
    //make sure promise is automatically forwarded to its first generic type
    expect(serializeToJson<Promise<string>>('1')).toBe('1');
    expect(deserializeFromJson<Promise<string>>('1' as any)).toBe('1');
    expect(roundTrip<Promise<string>>('1' as any)).toBe('1');
});

test('class inheritance', () => {
    class A {
        id: number = 0;
    }

    class B extends A {
        username: string = '';
    }

    expect(deserializeFromJson<A>({ id: 2 })).toEqual({ id: 2 });
    expect(serializeToJson<A>({ id: 2 })).toEqual({ id: 2 });

    expect(deserializeFromJson<B>({ id: 2, username: 'Peter' })).toEqual({ id: 2, username: 'Peter' });
    expect(serializeToJson<B>({ id: 2, username: 'Peter' })).toEqual({ id: 2, username: 'Peter' });
});

test('mapName interface', () => {
    interface A {
        type: string & MapName<'~type'>;
    }

    expect(deserializeFromJson<A>({ '~type': 'abc' })).toEqual({ 'type': 'abc' });
    expect(serializeToJson<A>({ 'type': 'abc' })).toEqual({ '~type': 'abc' });

    expect(deserializeFromJson<A | string>({ '~type': 'abc' })).toEqual({ 'type': 'abc' });
    expect(serializeToJson<A | string>({ 'type': 'abc' })).toEqual({ '~type': 'abc' });
    expect(serializeToJson<A | string>('abc')).toEqual('abc');
});

test('mapName class', () => {
    class A {
        id: string & MapName<'~id'> = '';

        constructor(public type: string & MapName<'~type'>) {
        }
    }

    expect(deserializeFromJson<A>({ '~id': '1', '~type': 'abc' })).toEqual({ 'id': '1', 'type': 'abc' });
    expect(serializeToJson<A>({ id: '1', 'type': 'abc' })).toEqual({ '~id': '1', '~type': 'abc' });

    expect(deserializeFromJson<A | string>({ '~id': '', '~type': 'abc' })).toEqual({ id: '', 'type': 'abc' });
    expect(serializeToJson<A | string>({ id: '1', 'type': 'abc' })).toEqual({ '~id': '1', '~type': 'abc' });
    expect(serializeToJson<A | string>('abc')).toEqual('abc');
});

test('dynamic properties', () => {
    class A {
        [index: string]: any;

        getType(): string {
            return String(this['~type'] || this['type'] || '');
        }
    }

    const back1 = deserializeFromJson<A>({ '~type': 'abc' });
    expect(back1.getType()).toBe('abc');

    const back2 = deserializeFromJson<A>({ 'type': 'abc' });
    expect(back2.getType()).toBe('abc');
});

test('class with statics', () => {
    class PilotId {
        public static readonly none: PilotId = new PilotId(0);

        constructor(public readonly value: number) {
        }

        static from(value: number) {
            return new PilotId(value);
        }
    }

    expect(deserializeFromJson<PilotId>({value: 34})).toEqual({value: 34});
    expect(serializeToJson<PilotId>({value: 33})).toEqual({value: 33});
});

test('primary key only for reference becomes reference', () => {
    expect(deserializeFromJson<Team>({id: 1, name: 'a', lead: 34}).lead).toBeInstanceOf(User);
    expect(deserializeFromJson<Team>({id: 1, name: 'a', lead: {id: 34}}).lead).toBeInstanceOf(User);
});
