/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { DatabaseQueryModel, Entity, SORT_ORDER } from '@deepkit/orm';

type BSONTypeAlias =
    | 'number'
    | 'double' | 'string' | 'object' | 'array'
    | 'binData' | 'undefined' | 'objectId' | 'bool'
    | 'date' | 'null' | 'regex' | 'dbPointer' | 'javascript'
    | 'symbol' | 'javascriptWithScope' | 'int' | 'timestamp'
    | 'long' | 'decimal' | 'minKey' | 'maxKey';

/** https://docs.mongodb.com/manual/reference/operator/query-bitwise */
type BitwiseQuery =
    | number    /** <numeric bitmask> */
    | number[]; /** [ <position1>, <position2>, ... ] */

// we can search using alternative types in mongodb e.g.
// string types can be searched using a regex in mongo
// array types can be searched using their element type
type RegExpForString<T> = T extends string ? (RegExp | T) : T;
type MongoAltQuery<T> =
    T extends Array<infer U> ? (T | RegExpForString<U>) :
    RegExpForString<T>;

/** https://docs.mongodb.com/manual/reference/operator/query/#query-selectors */
export type QuerySelector<T> = {
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
    $not?: T extends string ? (QuerySelector<T> | RegExp) : QuerySelector<T>;
    // Element
    /**
     * When `true`, `$exists` matches the documents that contain the field,
     * including documents where the field value is null.
     */
    $exists?: boolean;
    $type?: number | BSONTypeAlias;
    // Evaluation
    $expr?: any;
    $jsonSchema?: any;
    $mod?: T extends number ? [number, number] : never;
    $regex?: T extends string ? (RegExp | string) : never;
    $options?: T extends string ? string : never;
    // Geospatial
    // TODO: define better types for geo queries
    $geoIntersects?: { $geometry: object };
    $geoWithin?: object;
    $near?: object;
    $nearSphere?: object;
    $maxDistance?: number;
    // Array
    // TODO: define better types for $all and $elemMatch
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

export type RootQuerySelector<T> = {
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

export type ObjectQuerySelector<T> = T extends object ? { [key in keyof T]?: QuerySelector<T[key]> } : QuerySelector<T>;

export type Condition<T> = MongoAltQuery<T> | QuerySelector<MongoAltQuery<T>>;

export type FilterQuery<T> = {
    [P in keyof T]?: Condition<T[P]>;
} &
    RootQuerySelector<T>;

export type SORT_TYPE = SORT_ORDER | { $meta: "textScore" };
export type DEEP_SORT<T extends Entity> = { [P in keyof T]?: SORT_TYPE } & { [P: string]: SORT_TYPE };

export class MongoQueryModel<T extends Entity> extends DatabaseQueryModel<T, FilterQuery<T>, DEEP_SORT<T>> {
}
