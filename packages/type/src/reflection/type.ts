/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType } from '@deepkit/core';

export enum ReflectionVisibility {
    public,
    protected,
    private,
}

export enum ReflectionKind {
    never,
    any,
    void,
    string,
    number,
    boolean,
    bigint,
    null,
    undefined,

    literal,
    property,
    method,
    function,
    promise,

    /**
     * Uint8Array, Date, custom classes, Set, Map, etc
     */
    class,

    template,
    enum,
    union,

    array,

    objectLiteral,
    indexSignature,
    propertySignature,
    methodSignature,

    infer,
}

export interface TypeNever {
    kind: ReflectionKind.never,
}

export interface TypeAny {
    kind: ReflectionKind.any,
}

export interface TypeVoid {
    kind: ReflectionKind.void,
}

export interface TypeString {
    kind: ReflectionKind.string,
}

export interface TypeNumber {
    kind: ReflectionKind.number,
}

export interface TypeBoolean {
    kind: ReflectionKind.boolean,
}

export interface TypeBigInt {
    kind: ReflectionKind.bigint,
}

export interface TypeNull {
    kind: ReflectionKind.null,
}

export interface TypeUndefined {
    kind: ReflectionKind.undefined,
}

export interface TypeLiteral {
    kind: ReflectionKind.literal,
    literal: symbol | string | number | boolean | bigint;
}

export interface TypeLiteralMember {
    visibility: ReflectionVisibility,
    abstract?: true;
    optional?: true,
    readonly?: true;
}

export interface TypeMethod extends TypeLiteralMember {
    kind: ReflectionKind.method,
    visibility: ReflectionVisibility,
    name?: number | string | symbol;
    parameters: Type[];
    optional?: true,
    abstract?: true;
    return: Type;
}

export interface TypeProperty extends TypeLiteralMember {
    kind: ReflectionKind.property,
    visibility: ReflectionVisibility,
    name?: number | string | symbol;
    optional?: true,
    readonly?: true;
    abstract?: true;
    type: Type;
}

export interface TypeFunction {
    kind: ReflectionKind.function,
    name?: string,
    parameters: Type[];
    return: Type;
}

export interface TypePromise {
    kind: ReflectionKind.promise,
    type: Type;
}

export interface TypeClass {
    kind: ReflectionKind.class,
    classType: ClassType;
    /**
     * When class has generic template arguments, e.g. MyClass<string>
     */
    types?: Type[];

    /**
     * properties/methods.
     */
    members: Type[];
}

export interface TypeEnum {
    kind: ReflectionKind.enum,
    enumType: object;
}

export interface TypeTemplate {
    kind: ReflectionKind.template,
    name: string,
}

export interface TypeUnion {
    kind: ReflectionKind.union,
    members: Type[];
}

export interface TypeArray {
    kind: ReflectionKind.array,
    elementType: Type;
}

export interface TypePropertySignature {
    kind: ReflectionKind.propertySignature,
    name?: number | string | symbol;
    optional?: true;
    readonly?: true;
    type: Type;
}

export interface TypeMethodSignature {
    kind: ReflectionKind.methodSignature,
    name?: number | string | symbol;
    optional?: true;
    parameters: Type[];
    return: Type;
}

export interface TypeObjectLiteral {
    kind: ReflectionKind.objectLiteral,
    //todo: TypeProperty -> TypePropertySignature, TypeMethod -> TypeMethodSignature
    members: (TypeIndexSignature | TypePropertySignature | TypeMethodSignature)[];
}

export interface TypeIndexSignature {
    kind: ReflectionKind.indexSignature,
    index: Type;
    type: Type;
}

export interface TypeInfer {
    kind: ReflectionKind.infer,
    set(type: Type): void;
}

export type Type = TypeNever | TypeAny | TypeVoid | TypeString | TypeNumber | TypeBoolean | TypeBigInt | TypeNull | TypeUndefined | TypeLiteral
    | TypeFunction | TypeMethod | TypeProperty | TypePromise | TypeClass | TypeEnum | TypeUnion | TypeArray
    | TypeObjectLiteral | TypeIndexSignature | TypePropertySignature | TypeMethodSignature | TypeTemplate | TypeInfer
    ;

export function isType(entry: any): entry is Type {
    return 'object' === typeof entry && 'kind' in entry;
}

type FindType<K extends Type['kind'], T = Type> = T extends { kind: K } ? T : never;

export function assertType<K extends Type['kind'], T>(t: Type, kind: K): asserts t is FindType<K> {
    if (t.kind !== kind) throw new Error(`Invalid type ${t.kind}, expected ${kind}`);
}
