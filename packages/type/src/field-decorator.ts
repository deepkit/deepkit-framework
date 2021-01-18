/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType } from '@deepkit/core';
import { validators } from './validation-decorator';
import { BackReferenceOptions, ClassSchema, ForwardRefFn, IndexOptions, PropertySchema, PropertyValidator, ReferenceActions } from './model';
import { BackReference, PrimaryKey, Reference } from './types';
import { FlattenIfArray } from './utils';
import { PlainSchemaProps } from './decorators';

/**
 * @throws PropertyValidatorError when validation invalid
 */
export type ValidatorFn = (value: any, propertyName: string, classType?: ClassType) => void;

type ValidatorsToDecorator<T> = { [K in keyof typeof validators]: (typeof validators)[K] extends (...args: infer A) => any ? (...args: A) => FieldDecoratorResult<T> : never };

export type FieldDecoratorResult<T> = FieldDecoratorResultBase<T> & ValidatorsToDecorator<T>;

export interface FieldDecoratorResultBase<T> {
    (target: object, property?: string, parameterIndexOrDescriptor?: any): void;

    /**
     * Sets the name of this property. Important for cases where the actual name is lost during compilation.
     * This is only necessary in constructor arguments.
     */
    name(name: string): this;

    /**
     * Marks this field as owning reference to the foreign class.
     *
     * Its actual value is not written into the document itself, but stored
     * in its own collection/table and a reference is established using its primary field.
     * Without reference() field values are embedded into the main document.
     *
     * Owning reference means: Additional foreign key fields are automatically added if not already explicitly done.
     * Those additional fields are used to store the primary key of the foreign class.
     *
     * ReferenceActions defines what happens when either the target item is deleted (onDelete) or when
     * the primary key of the target item is changed (onUpdate).
     *
     * The default is CASCADE.
     *
     *   - RESTRICT: Forbids to delete the target item or change its primary key.
     *   - NO ACTION: WHen the target item is deled or primary key changed, no action is taken.
     *                The database might however throw FOREIGN KEY constraint failure errors when the target is
     *                deleted without setting this owning reference first to NULL or something different.
     *   - CASCADE: When the target item is deleted, then this item will be deleted as well. If the target primary key changes, then this reference adjusts automatically.
     *   - SET NULL: Sets this reference to NULL when target item is deleted or its primary key changed.
     *   - SET DEFAULT: Sets this reference to DEFAULT when target item is deleted or its primary key changed.
     */
    reference(options?: { onDelete?: ReferenceActions, onUpdate?: ReferenceActions }): FieldDecoratorResult<Reference<T>>;

    /**
     * Marks this reference as not-owning side.
     *
     * options.via: If the foreign class is not directly accessible, you can use a pivot collection/table
     *              using the `via` option. Make sure that the given class in `via` contains both reference
     *              (one back to this class and one to the actual foreign class).
     *
     * options.mappedBy: Explicitly set the name of the @t.reference() of the foreign class to which this backReference belongs to.
     *                   Per default it is automatically detected, but will fail if you the foreign class contains more
     *                   than one @t.reference() to the same class.
     * @param options
     */
    backReference(options?: BackReferenceOptions<FlattenIfArray<T>>): FieldDecoratorResult<BackReference<T>>;

    /**
     * Marks this type as optional (allow to set as undefined). Per default the type is required, this makes it optional.
     * TypeScript has in general its own convention that it most of the times works with optional values as undefined.
     * Some use-cases require to use optional values as null. Use then @t.nullable.
     *
     * Don't mix both .optional and .nullable, as this is most of the time not what you want.
     *
     * @example
     * ```typescript
     *     class Test {
     *         @t.optional label?: string;
     *
     *         @t.optional label2: string | undefined = undefined;
     *     }
     * ```
     *
     * @example
     * ```typescript
     *     class Test {
     *         @t.optional.nullable veryRare: string | undefined | null = null;
     *     }
     * ```
     */
    optional: FieldDecoratorResult<T | undefined>;

    /** 
     * Marks the field as required. This is the default, however in cases were you use ! you have to manually specify 
     * that this property is required.
    */
    required: FieldDecoratorResult<T>;

    /**
     * Marks this type as nullable (allow to set as null). Per default `undefined` and `null` are treated both as `undefined`,
     * basically ignoring `null` values. Null values fall back per default to the default property value. Using `nullable` keeps
     * the `null` value intact.
     *
     * @example
     * ```typescript
     *     class Test {
     *         @t.nullable label: string | null = null;
     *     }
     * ```
     */
    nullable: FieldDecoratorResult<T | null>;

    /**
     * Sets a default value.
     *
     * Internal note: Using in V our type T creates an TS issue: Type instantiation is excessively deep and possibly infinite.
     */
    default(v: (() => any) | T): FieldDecoratorResult<T>;

    /** 
     * Changes the value after serializing and deserialization to another value,
     * optionally for a particular serializer.
     * 
     * The function is called after all internal serializer/deserialization templates have been applied.
     * 
     * serializerName is the name of the serialzier. e.g. jsonSerializer has as name `json`. You can read the serializer's name in `jsonSerializer.name`;
     * 
     * Internal note: Unfortunately we can't annotate via `t: (v: T) => any` because that triggers a infinite circular type.
     * So it's to use the decorator typesafe via `@t.transform((user: User) => user.id)`.
    */
    transform<V extends T>(t: (v: V) => any, serializerName?: string): FieldDecoratorResult<T>;

    /** 
     * Changes the value after serializing (class to x) to another value, 
     * optionally for a particular serializer.
     * 
     * The function is called after all internal serializer templates have been applied.
     * 
     * serializerName is the name of the serialzier. e.g. jsonSerializer has as name `json`. You can read the serializer's name in `jsonSerializer.name`;
     * 
     * Internal note: Unfortunately we can't annotate via `t: (v: T) => any` because that triggers a infinite circular type.
     * So it's to use the decorator typesafe via `@t.transform((user: User) => user.id)`.
    */
    serialize<V extends T>(t: (v: V) => any, serializerName?: string): FieldDecoratorResult<T>;

    /** 
     * Changes the value after deserializing (x to class) to another value, 
     * optionally for a particular serializer.
     * 
     * The function is called after all internal deserializer templates have been applied.
     * 
     * serializerName is the name of the serialzier. e.g. jsonSerializer has as name `json`. You can read the serializer's name in `jsonSerializer.name`;
     * 
     * Internal note: Unfortunately we can't annotate via `t: (v: T) => any` because that triggers a infinite circular type.
     * So it's to use the decorator typesafe via `@t.transform((user: User) => user.id)`.
    */
    deserialize<V extends T>(t: (v: V) => any, serializerName?: string): FieldDecoratorResult<T>;

    /**
     * Sets a description.
     */
    description(description: string): this;

    /**
     * Marks this field as discriminant for the discriminator in union types.
     * See @t.union()
     */
    discriminant: this;

    /**
     * Mark the field as excluded from deserializing.
     * Serializing is not effected by this.
     * The given serializerName is the name of your serializer. `jsonSerializer` (classToPlain) has as name 'json'.
     * You find the name of the serializer using its `.name` attribute.
     * 
     * A special name of 'all' excludes this field for all serializers.
     * 
     * This exclusion is during compile time and can not be changed at runtime.
     * If you need a runtime exclude/include mechanism, use @t.group('groupName') and use in serialize method
     * the options to filter, e.g. serialize(item, {groupsExclude: ['groupName']}).
     */
    exclude(serializerName?: 'all' | 'json' | string): this;

    /**
     * Marks this field as an ID aka primary.
     * This is important if you interact with the database abstraction.
     *
     * Only one field in a class can be the ID.
     */
    primary: FieldDecoratorResult<PrimaryKey<T>>;

    /**
     * Marks this field as auto increment.
     *
     * Only available for the database abstraction.
     */
    autoIncrement: FieldDecoratorResult<T | undefined>;

    /**
     * @deprecated use `generic` instead
     */
    template(...templateArgs: (ClassType | ForwardRefFn<any> | ClassSchema | PlainSchemaProps | FieldDecoratorResult<any> | string | number | boolean)[]): this;

    /** 
     * Defines template arguments of a generic class. Very handy for types like Observables.
     *
     * ```typescript
     * class Stuff {
     * }
     *
     * class Page {
     *     @t.generic(Stuff)
     *     downloadStuff(): Observable<Stuff> {
     *          return new Observable<Stuff>((observer) => {
     *              observer.next(new Stuff());
     *          })
     *     }
     *
     *     //or more verbose way if the type is more complex.
     *     @t.generic(f.type(Stuff).optional)
     *     downloadStuffWrapper(): Observable<Stuff | undefined> {
     *          return new Observable<Stuff>((observer) => {
     *              observer.next(new Stuff());
     *          })
     *     }
     * }
     * ```
    */
    generic(...templateArgs: (ClassType | ForwardRefFn<any> | ClassSchema | PlainSchemaProps | FieldDecoratorResult<any> | string | number | boolean)[]): this;

    /**
     * Used to define an index on a field.
     */
    index(options?: IndexOptions, name?: string): this;

    /**
     * Adds custom data into the property schema.
     */
    data(key: string, value: any): this;

    /**
     * Puts the property into one or multiple groups.
     * Groups can be used to serialize only a subset of properties.
     * It's recommended to use enums to make sure you don't have magic
     * untyped strings.
     *
     * ```typescript
     * enum Group {
     *     confidential = 'confidential';
     * }
     *
     * class User {
     *     @f username: string;
     *     @t.group(Group.confidential) password: string;
     *
     *     @t.group('bar') foo: string;
     * }
     *
     * const user = new User();
     *
     * const plain = partialClassToPlain(User, user, {groupsExclude: [Group.confidential]});
     * ```
     */
    group(...names: string[]): this;

    /**
     * Used to define a field as MongoDB ObjectId. This decorator is necessary if you want to use Mongo's _id.
     *
     * ```typescript
     * class Page {
     *     @t.mongoId
     *     referenceToSomething?: string;
     *
     *     constructor(
     *         @t.primary.mongoId
     *         public readonly _id: string
     *     ) {
     *
     *     }
     * }
     * ```
     */
    mongoId: FieldDecoratorResult<string>;

    /**
     * Used to define a field as UUID (v4).
     */
    uuid: FieldDecoratorResult<string>;

    /**
     * @deprecated
     */
    parentReference: this;

    /**
     * Used to define a field as decorated.
     * This is necessary if you want to wrap a field value in the class instance using
     * a own class, like for example for Array manipulations, but keep the JSON and Database value
     * as primitive as possible.
     *
     * Only one field per class can be the decorated one.
     *
     * @category Decorator
     *
     * Example
     * ```typescript
     * export class PageCollection {
     *     @t.type(() => PageClass).decorated
     *     private readonly pages: PageClass[] = [];
     *
     *     constructor(pages: PageClass[] = []) {
     *         this.pages = pages;
     *     }
     *
     *     public count(): number {
     *         return this.pages.length;
     *     }
     *
     *     public add(name: string): number {
     *         return this.pages.push(new PageClass(name));
     *     }
     * }
     *
     * export class PageClass {
     *     @t.uuid
     *     id: string = uuid();
     *
     *     @f
     *     name: string;
     *
     *     @t.type(() => PageCollection)
     *     children: PageCollection = new PageCollection;
     *
     *     constructor(name: string) {
     *         this.name = name;
     *     }
     * }
     * ```
     *
     * If you use classToPlain(PageClass, ...) or classToMongo(PageClass, ...) the field value of `children` will be the type of
     * `PageCollection.pages` (always the field where @Decorated() is applied to), here a array of PagesClass `PageClass[]`.
     */
    decorated: this;

    /**
     * @internal
     */
    partial: this;

    /**
     * Uses an additional modifier to change the PropertySchema.
     */
    use(decorator: (target: object, property: PropertySchema) => void): this;

    /**
     * Adds a custom validator class or validator callback.
     * The validator has to throw a new instance of `PropertyValidatorError` if invalid.
     *
     * @example
     * ```typescript
     * import {PropertyValidator, PropertyValidatorError} from '@deepkit/type';
     *
     * class MyCustomValidator implements PropertyValidator {
     *      async validate<T>(value: any, target: ClassType<T>, propertyName: string) {
     *          if (value.length > 10) throw new PropertyValidatorError('too_long', 'Too long :()');
     *      };
     * }
     *
     * class Entity {
     *     @t.validator(MyCustomValidator)
     *     name: string;
     *
     *     @t.validator(MyCustomValidator)
     *     name: string;
     *
     *     @t.validator((value: any, target: ClassType, propertyName: string) => {
     *          if (value.length > 255) throw new PropertyValidatorError('too_long', 'Too long :()');
     *     })
     *     title: string;
     * }
     * ```
     */
    validator(
        ...validators: (ClassType<PropertyValidator> | ValidatorFn)[]
    ): this;

    /**
     * Ignores validation on this property.
     */
    noValidation: this;

    /**
     * Creates a PropertySchema object from the given definition.
     */
    buildPropertySchema(name?: string, parent?: PropertySchema): PropertySchema;

    /**
     * Sets field (column) options for MySQL.
     */
    mysql(options: Partial<MySQLOptions>): FieldDecoratorResult<T>;

    /**
     * Sets field (column) options for PostgreSQL.
     */
    postgres(options: Partial<MySQLOptions>): FieldDecoratorResult<T>;

    /**
     * Sets field (column) options for SQLite.
     */
    sqlite(options: Partial<MySQLOptions>): FieldDecoratorResult<T>;
}

export interface MySQLOptions {
    type: string;
}

export interface PostgresOptions {
    type: string;
}

export interface SqliteOptions {
    type: string;
}

export function isFieldDecorator(t: any): t is FieldDecoratorResult<any> {
    return 'function' === typeof t && 'function' === typeof t.name && 'function' === typeof t.optional;
}
