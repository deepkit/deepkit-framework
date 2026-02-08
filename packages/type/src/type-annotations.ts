import { ClassType, TypeAnnotation } from '@deepkit/core';

import {
    ReflectionKind,
    Type,
    TypeClass,
    TypeObjectLiteral,
    resolveProperty,
    typeToObject,
} from './reflection/type.js';
import type { ValidatorError } from './validator.js';

export type ValidatorMeta<Name extends string, Args extends [...args: any[]] = []> = TypeAnnotation<
    'validator',
    [Name, Args]
>;
export type ValidateFunction = (value: any, type: Type, options: any) => ValidatorError | void;
export type Validate<T extends ValidateFunction, Options extends Parameters<T>[2] = unknown> = ValidatorMeta<
    'function',
    [T, Options]
>;
export type Pattern<T extends RegExp> = ValidatorMeta<'pattern', [T]>;
export type Alpha = ValidatorMeta<'alpha'>;
export type Alphanumeric = ValidatorMeta<'alphanumeric'>;
export type Ascii = ValidatorMeta<'ascii'>;
export type Decimal<MinDigits extends number = 1, MaxDigits extends number = 100> = ValidatorMeta<
    'decimal',
    [MinDigits, MaxDigits]
>;
export type MultipleOf<Num extends number> = ValidatorMeta<'multipleOf', [Num]>;
export type MinLength<Length extends number> = ValidatorMeta<'minLength', [Length]>;
export type MaxLength<Length extends number> = ValidatorMeta<'maxLength', [Length]>;
export type Includes<T extends string | number | boolean> = ValidatorMeta<'includes', [T]>;
export type Excludes<T extends string | number | boolean> = ValidatorMeta<'excludes', [T]>;
export type Minimum<T extends number | bigint> = ValidatorMeta<'minimum', [T]>;
export type Maximum<T extends number | bigint> = ValidatorMeta<'maximum', [T]>;
/**
 Includes 0. Use PositiveNoZero to exclude 0.
 */
export type Positive = ValidatorMeta<'positive', unknown & [true]>;
/**
 * Includes 0. Use NegativeNoZero to exclude 0.
 */
export type Negative = ValidatorMeta<'negative', [true]>;
export type PositiveNoZero = ValidatorMeta<'positive', [false]>;
export type NegativeNoZero = ValidatorMeta<'negative', [false]>;
export type ExclusiveMinimum<T extends number | bigint> = ValidatorMeta<'exclusiveMinimum', [T]>;
export type ExclusiveMaximum<T extends number | bigint> = ValidatorMeta<'exclusiveMaximum', [T]>;
export type BeforeDate<T extends number> = ValidatorMeta<'beforeDate', [T]>;
export type AfterDate<T extends number> = ValidatorMeta<'afterDate', [T]>;
export type BeforeNow = ValidatorMeta<'beforeNow'>;
export type AfterNow = ValidatorMeta<'afterNow'>;
export const EMAIL_REGEX = /^\S+@\S+$/;
export type Email = string & Pattern<typeof EMAIL_REGEX>;
/**
 * Integer
 */
export type integer = number;
/**
 * Integer 8 bit.
 * Min value -127, max value 128
 */
export type int8 = number;
/**
 * Unsigned integer 8 bit.
 * Min value 0, max value 255
 */
export type uint8 = number;
/**
 * Integer 16 bit.
 * Min value -32768, max value 32767
 */
export type int16 = number;
/**
 * Unsigned integer 16 bit.
 * Min value 0, max value 65535
 */
export type uint16 = number;
/**
 * Integer 8 bit.
 * Min value -2147483648, max value 2147483647
 */
export type int32 = number;
/**
 * Unsigned integer 32 bit.
 * Min value 0, max value 4294967295
 */
export type uint32 = number;
/**
 * Float (same as number, but different semantic for databases).
 */
export type float = number;
/**
 * Float 32 bit.
 */
export type float32 = number;
/**
 * Float 64 bit.
 */
export type float64 = number;

export type Annotations = any; //actual { [name: symbol]: any[] };, but not support in older TS

export class AnnotationDefinition<T = true> {
    public symbol: symbol;

    constructor(public readonly id: string) {
        this.symbol = Symbol(id);
    }

    register(annotations: Annotations, data: T) {
        annotations[this.symbol] ||= [];
        annotations[this.symbol].push(data);
    }

    reset(annotations: Annotations) {
        //not `delete` so that Object.assign works
        annotations[this.symbol] = undefined;
    }

    registerType<TType extends Type>(type: TType, data: T): TType {
        type.annotations ||= {};
        this.register(type.annotations, data);
        return type;
    }

    replace(annotations: Annotations, annotation: T[]) {
        annotations[this.symbol] = annotation;
    }

    replaceType(type: Type, annotation: T[]) {
        type.annotations ||= {};
        type.annotations[this.symbol] = annotation;
    }

    getAnnotations(type: Type): T[] {
        if (type.annotations) return type.annotations[this.symbol] || [];
        return [];
    }

    getFirst(type: Type): T | undefined {
        return this.getAnnotations(type)[0];
    }

    hasAnnotations(type: Type): boolean {
        return this.getAnnotations(type).length > 0;
    }
}

export type AnnotationType<T extends AnnotationDefinition<any>> = T extends AnnotationDefinition<infer K> ? K : never;
export type ReferenceActions = 'RESTRICT' | 'NO ACTION' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';

export interface ReferenceOptions {
    /**
     * Default is CASCADE.
     */
    onDelete?: ReferenceActions;

    /**
     * Default is CASCADE.
     */
    onUpdate?: ReferenceActions;
}

/**
 * Assigns one or multiple groups to a type.
 *
 * @example
 * ```typescript
 * interface User {
 *     username: string;
 *     password: string & Group<'credentials'>;
 * }
 * ```
 */
export type Group<Name extends string> = TypeAnnotation<'group', Name>;
/**
 * Excludes the type from serialization of all kind.
 *
 * @example
 * ```typescript
 * interface User {
 *    username: string;
 *    password: string & Excluded;
 *  }
 *  ```
 */
export type Excluded<Name extends string = '*'> = TypeAnnotation<'excluded', Name>;
/**
 * Assigns arbitrary data to a type that can be read in runtime.
 *
 * @example
 * ```typescript
 * interface User {
 *   username: string;
 *   password: string & Data<'role', 'admin'>;
 * }
 * ```
 */
export type Data<Name extends string, Value> = TypeAnnotation<'data', [Name, Value]>;
/**
 * Resets an already set decorator to undefined.
 *
 * The required Name is the name of the type decorator (its first tuple entry).
 *
 * ```typescript
 * type Password = string & MinLength<6> & Excluded;
 *
 * interface UserCreationPayload {
 *     password: Password & ResetAnnotation<'excluded'>
 * }
 * ```
 */
export type ResetAnnotation<Name extends string> = TypeAnnotation<'reset', Name>;
export type IndexOptions = {
    name?: string;
    //index size. Necessary for blob/longtext, etc.
    size?: number;

    unique?: boolean;
    spatial?: boolean;
    sparse?: boolean;

    //only in mongodb
    fulltext?: boolean;
    where?: string;

    expireAfterSeconds?: number;
};
export type Unique<Options extends IndexOptions = {}> = TypeAnnotation<'index', Options & { unique: true }>;
export type Index<Options extends IndexOptions = {}> = TypeAnnotation<'index', Options>;

export interface DatabaseFieldOptions {
    /**
     * The name of the column in the database.
     * e.g. `userName: string & DatabaseField<{name: 'user_name'}>`
     *
     * Can alternatively also be configured by using a different NamingStrategy.
     */
    name?: string;

    /**
     *
     * e.g. `field: string & MySQL<{type: 'VARCHAR(255)'}>`
     */
    type?: string;

    /**
     * If the property is on a class, its initializer/default value is per default used.
     * This can be overridden using this option.
     * e.g. `field: string & MySQL<{default: 'abc'}>`
     */
    default?: any;

    /**
     * e.g. `field: string & MySQL<{defaultExpr: 'NOW()'}>`
     */
    defaultExpr?: any;

    /**
     * If true no default column value is inferred from the property initializer/default value.
     * e.g. `field: string & MySQL<{noDefault: true}> = ''`
     */
    noDefault?: true;

    /**
     * Skip this property in all queries and database migration files.
     */
    skip?: true;

    /**
     * Skip this property in database migration files. This excludes the property from the database, but
     * keeps it in the queries.
     */
    skipMigration?: true;
}

export interface MySQLOptions extends DatabaseFieldOptions {}

export interface PostgresOptions extends DatabaseFieldOptions {}

export interface SqliteOptions extends DatabaseFieldOptions {}

type Database<Name extends string, Options extends { [name: string]: any }> = TypeAnnotation<
    'database',
    [Name, Options]
>;
export type MySQL<Options extends MySQLOptions> = Database<'mysql', Options>;
export type Postgres<Options extends PostgresOptions> = Database<'postgres', Options>;
export type SQLite<Options extends SqliteOptions> = Database<'sqlite', Options>;
export type DatabaseField<Options extends DatabaseFieldOptions, Name extends string = '*'> = Database<Name, Options>;

/**
 * note: if this is adjusted, make sure to adjust ReflectionClass, entityAnnotation, and type serializer accordingly.
 */
export interface EntityOptions {
    name?: string;
    description?: string;
    collection?: string;
    database?: string;
    singleTableInheritance?: boolean;
    indexes?: { names: string[]; options: IndexOptions }[];
}

/**
 * Type to decorate an interface/object literal with entity information.
 *
 * ```typescript
 * interface User extends Entity<{name: 'user'}> {
 *     id: number & PrimaryKey & AutoIncrement;
 *     username: string & Unique;
 * }
 * ```
 */
export type Entity<T extends EntityOptions> = {} & TypeAnnotation<'entity', T>;
/**
 * Marks a property as primary key.
 * ```typescript
 * class Entity {
 *     id: number & Primary = 0;
 * }
 * ```
 */
export type PrimaryKey = TypeAnnotation<'primaryKey'>;
type TypeKeyOf<T> = T[keyof T];
export type PrimaryKeyFields<T> = any extends T
    ? any
    : { [P in keyof T]: Required<T[P]> extends Required<PrimaryKey> ? T[P] : never };
export type PrimaryKeyType<T> = any extends T ? any : TypeKeyOf<PrimaryKeyFields<T>>;
export type ReferenceFields<T> = {
    [P in keyof T]: Required<T[P]> extends Required<Reference> | Required<BackReference> ? T[P] : never;
};
/**
 * Marks a primary property key as auto-increment.
 *
 * ```typescript
 * class Entity {
 *     id: number & Primary & AutoIncrement = 0;
 * }
 * ```
 */
export type AutoIncrement = TypeAnnotation<'autoIncrement'>;
/**
 * UUID v4, as string, serialized as string in JSON, and binary in database.
 * Use `uuid()` as handy initializer.
 *
 * ```typescript
 * class Entity {
 *     id: UUID = uuid();
 * }
 * ```
 */
export type UUID = string & TypeAnnotation<'UUIDv4'>;
/**
 * MongoDB's ObjectID type. serialized as string in JSON, ObjectID in database.
 */
export type MongoId = string & TypeAnnotation<'mongoId'>;
/**
 * NanoId, a URL-friendly unique identifier as string.
 * Default length is 21 characters using URL-safe alphabet.
 * Use `nanoid()` as handy initializer.
 *
 * ```typescript
 * class Entity {
 *     id: NanoId & PrimaryKey = nanoid();
 * }
 * ```
 */
export type NanoId = string & TypeAnnotation<'nanoid'>;
/**
 * Same as `bigint` but serializes to unsigned binary with unlimited size (instead of 8 bytes in most databases).
 * Negative values will be converted to positive (abs(x)).
 *
 * ```typescript
 * class Entity {
 *     id: BinaryBigInt = 0n;
 * }
 * ```
 */
export type BinaryBigInt = bigint & TypeAnnotation<'binaryBigInt'>;
/**
 * Same as `bigint` but serializes to signed binary with unlimited size (instead of 8 bytes in most databases).
 * The binary has an additional leading sign byte and is represented as an uint: 255 for negative, 0 for zero, or 1 for positive.
 *
 * ```typescript
 * class Entity {
 *     id: SignedBinaryBigInt = 0n;
 * }
 * ```
 */
export type SignedBinaryBigInt = bigint & TypeAnnotation<'signedBinaryBigInt'>;

export interface BackReferenceOptions {
    /**
     * Necessary for normalised many-to-many relations. This defines the class of the pivot table/collection.
     */
    via?: ClassType | {};

    /**
     * A reference/backReference can define which reference on the other side
     * reference back. This is necessary when there are multiple outgoing references
     * to the same entity.
     */
    mappedBy?: string;
}

export type Reference<Options extends ReferenceOptions = {}> = TypeAnnotation<'reference', Options>;
export type BackReference<Options extends BackReferenceOptions = {}> = TypeAnnotation<'backReference', Options>;

/**
 * Options for the Inline annotation.
 * Controls which serializers should serialize the reference as a nested object.
 */
export interface InlineOptions {
    /**
     * List of serializer names where inline serialization is active.
     * If specified, only these serializers will output nested objects.
     * Example: { only: ['json'] } - only JSON serializer outputs nested, BSON outputs FK.
     */
    only?: string[];

    /**
     * List of serializer names where inline serialization is disabled.
     * These serializers will output FK even with & Inline.
     * Example: { except: ['bson'] } - BSON outputs FK, others output nested.
     */
    except?: string[];
}

/**
 * Marks a Reference field to be serialized as a nested object instead of just the foreign key.
 *
 * By default, `& Reference` fields serialize as FK only (just the primary key).
 * Adding `& Inline` changes this to serialize the full nested object.
 *
 * @example
 * ```typescript
 * class Post {
 *     // Serializes as FK: { author: 2 }
 *     author: User & Reference;
 *
 *     // Serializes as nested: { editor: { id: 3, name: "Bob" } }
 *     // Throws if not loaded via joinWith()
 *     editor: User & Reference & Inline;
 *
 *     // Nested only for JSON serializer, FK for BSON
 *     reviewer: User & Reference & Inline<{ only: ['json'] }>;
 * }
 * ```
 *
 * Note: MongoDB database serialization always outputs FK regardless of Inline.
 */
export type Inline<Options extends InlineOptions = {}> = TypeAnnotation<'inline', Options>;
export type EmbeddedMeta<Options> = TypeAnnotation<'embedded', Options>;
export type Embedded<T, Options extends { prefix?: string } = {}> = T & EmbeddedMeta<Options>;
export type MapName<Alias extends string, ForSerializer extends string = ''> = TypeAnnotation<
    'mapName',
    [Alias, ForSerializer]
>;

export interface EmbeddedOptions {
    prefix?: string;
}

export const embeddedAnnotation = new AnnotationDefinition<EmbeddedOptions>('embedded');

export function hasEmbedded(type: Type): boolean {
    if (type.kind === ReflectionKind.propertySignature || type.kind === ReflectionKind.property)
        return hasEmbedded(type.type);
    if (type.kind === ReflectionKind.union) return type.types.some(hasEmbedded);
    return embeddedAnnotation.getFirst(type) !== undefined;
}

export enum BinaryBigIntType {
    unsigned,
    signed,
}

export const binaryBigIntAnnotation = new AnnotationDefinition<BinaryBigIntType>('binaryBigInt');
export const groupAnnotation = new AnnotationDefinition<string>('group');
export const excludedAnnotation = new (class extends AnnotationDefinition<string> {
    isExcluded(type: Type, name: string): boolean {
        const excluded = this.getAnnotations(type);
        return excluded.includes('*') || excluded.includes(name);
    }
})('excluded');
export const dataAnnotation = new (class extends AnnotationDefinition<{ [name: string]: any }> {
    set<T extends Type>(type: T, key: string, value: any): T {
        const data = this.getFirst(type) || {};
        data[key] = value;
        this.replaceType(type, [data]);
        return type;
    }

    get(type: Type, key: string): any {
        const data = this.getFirst(type) || {};
        return data[key];
    }
})('data');
/**
 * All raw data from `TypeAnnotation<Name, Options>` types.
 */
export const typeAnnotation = new (class extends AnnotationDefinition<{ name: string; options: Type }> {
    /**
     * Returns the parsed Type to JS objects, e.g. `{name: string}` => `{name: 'xy'}`
     */
    getOption(type: Type, name: string): any {
        const options = this.getType(type, name);
        return options ? typeToObject(options) : undefined;
    }

    /**
     * Returns the Type object of the annotation which can be parsed with `typeToObject`.
     */
    getType(type: Type, name: string): Type | undefined {
        for (const v of this.getAnnotations(type)) {
            if (v.name === name) return v.options;
        }
        return;
    }
})('meta');
export const indexAnnotation = new AnnotationDefinition<IndexOptions>('index');
export const databaseAnnotation = new (class extends AnnotationDefinition<{
    name: string;
    options: { [name: string]: any };
}> {
    getDatabase<T extends DatabaseFieldOptions>(type: Type, name: string): T | undefined {
        let options: T | undefined = undefined;
        for (const annotation of this.getAnnotations(type)) {
            if (annotation.name === '*' || annotation.name === name) {
                if (!options) options = {} as T;
                Object.assign(options, annotation.options as T);
            }
        }
        return options as any;
    }
})('database');

export const referenceAnnotation = new AnnotationDefinition<ReferenceOptions>('reference');
export const inlineAnnotation = new AnnotationDefinition<InlineOptions>('inline');
export const entityAnnotation = new (class extends AnnotationDefinition<EntityOptions> {
    set<K extends keyof EntityOptions>(type: Type, name: K, value: EntityOptions[K]) {
        const data = this.getFirst(type) || {};
        data[name] = value;
        this.replaceType(type, [data]);
    }

    get(type: Type): EntityOptions {
        let data = this.getFirst(type);
        if (data) return data;
        data = {};
        this.replaceType(type, [data]);
        return data;
    }
})('entity');
export const mapNameAnnotation = new AnnotationDefinition<{ name: string; serializer?: string }>('mapName');
export const autoIncrementAnnotation = new AnnotationDefinition('autoIncrement');
export const primaryKeyAnnotation = new (class extends AnnotationDefinition {
    isPrimaryKey(type: Type): boolean {
        return this.getAnnotations(type).length > 0;
    }
})('primaryKey');

export interface BackReferenceOptionsResolved {
    /**
     * Necessary for normalised many-to-many relations. This defines the class of the pivot table/collection.
     */
    via?: TypeClass | TypeObjectLiteral;

    /**
     * A reference/backReference can define which reference on the other side
     * reference back. This is necessary when there are multiple outgoing references
     * to the same entity.
     */
    mappedBy?: string;
}

export const backReferenceAnnotation = new AnnotationDefinition<BackReferenceOptionsResolved>('backReference');
export const mongoIdAnnotation = new AnnotationDefinition('mongoID');
export const uuidAnnotation = new AnnotationDefinition('uuid');
export const nanoidAnnotation = new AnnotationDefinition('nanoid');

export function isUUIDType(type: Type): boolean {
    return uuidAnnotation.getFirst(type) !== undefined;
}

export function isPrimaryKeyType(type: Type): boolean {
    return primaryKeyAnnotation.isPrimaryKey(type);
}

export function isAutoIncrementType(type: Type): boolean {
    return autoIncrementAnnotation.getFirst(type) !== undefined;
}

export function isMongoIdType(type: Type): boolean {
    return mongoIdAnnotation.getFirst(type) !== undefined;
}

export function isNanoIdType(type: Type): boolean {
    return nanoidAnnotation.getFirst(type) !== undefined;
}

export function isBinaryBigIntType(type: Type): boolean {
    return binaryBigIntAnnotation.getFirst(type) !== undefined;
}

export function isReferenceType(type: Type): boolean {
    return referenceAnnotation.getFirst(resolveProperty(type)) !== undefined;
}

export function getReferenceType(type: Type): ReferenceOptions | undefined {
    return referenceAnnotation.getFirst(resolveProperty(type));
}

export function isBackReferenceType(type: Type): boolean {
    return backReferenceAnnotation.getFirst(resolveProperty(type)) !== undefined;
}

export function getBackReferenceType(type: Type): BackReferenceOptionsResolved {
    const options = backReferenceAnnotation.getFirst(type);
    if (!options) throw new Error('No back reference');
    return options;
}
