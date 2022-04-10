import { expect, test } from '@jest/globals';
import { typeOf } from '../src/reflection/reflection';
import { cast } from '../src/serializer-facade';

type BSONTypeAlias =
    | 'number'
    | 'double' | 'string' | 'object' | 'array'
    | 'binData' | 'undefined' | 'objectId' | 'bool'
    | 'date' | 'null' | 'regex' | 'dbPointer' | 'javascript'
    | 'symbol' | 'javascriptWithScope' | 'int' | 'timestamp'
    | 'long' | 'decimal' | 'minKey' | 'maxKey';

/** https://docs.mongodb.com/manual/reference/operator/query-bitwise */
type BitwiseQuery = number | number[];

// we can search using alternative types in mongodb e.g.
// string types can be searched using a regex in mongo
// array types can be searched using their element type
type RegExpForString<T> = T extends string ? (RegExp | T) : T;
type MongoAltQuery<T> =
    T extends Array<infer U> ? (T | RegExpForString<U>) :
        RegExpForString<T>;

/** https://docs.mongodb.com/manual/reference/operator/query/#query-selectors */
type QuerySelector<T> = {
    // Comparison
    $eq?: T;
    $gt?: T;
    $gte?: T;
    $in?: T[];
    $lt?: T;
    $lte?: T;
    $ne?: T;
    $nin?: T[];
    // Logical
    // $not?: T extends string ? (QuerySelector<T> | RegExp) : QuerySelector<T>;
    // Element
    $exists?: boolean;
    $type?: number | BSONTypeAlias;
    // Evaluation
    $expr?: any;
    $jsonSchema?: any;
    $mod?: T extends number ? [number, number] : never;
    $regex?: T extends string ? (RegExp | string) : never;
    $options?: T extends string ? string : never;
    // Geospatial
    $geoIntersects?: { $geometry: object };
    $geoWithin?: object;
    $near?: object;
    $nearSphere?: object;
    $maxDistance?: number;
    // Array
    $all?: T extends Array<infer U> ? any[] : never;
    $elemMatch?: T extends Array<infer U> ? object : never;
    $size?: T extends Array<infer U> ? number : never;
    // Bitwise
    $bitsAllClear?: BitwiseQuery;
    $bitsAllSet?: BitwiseQuery;
    $bitsAnyClear?: BitwiseQuery;
    $bitsAnySet?: BitwiseQuery;

    //special deepkit/type type
    $parameter?: string;
};

type RootQuerySelector<T> = {
    /** https://docs.mongodb.com/manual/reference/operator/query/and/#op._S_and */
    $and?: Array<FilterQuery<T>>;
    /** https://docs.mongodb.com/manual/reference/operator/query/nor/#op._S_nor */
    $nor?: Array<FilterQuery<T>>;
    /** https://docs.mongodb.com/manual/reference/operator/query/or/#op._S_or */
    $or?: Array<FilterQuery<T>>;
    /** https://docs.mongodb.com/manual/reference/operator/query/text */
    $text?: {
        $search: string;
        $language?: string;
        $caseSensitive?: boolean;
        $diacraticSensitive?: boolean;
    };
    /** https://docs.mongodb.com/manual/reference/operator/query/where/#op._S_where */
    $where?: string | Function;
    /** https://docs.mongodb.com/manual/reference/operator/query/comment/#op._S_comment */
    $comment?: string;
    // we could not find a proper TypeScript generic to support nested queries e.g. 'user.friends.name'
    // this will mark all unrecognized properties as any (including nested queries)
    [key: string]: any;
};

type Condition<T> = MongoAltQuery<T> | QuerySelector<MongoAltQuery<T>>;

type FilterQuery<T> = {
    [P in keyof T]?: Condition<T[P]>;
} & RootQuerySelector<T>;

test('filter', () => {

    interface Product {
        id: number;
        title: string;
    }
    interface User {
        id: number;
        username: string;
    }

    type t = FilterQuery<User>;
    const type = typeOf<t>();
    // console.log(type);
    // console.log(stringifyResolvedType(type));

    expect(cast<t>({ username: 'peter' })).toEqual({ username: 'peter' });
    expect(cast<t>({ id: 3 })).toEqual({ id: 3 });
    expect(cast<t>({ $and: [{ username: 'peter' }, { id: 3 }] })).toEqual({ $and: [{ username: 'peter' }, { id: 3 }] });
});
