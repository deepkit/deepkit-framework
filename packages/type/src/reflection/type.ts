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
    parameter,

    promise,

    /**
     * Uint8Array, Date, custom classes, Set, Map, etc
     */
    class,

    template,
    enum,
    union,
    intersection,

    array,
    tuple,
    tupleMember,

    rest,

    objectLiteral,
    indexSignature,
    propertySignature,
    methodSignature,

    infer,
}

export interface TypeBrandable {
    brands?: Type[];
}

export function isBrandable(type: Type): boolean {
    return type.kind === ReflectionKind.void || type.kind === ReflectionKind.string || type.kind === ReflectionKind.number || type.kind === ReflectionKind.boolean
        || type.kind === ReflectionKind.bigint || type.kind === ReflectionKind.null || type.kind === ReflectionKind.undefined || type.kind === ReflectionKind.literal;
}

export interface TypeNever {
    kind: ReflectionKind.never,
}

export interface TypeAny {
    kind: ReflectionKind.any,
}

export interface TypeVoid extends TypeBrandable {
    kind: ReflectionKind.void,
}

export interface TypeString extends TypeBrandable {
    kind: ReflectionKind.string,
}

export enum TypeNumberBrand {
    integer,

    int8,
    int16,
    int32,

    uint8,
    uint16,
    uint32,

    float,
    float32,
    float64,
}

export interface TypeNumber extends TypeBrandable {
    kind: ReflectionKind.number,
    brand?: TypeNumberBrand; //built in brand
}

export interface TypeBoolean extends TypeBrandable {
    kind: ReflectionKind.boolean,
}

export interface TypeBigInt extends TypeBrandable {
    kind: ReflectionKind.bigint,
}

export interface TypeNull extends TypeBrandable {
    kind: ReflectionKind.null,
}

export interface TypeUndefined extends TypeBrandable {
    kind: ReflectionKind.undefined,
}

export interface TypeLiteral extends TypeBrandable {
    kind: ReflectionKind.literal,
    literal: symbol | string | number | boolean | bigint;
}

export interface TypeLiteralMember {
    visibility: ReflectionVisibility,
    abstract?: true;
    optional?: true,
    readonly?: true;
}

export interface TypeParameter {
    kind: ReflectionKind.parameter,
    name: string;
    type: Type;

    //parameter could be a property as well if visibility is set
    visibility?: ReflectionVisibility,
    readonly?: true;
    optional?: true,
}

export interface TypeMethod extends TypeLiteralMember {
    kind: ReflectionKind.method,
    visibility: ReflectionVisibility,
    name: number | string | symbol;
    parameters: TypeParameter[];
    optional?: true,
    abstract?: true;
    return: Type;
}

export interface TypeProperty extends TypeLiteralMember {
    kind: ReflectionKind.property,
    visibility: ReflectionVisibility,
    name: number | string | symbol;
    optional?: true,
    readonly?: true;
    abstract?: true;
    description?: string;
    type: Type;
    default?: () => any
}

export interface TypeFunction {
    kind: ReflectionKind.function,
    name?: string,
    parameters: TypeParameter[];
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
     * When class has generic template arguments, e.g. MyClass<string>, it contains
     * all template arguments. If no template arguments are given, its undefined.
     */
    arguments?: Type[];

    /**
     * properties/methods.
     */
    types: Type[];
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
    types: Type[];
}

export interface TypeIntersection {
    kind: ReflectionKind.intersection,
    types: Type[];
}

export interface TypeArray {
    kind: ReflectionKind.array,
    type: Type;
}

export interface TypePropertySignature {
    kind: ReflectionKind.propertySignature,
    name: number | string | symbol;
    optional?: true;
    readonly?: true;
    description?: string;
    type: Type;
}

export interface TypeMethodSignature {
    kind: ReflectionKind.methodSignature,
    name: number | string | symbol;
    optional?: true;
    parameters: TypeParameter[];
    return: Type;
}

export interface TypeObjectLiteral {
    kind: ReflectionKind.objectLiteral,
    types: (TypeIndexSignature | TypePropertySignature | TypeMethodSignature)[];
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

export interface TypeTupleMember {
    kind: ReflectionKind.tupleMember,
    type: Type;
    optional?: true;
    name?: string;
}

export interface TypeTuple {
    kind: ReflectionKind.tuple,
    types: TypeTupleMember[]
}

export interface TypeRest {
    kind: ReflectionKind.rest,
    type: Type
}

export type Type = TypeNever | TypeAny | TypeVoid | TypeString | TypeNumber | TypeBoolean | TypeBigInt | TypeNull | TypeUndefined | TypeLiteral
    | TypeParameter | TypeFunction | TypeMethod | TypeProperty | TypePromise | TypeClass | TypeEnum | TypeUnion | TypeIntersection | TypeArray
    | TypeObjectLiteral | TypeIndexSignature | TypePropertySignature | TypeMethodSignature | TypeTemplate | TypeInfer | TypeTuple | TypeTupleMember
    | TypeRest
    ;

export function isType(entry: any): entry is Type {
    return 'object' === typeof entry && entry.constructor === Object && 'kind' in entry;
}

type FindType<K extends Type['kind'], T = Type> = T extends { kind: K } ? T : never;

export function assertType<K extends Type['kind'], T>(t: Type, kind: K): asserts t is FindType<K> {
    if (t.kind !== kind) throw new Error(`Invalid type ${t.kind}, expected ${kind}`);
}

export function isOptional(type: Type): boolean {
    return type.kind === ReflectionKind.undefined || (type.kind === ReflectionKind.union && type.types.some(v => v.kind === ReflectionKind.undefined));
}

export function isNullable(type: Type): boolean {
    return type.kind === ReflectionKind.null || (type.kind === ReflectionKind.union && type.types.some(v => v.kind === ReflectionKind.null));
}

export type integer = number;
export type int8 = number;
export type uint8 = number;
export type int16 = number;
export type uint16 = number;
export type int32 = number;
export type uint32 = number;
export type float = number;
export type float32 = number;
export type float64 = number;

export type Reference = { __meta?: 'reference' };
export type PrimaryKey = { __meta?: 'primaryKey' };
export type BackReference<T extends ClassType = any, VIA extends keyof T = any> = { __meta?: 'backReference', backReference?: { class: T, via: VIA } };

export const enum MappedModifier {
    optional = 1 << 0,
    removeOptional = 1 << 1,
    readonly = 1 << 2,
    removeReadonly = 1 << 3,
}

/**
 * The instruction set.
 * Not more than `packSize` elements are allowed (can be stored).
 */
export enum ReflectionOp {
    never,
    any,
    void,

    string,
    number,
    numberBrand,
    boolean,
    bigint,

    null,
    undefined,

    /**
     * The literal type of string, number, or boolean.
     *
     * This OP has 1 parameter. The next byte is the absolute address of the literal on the stack, which is the actual literal value.
     *
     * Pushes a function type.
     */
    literal,

    /**
     * This OP pops all types on the current stack frame.
     *
     * This OP has 1 parameter. The next byte is the absolute address of a string|number|symbol entry on the stack.
     *
     * Pushes a function type.
     */
    function,

    /**
     * This OP pops all types on the current stack frame.
     *
     * Pushes a method type.
     */
    method,
    methodSignature, //has 1 parameter, reference to stack for its property name

    parameter,

    /**
     * This OP pops the latest type entry on the stack.
     *
     * Pushes a property type.
     */
    property,
    propertySignature, //has 1 parameter, reference to stack for its property name

    constructor,

    /**
     * This OP pops all types on the current stack frame. Those types should be method|property.
     *
     * Pushes a class type.
     */
    class,

    /**
     * This OP has 1 parameter, the stack entry to the actual class symbol.
     */
    classReference,

    /**
     * Marks the last entry in the stack as optional. Used for method|property. Equal to the QuestionMark operator in a property assignment.
     */
    optional,
    readonly,

    //modifiers for property|method
    public,
    private,
    protected,
    abstract,
    defaultValue,
    description,
    rest,

    /**
     * This OP has 1 parameter. The next byte is the absolute address of a enum entry on the stack.
     */
    enum,

    /**
     * This OP pops all members on the stack frame and pushes a new enum type.
     */
    constEnum,

    set,
    map,

    /**
     * Pops the latest stack entry and uses it as T for an array type.
     *
     * Pushes an array type.
     */
    array,
    tuple,
    tupleMember,
    namedTupleMember, //has one argument

    union, //pops frame. requires frame start when stack can be dirty.
    intersection,

    indexSignature,
    objectLiteral,
    mappedType,
    in,

    frame, //creates a new stack frame
    return,

    //special instructions that exist to emit less output
    date,
    int8Array,
    uint8ClampedArray,
    uint8Array,
    int16Array,
    uint16Array,
    int32Array,
    uint32Array,
    float32Array,
    float64Array,
    bigInt64Array,
    arrayBuffer,
    promise,

    // pointer, //parameter is a number referencing an entry in the stack, relative to the very beginning (0). pushes that entry onto the stack.
    arg, //@deprecated. parameter is a number referencing an entry in the stack, relative to the beginning of the current frame, *-1. pushes that entry onto the stack. this is related to the calling convention.
    template, //template argument, e.g. T in a generic. has 1 parameter: reference to the name.
    var, //reserve a new variable in the stack
    loads, //pushes to the stack a referenced value in the stack. has 2 parameters: <frame> <index>, frame is a negative offset to the frame, and index the index of the stack entry withing the referenced frame

    query, //T['string'], 2 items on the stack
    keyof, //keyof operator
    infer, //2 params, like `loads`

    condition,
    jumpCondition, //used when INFER is used in `extends` conditional branch
    jump, //jump to an address
    call, //has one parameter, the next program address. creates a new stack frame with current program address as first stack entry, and jumps back to that + 1.
    inline,
    inlineCall,


    extends, //X extends Y, XY popped from the stack, pushes boolean on the stack
}
