/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, getClassName, indent } from '@deepkit/core';
import { getProperty, toSignature } from './reflection';
import { isExtendable } from './extends';

export enum ReflectionVisibility {
    public,
    protected,
    private,
}

export const enum ReflectionKind {
    never,
    any,
    unknown,
    void,
    object,
    string,
    number,
    boolean,
    symbol,
    bigint,
    null,
    undefined,

    literal,
    templateLiteral,
    property,
    method,
    function,
    parameter,

    promise,

    /**
     * Uint8Array, Date, custom classes, Set, Map, etc
     */
    class,

    typeParameter,
    enum,
    union,
    intersection,

    array,
    tuple,
    tupleMember,
    enumMember,

    rest,
    regexp,

    objectLiteral,
    indexSignature,
    propertySignature,
    methodSignature,

    infer,
}

export type TypeDecorator = (annotations: Annotations, decorator: TypeObjectLiteral) => boolean;

export type Annotations = { [name: symbol]: any[] };

/**
 * @reflection never
 */
export interface TypeAnnotations {
    /**
     * If the type was created by a type function, this contains the alias name.
     */
    typeName?: string;

    /**
     * If the type was created by a type function, this contains the arguments passed the function.
     */
    typeArguments?: OuterType[];

    /**
     * Set for index access expressions, e.g. Config['property'].
     */
    indexAccessOrigin?: { container: TypeClass | TypeObjectLiteral, index: OuterType };

    annotations?: Annotations; //parsed decorator types as annotations
    decorators?: OuterType[]; //original decorator type
}

/**
 * Object to hold runtime jit data.
 */
export type JitContainer = { [name: string | symbol]: any };

export interface TypeRuntimeData {
    /**
     * A place where arbitrary jit functions and its cache data is stored.
     */
    jit?: JitContainer;
}

export function getTypeJitContainer(type: OuterType): JitContainer {
    if (!type.jit) type.jit = {};
    return type.jit;
}

export interface TypeNever extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.never,
    parent?: Type;
}

export interface TypeAny extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.any,
    parent?: Type;
}

export interface TypeUnknown extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.unknown,
    parent?: Type;
}

export interface TypeVoid extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.void,
    parent?: Type;
}

export interface TypeObject extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.object,
    parent?: Type;
}

export interface TypeOrigin {
    origin?: OuterType;
}

export interface TypeString extends TypeOrigin, TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.string,
    parent?: Type;
}

/**
 * note: Checks are based on range checks (>, <, etc), so when adding
 * new types a check is required for all code using `TypeNumberBrand`.
 */
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

export function isIntegerType(type: Type): type is TypeNumber {
    return type.kind === ReflectionKind.number && type.brand !== undefined && type.brand >= TypeNumberBrand.integer && type.brand <= TypeNumberBrand.uint32;
}

export interface TypeNumber extends TypeOrigin, TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.number,
    brand?: TypeNumberBrand; //built in brand
    parent?: Type;
}

export interface TypeBoolean extends TypeOrigin, TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.boolean,
    parent?: Type;
}

export interface TypeBigInt extends TypeOrigin, TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.bigint,
    parent?: Type;
}

export interface TypeSymbol extends TypeOrigin, TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.symbol,
    parent?: Type;
}

export interface TypeNull extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.null,
    parent?: Type;
}

export interface TypeUndefined extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.undefined,
    parent?: Type;
}

export interface TypeLiteral extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.literal,
    literal: symbol | string | number | boolean | bigint | RegExp;
    parent?: Type;
}

export interface TypeTemplateLiteral extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.templateLiteral,
    types: (TypeString | TypeAny | TypeNumber | TypeLiteral | TypeInfer)[]
    parent?: Type;
}

export interface TypeRegexp extends TypeOrigin, TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.regexp;
    parent?: Type;
}

export interface TypeBaseMember {
    visibility: ReflectionVisibility,
    abstract?: true;
    optional?: true,
    readonly?: true;
}

export interface TypeParameter extends TypeRuntimeData {
    kind: ReflectionKind.parameter,
    name: string;
    type: OuterType;
    parent: TypeFunction | TypeMethod | TypeMethodSignature;

    //parameter could be a property as well if visibility is set
    visibility?: ReflectionVisibility,
    readonly?: true;
    optional?: true,

    /**
     * Set when the parameter has a default value aka initializer.
     */
    default?: () => any
}

export interface TypeMethod extends TypeBaseMember {
    kind: ReflectionKind.method,
    parent: TypeClass;
    visibility: ReflectionVisibility,
    name: number | string | symbol;
    parameters: TypeParameter[];
    optional?: true,
    abstract?: true;
    return: OuterType;
}

export interface TypeProperty extends TypeBaseMember, TypeRuntimeData {
    kind: ReflectionKind.property,
    parent: TypeClass;
    visibility: ReflectionVisibility,
    name: number | string | symbol;
    optional?: true,
    readonly?: true;
    abstract?: true;
    description?: string;
    type: OuterType;

    /**
     * Set when the property has a default value aka initializer.
     */
    default?: () => any
}

export interface TypeFunction extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.function,
    parent?: Type;
    name?: number | string | symbol,
    function?: Function; //reference to the real function if available
    parameters: TypeParameter[];
    return: OuterType;
}

export interface TypePromise extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.promise,
    parent?: Type;
    type: OuterType;
}

export interface TypeClass extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.class,
    parent?: Type;
    classType: ClassType;

    /**
     * When the class extends another class and uses on it generic type arguments, then those arguments
     * are in this array.
     * For example `class A extends B<string, boolean> {}` then extendsArguments = [string, boolean].
     */
    extendsArguments?: Type[];

    /**
     * When class has generic type arguments, e.g. MyClass<string>, it contains
     * all type arguments. If no type arguments are given, it's undefined.
     */
    arguments?: Type[];

    /**
     * properties/methods.
     */
    types: (TypeIndexSignature | TypeProperty | TypeMethod)[];
}

export interface TypeEnum extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.enum,
    parent?: Type;
    enum: { [name: string]: string | number | undefined | null },
    values: (string | number | undefined | null)[]
}

export interface TypeEnumMember {
    kind: ReflectionKind.enumMember,
    parent: TypeEnum;
    name: string;
    default?: () => string | number;
}

export interface TypeTypeParameter extends TypeRuntimeData {
    kind: ReflectionKind.typeParameter,
    parent?: Type;
    name: string,
}

export interface TypeUnion extends TypeRuntimeData {
    kind: ReflectionKind.union,
    parent?: Type;
    types: Type[];
}

export interface TypeIntersection {
    kind: ReflectionKind.intersection,
    parent?: Type;
    types: Type[];
}

export interface TypeArray extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.array,
    parent?: Type;
    type: Type;
}

export interface TypePropertySignature extends TypeRuntimeData {
    kind: ReflectionKind.propertySignature,
    parent: TypeObjectLiteral;
    name: number | string | symbol;
    optional?: true;
    readonly?: true;
    description?: string;
    type: OuterType;
}

export interface TypeMethodSignature {
    kind: ReflectionKind.methodSignature,
    parent: TypeObjectLiteral;
    name: number | string | symbol;
    optional?: true;
    parameters: TypeParameter[];
    return: OuterType;
}

/**
 * Object literals or interfaces.
 */
export interface TypeObjectLiteral extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.objectLiteral,
    parent?: Type;
    types: (TypeIndexSignature | TypePropertySignature | TypeMethodSignature)[];
}

export interface TypeIndexSignature {
    kind: ReflectionKind.indexSignature,
    parent: TypeClass | TypeObjectLiteral;
    index: Type;
    type: Type;
}

export interface TypeInfer {
    kind: ReflectionKind.infer,
    parent?: Type;

    set(type: Type): void;
}

export interface TypeTupleMember {
    kind: ReflectionKind.tupleMember,
    parent: TypeTuple;
    type: Type;
    optional?: true;
    name?: string;
}

export interface TypeTuple extends TypeAnnotations, TypeRuntimeData {
    kind: ReflectionKind.tuple,
    parent?: Type;
    types: TypeTupleMember[]
}

export interface TypeRest {
    kind: ReflectionKind.rest,
    parent: TypeTypeParameter | TypeTupleMember;
    type: Type
}

export type Type =
    TypeNever
    | TypeAny
    | TypeUnknown
    | TypeVoid
    | TypeObject
    | TypeString
    | TypeNumber
    | TypeBoolean
    | TypeBigInt
    | TypeSymbol
    | TypeNull
    | TypeUndefined
    | TypeLiteral
    | TypeTemplateLiteral
    | TypeParameter
    | TypeFunction
    | TypeMethod
    | TypeProperty
    | TypePromise
    | TypeClass
    | TypeEnum
    | TypeEnumMember
    | TypeUnion
    | TypeIntersection
    | TypeArray
    | TypeObjectLiteral
    | TypeIndexSignature
    | TypePropertySignature
    | TypeMethodSignature
    | TypeTypeParameter
    | TypeInfer
    | TypeTuple
    | TypeTupleMember
    | TypeRest
    | TypeRegexp
    ;

/**
 * Types that can be created and passed to type arguments.
 * Excludes things like PropertySignature (which needs ObjectLiteral as parent), TupleMember (which needs Tuple as parent), etc.
 */
export type OuterType =
    TypeNever
    | TypeAny
    | TypeUnknown
    | TypeVoid
    | TypeObject
    | TypeString
    | TypeNumber
    | TypeBoolean
    | TypeBigInt
    | TypeSymbol
    | TypeNull
    | TypeUndefined
    | TypeLiteral
    | TypeTemplateLiteral
    | TypePropertySignature
    | TypeProperty
    | TypeParameter
    | TypeFunction
    | TypePromise
    | TypeClass
    | TypeEnum
    | TypeUnion
    | TypeArray
    | TypeObjectLiteral
    | TypeTuple
    | TypeRegexp
    | TypeTypeParameter
    ;

export type Widen<T> =
    T extends string ? string
        : T extends number ? number
            : T extends bigint ? bigint
                : T extends boolean ? boolean
                    : T extends symbol ? symbol : T;

export type FindType<T extends Type, LOOKUP extends ReflectionKind> = T extends { kind: infer K } ? K extends LOOKUP ? T : never : never;

export function isType(entry: any): entry is Type {
    return 'object' === typeof entry && entry.constructor === Object && 'kind' in entry && 'number' === typeof entry.kind;
}

export function isBinary(type: Type): boolean {
    return type.kind === ReflectionKind.class && binaryTypes.includes(type.classType);
}

export function isPrimitive<T extends Type>(type: T): boolean {
    return type.kind === ReflectionKind.string || type.kind === ReflectionKind.number || type.kind === ReflectionKind.bigint || type.kind === ReflectionKind.boolean
        || type.kind === ReflectionKind.literal || type.kind === ReflectionKind.null || type.kind === ReflectionKind.undefined;
}

/**
 * Return all properties created in the constructor (via `constructor(public title: string)`)
 *
 * If a non-property parameter is in the constructor, the type is given instead, e.g. `constructor(public title: string, anotherOne:number)` => [TypeProperty, TypeNumber]
 */
export function getConstructorProperties(type: TypeClass): { parameters: (TypeProperty | OuterType)[], properties: TypeProperty[] } {
    const constructor = findMember('constructor', type) as TypeMethod | undefined;
    const result: { parameters: (TypeProperty | OuterType)[], properties: TypeProperty[] } = { parameters: [], properties: [] };
    if (!constructor) return result;

    for (const parameter of constructor.parameters) {
        const property = findMember(parameter.name, type);
        if (property && property.kind === ReflectionKind.property) {
            result.properties.push(property);
            result.parameters.push(property);
        } else {
            result.parameters.push(parameter.type as OuterType);
        }
    }
    return result;
}

export type WithAnnotations =
    TypeAny
    | TypeUnknown
    | TypeString
    | TypeNumber
    | TypeBigInt
    | TypeBoolean
    | TypeArray
    | TypeTuple
    | TypeLiteral
    | TypeNull
    | TypeUndefined
    | TypeClass
    | TypeObjectLiteral
    | TypeObject
    | TypeTemplateLiteral
    | TypeRegexp
    | TypeSymbol;

export function isWithAnnotations(type: ParentLessType): type is WithAnnotations {
    return type.kind === ReflectionKind.any || type.kind === ReflectionKind.unknown || type.kind === ReflectionKind.string || type.kind === ReflectionKind.number || type.kind === ReflectionKind.bigint || type.kind === ReflectionKind.boolean
        || type.kind === ReflectionKind.array || type.kind === ReflectionKind.tuple || type.kind === ReflectionKind.literal || type.kind === ReflectionKind.null || type.kind === ReflectionKind.undefined
        || type.kind === ReflectionKind.class || type.kind === ReflectionKind.objectLiteral || type.kind === ReflectionKind.object || type.kind === ReflectionKind.templateLiteral
        || type.kind === ReflectionKind.regexp || type.kind === ReflectionKind.symbol;
}

export function getAnnotations(type: WithAnnotations): Annotations {
    return type.annotations ||= {};
}

/**
 * Checks if the structure of a and b are identical.
 */
export function isSameType(a: Type, b: Type): boolean {
    if (a.kind !== b.kind) return false;

    if (a.kind === ReflectionKind.literal) return a.literal === (b as TypeLiteral).literal;

    if (a.kind === ReflectionKind.class && b.kind === ReflectionKind.class) {
        if (a.classType !== b.classType) return false;
        if (!a.arguments && !b.arguments) return true;
        if (!a.arguments || !b.arguments) return false;

        if (a.arguments && !b.arguments) return false;
        if (!a.arguments && b.arguments) return false;

        for (let i = 0; a.arguments.length; i++) {
            if (!isSameType(a.arguments[i], b.arguments[i])) return false;
        }
        return true;
    }

    if (a.kind === ReflectionKind.objectLiteral) {
        if (b.kind === ReflectionKind.objectLiteral) {
            if (a.types.length !== b.types.length) return false;

            for (const aMember of a.types) {
                //todo: call signature
                if (aMember.kind === ReflectionKind.indexSignature) {
                    const valid = b.types.some(v => {
                        if (v.kind !== ReflectionKind.indexSignature) return false;
                        const sameIndex = isSameType(aMember.index, v.index);
                        const sameType = isSameType(aMember.type, v.type);
                        return sameIndex && sameType;
                    });
                    if (!valid) return false;
                } else if (aMember.kind === ReflectionKind.propertySignature || aMember.kind === ReflectionKind.methodSignature) {
                    const bMember = findMember(aMember.name, b);
                    if (!bMember) return false;
                    if (!isSameType(aMember, bMember)) return false;
                }
            }
            return true;
        }
    }

    if (a.kind === ReflectionKind.tupleMember) {
        if (b.kind !== ReflectionKind.tupleMember) return false;

        return a.optional === b.optional && a.name === b.name && isSameType(a.type, b.type);
    }

    if (a.kind === ReflectionKind.array) {
        if (b.kind !== ReflectionKind.array) return false;

        return isSameType(a.type, b.type);
    }

    if (a.kind === ReflectionKind.tuple) {
        if (b.kind !== ReflectionKind.tuple) return false;

        if (a.types.length !== b.types.length) return false;
        for (let i = 0; i < a.types.length; i++) {
            if (!isSameType(a.types[i], b.types[i])) return false;
        }
        return true;
    }

    if (a.kind === ReflectionKind.parameter) {
        if (b.kind !== ReflectionKind.parameter) return false;
        return a.name === b.name && a.optional === b.optional && isSameType(a.type, b.type);
    }

    if (a.kind === ReflectionKind.function || a.kind === ReflectionKind.method || a.kind === ReflectionKind.methodSignature) {
        if (b.kind !== ReflectionKind.function && b.kind !== ReflectionKind.method && b.kind !== ReflectionKind.methodSignature) return false;
        if (a.parameters.length !== b.parameters.length) return false;

        for (let i = 0; i < a.parameters.length; i++) {
            if (!isSameType(a.parameters[i], b.parameters[i])) return false;
        }

        return isSameType(a.return, b.return);
    }

    if (a.kind === ReflectionKind.union) {
        if (b.kind !== ReflectionKind.union) return false;
        if (a.types.length !== b.types.length) return false;
        for (let i = 0; i < a.types.length; i++) {
            if (!isTypeIncluded(b.types, a.types[i])) return false;
        }
    }

    return a.kind === b.kind;
}

export function addType<T extends Type>(container: T, type: Type): T {
    if (container.kind === ReflectionKind.tuple) {
        if (type.kind === ReflectionKind.tupleMember) {
            container.types.push({ ...type, parent: container });
        } else {
            container.types.push({ kind: ReflectionKind.tupleMember, parent: container, type });
        }
    } else if (container.kind === ReflectionKind.union) {
        if (type.kind === ReflectionKind.union) {
            for (const t of flatten(type).types) {
                addType(container, t);
            }
        } else if (type.kind === ReflectionKind.tupleMember) {
            if (type.optional && !isTypeIncluded(container.types, { kind: ReflectionKind.undefined })) {
                container.types.push({ kind: ReflectionKind.undefined, parent: container });
            }
            addType(container, type.type);
        } else if (type.kind === ReflectionKind.rest) {
            addType(container, type.type);
        } else {
            if (!isTypeIncluded(container.types, type)) {
                container.types.push({ ...type as any, parent: container });
            }
        }
    }

    return container;
}

export function isTypeIncluded(types: Type[], type: Type): boolean {
    for (const t of types) {
        if (isSameType(t, type)) return true;
    }

    return false;
}

/**
 * `true | (string | number)` => `true | string | number`
 */
export function flatten<T extends Type>(type: T): T {
    if (type.kind === ReflectionKind.union) {
        type.types = flattenUnionTypes(type.types);
    }
    return type;
}

/**
 * Flatten nested union types.
 */
export function flattenUnionTypes(types: Type[]): Type[] {
    const result: Type[] = [];
    for (const type of types) {
        if (type.kind === ReflectionKind.union) {
            for (const s of flattenUnionTypes(type.types)) {
                if (!isTypeIncluded(result, s)) result.push(s);
            }
        } else {
            if (!isTypeIncluded(result, type)) result.push(type);
        }
    }

    return result;
}

/**
 * empty union => never
 * union with one member => member
 * otherwise the union is returned
 */
export function unboxUnion(union: TypeUnion): Type {
    if (union.types.length === 0) return { kind: ReflectionKind.never };
    if (union.types.length === 1) return union.types[0];
    return union;
}

function findMember(
    index: string | number | symbol, type: { types: Type[] }
): TypePropertySignature | TypeMethodSignature | TypeMethod | TypeProperty | TypeIndexSignature | undefined {
    const indexType = typeof index;

    for (const member of type.types) {
        if (member.kind === ReflectionKind.propertySignature && member.name === index) return member;
        if (member.kind === ReflectionKind.methodSignature && member.name === index) return member;
        if (member.kind === ReflectionKind.property && member.name === index) return member;
        if (member.kind === ReflectionKind.method && member.name === index) return member;

        if (member.kind === ReflectionKind.indexSignature) {
            if (member.index.kind === ReflectionKind.string && 'string' === indexType) return member;
            if (member.index.kind === ReflectionKind.number && 'number' === indexType) return member;
            if (member.index.kind === ReflectionKind.symbol && 'symbol' === indexType) return member;
            //todo: union needs to match depending on union and indexType
        }
    }

    return;
}

function resolveObjectIndexType(type: TypeObjectLiteral | TypeClass, index: Type): Type {
    if (index.kind === ReflectionKind.literal && ('string' === typeof index.literal || 'number' === typeof index.literal || 'symbol' === typeof index.literal)) {
        const member = findMember(index.literal, type);
        if (member) {
            if (member.kind === ReflectionKind.indexSignature) {
                //todo: check if index type matches literal type
                return member.type;
            } else if (member.kind === ReflectionKind.method || member.kind === ReflectionKind.methodSignature) {
                return member;
            } else if (member.kind === ReflectionKind.property || member.kind === ReflectionKind.propertySignature) {
                return member.type;
            } else {
                return { kind: ReflectionKind.never };
            }
        } else {
            return { kind: ReflectionKind.never };
        }
    } else {
        return { kind: ReflectionKind.never };
    }
}

interface CStack {
    iterator: Type[];
    i: number;
    round: number;
}

export function emptyObject(type: Type): boolean {
    return (type.kind === ReflectionKind.objectLiteral || type.kind === ReflectionKind.class) && type.types.length === 0;
}

export class CartesianProduct {
    protected stack: CStack[] = [];

    private current(s: CStack): Type {
        return s.iterator[s.i];
    }

    private next(s: CStack): boolean {
        return (++s.i === s.iterator.length) ? (s.i = 0, false) : true;
    }

    toGroup(type: Type): Type[] {
        if (type.kind === ReflectionKind.boolean) {
            return [{ kind: ReflectionKind.literal, literal: 'false' }, { kind: ReflectionKind.literal, literal: 'true' }];
        } else if (type.kind === ReflectionKind.null) {
            return [{ kind: ReflectionKind.literal, literal: 'null' }];
        } else if (type.kind === ReflectionKind.undefined) {
            return [{ kind: ReflectionKind.literal, literal: 'undefined' }];
        } else if (type.kind === ReflectionKind.union) {
            const result: Type[] = [];
            for (const s of type.types) {
                const g = this.toGroup(s);
                result.push(...g);
            }

            return result;
        } else {
            return [type];
        }
    }

    add(item: Type) {
        this.stack.push({ iterator: this.toGroup(item), i: 0, round: 0 });
    }

    calculate(): Type[][] {
        const result: Type[][] = [];
        outer:
            while (true) {
                const row: Type[] = [];
                for (const s of this.stack) row.push(this.current(s));
                result.push(row);

                for (let i = this.stack.length - 1; i >= 0; i--) {
                    const active = this.next(this.stack[i]);
                    //when that i stack is active, continue in main loop
                    if (active) continue outer;

                    //i stack was rewinded. If its the first, it means we are done
                    if (i === 0) break outer;
                }
                break;
            }

        return result;
    }
}

/**
 * Query a container type and return the result.
 *
 * container[index]
 *
 * e.g. {a: string}['a'] => string
 * e.g. {a: string, b: number}[keyof T] => string | number
 * e.g. [string, number][0] => string
 * e.g. [string, number][number] => string | number
 */
export function indexAccess(container: Type, index: Type): Type {
    if (container.kind === ReflectionKind.array) {
        if ((index.kind === ReflectionKind.literal && 'number' === typeof index.literal) || index.kind === ReflectionKind.number) return container.type;
        if (index.kind === ReflectionKind.literal && index.literal === 'length') return { kind: ReflectionKind.number };
    } else if (container.kind === ReflectionKind.tuple) {
        if (index.kind === ReflectionKind.literal && index.literal === 'length') return { kind: ReflectionKind.literal, literal: container.types.length };
        if (index.kind === ReflectionKind.literal && 'number' === typeof index.literal && index.literal < 0) {
            index = { kind: ReflectionKind.number };
        }

        if (index.kind === ReflectionKind.literal && 'number' === typeof index.literal) {
            type b0 = [string, boolean?][0]; //string
            type b1 = [string, boolean?][1]; //boolean|undefined
            type a0 = [string, ...number[], boolean][0]; //string
            type a1 = [string, ...number[], boolean][1]; //number|boolean
            type a2 = [string, ...number[], boolean][2]; //number|boolean
            type a22 = [string, ...number[], boolean][3]; //number|boolean
            // type a23 = [string, number, boolean][4]; //number|boolean
            type a3 = [string, number, ...number[], boolean][1]; //number
            type a4 = [string, number, ...number[], boolean][-2]; //string|number|boolean, minus means all
            type a5 = [string, number, ...number[], boolean][number]; //string|number|boolean

            let restPosition = -1;
            for (let i = 0; i < container.types.length; i++) {
                if (container.types[i].type.kind === ReflectionKind.rest) {
                    restPosition = i;
                    break;
                }
            }

            if (restPosition === -1 || index.literal < restPosition) {
                const sub = container.types[index.literal];
                if (!sub) return { kind: ReflectionKind.undefined };
                if (sub.optional) return { kind: ReflectionKind.union, types: [sub.type, { kind: ReflectionKind.undefined }] };
                return sub.type;
            }

            //index beyond a rest, return all beginning from there as big enum

            const result: TypeUnion = { kind: ReflectionKind.union, types: [] };
            for (let i = restPosition; i < container.types.length; i++) {
                const member = container.types[i];
                const type = member.type.kind === ReflectionKind.rest ? member.type.type : member.type;
                if (!isTypeIncluded(result.types, type)) result.types.push(type);
                if (member.optional && !isTypeIncluded(result.types, { kind: ReflectionKind.undefined })) result.types.push({ kind: ReflectionKind.undefined });
            }

            return unboxUnion(result);
        } else if (index.kind === ReflectionKind.number) {
            const union: TypeUnion = { kind: ReflectionKind.union, types: [] };
            for (const sub of container.types) {
                if (sub.type.kind === ReflectionKind.rest) {
                    if (isTypeIncluded(union.types, sub.type.type)) continue;
                    union.types.push(sub.type.type);
                } else {
                    if (isTypeIncluded(union.types, sub.type)) continue;
                    union.types.push(sub.type);
                }
            }
            return unboxUnion(union);
        } else {
            return { kind: ReflectionKind.never };
        }
    } else if (container.kind === ReflectionKind.objectLiteral || container.kind === ReflectionKind.class) {
        if (index.kind === ReflectionKind.literal) {
            return resolveObjectIndexType(container, index);
        } else if (index.kind === ReflectionKind.union) {
            const union: TypeUnion = { kind: ReflectionKind.union, types: [] };
            for (const t of index.types) {
                const result = resolveObjectIndexType(container, t);
                if (result.kind === ReflectionKind.never) continue;

                if (result.kind === ReflectionKind.union) {
                    for (const resultT of result.types) {
                        if (isTypeIncluded(union.types, resultT)) continue;
                        union.types.push(resultT);
                    }
                } else {
                    if (isTypeIncluded(union.types, result)) continue;
                    union.types.push(result);
                }
            }
            return unboxUnion(union);
        } else {
            return { kind: ReflectionKind.never };
        }
    }
    return { kind: ReflectionKind.never };
}

export function merge(types: (TypeObjectLiteral | TypeClass)[]): TypeObjectLiteral {
    const type: TypeObjectLiteral = { kind: ReflectionKind.objectLiteral, types: [] };

    for (const subType of types) {
        for (const member of subType.types) {
            if (member.kind === ReflectionKind.indexSignature) {
                member.parent = type;
                type.types.push(member);
            } else if (!isMember(member)) {
                continue;
            } else if (!hasMember(type, member.name)) {
                const t = toSignature(member);
                t.parent = type;
                type.types.push(t);
            }
        }
    }
    return type;
}

export function narrowOriginalLiteral(type: Type): Type {
    if ((type.kind === ReflectionKind.string || type.kind === ReflectionKind.number || type.kind === ReflectionKind.boolean || type.kind === ReflectionKind.bigint) && type.origin) {
        return type.origin;
    }
    return type;
}

type GetArrayElement<T extends any[]> = [T] extends [Array<infer K>] ? K : never;
type RemoveParent<T, K extends keyof T> = { [P in K]: T[P] extends Type[] ? RemoveParentHomomorphic<GetArrayElement<T[P]>>[] : T[P] extends Type ? RemoveParentHomomorphic<T[P]> : T[P] };
type RemoveParentHomomorphic<T> = RemoveParent<T, Exclude<keyof T, 'parent'>>;
type RemoveDeepParent<T extends Type> = T extends infer K ? RemoveParentHomomorphic<K> : never;
export type ParentLessType = RemoveDeepParent<Type>;

export function copyAndSetParent<T extends ParentLessType>(inc: T, parent?: Type): FindType<Type, T['kind']> {
    const type = parent ? { ...inc, parent: parent } as Type : { ...inc } as Type;

    if (isWithAnnotations(type) && isWithAnnotations(inc)) {
        if (inc.annotations) type.annotations = { ...inc.annotations };
        if (inc.decorators) type.decorators = inc.decorators.slice();
        if (inc.indexAccessOrigin) type.indexAccessOrigin = { ...inc.indexAccessOrigin };
        if (inc.typeArguments) type.typeArguments = inc.typeArguments.slice();
    }

    switch (type.kind) {
        case ReflectionKind.objectLiteral:
        case ReflectionKind.tuple:
        case ReflectionKind.union:
        case ReflectionKind.class:
        case ReflectionKind.intersection:
        case ReflectionKind.templateLiteral:
            type.types = type.types.map(member => copyAndSetParent(member, type));
            break;
        case ReflectionKind.string:
        case ReflectionKind.number:
        case ReflectionKind.bigint:
        case ReflectionKind.symbol:
        case ReflectionKind.regexp:
        case ReflectionKind.boolean:
            if (type.origin) type.origin = copyAndSetParent(type.origin, type);
            break;
        case ReflectionKind.function:
        case ReflectionKind.method:
        case ReflectionKind.methodSignature:
            type.return = copyAndSetParent(type.return, type);
            type.parameters = type.parameters.map(member => copyAndSetParent(member, type));
            break;
        case ReflectionKind.propertySignature:
        case ReflectionKind.property:
        case ReflectionKind.array:
        case ReflectionKind.promise:
        case ReflectionKind.parameter:
        case ReflectionKind.tupleMember:
        case ReflectionKind.rest:
            type.type = copyAndSetParent(type.type, type);
            break;
        case ReflectionKind.indexSignature:
            type.index = copyAndSetParent(type.index, type);
            type.type = copyAndSetParent(type.type, type);
            break;
    }

    return type as any;
}

export function widenLiteral(type: OuterType): OuterType {
    if (type.kind === ReflectionKind.literal) {
        if ('number' === typeof type.literal) return copyAndSetParent({ kind: ReflectionKind.number, origin: type });
        if ('boolean' === typeof type.literal) return copyAndSetParent({ kind: ReflectionKind.boolean, origin: type });
        if ('bigint' === typeof type.literal) return copyAndSetParent({ kind: ReflectionKind.bigint, origin: type });
        if ('symbol' === typeof type.literal) return copyAndSetParent({ kind: ReflectionKind.symbol, origin: type });
        if ('string' === typeof type.literal) return copyAndSetParent({ kind: ReflectionKind.string, origin: type });
        if (type.literal instanceof RegExp) return copyAndSetParent({ kind: ReflectionKind.regexp, origin: type });
    }

    return type;
}

export function assertType<K extends ReflectionKind, T>(t: Type, kind: K): asserts t is FindType<Type, K> {
    if (t.kind !== kind) throw new Error(`Invalid type ${t.kind}, expected ${kind}`);
}

export function getClassType(type: Type): ClassType {
    if (type.kind !== ReflectionKind.class) throw new Error(`Type needs to be TypeClass, but ${type.kind} given.`);
    return type.classType;
}

export function isMember(type: Type): type is TypePropertySignature | TypeProperty | TypeMethodSignature | TypeMethod {
    return type.kind === ReflectionKind.propertySignature || type.kind === ReflectionKind.property
        || type.kind === ReflectionKind.methodSignature || type.kind === ReflectionKind.method;
}

export function hasMember(type: TypeObjectLiteral | TypeClass, memberName: number | string | symbol, memberType?: Type): boolean {
    return type.types.some(v => isMember(v) && v.name === memberName && (!memberType || isExtendable(v.kind === ReflectionKind.propertySignature || v.kind === ReflectionKind.property ? v.type : v, memberType)));
}

export function getMember(type: TypeObjectLiteral | TypeClass, memberName: number | string | symbol): TypeMethodSignature | TypeMethod | TypePropertySignature | TypeProperty | void {
    return (type.types as (TypeIndexSignature | TypeMethodSignature | TypeMethod | TypePropertySignature | TypeProperty)[]).find(v => isMember(v) && v.name === memberName) as TypeMethodSignature | TypeMethod | TypePropertySignature | TypeProperty | void;
}

/**
 * Checks whether `undefined` is allowed as type.
 */
export function isOptional(type: Type): boolean {
    if (isMember(type) && type.optional === true) return true;
    if (type.kind === ReflectionKind.property || type.kind === ReflectionKind.propertySignature || type.kind === ReflectionKind.indexSignature) return isOptional(type.type);
    return type.kind === ReflectionKind.any || type.kind === ReflectionKind.undefined || (type.kind === ReflectionKind.union && type.types.some(isOptional));
}

/**
 * Whether a property has an initializer/default value.
 */
export function hasDefaultValue(type: Type): boolean {
    return type.kind === ReflectionKind.property && type.default !== undefined;
}

/**
 * Checks whether `null` is allowed as type.
 */
export function isNullable(type: Type): boolean {
    if (type.kind === ReflectionKind.property || type.kind === ReflectionKind.propertySignature || type.kind === ReflectionKind.indexSignature) return isNullable(type.type);
    return type.kind === ReflectionKind.null || (type.kind === ReflectionKind.union && type.types.some(isNullable));
}

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

export class AnnotationDefinition<T = true> {
    public symbol: symbol;

    constructor(public readonly id: string) {
        this.symbol = Symbol(id);
    }

    register(annotations: Annotations, data: T) {
        annotations[this.symbol] ||= [];
        annotations[this.symbol].push(data);
    }

    replace(annotations: Annotations, annotation: T[]) {
        annotations[this.symbol] = annotation;
    }

    getAnnotations(type: Type): T[] {
        if (isWithAnnotations(type) && type.annotations) return type.annotations[this.symbol] || [];
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
    onDelete?: ReferenceActions,

    /**
     * Default is CASCADE.
     */
    onUpdate?: ReferenceActions
}

export interface EntityOptions {
    name?: string;
    collection?: string;
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
export type Entity<T extends EntityOptions> = { __meta?: ['entity', T] }

/**
 * Marks a property as primary key.
 * ```typescript
 * class Entity {
 *     id: number & Primary = 0;
 * }
 * ```
 */
export type PrimaryKey = { __meta?: ['primaryKey'] };

type TypeKeyOf<T> = T[keyof T];
export type PrimaryKeyFields<T> = any extends T ? any : { [P in keyof T]: Required<T[P]> extends Required<PrimaryKey> ? T[P] : never };
export type PrimaryKeyType<T> = any extends T ? any : TypeKeyOf<PrimaryKeyFields<T>>;

export type ReferenceFields<T> = { [P in keyof T]: Required<T[P]> extends Required<Reference> | Required<BackReference> ? T[P] : never };

/**
 * Marks a primary property key as auto-increment.
 *
 * ```typescript
 * class Entity {
 *     id: number & Primary & AutoIncrement = 0;
 * }
 * ```
 */
export type AutoIncrement = { __meta?: ['autoIncrement'] };

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
export type UUID = string & { __meta?: ['UUIDv4'] };

/**
 * MongoDB's ObjectID type. serialized as string in JSON, ObjectID in database.
 */
export type MongoId = string & { __meta?: ['mongoId'] };

/**
 * Same as `bigint` but serializes to unsigned binary with unlimited size (instead of 8 bytes in most databases).
 * Negative values will be converted to positive (abs(x))
 *
 * ```typescript
 * class Entity {
 *     id: BinaryBigInt = 0n;
 * }
 * ```
 */
export type BinaryBigInt = bigint & { __meta?: ['binaryBigInt'] };

/**
 * Same as `bigint` but serializes to signed binary with unlimited size (instead of 8 bytes in most databases).
 * Negative values will be stored using a signed number representation.
 * The binary has an additional leading sign byte and is represented as an uint: 255 for negative, 0 for zero, or 1 for positive.
 *
 * ```typescript
 * class Entity {
 *     id: SignedBinaryBigInt = 0n;
 * }
 * ```
 */
export type SignedBinaryBigInt = bigint & { __meta?: ['signedBinaryBigInt'] };

export type Reference<Options extends ReferenceOptions = {}> = { __meta?: ['reference', Options] };
export type BackReference<Options extends BackReferenceOptions = {}> = { __meta?: ['backReference', Options] };
export type EmbeddedMeta<Options> = { __meta?: ['embedded', Options] };
export type Embedded<T, Options extends { prefix?: string } = {}> = T & EmbeddedMeta<Options>;

export const referenceAnnotation = new AnnotationDefinition<ReferenceOptions>('reference');
export const entityAnnotation = new AnnotationDefinition<EntityOptions>('entity');

export const autoIncrementAnnotation = new AnnotationDefinition('autoIncrement');
export const primaryKeyAnnotation = new class extends AnnotationDefinition {
    isPrimaryKey(type: Type): boolean {
        return this.getAnnotations(type).length > 0;
    }
}('primaryKey');

export interface BackReferenceOptions {
    /**
     * Necessary for normalised many-to-many relations. This defines the class of the pivot table/collection.
     */
    via?: ClassType;

    /**
     * A reference/backReference can define which reference on the other side
     * reference back. This is necessary when there are multiple outgoing references
     * to the same entity.
     */
    mappedBy?: string,
}

export const backReferenceAnnotation = new AnnotationDefinition<BackReferenceOptions>('backReference');
export const validationAnnotation = new AnnotationDefinition<{ name: string, args: Type[] }>('validation');
export const UUIDAnnotation = new AnnotationDefinition('UUID');
export const mongoIdAnnotation = new AnnotationDefinition('mongoID');
export const uuidAnnotation = new AnnotationDefinition('uuid');
export const defaultAnnotation = new AnnotationDefinition('default');

export function isUUIDType(type: Type): boolean {
    return uuidAnnotation.getFirst(type) !== undefined;
}

export function isAutoIncrementType(type: Type): boolean {
    return autoIncrementAnnotation.getFirst(type) !== undefined;
}

export function isMongoIdType(type: Type): boolean {
    return mongoIdAnnotation.getFirst(type) !== undefined;
}

export function isReferenceType(type: Type): boolean {
    return referenceAnnotation.getFirst(type) !== undefined;
}

export function getReferenceType(type: Type): ReferenceOptions | undefined {
    return referenceAnnotation.getFirst(type);
}

export function isBackReferenceType(type: Type): boolean {
    return backReferenceAnnotation.getFirst(type) !== undefined;
}

export function getBackReferenceType(type: Type): BackReferenceOptions {
    const options = backReferenceAnnotation.getFirst(type);
    if (!options) throw new Error('No back reference');
    return options;
}

export interface EmbeddedOptions {
    prefix?: string;
}

export const embeddedAnnotation = new AnnotationDefinition<EmbeddedOptions>('embedded');

export function hasEmbedded(type: Type): boolean {
    if (type.kind === ReflectionKind.propertySignature || type.kind === ReflectionKind.property) return hasEmbedded(type.type);
    if (type.kind === ReflectionKind.union) return type.types.some(hasEmbedded);
    return type.kind === ReflectionKind.class && embeddedAnnotation.getFirst(type) !== undefined;
}

//`never` is here to allow using a decorator multiple times on the same type without letting the TS complaining about incompatible types.
export type Group<Name extends string> = { __meta?: ['group', never & Name] };
export type Excluded<Name extends string = '*'> = { __meta?: ['excluded', never & Name] };
export type Data<Name extends string, Value> = { __meta?: ['data', never & Name, never & Value] };

export type IndexOptions = {
    name?: string;
    //index size. Necessary for blob/longtext, etc.
    size?: number,

    unique?: boolean,
    spatial?: boolean,
    sparse?: boolean,

    //only in mongodb
    fulltext?: boolean,
    where?: string,
};

export type Unique<Options extends IndexOptions = {}> = { __meta?: ['index', never & Options & { unique: true }] };
export type Index<Options extends IndexOptions = {}> = { __meta?: ['index', never & Options] };

export interface DatabaseFieldOptions {
    type?: string;
}

export interface MySQLOptions extends DatabaseFieldOptions {
}

export interface PostgresOptions extends DatabaseFieldOptions {
}

export interface SqliteOptions extends DatabaseFieldOptions {
}

type Database<Name extends string, Options extends { [name: string]: any }> = { __meta?: ['database', never & Name, never & Options] };
export type MySQL<Options extends MySQLOptions> = Database<'mysql', Options>;
export type Postgres<Options extends PostgresOptions> = Database<'postgres', Options>;
export type SQLite<Options extends SqliteOptions> = Database<'sqlite', Options>;
export type DatabaseField<Options extends DatabaseFieldOptions, Name extends string = '*'> = Database<Name, Options>;

export const enum BinaryBigIntType {
    unsigned,
    signed
}

export const binaryBigIntAnnotation = new AnnotationDefinition<BinaryBigIntType>('binaryBigInt');
export const groupAnnotation = new AnnotationDefinition<string>('group');
export const excludedAnnotation = new class extends AnnotationDefinition<string> {
    isExcluded(type: Type, name: string): boolean {
        const excluded = this.getAnnotations(type);
        return excluded.includes('*') || excluded.includes(name);
    }
}('excluded');
export const dataAnnotation = new AnnotationDefinition<{ [name: string]: any }>('data');
export const metaAnnotation = new AnnotationDefinition<{ name: string, options: OuterType[] }>('meta');
export const indexAnnotation = new AnnotationDefinition<IndexOptions>('index');
export const databaseAnnotation = new class extends AnnotationDefinition<{ name: string, options: { [name: string]: any } }> {
    getDatabase<T extends DatabaseFieldOptions>(type: Type, name: string): T | undefined {
        let options: T | undefined = undefined;
        for (const annotation of this.getAnnotations(type)) {
            if (annotation.name === '*' || annotation.name === name) {
                if (!options) options = {} as T;
                Object.assign(options, annotation.options as T);
            }
        }
        return options as any;
    };
}('database');

export function registerTypeDecorator(decorator: TypeDecorator) {
    typeDecorators.push(decorator);
}

export const typeDecorators: TypeDecorator[] = [
    (annotations: Annotations, decorator: TypeObjectLiteral) => {
        const meta = getProperty(decorator, '__meta');
        if (!meta || meta.type.kind !== ReflectionKind.tuple) return false;
        const id = meta.type.types[0];
        if (!id || id.type.kind !== ReflectionKind.literal) return false;

        switch (id.type.literal) {
            case 'reference': {
                const optionsType = meta.type.types[1];
                if (!optionsType || optionsType.type.kind !== ReflectionKind.objectLiteral) return false;
                const options = typeToObject(optionsType.type);
                referenceAnnotation.replace(annotations, [options]);
                return true;
            }
            case 'entity': {
                const optionsType = meta.type.types[1];
                if (!optionsType || optionsType.type.kind !== ReflectionKind.objectLiteral) return false;
                const options = typeToObject(optionsType.type);
                entityAnnotation.replace(annotations, [options]);
                return true;
            }
            case 'autoIncrement':
                autoIncrementAnnotation.register(annotations, true);
                return true;
            case 'binaryBigInt':
                binaryBigIntAnnotation.replace(annotations, [BinaryBigIntType.unsigned]);
                return true;
            case 'signedBinaryBigInt':
                binaryBigIntAnnotation.replace(annotations, [BinaryBigIntType.signed]);
                return true;
            case 'primaryKey':
                primaryKeyAnnotation.register(annotations, true);
                return true;
            case 'mongoId':
                mongoIdAnnotation.register(annotations, true);
                return true;
            case 'UUIDv4':
                uuidAnnotation.register(annotations, true);
                return true;
            case 'embedded': {
                const optionsType = meta.type.types[1];
                if (!optionsType || optionsType.type.kind !== ReflectionKind.objectLiteral) return false;
                const options = typeToObject(optionsType.type);
                embeddedAnnotation.replace(annotations, [options]);
                return true;
            }
            case 'group': {
                const nameType = meta.type.types[1];
                if (!nameType || nameType.type.kind !== ReflectionKind.literal || 'string' !== typeof nameType.type.literal) return false;
                groupAnnotation.register(annotations, nameType.type.literal);
                return true;
            }
            case 'index': {
                const optionsType = meta.type.types[1];
                if (!optionsType || optionsType.type.kind !== ReflectionKind.objectLiteral) return false;
                const options = typeToObject(optionsType.type);
                indexAnnotation.replace(annotations, [options]);
                return true;
            }
            case 'database': {
                const nameType = meta.type.types[1];
                if (!nameType || nameType.type.kind !== ReflectionKind.literal || 'string' !== typeof nameType.type.literal) return false;
                const optionsType = meta.type.types[2];
                if (!optionsType || optionsType.type.kind !== ReflectionKind.objectLiteral) return false;
                const options = typeToObject(optionsType.type);
                databaseAnnotation.register(annotations, { name: nameType.type.literal, options });
                return true;
            }
            case 'excluded': {
                const nameType = meta.type.types[1];
                if (!nameType || nameType.type.kind !== ReflectionKind.literal || 'string' !== typeof nameType.type.literal) return false;
                excludedAnnotation.register(annotations, nameType.type.literal);
                return true;
            }
            case 'data': {
                const nameType = meta.type.types[1];
                if (!nameType || nameType.type.kind !== ReflectionKind.literal || 'string' !== typeof nameType.type.literal) return false;
                const dataType = meta.type.types[2];
                if (!dataType) return false;

                annotations[dataAnnotation.symbol] ||= [];
                let data: { [name: string]: any } = {};
                if (annotations[dataAnnotation.symbol].length) {
                    data = annotations[dataAnnotation.symbol][0];
                } else {
                    annotations[dataAnnotation.symbol].push(data);
                }

                data[nameType.type.literal] = dataType.type.kind === ReflectionKind.literal ? dataType.type.literal : dataType.type;

                return true;
            }
            case 'backReference': {
                const optionsType = meta.type.types[1];
                if (!optionsType || optionsType.type.kind !== ReflectionKind.objectLiteral) return false;

                const options = typeToObject(optionsType.type);
                backReferenceAnnotation.register(annotations, options);
                return true;
            }
            case 'validator': {
                const nameType = meta.type.types[1];
                if (!nameType || nameType.type.kind !== ReflectionKind.literal || 'string' !== typeof nameType.type.literal) return false;
                const name = nameType.type.literal;

                const argsType = meta.type.types[2];
                if (!argsType || argsType.type.kind !== ReflectionKind.tuple) return false;
                const args: Type[] = argsType.type.types.map(v => v.type);

                const options: AnnotationType<typeof validationAnnotation> = { name, args };
                validationAnnotation.register(annotations, options);
                return true;
            }
            default: {
                const optionsType = meta.type.types.slice(1).map(v => v.type) as OuterType[];
                metaAnnotation.register(annotations, { name: id.type.literal as string, options: optionsType });
                return true;
            }
        }
    }
];

export function typeToObject(type: Type, state: { stack: Type[] } = { stack: [] }): any {
    if (state.stack.includes(type)) return undefined;
    state.stack.push(type);

    try {
        switch (type.kind) {
            case ReflectionKind.any:
            case ReflectionKind.void:
            case ReflectionKind.never:
            case ReflectionKind.undefined:
                return undefined;
            case ReflectionKind.null:
                return null;
            case ReflectionKind.string:
                return '';
            case ReflectionKind.number:
                return 0;
            case ReflectionKind.bigint:
                return BigInt(0);
            case ReflectionKind.regexp:
                return; //;
            case ReflectionKind.boolean:
                return true;
            case ReflectionKind.literal:
                return type.literal;
            case ReflectionKind.promise:
                return typeToObject(type.type);
            case ReflectionKind.templateLiteral:
                return '';
            case ReflectionKind.class: {
                return type.classType;
            }
            case ReflectionKind.objectLiteral: {
                const res: { [name: string | number | symbol]: any } = {};
                for (const t of type.types) {
                    if (t.kind === ReflectionKind.propertySignature) {
                        res[t.name] = typeToObject(t.type);
                    } else if (t.kind === ReflectionKind.methodSignature) {
                    }
                }
                return res;
            }
            case ReflectionKind.union:
            case ReflectionKind.intersection:
                return typeToObject(type.types[0]);
            case ReflectionKind.function:
                return type.function;
            case ReflectionKind.array:
                return [typeToObject(type.type)];
            case ReflectionKind.tuple:
                return type.types.map(v => typeToObject(v.type, state));
        }

        return type.kind + '';
    } finally {
        state.stack.pop();
    }
}

export const enum MappedModifier {
    optional = 1 << 0,
    removeOptional = 1 << 1,
    readonly = 1 << 2,
    removeReadonly = 1 << 3,
}

export const binaryTypes: ClassType[] = [
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
    ArrayBuffer,
];

export function stringifyResolvedType(type: Type): string {
    return stringifyType(type, { depth: 0, stack: [], showNames: false, showFullDefinition: true });
}

export function stringifyShortResolvedType(type: Type): string {
    return stringifyType(type, { depth: 0, stack: [], showNames: false, showFullDefinition: false });
}

interface StringifyTypeOptions {
    depth: number;
    stack: Type[];
    //show type alias names
    showNames: boolean;
    showFullDefinition: boolean;
    skipNameOnce?: true;
    skipNextRecursion?: true;
}

export function stringifyType(type: Type, stateIn: Partial<StringifyTypeOptions> = {}): string {
    const state: StringifyTypeOptions = { depth: 0, stack: [], showNames: true, showFullDefinition: true, ...stateIn };
    if (state.stack.includes(type) && !state.skipNextRecursion) {
        return '* Recursion *';
    }
    if (state.skipNextRecursion) state.skipNextRecursion = undefined;
    state.stack.push(type);

    try {
        let name = type.kind + '';
        if (!state.skipNameOnce && state.showNames && isWithAnnotations(type) && type.typeName) {
            const args = type.typeArguments ? '<' + type.typeArguments.map(v => stringifyType(v, { ...state, skipNameOnce: true, skipNextRecursion: true })).join(', ') + '>' : '';
            return type.typeName + args;
        }

        if (state.skipNameOnce) state.skipNameOnce = undefined;

        switch (type.kind) {
            case ReflectionKind.never:
                name = `never`;
                break;
            case ReflectionKind.any:
                name = `any`;
                break;
            case ReflectionKind.void:
                name = `void`;
                break;
            case ReflectionKind.undefined:
                name = `undefined`;
                break;
            case ReflectionKind.null:
                name = `null`;
                break;
            case ReflectionKind.string:
                name = 'string';
                break;
            case ReflectionKind.number:
                name = 'number';
                break;
            case ReflectionKind.bigint:
                name = 'bigint';
                break;
            case ReflectionKind.regexp:
                name = 'RegExp';
                break;
            case ReflectionKind.boolean:
                name = 'boolean';
                break;
            case ReflectionKind.literal:
                if ('number' === typeof type.literal) {
                    name = type.literal + '';
                } else if ('boolean' === typeof type.literal) {
                    name = type.literal + '';
                } else {
                    name = `'${String(type.literal).replace(/'/g, '\\\'')}'`;
                }
                break;
            case ReflectionKind.promise:
                name = `Promise<${stringifyType(type.type, state)}>`;
                break;
            case ReflectionKind.templateLiteral:
                name = '`' + type.types.map(v => {
                    return v.kind === ReflectionKind.literal ? v.literal : '${' + stringifyType(v, state) + '}';
                }).join('') + '`';
                break;
            case ReflectionKind.class: {
                if (type.classType === Date) {
                    name = `Date`;
                    break;
                }
                if (type.classType === Set) {
                    name = `Set<${stringifyType(type.arguments![0], state)}>`;
                    break;
                }
                if (type.classType === Map) {
                    name = `Map<${stringifyType(type.arguments![0], state)}, ${stringifyType(type.arguments![1], state)}>`;
                    break;
                }
                const indentation = indent((state.depth + 1) * 2);
                const args = type.arguments ? '<' + type.arguments.map(v => stringifyType(v, state)).join(', ') + '>' : '';
                if (state.showFullDefinition) {
                    name = `${getClassName(type.classType)}${args} {\n${type.types.map(v => indentation(stringifyType(v, state))).join(';\n')};\n}`;
                } else {
                    name = `${getClassName(type.classType)}${args}`;
                }
                break;
            }
            case ReflectionKind.objectLiteral: {
                //todo: return name if available
                const indentation = indent((state.depth + 1) * 2);
                const sub = type.types.map(v => indentation(stringifyType(v, state)));
                if (sub.length) {
                    name = `{\n${sub.join(';\n')};\n}`;
                } else {
                    name = `{}`;
                }
                break;
            }
            case ReflectionKind.union:
                name = type.types.map(v => stringifyType(v, state)).join(' | ');
                break;
            case ReflectionKind.intersection:
                name = type.types.map(v => stringifyType(v, state)).join(' & ');
                break;
            case ReflectionKind.parameter: {
                const visibility = type.visibility ? ReflectionVisibility[type.visibility] + ' ' : '';
                name = `${type.readonly ? 'readonly ' : ''}${visibility}${type.name}${type.optional ? '?' : ''}: ${stringifyType(type.type, state)}`;
                break;
            }
            case ReflectionKind.function:
                name = `(${type.parameters.map(v => stringifyType(v, state)).join(', ')}) => ${stringifyType(type.return, state)}`;
                break;
            case ReflectionKind.enum:
                name = `enum todo`;
                break;
            case ReflectionKind.array:
                if (type.type.kind === ReflectionKind.union) {
                    name = `(${stringifyType(type.type, state)})[]`;
                } else {
                    name = `${stringifyType(type.type, state)}[]`;
                }
                break;
            case ReflectionKind.rest:
                name = `...${stringifyType(type.type, state)}[]`;
                break;
            case ReflectionKind.tupleMember:
                if (type.name) {
                    name = `${type.name}${type.optional ? '?' : ''}: ${stringifyType(type.type, state)}`;
                    break;
                }
                name = `${stringifyType(type.type, state)}${type.optional ? '?' : ''}`;
                break;
            case ReflectionKind.tuple:
                name = `[${type.types.map(v => stringifyType(v, state)).join(', ')}]`;
                break;
            case ReflectionKind.indexSignature:
                name = `{[index: ${stringifyType(type.index, state)}]: ${stringifyType(type.type, state)}`;
                break;
            case ReflectionKind.propertySignature:
                name = `${type.readonly ? 'readonly ' : ''}${String(type.name)}${type.optional ? '?' : ''}: ${stringifyType(type.type, state)}`;
                break;
            case ReflectionKind.property: {
                const visibility = type.visibility ? ReflectionVisibility[type.visibility] + ' ' : '';
                name = `${type.readonly ? 'readonly ' : ''}${visibility}${String(type.name)}${type.optional ? '?' : ''}: ${stringifyType(type.type, state)}`;
                break;
            }
            case ReflectionKind.methodSignature:
                name = `${String(type.name)}${type.optional ? '?' : ''}(${type.parameters.map(v => stringifyType(v, state)).join(', ')}): ${stringifyType(type.return, state)}`;
                break;
            case ReflectionKind.method: {
                const visibility = type.visibility ? ReflectionVisibility[type.visibility] + ' ' : '';
                name = `${type.abstract ? 'abstract ' : ''}${visibility}${String(type.name)}${type.optional ? '?' : ''}`
                    + `(${type.parameters.map(v => stringifyType(v, state)).join(', ')}): ${stringifyType(type.return, state)}`;
                break;
            }
        }

        if (isWithAnnotations(type) && type.decorators) {
            name = name + ' & ' + type.decorators.map(v => (isWithAnnotations(v) && v.typeName) || stringifyType(v, {
                ...state,
                showNames: true,
                showFullDefinition: false
            })).join(' & ');
        }

        if (state.depth > 0) return '(' + name + ')';
        return name;
    } finally {
        state.stack.pop();
    }
}

/**
 * The instruction set.
 * Should not be greater than 93 members, because we encode it via charCode starting at 33. +93 means we end up with charCode=126
 * (which is '~' and the last char that can be represented without \x. The next 127 is '\x7F').
 */
export enum ReflectionOp {
    never,
    any,
    unknown,
    void,
    object,

    string,
    number,
    numberBrand,
    boolean,
    bigint,

    symbol,
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

    /**
     * This OP pops all types on the current stack frame. Those types should be method|property.
     *
     * Pushes a TypeClass onto the stack.
     */
    class,

    /**
     * If a class extends another class with generics, this OP represents the generic type arguments of the super class.
     *
     * e.g. `class A extends B<string, boolean>`, string and boolean are on the stack and classExtends pops() them, and then assigns to A.extendsTypeArguments = [string, boolean].
     *
     * This is only emitted when the class that is currently being described actually extends another class and uses generics.
     *
     * This OP has 1 argument and pops x types from the stack. X is the first argument.
     * Expects a TypeClass on the stack.
     */
    classExtends,

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

    regexp,

    enum,
    enumMember, //has one argument, the name.

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
    namedTupleMember, //has one argument, the name.

    union, //pops frame. requires frame start when stack can be dirty.
    intersection,

    indexSignature,
    objectLiteral,
    mappedType, //2 parameters: functionPointer and modifier.
    in,

    frame, //creates a new stack frame
    moveFrame, //pop() as T, pops the current stack frame, push(T)
    return,

    templateLiteral,

    //special instructions that exist to emit less output
    date,

    //those typed array OPs are here only to reduce runtime code overhead when used in types.
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
    typeParameter, //generic type parameter, e.g. T in a generic. has 1 parameter: reference to the name.
    typeParameterDefault, //generic type parameter with a default value, e.g. T in a generic. has 1 parameter: reference to the name. pop() for the default value
    var, //reserve a new variable in the stack
    loads, //pushes to the stack a referenced value in the stack. has 2 parameters: <frame> <index>, frame is a negative offset to the frame, and index the index of the stack entry withing the referenced frame

    indexAccess, //T['string'], 2 items on the stack
    keyof, //keyof operator
    infer, //2 params, like `loads`
    typeof, //1 parameter that points to a function returning the runtime value from which we need to extract the type

    condition,
    jumpCondition, //@deprecated. used when INFER is used in `extends` conditional branch. 2 args: left program, right program
    jump, //jump to an address
    call, //has one parameter, the next program address. creates a new stack frame with current program address as first stack entry, and jumps back to that + 1.
    inline,
    inlineCall,
    distribute,//has one parameter, the co-routine program index.

    extends, //X extends Y in a conditional type, XY popped from the stack, pushes boolean on the stack

    widen, //widens the type on the stack, .e.g 'asd' => string, 34 => number, etc. this is necessary for infer runtime data, and widen if necessary (object member or non-contained literal)


}
