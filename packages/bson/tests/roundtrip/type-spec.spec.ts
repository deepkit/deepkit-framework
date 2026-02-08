/**
 * Comprehensive round-trip tests: serialize -> deserialize -> verify
 *
 * These tests verify that data survives a full serialize/deserialize cycle
 * with the expected type transformations.
 */
import { describe, test } from 'node:test';

import { expect } from '@deepkit/run/expect';
import {
    AutoIncrement,
    BinaryBigInt,
    Email,
    Embedded,
    Excluded,
    Group,
    MapName,
    MaxLength,
    MinLength,
    MongoId,
    Positive,
    PrimaryKey,
    Reference,
    ReflectionKind,
    SignedBinaryBigInt,
    UUID,
    Unique,
    cast,
    integer,
    typeOf,
    serialize as typeSerialize,
    uuid,
} from '@deepkit/type';

import { deserializeBSON, deserializeBSONWithoutOptimiser, getBSONDeserializer, getBSONSerializer, serializeBSONWithoutOptimiser } from '../../index.js';

// Helper for full round-trip test
function roundTrip<T>(type: ReturnType<typeof typeOf<T>>, value: T): T {
    const serializer = getBSONSerializer(type);
    const deserializer = getBSONDeserializer(type);
    const [buffer, size] = serializer(value);
    return deserializer(buffer.slice(0, size));
}

// Helper for serialize -> JSON representation
function serializeToJson<T>(type: ReturnType<typeof typeOf<T>>, value: T): any {
    const serializer = getBSONSerializer(type);
    const [buffer, size] = serializer(value);
    return deserializeBSONWithoutOptimiser(buffer.slice(0, size));
}

// Helper for JSON -> deserialize
function deserializeFromJson<T>(type: ReturnType<typeof typeOf<T>>, json: any): T {
    const bson = serializeBSONWithoutOptimiser(json);
    const deserializer = getBSONDeserializer(type);
    return deserializer(bson);
}

describe('primitive round-trips', () => {
    test('string', () => {
        const type = typeOf<{ v: string }>();
        expect(roundTrip(type, { v: 'hello' })).toEqual({ v: 'hello' });
        expect(roundTrip(type, { v: '' })).toEqual({ v: '' });
        expect(roundTrip(type, { v: 'unicode: 中文 🎉' })).toEqual({ v: 'unicode: 中文 🎉' });
    });

    test('number', () => {
        const type = typeOf<{ v: number }>();
        expect(roundTrip(type, { v: 0 })).toEqual({ v: 0 });
        expect(roundTrip(type, { v: 42 })).toEqual({ v: 42 });
        expect(roundTrip(type, { v: -42 })).toEqual({ v: -42 });
        expect(roundTrip(type, { v: 3.14159 })).toEqual({ v: 3.14159 });
    });

    test('boolean', () => {
        const type = typeOf<{ v: boolean }>();
        expect(roundTrip(type, { v: true })).toEqual({ v: true });
        expect(roundTrip(type, { v: false })).toEqual({ v: false });
    });

    test('bigint', () => {
        const type = typeOf<{ v: bigint }>();
        expect(roundTrip(type, { v: 0n })).toEqual({ v: 0n });
        expect(roundTrip(type, { v: 9007199254740992n })).toEqual({ v: 9007199254740992n }); // > MAX_SAFE_INTEGER
        expect(roundTrip(type, { v: -9007199254740992n })).toEqual({ v: -9007199254740992n });
    });

    test('BinaryBigInt', () => {
        const type = typeOf<{ v: BinaryBigInt }>();
        expect(roundTrip(type, { v: 0n })).toEqual({ v: 0n });
        expect(roundTrip(type, { v: 9223372036854775810n })).toEqual({ v: 9223372036854775810n });
    });

    test('SignedBinaryBigInt', () => {
        const type = typeOf<{ v: SignedBinaryBigInt }>();
        expect(roundTrip(type, { v: 9223372036854775810n })).toEqual({ v: 9223372036854775810n });
        expect(roundTrip(type, { v: -9223372036854775810n })).toEqual({ v: -9223372036854775810n });
    });
});

describe('date round-trips', () => {
    test('Date', () => {
        const type = typeOf<{ v: Date }>();
        const now = new Date();
        expect(roundTrip(type, { v: now })).toEqual({ v: now });

        const future = new Date('2100-01-01T00:00:00.000Z');
        expect(roundTrip(type, { v: future })).toEqual({ v: future });

        const past = new Date('1900-01-01T00:00:00.000Z');
        expect(roundTrip(type, { v: past })).toEqual({ v: past });
    });
});

describe('special types round-trips', () => {
    test('UUID', () => {
        const type = typeOf<{ v: UUID }>();
        const id = uuid();
        expect(roundTrip(type, { v: id })).toEqual({ v: id });
    });

    test('MongoId', () => {
        const type = typeOf<{ v: MongoId }>();
        const id = '507f191e810c19729de860ea';
        expect(roundTrip(type, { v: id })).toEqual({ v: id });
    });

    test('RegExp', () => {
        const type = typeOf<{ v: RegExp }>();
        expect(roundTrip(type, { v: /abc/g })).toEqual({ v: /abc/g });
        expect(roundTrip(type, { v: /test/i })).toEqual({ v: /test/i });
    });
});

describe('binary round-trips', () => {
    test('Uint8Array', () => {
        const type = typeOf<{ v: Uint8Array }>();
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const result = roundTrip(type, { v: data });
        expect(result.v).toBeInstanceOf(Uint8Array);
        expect([...result.v]).toEqual([1, 2, 3, 4, 5]);
    });

    test('ArrayBuffer', () => {
        const type = typeOf<{ v: ArrayBuffer }>();
        const buffer = new ArrayBuffer(5);
        new Uint8Array(buffer).set([1, 2, 3, 4, 5]);
        const result = roundTrip(type, { v: buffer });
        expect(result.v).toBeInstanceOf(ArrayBuffer);
        expect([...new Uint8Array(result.v)]).toEqual([1, 2, 3, 4, 5]);
    });
});

describe('collection round-trips', () => {
    test('array', () => {
        const type = typeOf<{ v: number[] }>();
        expect(roundTrip(type, { v: [1, 2, 3] })).toEqual({ v: [1, 2, 3] });
        expect(roundTrip(type, { v: [] })).toEqual({ v: [] });
    });

    test('Set', () => {
        const type = typeOf<{ v: Set<string> }>();
        const result = roundTrip(type, { v: new Set(['a', 'b', 'c']) });
        expect(result.v).toBeInstanceOf(Set);
        expect([...result.v]).toEqual(['a', 'b', 'c']);
    });

    test('Map', () => {
        const type = typeOf<{ v: Map<string, number> }>();
        const result = roundTrip(type, {
            v: new Map([
                ['a', 1],
                ['b', 2],
            ]),
        });
        expect(result.v).toBeInstanceOf(Map);
        expect(result.v.get('a')).toBe(1);
        expect(result.v.get('b')).toBe(2);
    });

    test('nested array', () => {
        const type = typeOf<{ v: number[][] }>();
        expect(
            roundTrip(type, {
                v: [
                    [1, 2],
                    [3, 4],
                ],
            }),
        ).toEqual({
            v: [
                [1, 2],
                [3, 4],
            ],
        });
    });

    test('tuple', () => {
        const type = typeOf<{ v: [string, number, boolean] }>();
        expect(roundTrip(type, { v: ['hello', 42, true] })).toEqual({ v: ['hello', 42, true] });
    });
});

describe('object round-trips', () => {
    test('simple object', () => {
        const type = typeOf<{ name: string; age: number }>();
        expect(roundTrip(type, { name: 'Alice', age: 30 })).toEqual({ name: 'Alice', age: 30 });
    });

    test('nested object', () => {
        const type = typeOf<{ user: { name: string; profile: { bio: string } } }>();
        const data = { user: { name: 'Alice', profile: { bio: 'Hello' } } };
        expect(roundTrip(type, data)).toEqual(data);
    });

    test('optional properties', () => {
        const type = typeOf<{ name: string; age?: number }>();
        expect(roundTrip(type, { name: 'Alice', age: 30 })).toEqual({ name: 'Alice', age: 30 });
        expect(roundTrip(type, { name: 'Alice' })).toEqual({ name: 'Alice' });
    });

    test('index signature', () => {
        const type = typeOf<{ [key: string]: number }>();
        expect(roundTrip(type, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
    });
});

describe('union round-trips', () => {
    test('string | number', () => {
        const type = typeOf<{ v: string | number }>();
        expect(roundTrip(type, { v: 'hello' })).toEqual({ v: 'hello' });
        expect(roundTrip(type, { v: 42 })).toEqual({ v: 42 });
    });

    test('literal union', () => {
        const type = typeOf<{ v: 'a' | 'b' | 'c' }>();
        expect(roundTrip(type, { v: 'a' })).toEqual({ v: 'a' });
        expect(roundTrip(type, { v: 'b' })).toEqual({ v: 'b' });
        expect(roundTrip(type, { v: 'c' })).toEqual({ v: 'c' });
    });

    test('number literal union', () => {
        const type = typeOf<{ v: 1 | 2 | 3 }>();
        expect(roundTrip(type, { v: 1 })).toEqual({ v: 1 });
        expect(roundTrip(type, { v: 2 })).toEqual({ v: 2 });
        expect(roundTrip(type, { v: 3 })).toEqual({ v: 3 });
    });

    test('nullable', () => {
        const type = typeOf<{ v: string | null }>();
        expect(roundTrip(type, { v: 'hello' })).toEqual({ v: 'hello' });
        expect(roundTrip(type, { v: null })).toEqual({ v: null });
    });
});

describe('class round-trips', () => {
    test('simple class', () => {
        class User {
            constructor(
                public name: string,
                public age: number,
            ) {}
        }

        const type = typeOf<User>();
        const user = new User('Alice', 30);
        const result = roundTrip(type, user);
        expect(result.name).toBe('Alice');
        expect(result.age).toBe(30);
    });

    test('class with UUID primary key', () => {
        class Entity {
            id: UUID & PrimaryKey = uuid();
            name: string = '';
        }

        const type = typeOf<Entity>();
        const entity = new Entity();
        entity.name = 'test';
        const result = roundTrip(type, entity);
        expect(result.id).toBe(entity.id);
        expect(result.name).toBe('test');
    });

    test('class with excluded field', () => {
        class User {
            id: number = 0;
            password: string & Excluded = 'secret';
            name: string = '';
        }

        const type = typeOf<User>();
        const user = new User();
        user.id = 1;
        user.name = 'Alice';

        const json = serializeToJson(type, user);
        expect(json.password).toBeUndefined();
        expect(json.id).toBe(1);
        expect(json.name).toBe('Alice');
    });
});

describe('recursive round-trips', () => {
    test('self-referential type', () => {
        interface Node {
            value: number;
            next?: Node;
        }

        const type = typeOf<Node>();
        const data: Node = {
            value: 1,
            next: {
                value: 2,
                next: {
                    value: 3,
                },
            },
        };

        expect(roundTrip(type, data)).toEqual(data);
    });

    test('tree structure', () => {
        interface TreeNode {
            value: string;
            children: TreeNode[];
        }

        const type = typeOf<TreeNode>();
        const tree: TreeNode = {
            value: 'root',
            children: [
                { value: 'a', children: [] },
                {
                    value: 'b',
                    children: [{ value: 'b1', children: [] }],
                },
            ],
        };

        expect(roundTrip(type, tree)).toEqual(tree);
    });
});

describe('edge cases', () => {
    test('empty object', () => {
        const type = typeOf<{}>();
        expect(roundTrip(type, {})).toEqual({});
    });

    test('deeply nested', () => {
        const type = typeOf<{ a: { b: { c: { d: { e: string } } } } }>();
        const data = { a: { b: { c: { d: { e: 'deep' } } } } };
        expect(roundTrip(type, data)).toEqual(data);
    });

    test('large array', () => {
        const type = typeOf<{ v: number[] }>();
        const data = { v: Array.from({ length: 10000 }, (_, i) => i) };
        expect(roundTrip(type, data)).toEqual(data);
    });

    test('unicode strings', () => {
        const type = typeOf<{ v: string }>();
        const strings = ['中文测试', 'العربية', '日本語', '🎉🎊🎁', 'mixed: hello 世界 🌍'];

        for (const str of strings) {
            expect(roundTrip(type, { v: str })).toEqual({ v: str });
        }
    });
});

describe('Partial types', () => {
    test('Partial interface', () => {
        interface User {
            name: string;
            age: number;
            email: string;
        }

        const type = typeOf<Partial<User>>();

        // All fields provided
        expect(roundTrip(type, { name: 'Alice', age: 30, email: 'a@b.com' })).toEqual({
            name: 'Alice',
            age: 30,
            email: 'a@b.com',
        });

        // Some fields missing
        expect(roundTrip(type, { name: 'Alice' })).toEqual({ name: 'Alice' });
        expect(roundTrip(type, { age: 30 })).toEqual({ age: 30 });

        // Empty object
        expect(roundTrip(type, {})).toEqual({});
    });

    test('Partial class', () => {
        class Config {
            host: string = 'localhost';
            port: number = 3000;
            debug: boolean = false;
        }

        const type = typeOf<Partial<Config>>();
        expect(roundTrip(type, { host: 'example.com' })).toEqual({ host: 'example.com' });
        expect(roundTrip(type, { port: 8080, debug: true })).toEqual({ port: 8080, debug: true });
    });
});

describe('Record types', () => {
    test('Record with undefined values', () => {
        const type = typeOf<{ v: Record<string, number | undefined> }>();

        const data = { v: { a: 1, b: undefined, c: 3 } };
        const result = roundTrip(type, data);

        // When type allows undefined, BSON NULL preserves the key;
        // deserialized back as undefined with the key present.
        expect(result.v.a).toBe(1);
        expect(result.v.c).toBe(3);
        expect('b' in result.v).toBe(true);
        expect(result.v.b).toBe(undefined);
    });

    test('Record<string, number>', () => {
        const type = typeOf<Record<string, number>>();
        expect(roundTrip(type, { a: 1, b: 2, c: 3 })).toEqual({ a: 1, b: 2, c: 3 });
    });

    test('Record<string, object>', () => {
        const type = typeOf<Record<string, { id: number; name: string }>>();
        const data = {
            user1: { id: 1, name: 'Alice' },
            user2: { id: 2, name: 'Bob' },
        };
        expect(roundTrip(type, data)).toEqual(data);
    });
});

describe('Reference serialization', () => {
    test('Reference serializes to primary key', () => {
        class User {
            id: number & PrimaryKey = 0;
            name: string = '';
        }

        class Post {
            id: number & PrimaryKey = 0;
            author: User & Reference = new User();
        }

        const post = new Post();
        post.id = 1;
        post.author.id = 42;
        post.author.name = 'Alice';

        const type = typeOf<Post>();
        const json = serializeToJson(type, post);

        // Reference should serialize to just the primary key
        expect(json.author).toBe(42);
    });

    test('Reference in array', () => {
        class Tag {
            id: number & PrimaryKey = 0;
            name: string = '';
        }

        class Article {
            id: number = 0;
            tags: (Tag & Reference)[] = [];
        }

        const article = new Article();
        article.id = 1;
        const tag1 = new Tag();
        tag1.id = 10;
        tag1.name = 'tech';
        const tag2 = new Tag();
        tag2.id = 20;
        tag2.name = 'news';
        article.tags = [tag1, tag2];

        const type = typeOf<Article>();
        const json = serializeToJson(type, article);

        // References in array should serialize to primary keys
        expect(json.tags).toEqual([10, 20]);
    });
});

describe('MapName annotation', () => {
    test('MapName renames property in BSON', () => {
        class User {
            id: number = 0;
            userName: string & MapName<'user_name'> = '';
            emailAddress: string & MapName<'email'> = '';
        }

        const user = new User();
        user.id = 1;
        user.userName = 'alice';
        user.emailAddress = 'alice@example.com';

        const type = typeOf<User>();
        const json = serializeToJson(type, user);

        // Properties should be renamed in BSON
        expect(json.id).toBe(1);
        expect(json.user_name).toBe('alice');
        expect(json.email).toBe('alice@example.com');
        expect(json.userName).toBeUndefined();
        expect(json.emailAddress).toBeUndefined();
    });

    test('MapName deserialization', () => {
        class User {
            id: number = 0;
            userName: string & MapName<'user_name'> = '';
        }

        const type = typeOf<User>();
        const result = deserializeFromJson(type, { id: 1, user_name: 'alice' });

        expect(result.id).toBe(1);
        expect(result.userName).toBe('alice');
    });
});

describe('Class inheritance', () => {
    test('simple inheritance', () => {
        class Entity {
            id: number & PrimaryKey = 0;
            createdAt: Date = new Date();
        }

        class User extends Entity {
            name: string = '';
            email: string = '';
        }

        const user = new User();
        user.id = 1;
        user.name = 'Alice';
        user.email = 'alice@example.com';
        user.createdAt = new Date('2024-01-01T00:00:00.000Z');

        const type = typeOf<User>();
        const result = roundTrip(type, user);

        expect(result.id).toBe(1);
        expect(result.name).toBe('Alice');
        expect(result.email).toBe('alice@example.com');
        expect(result.createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
    });

    test('multi-level inheritance', () => {
        class Base {
            id: number = 0;
        }

        class Middle extends Base {
            type: string = '';
        }

        class Derived extends Middle {
            value: number = 0;
        }

        const derived = new Derived();
        derived.id = 1;
        derived.type = 'test';
        derived.value = 42;

        const type = typeOf<Derived>();
        const result = roundTrip(type, derived);

        expect(result.id).toBe(1);
        expect(result.type).toBe('test');
        expect(result.value).toBe(42);
    });
});

describe('Class with statics', () => {
    test('static properties are ignored', () => {
        class Config {
            static version = '1.0.0';
            static instance: Config | null = null;

            name: string = '';
            value: number = 0;
        }

        const config = new Config();
        config.name = 'test';
        config.value = 42;

        const type = typeOf<Config>();
        const json = serializeToJson(type, config);

        // Static properties should not be serialized
        expect(json.name).toBe('test');
        expect(json.value).toBe(42);
        expect(json.version).toBeUndefined();
        expect(json.instance).toBeUndefined();
    });
});

describe('Promise unwrapping', () => {
    test('Promise<T> serializes as T', () => {
        interface Response {
            data: Promise<string>;
        }

        const type = typeOf<Response>();
        const data = { data: 'hello' }; // Already resolved value
        const json = serializeToJson(type, data as any);

        expect(json.data).toBe('hello');
    });

    test('Promise in nested object', () => {
        interface Container {
            nested: {
                value: Promise<number>;
            };
        }

        const type = typeOf<Container>();
        const data = { nested: { value: 42 } };
        const json = serializeToJson(type, data as any);

        expect(json.nested.value).toBe(42);
    });
});

describe('Circular reference omission', () => {
    test('self-referential object omits circular reference', () => {
        class Node {
            id: number = 0;
            parent?: Node;
        }

        const node = new Node();
        node.id = 1;
        node.parent = node; // Circular reference

        const type = typeOf<Node>();
        const json = serializeToJson(type, node);

        // Circular reference should be omitted
        expect(json.id).toBe(1);
        expect(json.parent).toBeUndefined();
    });

    test('non-circular reference is preserved', () => {
        class Node {
            id: number = 0;
            parent?: Node;
        }

        const parent = new Node();
        parent.id = 1;

        const child = new Node();
        child.id = 2;
        child.parent = parent;

        const type = typeOf<Node>();
        const json = serializeToJson(type, child);

        // Non-circular reference should be preserved
        expect(json.id).toBe(2);
        expect(json.parent).toEqual({ id: 1 });
    });

    test('indirect circular reference', () => {
        class A {
            id: number = 0;
            b?: B;
        }

        class B {
            id: number = 0;
            a?: A;
        }

        const a = new A();
        a.id = 1;
        const b = new B();
        b.id = 2;
        a.b = b;
        b.a = a; // Circular

        const type = typeOf<A>();
        const json = serializeToJson(type, a);

        expect(json.id).toBe(1);
        expect(json.b).toBeDefined();
        expect(json.b.id).toBe(2);
        expect(json.b.a).toBeUndefined(); // Circular reference omitted
    });
});

describe('Nullable containers', () => {
    test('string[] | null', () => {
        const type = typeOf<{ v: string[] | null }>();

        // Array case
        expect(roundTrip(type, { v: ['a', 'b', 'c'] })).toEqual({ v: ['a', 'b', 'c'] });

        // Null case
        expect(roundTrip(type, { v: null })).toEqual({ v: null });
    });

    test('Map | null', () => {
        const type = typeOf<{ v: Map<string, number> | null }>();

        // Map case
        const result = roundTrip(type, { v: new Map([['a', 1]]) });
        expect(result.v).toBeInstanceOf(Map);
        expect(result.v!.get('a')).toBe(1);

        // Null case
        expect(roundTrip(type, { v: null })).toEqual({ v: null });
    });

    test('Set<number> | null', () => {
        const type = typeOf<{ v: Set<number> | null }>();

        // Set case
        const result = roundTrip(type, { v: new Set([1, 2, 3]) });
        expect(result.v).toBeInstanceOf(Set);
        expect([...result.v!]).toEqual([1, 2, 3]);

        // Null case
        expect(roundTrip(type, { v: null })).toEqual({ v: null });
    });

    test('object | undefined', () => {
        const type = typeOf<{ v?: { name: string } }>();

        // Object case
        expect(roundTrip(type, { v: { name: 'test' } })).toEqual({ v: { name: 'test' } });

        // Undefined case (missing)
        expect(roundTrip(type, {})).toEqual({});
    });
});

describe('Embedded types', () => {
    test('embedded object flattens properties', () => {
        class Address {
            street: string = '';
            city: string = '';
            zip: string = '';
        }

        class User {
            id: number = 0;
            name: string = '';
            address: Embedded<Address> = new Address();
        }

        const user = new User();
        user.id = 1;
        user.name = 'Alice';
        user.address.street = '123 Main St';
        user.address.city = 'Springfield';
        user.address.zip = '12345';

        const type = typeOf<User>();
        const json = serializeToJson(type, user);

        // Embedded properties should be flattened into parent
        expect(json.id).toBe(1);
        expect(json.name).toBe('Alice');
        expect(json.street).toBe('123 Main St');
        expect(json.city).toBe('Springfield');
        expect(json.zip).toBe('12345');
        expect(json.address).toBeUndefined(); // No nested object
    });

    test('embedded with prefix', () => {
        class Coordinates {
            lat: number = 0;
            lng: number = 0;
        }

        class Location {
            id: number = 0;
            coords: Embedded<Coordinates, { prefix: 'loc_' }> = new Coordinates();
        }

        const loc = new Location();
        loc.id = 1;
        loc.coords.lat = 40.7128;
        loc.coords.lng = -74.006;

        const type = typeOf<Location>();
        const json = serializeToJson(type, loc);

        // Embedded properties should have prefix
        expect(json.id).toBe(1);
        expect(json.loc_lat).toBe(40.7128);
        expect(json.loc_lng).toBe(-74.006);
        expect(json.coords).toBeUndefined();
    });

    test('embedded deserialization', () => {
        class Settings {
            theme: string = 'light';
            notifications: boolean = true;
        }

        class Profile {
            id: number = 0;
            settings: Embedded<Settings> = new Settings();
        }

        const type = typeOf<Profile>();
        // When deserializing, flattened properties become embedded object
        const result = deserializeFromJson(type, {
            id: 1,
            theme: 'dark',
            notifications: false,
        });

        expect(result.id).toBe(1);
        expect(result.settings.theme).toBe('dark');
        expect(result.settings.notifications).toBe(false);
    });

    test('multiple embedded objects', () => {
        class Name {
            first: string = '';
            last: string = '';
        }

        class Contact {
            phone: string = '';
            email: string = '';
        }

        class Person {
            id: number = 0;
            name: Embedded<Name, { prefix: 'name_' }> = new Name();
            contact: Embedded<Contact, { prefix: 'contact_' }> = new Contact();
        }

        const person = new Person();
        person.id = 1;
        person.name.first = 'Alice';
        person.name.last = 'Smith';
        person.contact.phone = '555-1234';
        person.contact.email = 'alice@example.com';

        const type = typeOf<Person>();
        const json = serializeToJson(type, person);

        expect(json.id).toBe(1);
        expect(json.name_first).toBe('Alice');
        expect(json.name_last).toBe('Smith');
        expect(json.contact_phone).toBe('555-1234');
        expect(json.contact_email).toBe('alice@example.com');
    });
});
