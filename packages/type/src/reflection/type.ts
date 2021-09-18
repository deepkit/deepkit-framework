import { ClassType } from '../../../core';

export enum ReflectionVisibility {
    public,
    protected,
    private,
}

export enum ReflectionKind {
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

    enum,
    union,

    array,

    objectLiteral,
    indexSignature,
    propertySignature,
    methodSignature,
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
    literal: string | number | boolean;
}

export interface TypeLiteralMember {
    visibility: ReflectionVisibility,
    abstract?: true;
    optional?: true,
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
    abstract?: true;
    type: Type;
}

export interface TypeFunction {
    kind: ReflectionKind.function,
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
    types: Type[];
}

export interface TypeEnum {
    kind: ReflectionKind.enum,
    enumType: object;
}

export interface TypeUnion {
    kind: ReflectionKind.union,
    types: Type[];
}

export interface TypeArray {
    kind: ReflectionKind.array,
    elementType: Type;
}

export interface TypePropertySignature {
    kind: ReflectionKind.propertySignature,
    name?: number | string | symbol;
    optional?: true;
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

export type Type = TypeAny | TypeVoid | TypeString | TypeNumber | TypeBoolean | TypeBigInt | TypeNull | TypeUndefined | TypeLiteral
    | TypeFunction | TypeMethod | TypeProperty | TypePromise | TypeClass | TypeEnum | TypeUnion | TypeArray
    | TypeObjectLiteral | TypeIndexSignature | TypePropertySignature | TypeMethodSignature
    ;

export function isType(entry: any): entry is Type {
    return 'object' === typeof entry && 'kind' in entry;
}
