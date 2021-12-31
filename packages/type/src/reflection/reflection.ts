/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    assertType,
    autoIncrementAnnotation,
    backReferenceAnnotation,
    copyAndSetParent,
    dataAnnotation,
    databaseAnnotation,
    embeddedAnnotation,
    excludedAnnotation,
    getTypeJitContainer,
    groupAnnotation,
    indexAnnotation,
    IndexOptions,
    isType,
    OuterType,
    primaryKeyAnnotation,
    referenceAnnotation,
    ReferenceOptions,
    ReflectionKind,
    ReflectionVisibility,
    Type,
    TypeClass,
    TypeFunction,
    TypeMethod,
    TypeMethodSignature,
    TypeObjectLiteral,
    TypeParameter,
    TypeProperty,
    TypePropertySignature
} from './type';
import { AbstractClassType, ClassType, getClassName, isArray, isClass } from '@deepkit/core';
import { Packed, resolvePacked, resolveRuntimeType } from './processor';
import { NoTypeReceived } from '../utils';
import { findCommonLiteral } from '../inheritance';

/**
 * Receives the runtime type of template argument.
 *
 * Use
 *
 * ```typescript
 *
 * function f<T>(type?: ReceiveType<T>): Type {
 *     return resolveReceiveType(type);
 * }
 *
 * ```
 */
export type ReceiveType<T> = Packed | OuterType;

export function resolveReceiveType(type?: Packed | Type | ClassType): OuterType {
    if (!type) throw new NoTypeReceived();
    if (isArray(type) && type.__type) return type.__type;
    if (isType(type)) return type as OuterType;
    if (isClass(type)) return resolveRuntimeType(type) as OuterType;
    return resolvePacked(type);
}

export function reflect(o: any, ...args: any[]): OuterType {
    return resolveRuntimeType(o, args) as OuterType;
}

export function valuesOf<T>(args: any[] = [], p?: Packed): (string | number | symbol | Type)[] {
    const type = typeOf(args, p);
    if (type.kind === ReflectionKind.union) {
        return type.types.map(v => {
            if (v.kind === ReflectionKind.literal) return v.literal;
            return v;
        }) as (string | number | symbol | Type)[];
    }
    if (type.kind === ReflectionKind.objectLiteral || type.kind === ReflectionKind.class) {
        return type.types.map(v => {
            if (v.kind === ReflectionKind.method) return v;
            if (v.kind === ReflectionKind.property) return v.type;
            if (v.kind === ReflectionKind.propertySignature) return v.type;
            if (v.kind === ReflectionKind.methodSignature) return v;
            return v;
        }) as (string | number | symbol | Type)[];
    }
    return [];
}

export function propertiesOf<T>(args: any[] = [], p?: Packed): (string | number | symbol | Type)[] {
    const type = typeOf(args, p);
    if (type.kind === ReflectionKind.objectLiteral || type.kind === ReflectionKind.class) {
        return type.types.map(v => {
            if (v.kind === ReflectionKind.method) return v.name;
            if (v.kind === ReflectionKind.property) return v.name;
            if (v.kind === ReflectionKind.propertySignature) return v.name;
            if (v.kind === ReflectionKind.methodSignature) return v.name;
            return v;
        }) as (string | number | symbol | Type)[];
    }
    return [];
}

export function typeOf<T>(args: any[] = [], p?: Packed): OuterType {
    if (p) {
        return resolveRuntimeType(p, args) as OuterType;
    }

    throw new Error('No type given');
}

export function removeTypeName<T extends Type>(type: T): Omit<T, 'typeName' | 'typeArguments'> {
    const o = { ...type };
    if ('typeName' in o) delete o.typeName;
    if ('typeArguments' in o) delete o.typeArguments;
    return o;
}

export function getProperty(type: TypeObjectLiteral | TypeClass, memberName: number | string | symbol): TypeProperty | TypePropertySignature | undefined {
    for (const t of type.types) {
        if ((t.kind === ReflectionKind.property || t.kind === ReflectionKind.propertySignature) && t.name === memberName) return t;
    }
    return;
}

export function toSignature(type: TypeProperty | TypeMethod | TypePropertySignature | TypeMethodSignature): TypePropertySignature | TypeMethodSignature {
    if (type.kind === ReflectionKind.propertySignature || type.kind === ReflectionKind.methodSignature) return type;
    if (type.kind === ReflectionKind.property) {
        return { ...type, parent: type.parent as any, kind: ReflectionKind.propertySignature };
    }

    return { ...type, parent: type.parent as any, kind: ReflectionKind.methodSignature };
}

export function hasCircularReference(type: Type) {
    let hasCircular = false;
    visit(type, () => undefined, () => {
        hasCircular = true;
    });
    return hasCircular;
}

export function visit(type: Type, visitor: (type: Type, path: string, parent?: Type) => false | void, onCircular?: (stack: Type[]) => void, stack: Type[] = [], path: string = '', parent?: Type): void {
    if (stack.includes(type)) {
        if (onCircular) onCircular(stack);
        return;
    }
    stack.push(type);

    if (!path) path = '[' + ReflectionKind[type.kind] + ']';

    if (visitor(type, path, parent) === false) return;

    switch (type.kind) {
        case ReflectionKind.objectLiteral:
        case ReflectionKind.tuple:
        case ReflectionKind.union:
        case ReflectionKind.class:
        case ReflectionKind.intersection:
        case ReflectionKind.templateLiteral:
            for (const member of type.types) visit(member, visitor, onCircular, stack, (path && path + '.') + 'types[' + ReflectionKind[member.kind] + ']', type);
            break;
        case ReflectionKind.string:
        case ReflectionKind.number:
        case ReflectionKind.bigint:
        case ReflectionKind.symbol:
        case ReflectionKind.regexp:
        case ReflectionKind.boolean:
            if (type.origin) visit(type.origin, visitor, onCircular, stack, (path && path + '.') + 'origin[' + ReflectionKind[type.origin.kind] + ']', type);
            break;
        case ReflectionKind.function:
        case ReflectionKind.method:
        case ReflectionKind.methodSignature:
            visit(type.return, visitor, onCircular, stack, (path && path + '.') + 'return[' + ReflectionKind[type.return.kind] + ']', type);
            for (const member of type.parameters) visit(member, visitor, onCircular, stack, (path && path + '.') + 'parameters[' + ReflectionKind[member.kind] + ']', type);
            break;
        case ReflectionKind.propertySignature:
        case ReflectionKind.property:
        case ReflectionKind.array:
        case ReflectionKind.promise:
        case ReflectionKind.parameter:
        case ReflectionKind.tupleMember:
        case ReflectionKind.rest:
            visit(type.type, visitor, onCircular, stack, (path && path + '.') + 'type[' + ReflectionKind[type.type.kind] + ']', type);
            break;
        case ReflectionKind.indexSignature:
            visit(type.index, visitor, onCircular, stack, (path && path + '.') + 'index[' + ReflectionKind[type.index.kind] + ']', type);
            visit(type.type, visitor, onCircular, stack, (path && path + '.') + 'type[' + ReflectionKind[type.type.kind] + ']', type);
            break;
    }

    stack.pop();
}

export class ReflectionParameter {
    type: Type;

    constructor(
        public readonly parameter: TypeParameter,
        public readonly reflectionMethod: ReflectionMethod,
    ) {
        this.type = this.parameter.type;
    }

    getType(): Type {
        return this.type;
    }

    getName(): string {
        return this.parameter.name;
    }

    get name(): string {
        return this.parameter.name;
    }

    isOptional(): boolean {
        return this.parameter.optional === true;
    }

    applyDecorator(t: TData) {
        if (t.type) {
            this.type = resolveReceiveType(t.type);
            if (this.getVisibility() !== undefined) {
                this.reflectionMethod.reflectionClass.getProperty(this.getName())!.setType(this.type);
            }
        }
    }

    getVisibility(): ReflectionVisibility | undefined {
        return this.parameter.visibility;
    }

    isPublic(): boolean {
        return this.parameter.visibility === ReflectionVisibility.public;
    }

    isProtected(): boolean {
        return this.parameter.visibility === ReflectionVisibility.protected;
    }

    isPrivate(): boolean {
        return this.parameter.visibility === ReflectionVisibility.private;
    }
}

export class ReflectionMethod {
    parameters: ReflectionParameter[] = [];

    /**
     * Whether this method acts as validator.
     */
    validator: boolean = false;

    constructor(
        public method: TypeMethod | TypeMethodSignature,
        public reflectionClass: ReflectionClass<any>,
    ) {
        this.setType(method);
    }

    setType(method: TypeMethod | TypeMethodSignature) {
        this.method = method;
        this.parameters = [];
        for (const p of this.method.parameters) {
            this.parameters.push(new ReflectionParameter(p, this));
        }
    }

    applyDecorator(data: TData) {
        this.validator = data.validator;
        if (this.validator) {
            this.reflectionClass.validationMethod = this.getName();
        }
    }

    clone(reflectionClass?: ReflectionClass<any>, method?: TypeMethod | TypeMethodSignature): ReflectionMethod {
        const c = new ReflectionMethod(method || this.method, reflectionClass || this.reflectionClass);
        //todo, clone parameter
        return c;
    }

    getParameterNames(): (string)[] {
        return this.getParameters().map(v => v.getName());
    }

    hasParameter(name: string | number | symbol): boolean {
        return !!this.getParameter(name);
    }

    getParameter(name: string | number | symbol): ReflectionParameter | undefined {
        for (const property of this.getParameters()) {
            if (property.getName() === name) return property;
        }
        return;
    }

    getParameterType(name: string | number | symbol): Type | undefined {
        const parameter = this.getParameter(name);
        if (parameter) return parameter.getType();
        return;
    }

    getParameters(): ReflectionParameter[] {
        return this.parameters;
    }

    getReturnType(): Type {
        return this.method.return;
    }

    isOptional(): boolean {
        return this.method.optional === true;
    }

    getName(): number | string | symbol {
        return this.method.name;
    }
}

export class ReflectionFunction {
    constructor(
        public readonly type: TypeFunction,
    ) {
    }

    static from(fn: Function): ReflectionFunction {
        //todo: cache it

        if (!('__type' in fn)) {
            //functions without any types have no __type attached
            return new ReflectionFunction({ kind: ReflectionKind.function, function: fn, return: { kind: ReflectionKind.any }, parameters: [] });
        }

        const type = reflect(fn);
        if (type.kind !== ReflectionKind.function) {
            throw new Error(`Given object is not a function ${fn}`);
        }
        return new ReflectionFunction(type);
    }

    getParameters(): TypeParameter[] {
        return this.type.parameters;
    }

    getParameterNames(): string[] {
        return this.type.parameters.map(v => v.name);
    }

    getParameterType(name: string): Type | undefined {
        const parameter = this.getParameter(name);
        if (parameter) return parameter.type;
        return;
    }

    getParameter(name: string): TypeParameter | undefined {
        for (const parameter of this.type.parameters) {
            if (parameter.name === name) return parameter;
        }
        return;
    }

    getReturnType(): Type {
        return this.type.return;
    }

    getName(): number | string | symbol | undefined {
        return this.type.name;
    }
}

/**
 * Resolved the class/object ReflectionClass of the given TypeClass|TypeObjectLiteral
 */
export function resolveClassType(type: OuterType): ReflectionClass<any> {
    if (type.kind !== ReflectionKind.class && type.kind !== ReflectionKind.objectLiteral) {
        throw new Error(`Cant resolve ReflectionClass of type ${type.kind} since its not a class or object literal`);
    }

    return ReflectionClass.from(type);
}

export class ReflectionProperty {
    //is this really necessary?
    jsonType?: OuterType;

    serializer?: SerializerFn;
    deserializer?: SerializerFn;

    type: OuterType;

    symbol: symbol;

    constructor(
        public property: TypeProperty | TypePropertySignature,
        public reflectionClass: ReflectionClass<any>,
    ) {
        this.type = property.type;
        this.setType(this.type);
        this.symbol = Symbol(String(this.getName()));
    }

    setType(type: OuterType) {
        this.type = type;
    }

    isPrimaryKey(): boolean {
        return primaryKeyAnnotation.isPrimaryKey(this.getType());
    }

    isEmbedded(): boolean {
        return !!embeddedAnnotation.getFirst(this.getType());
    }

    /**
     * Returns the sub type if available (for arrays for example).
     *
     * @throws Error if the property type does not support sub types.
     */
    getSubType(): OuterType {
        if (this.type.kind === ReflectionKind.array) return this.type.type as OuterType;

        throw new Error(`Type ${this.type.kind} does not support sub types`);
    }

    /**
     * If undefined, it's not an embedded class.
     */
    getEmbedded(): { prefix?: string } | undefined {
        return embeddedAnnotation.getFirst(this.getType());
    }

    isBackReference(): boolean {
        return backReferenceAnnotation.getFirst(this.getType()) !== undefined;
    }

    isAutoIncrement(): boolean {
        return autoIncrementAnnotation.getFirst(this.getType()) === true;
    }

    isReference(): boolean {
        return referenceAnnotation.getFirst(this.getType()) !== undefined;
    }

    isArray(): boolean {
        return this.type.kind === ReflectionKind.array;
    }

    getForeignKeyName(): string {
        return this.getNameAsString();
    }

    getReference(): ReferenceOptions | undefined {
        return referenceAnnotation.getFirst(this.getType());
    }

    getGroups(): string[] {
        return groupAnnotation.getAnnotations(this.getType());
    }

    getExcluded(): string[] {
        return excludedAnnotation.getAnnotations(this.getType());
    }

    isSerializerExcluded(name: string): boolean {
        return excludedAnnotation.isExcluded(this.getType(), name);
    }

    getData(): { [name: string]: any } {
        return dataAnnotation.getFirst(this.getType()) || {};
    }

    /**
     * Returns the ReflectionClass of the reference class/object literal.
     *
     * @throws Error if the property is not from type TypeClass or TypeObjectLiteral
     */
    getResolvedReflectionClass(): ReflectionClass<any> {
        return resolveClassType(this.getType());
    }

    /**
     * If undefined the property is not an index.
     * A unique property is defined as index with IndexOptions.unique=true.
     */
    getIndex(): IndexOptions | undefined {
        return indexAnnotation.getFirst(this.getType());
    }

    /**
     * If undefined the property is not an index.
     * A unique property is defined as index with IndexOptions.unique=true.
     */
    getDatabase<T extends { [name: string]: any }>(name: string): T | undefined {
        return databaseAnnotation.getDatabase<T>(this.getType(), name);
    }

    clone(reflectionClass?: ReflectionClass<any>, property?: TypeProperty | TypePropertySignature): ReflectionProperty {
        const c = new ReflectionProperty(copyAndSetParent(property || this.property), reflectionClass || this.reflectionClass);
        c.jsonType = this.jsonType;
        c.serializer = this.serializer;
        c.deserializer = this.deserializer;
        return c;
    }

    applyDecorator(data: TData) {
        this.serializer = data.serializer;
        this.deserializer = data.deserializer;
    }

    getName(): number | string | symbol {
        return this.property.name;
    }

    getNameAsString(): string {
        return String(this.property.name);
    }

    get name(): string {
        return String(this.property.name);
    }

    getKind(): ReflectionKind {
        return this.type.kind;
    }

    getType(): OuterType {
        return this.type as OuterType;
    }

    getDescription(): string {
        return this.property.description || '';
    }

    /**
     * Whether a value is required from serialization point of view.
     * If this property has for example a default value (set via constructor or manually via t.default),
     * then the value is not required to instantiate the property value.
     */
    isValueRequired(): boolean {
        if (this.hasDefault()) return false;

        return !this.isOptional();
    }

    /**
     * Returns true when `undefined` or a missing value is allowed at the class itself.
     * This is now only true when `optional` is set, but also when type is `any`.
     */
    isActualOptional(): boolean {
        return this.isOptional() || this.type.kind === ReflectionKind.any;
    }

    /**
     * If the property is actual optional or is an union with undefined in it.
     */
    isOptional(): boolean {
        return this.property.optional === true || (this.type.kind === ReflectionKind.union && this.type.types.some(v => v.kind === ReflectionKind.undefined));
    }

    setOptional(v: boolean): void {
        this.property.optional = v ? true : undefined;
    }

    isNullable(): boolean {
        return (this.type.kind === ReflectionKind.union && this.type.types.some(v => v.kind === ReflectionKind.null));
    }

    isReadonly(): boolean {
        return this.property.readonly === true;
    }

    isAbstract(): boolean {
        return this.property.kind === ReflectionKind.property && this.property.abstract === true;
    }

    hasDefault(): boolean {
        return this.property.kind === ReflectionKind.property && this.property.default !== undefined;
    }

    getDefaultValue(): any {
        if (this.property.kind === ReflectionKind.property && this.property.default !== undefined) {
            return this.property.default();
        }
    }

    getDefaultValueFunction(): (() => any) | undefined {
        if (this.property.kind === ReflectionKind.property && this.property.default !== undefined) {
            return this.property.default;
        }
        return;
    }

    getVisibility(): ReflectionVisibility | undefined {
        return this.property.kind === ReflectionKind.property ? this.property.visibility : undefined;
    }

    isPublic(): boolean {
        return this.property.kind === ReflectionKind.property ? this.property.visibility === ReflectionVisibility.public : true;
    }

    isProtected(): boolean {
        return this.property.kind === ReflectionKind.property ? this.property.visibility === ReflectionVisibility.protected : false;
    }

    isPrivate(): boolean {
        return this.property.kind === ReflectionKind.property ? this.property.visibility === ReflectionVisibility.private : false;
    }
}

export const reflectionClassSymbol = Symbol('reflectionClass');

export interface ValidatorFn {
    (value: any, property: ReflectionProperty): any;
}

export interface SerializerFn {
    (value: any, property: ReflectionProperty): any;
}

export class TData {
    validator: boolean = false;
    validators: ValidatorFn[] = [];
    type?: Packed | Type | ClassType;
    data: { [name: string]: any } = {};
    serializer?: SerializerFn;
    deserializer?: SerializerFn;
}

export class EntityData {
    name?: string;
    collectionName?: string;
    data: { [name: string]: any } = {};
    indexes: { names: string[], options: IndexOptions }[] = [];
    singleTableInheritance?: true;
}

export class ReflectionClass<T> {
    /**
     * The description, extracted from the class JSDoc @description.
     */
    description: string = '';

    /**
     * A place where arbitrary data is stored, usually set via decorator t.data.
     */
    data: { [name: string]: any } = {};

    /**
     * The unique entity name.
     *
     * ```typescript
     * @entity.name('user')
     * class User {
     *
     * }
     * ```
     */
    name?: string;

    databaseSchemaName?: string;

    /**
     * The collection name, used in database context (also known as table name).
     *
     * Usually, if this is not set, `name` will be used.
     *
     * ```typescript
     * @entity.collection('users').name('user')
     * class User {
     *
     * }
     * ```
     */
    collectionName?: string;

    singleTableInheritance: boolean = false;

    /**
     * Defined multi-column indexes.
     *
     * ```typescript
     * @entity
     *    .collection('users')
     *    .name('user')
     *    .index(['username', 'email'])
     *    .index(['email', 'region'], {unique: true})
     * class User {
     *     username: string;
     *     email: string;
     * }
     * ```
     */
    indexes: { names: string[], options: IndexOptions }[] = [];

    protected propertyNames: (number | string | symbol)[] = [];
    protected methodNames: (number | string | symbol)[] = [];
    protected properties: ReflectionProperty[] = [];
    protected methods: ReflectionMethod[] = [];

    /**
     * References and back references.
     */
    protected references: ReflectionProperty[] = [];

    protected primaries: ReflectionProperty[] = [];

    protected autoIncrements: ReflectionProperty[] = [];

    /**
     * If a custom validator method was set via @t.validator, then this is the method name.
     */
    public validationMethod?: string | symbol | number;

    public readonly type: TypeClass | TypeObjectLiteral;

    /**
     * A class using @t.singleTableInheritance registers itself in this array in its super class.
     */
    public subClasses: ReflectionClass<any>[] = [];

    constructor(type: Type, public parent?: ReflectionClass<any>) {
        if (type.kind !== ReflectionKind.class && type.kind !== ReflectionKind.objectLiteral) throw new Error('Only class, interface, or object literal type possible');
        this.type = type;
        if (parent) {
            for (const member of parent.getProperties()) {
                this.addProperty(member.clone(this));
            }
            for (const member of parent.getMethods()) {
                this.addMethod(member.clone(this));
            }
        }

        for (const member of type.types) {
            this.add(member);
        }
    }

    clone(): ReflectionClass<any> {
        const reflection = new ReflectionClass(copyAndSetParent(this.type), this.parent);
        reflection.name = this.name;
        reflection.collectionName = this.collectionName;
        reflection.databaseSchemaName = this.databaseSchemaName;
        reflection.singleTableInheritance = this.singleTableInheritance;
        reflection.indexes = this.indexes.slice();
        reflection.subClasses = this.subClasses.slice();
        reflection.data = { ...this.data };

        return reflection;
    }

    getPropertiesDeclaredInConstructor(): ReflectionProperty[] {
        const constructor = this.getMethod('constructor');
        if (!constructor) return [];
        const propertyNames = constructor.parameters.filter(v => v.getVisibility() !== undefined).map(v => v.getName());
        return this.properties.filter(v => propertyNames.includes(String(v.getName())));
    }

    getJitContainer() {
        return getTypeJitContainer(this.type);
    }

    getClassType(): ClassType {
        return this.type.kind === ReflectionKind.class ? this.type.classType : Object;
    }

    getClassName(): string {
        return this.type.kind === ReflectionKind.class ? getClassName(this.getClassType()) : this.type.typeName || 'Object';
    }

    getName(): string {
        return this.name || this.getClassName();
    }

    getCollectionName(): string {
        return this.collectionName || this.getName();
    }

    hasProperty(name: string | symbol | number): boolean {
        return this.propertyNames.includes(name);
    }

    getPrimary(): ReflectionProperty {
        if (!this.primaries.length) throw new Error(`Class ${this.getClassName()} has no primary key.`);
        return this.primaries[0];
    }

    getAutoIncrement(): ReflectionProperty | undefined {
        return this.autoIncrements[0];
    }

    public isSchemaOf(classType: ClassType): boolean {
        if (this.getClassType() === classType) return true;
        let currentProto = Object.getPrototypeOf(this.getClassType().prototype);
        while (currentProto && currentProto !== Object.prototype) {
            if (currentProto === classType) return true;
            currentProto = Object.getPrototypeOf(currentProto);
        }

        return false;
    }


    hasPrimary(): boolean {
        return this.primaries.length > 0;
    }

    getPrimaries(): ReflectionProperty[] {
        return this.primaries;
    }

    /**
     * Returns the ReflectionClass object from parent/super class, if available.
     */
    getSuperReflectionClass(): ReflectionClass<any> | undefined {
        return this.parent;
    }

    addProperty(property: ReflectionProperty) {
        this.properties.push(property);
        this.propertyNames.push(property.getName());
        if (property.isReference() || property.isBackReference()) {
            this.references.push(property);
        }

        if (property.isPrimaryKey()) this.primaries.push(property);
        if (property.isAutoIncrement()) this.autoIncrements.push(property);
    }

    addMethod(method: ReflectionMethod) {
        this.methods.push(method);
        this.methodNames.push(method.getName());
    }

    add(member: Type) {
        if (member.kind === ReflectionKind.property || member.kind === ReflectionKind.propertySignature) {
            const existing = this.getPropertyOrUndefined(member.name);
            if (existing) {
                existing.setType(member.type);
            } else {
                this.addProperty(new ReflectionProperty(member, this));
            }
        }

        if (member.kind === ReflectionKind.method || member.kind === ReflectionKind.methodSignature) {
            const existing = this.getMethodOrUndefined(member.name);
            if (existing) {
                existing.setType(member);
            } else {
                this.addMethod(new ReflectionMethod(member, this));
            }
        }
    }

    public assignedSingleTableInheritanceSubClassesByIdentifier?: { [id: string]: ReflectionClass<any> };

    getAssignedSingleTableInheritanceSubClassesByIdentifier(): { [id: string]: ReflectionClass<any> } | undefined {
        if (!this.subClasses.length) return;
        if (this.assignedSingleTableInheritanceSubClassesByIdentifier) return this.assignedSingleTableInheritanceSubClassesByIdentifier;

        let isBaseOfSingleTableEntity = false;
        for (const schema of this.subClasses) {
            if (schema.singleTableInheritance) {
                isBaseOfSingleTableEntity = true;
                break;
            }
        }

        if (!isBaseOfSingleTableEntity) return;

        const discriminant = this.getSingleTableInheritanceDiscriminantName();

        for (const schema of this.subClasses) {
            if (schema.singleTableInheritance) {
                if (!this.assignedSingleTableInheritanceSubClassesByIdentifier) this.assignedSingleTableInheritanceSubClassesByIdentifier = {};
                const property = schema.getProperty(discriminant);
                assertType(property.type, ReflectionKind.literal);
                this.assignedSingleTableInheritanceSubClassesByIdentifier[property.type.literal as string] = schema;
            }
        }
        return this.assignedSingleTableInheritanceSubClassesByIdentifier;
    }

    hasSingleTableInheritanceSubClasses(): boolean {
        return this.getAssignedSingleTableInheritanceSubClassesByIdentifier() !== undefined;
    }

    getSingleTableInheritanceDiscriminantName(): string {
        if (!this.data.singleTableInheritanceProperty) {

            // let discriminant = findCommonDiscriminant(this.subClasses);

            //when no discriminator was found, find a common literal
            const discriminant = findCommonLiteral(this.subClasses);

            if (!discriminant) {
                throw new Error(`Sub classes of ${this.getClassName()} single-table inheritance [${this.subClasses.map(v => v.getClassName())}] have no common discriminant or common literal. Please define one.`);
            }
            this.data.singleTableInheritanceProperty = this.getProperty(discriminant);
        }

        return (this.data.singleTableInheritanceProperty as ReflectionProperty).name;
    }

    applyDecorator(data: EntityData) {
        Object.assign(this.data, data.data);
        this.name = data.name;
        this.collectionName = data.collectionName;
        this.indexes = data.indexes;
        if (data.singleTableInheritance) {
            this.singleTableInheritance = true;
            if (this.parent) {
                this.parent.subClasses.push(this);
            }
        }
    }

    static from<T>(classTypeIn?: ReceiveType<T> | AbstractClassType<T> | TypeClass | TypeObjectLiteral | ReflectionClass<any>, ...args: any[]): ReflectionClass<T> {
        if (!classTypeIn) throw new Error(`No type given in ReflectionClass.from<T>`);
        if (isArray(classTypeIn)) classTypeIn = resolveReceiveType(classTypeIn);

        if (classTypeIn instanceof ReflectionClass) return classTypeIn;

        if (isType(classTypeIn)) {
            return new ReflectionClass(classTypeIn);
        }

        const classType = (classTypeIn as any)['prototype'] ? classTypeIn as ClassType<T> : classTypeIn.constructor as ClassType<T>;

        if (!classType.prototype.hasOwnProperty(reflectionClassSymbol)) {
            Object.defineProperty(classType.prototype, reflectionClassSymbol, { writable: true, enumerable: false });
        }

        if (!classType.prototype[reflectionClassSymbol]) {
            const type = '__type' in classType ? reflect(classType, ...args) : { kind: ReflectionKind.class, classType, types: [] } as TypeClass;
            if (type.kind !== ReflectionKind.class) {
                throw new Error(`Given class is not a class ${classType}`);
            }

            const parentProto = Object.getPrototypeOf(classType.prototype);
            const parentReflectionClass: ReflectionClass<T> | undefined = parentProto ? ReflectionClass.from(parentProto) : undefined;

            const reflectionClass = new ReflectionClass(type, parentReflectionClass);
            if (args.length === 0) {
                classType.prototype[reflectionClassSymbol] = reflectionClass;
            } else {
                return reflectionClass;
            }
        }

        return classType.prototype[reflectionClassSymbol];
    }

    getIndexSignatures() {
        throw new Error('todo');
    }

    getPropertyNames(): (string | number | symbol)[] {
        return this.propertyNames;
    }

    getProperties(): ReflectionProperty[] {
        return this.properties;
    }

    getMethodNames(): (string | number | symbol)[] {
        return this.methodNames;
    }

    getMethods(): ReflectionMethod[] {
        return this.methods;
    }

    /**
     * Returns references and back references.
     */
    getReferences(): ReflectionProperty[] {
        return this.references;
    }

    getConstructorOrUndefined(): ReflectionMethod | undefined {
        return this.getMethodOrUndefined('constructor');
    }

    getPropertyOrUndefined(name: string | number | symbol): ReflectionProperty | undefined {
        for (const property of this.getProperties()) {
            if (property.getName() === name) return property;
        }
        return;
    }

    getProperty(name: string | number | symbol): ReflectionProperty {
        const property = this.getPropertyOrUndefined(name);
        if (!property) throw new Error(`No property ${String(name)} found in ${this.getClassName()}`);
        return property;
    }

    getMethodParameters(name: string | number | symbol): ReflectionParameter[] {
        const method = this.getMethodOrUndefined(name);
        return method ? method.getParameters() : [];
    }

    getMethodOrUndefined(name: string | number | symbol): ReflectionMethod | undefined {
        for (const method of this.getMethods()) {
            if (method.getName() === name) return method;
        }
        return;
    }

    getMethod(name: string | number | symbol): ReflectionMethod {
        const method = this.getMethodOrUndefined(name);
        if (!method) throw new Error(`No method ${String(name)} found in ${this.getClassName()}`);
        return method;
    }

    public hasCircularReference(): boolean {
        return hasCircularReference(this.type);
    }
}

// old function to decorate an interface
// export function decorate<T>(decorate: { [P in keyof T]?: FreeDecoratorFn<any> }, p?: ReceiveType<T>): ReflectionClass<T> {
//     const type = typeOf([], p);
//     if (type.kind === ReflectionKind.objectLiteral) {
//         const classType = class {
//         };
//         const reflection = new ReflectionClass({ kind: ReflectionKind.class, classType, types: type.types });
//         (classType as any).prototype[reflectionClassSymbol] = reflection;
//
//         for (const [p, fn] of Object.entries(decorate)) {
//             (fn as FreeDecoratorFn<any>)(classType, p);
//         }
//
//         return reflection;
//     }
//     throw new Error('Decorate is only possible on object literal/interfaces.');
// }
