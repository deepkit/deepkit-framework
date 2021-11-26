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
    isType,
    ReflectionKind,
    ReflectionVisibility,
    Type,
    TypeClass,
    TypeFunction,
    TypeIntersection,
    TypeMethod,
    TypeMethodSignature,
    TypeObjectLiteral,
    TypeParameter,
    TypeProperty,
    TypePropertySignature
} from './type';
import { AbstractClassType, ClassType } from '@deepkit/core';
import { FreeDecoratorFn } from '../decorator-builder';
import { Packed, resolveRuntimeType } from './processor';
import { isExtendable } from './extends';

export type ReceiveType<T> = Packed;

export function reflect(o: any, ...args: any[]): Type {
    return resolveRuntimeType(o, args);
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

export function typeOf<T>(args: any[] = [], p?: Packed): Type {
    if (p) {
        return resolveRuntimeType(p, args);
    }

    throw new Error('No type given');
}

type TypeDecorator = (type: Type) => boolean;

export const typeDecorators: TypeDecorator[] = [
    (type: Type) => {
        if (type.kind === ReflectionKind.objectLiteral) {
            return hasMember(type, '__meta', {
                    kind: ReflectionKind.union,
                    types: [
                        { kind: ReflectionKind.literal, literal: 'reference' },
                        { kind: ReflectionKind.literal, literal: 'autoIncrement' },
                        { kind: ReflectionKind.literal, literal: 'primaryKey' },
                        { kind: ReflectionKind.literal, literal: 'backReference' }
                    ]
                }
            );
        }
        return false;
    }
];

export function registerTypeDecorator(decorator: TypeDecorator) {
    typeDecorators.push(decorator);
}

export function isTypeDecorator(type: Type): boolean {
    return typeDecorators.some(v => v(type));
}

export function isMember(v: Type): v is TypeProperty | TypePropertySignature | TypeMethodSignature | TypeMethod {
    return v.kind === ReflectionKind.property || v.kind === ReflectionKind.propertySignature || v.kind === ReflectionKind.methodSignature || v.kind === ReflectionKind.method;
}

export function hasMember(type: TypeObjectLiteral | TypeClass, memberName: number | string | symbol, memberType?: Type): boolean {
    return type.types.some(v => isMember(v) && v.name === memberName && (!memberType || isExtendable(v.kind === ReflectionKind.propertySignature || v.kind === ReflectionKind.property ? v.type : v, memberType)));
}

export function toSignature(type: TypeProperty | TypeMethod | TypePropertySignature | TypeMethodSignature): TypePropertySignature | TypeMethodSignature {
    if (type.kind === ReflectionKind.propertySignature || type.kind === ReflectionKind.methodSignature) return type;
    if (type.kind === ReflectionKind.property) {
        return { ...type, kind: ReflectionKind.propertySignature };
    }

    return { ...type, kind: ReflectionKind.methodSignature };
}

export function merge(types: (TypeObjectLiteral | TypeClass)[]): TypeObjectLiteral {
    const type: TypeObjectLiteral = { kind: ReflectionKind.objectLiteral, types: [] };

    for (const subType of types) {
        for (const member of subType.types) {
            if (!isMember(member)) continue;
            if (!hasMember(type, member.name)) {
                type.types.push(toSignature(member));
            }
        }
    }
    return type;
}

export function resolveIntersection(type: TypeIntersection): { resolved: Type, decorations: Type[] } {
    const candidates: Type[] = [];
    const decorations: Type[] = [];
    for (let t of type.types) {
        if (t.kind === ReflectionKind.intersection) {
            const subResolved = resolveIntersection(t);
            t = subResolved.resolved;
            decorations.push(...subResolved.decorations);
        }
        if (isTypeDecorator(t)) {
            decorations.push(t);
        } else {
            candidates.push(t);
        }
    }

    if (candidates.length === 0) return { resolved: { kind: ReflectionKind.never }, decorations: [] };
    if (candidates.length === 1) return { resolved: candidates[0], decorations };

    const isMergeAble = candidates.every(v => v.kind === ReflectionKind.objectLiteral || v.kind === ReflectionKind.class);
    if (isMergeAble) return { resolved: merge(candidates as (TypeObjectLiteral | TypeClass)[]), decorations };

    return { resolved: { kind: ReflectionKind.intersection, types: candidates }, decorations };
}

export function hasCircularReference(type: Type, stack: Type[] = []) {
    let hasCircular = false;
    visit(type, () => undefined, () => {
        hasCircular = true;
    });
    return hasCircular;
}

export function visit(type: Type, visitor: (type: Type) => false | void, onCircular: (stack: Type[]) => void, stack: Type[] = []): void {
    if (stack.includes(type)) {
        onCircular(stack);
        return;
    }
    stack.push(type);

    visitor(type);

    switch (type.kind) {
        case ReflectionKind.objectLiteral:
        case ReflectionKind.tuple:
        case ReflectionKind.union:
        case ReflectionKind.class:
        case ReflectionKind.intersection:
            for (const member of type.types) visit(member, visitor, onCircular, stack);
            break;
        case ReflectionKind.propertySignature:
        case ReflectionKind.property:
        case ReflectionKind.array:
        case ReflectionKind.promise:
        case ReflectionKind.parameter:
        case ReflectionKind.rest:
            visit(type.type, visitor, onCircular, stack);
            break;
        case ReflectionKind.indexSignature:
            visit(type.index, visitor, onCircular, stack);
            visit(type.type, visitor, onCircular, stack);
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

    isOptional(): boolean {
        return this.parameter.optional === true;
    }

    applyDecorator(t: TData) {
        if (t.type) {
            this.type = resolveRuntimeType(t.type);
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

    clone(reflectionClass?: ReflectionClass<any>, method?: TypeMethod | TypeMethodSignature): ReflectionMethod {
        const c = new ReflectionMethod(method || this.method, reflectionClass || this.reflectionClass);
        //todo, clone parameter
        return c;
    }

    getParameterNames(): (string)[] {
        return this.getParameters().map(v => v.getName());
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

//convert that to
export interface BackReferenceOptions<T> {
    /**
     * Necessary for normalised many-to-many relations. This defines the class of the pivot table/collection.
     */
    via?: ClassType; // | ForwardRefFn<ClassType>,

    /**
     * A reference/backReference can define which reference on the other side
     * reference back. This is necessary when there are multiple outgoing references
     * to the same entity.
     */
    mappedBy?: keyof T & string,
}

export type IndexOptions = Partial<{
    //index size. Necessary for blob/longtext, etc.
    size: number,

    unique: boolean,
    spatial: boolean,
    sparse: boolean,

    //only in mongodb
    synchronize: boolean,
    fulltext: boolean,
    where: string,
}>;

export type ReferenceActions = 'RESTRICT' | 'NO ACTION' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';

export class ReflectionProperty {
    data: { [name: string]: any } = {};

    autoIncrement?: true;
    primaryKey?: true;

    jsonType?: Type;

    groups: string[] = [];

    /**
     * true when this property is marked as a owning reference (also known as foreign key).
     */
    reference?: true;
    referenceOptions: { onDelete: ReferenceActions, onUpdate: ReferenceActions } = {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    };

    /**
     * Set when this property is marked as a back reference.
     */
    backReference?: BackReferenceOptions<any>;

    serializer?: SerializerFn;
    deserializer?: SerializerFn;
    excludeSerializerNames?: string[];

    index?: IndexOptions;

    type: Type;

    constructor(
        public property: TypeProperty | TypePropertySignature,
        public reflectionClass: ReflectionClass<any>,
    ) {
        this.type = property.type;
    }

    setType(type: Type) {
        this.type = type;
    }

    clone(reflectionClass?: ReflectionClass<any>, property?: TypeProperty | TypePropertySignature): ReflectionProperty {
        const c = new ReflectionProperty(property || this.property, reflectionClass || this.reflectionClass);
        c.data = { ...this.data };
        c.autoIncrement = this.autoIncrement;
        c.primaryKey = this.primaryKey;
        c.jsonType = this.jsonType;
        c.groups = this.groups.slice();
        c.reference = this.reference;
        c.serializer = this.serializer;
        c.deserializer = this.deserializer;
        if (this.referenceOptions) c.referenceOptions = { ...this.referenceOptions };
        if (this.backReference) c.backReference = { ...this.backReference };
        if (this.index) c.index = { ...this.index };
        return c;
    }

    applyDecorator(data: TData) {
        Object.assign(this.data, data.data);
        if (data.groups) this.groups.push(...data.groups);
        this.serializer = data.serializer;
        this.deserializer = data.deserializer;
        this.excludeSerializerNames = data.excludeSerializerNames;
        if (data.referenceOptions) {
            this.reference = true;
            this.referenceOptions = data.referenceOptions;
        }
        if (data.backReference) {
            this.backReference = data.backReference;
        }
    }

    getName(): number | string | symbol {
        return this.property.name;
    }

    getKind(): ReflectionKind {
        return this.type.kind;
    }

    getType(): Type {
        return this.type;
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

const reflectionClassSymbol = Symbol('reflectionClass');

export interface ValidatorFn {
    (value: any, property: ReflectionProperty): any;
}

export interface SerializerFn {
    (value: any, property: ReflectionProperty): any;
}

export class TData {
    validators: ValidatorFn[] = [];
    type?: Packed | ClassType;
    data: { [name: string]: any } = {};
    serializer?: SerializerFn;
    deserializer?: SerializerFn;
    excludeSerializerNames?: string[];
    groups?: string[];
    referenceOptions?: { onDelete: ReferenceActions, onUpdate: ReferenceActions };
    backReference?: BackReferenceOptions<any>;

    //todo: index
}

export class ReflectionClass<T> {
    description: string = '';
    data: { [name: string]: any } = {};
    jit: { [name: string]: any } = {};

    protected propertyNames: (number | string | symbol)[] = [];
    protected methodNames: (number | string | symbol)[] = [];
    protected properties: ReflectionProperty[] = [];
    protected methods: ReflectionMethod[] = [];

    public groups: string[] = [];
    public type: TypeClass | TypeObjectLiteral;

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

    getClassType(): ClassType {
        return this.type.kind === ReflectionKind.class ? this.type.classType : Object;
    }

    /**
     * Returns the parent/super class type, if available.
     */
    getSuperClass(): ClassType | undefined {
        return this.parent ? this.parent.getClassType() : undefined;
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
    }

    addMethod(method: ReflectionMethod) {
        this.methods.push(method);
        this.methodNames.push(method.getName());
    }

    add(member: Type) {
        if (member.kind === ReflectionKind.property || member.kind === ReflectionKind.propertySignature) {
            const existing = this.getProperty(member.name);
            if (existing) {
                existing.setType(member);
            } else {
                this.addProperty(new ReflectionProperty(member, this));
            }
        }

        if (member.kind === ReflectionKind.method || member.kind === ReflectionKind.methodSignature) {
            const existing = this.getMethod(member.name);
            if (existing) {
                existing.setType(member);
            } else {
                this.addMethod(new ReflectionMethod(member, this));
            }
        }
    }

    applyDecorator(data: TData) {
        Object.assign(this.data, data.data);
        if (data.groups) this.groups = data.groups;
    }

    static from<T>(classTypeIn: AbstractClassType<T> | Type, ...args: any[]): ReflectionClass<T> {
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
            const parentReflectionClass: ReflectionClass<any> | undefined = parentProto ? ReflectionClass.from(parentProto) : undefined;

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

    getConstructor(): ReflectionMethod | undefined {
        return this.getMethod('constructor');
    }

    getProperty(name: string | number | symbol): ReflectionProperty | undefined {
        for (const property of this.getProperties()) {
            if (property.getName() === name) return property;
        }
        return;
    }

    getMethod(name: string | number | symbol): ReflectionMethod | undefined {
        for (const method of this.getMethods()) {
            if (method.getName() === name) return method;
        }
        return;
    }

    public hasCircularReference(): boolean {
        return hasCircularReference(this.type);
    }
}

export function decorate<T>(decorate: { [P in keyof T]?: FreeDecoratorFn<any> }, p?: ReceiveType<T>): ReflectionClass<T> {
    const type = typeOf([], p);
    if (type.kind === ReflectionKind.objectLiteral) {
        const classType = class {
        };
        const reflection = new ReflectionClass({ kind: ReflectionKind.class, classType, types: type.types });
        (classType as any).prototype[reflectionClassSymbol] = reflection;

        for (const [p, fn] of Object.entries(decorate)) {
            (fn as FreeDecoratorFn<any>)(classType, p);
        }

        return reflection;
    }
    throw new Error('Decorate is only possible on object literal/interfaces.');
}
