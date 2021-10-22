/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Packed, unpack } from './compiler';
import { Processor, resolveRuntimeType } from './processor';
import { ReflectionKind, ReflectionVisibility, Type, TypeClass, TypeFunction, TypeMethod, TypeMethodSignature, TypeParameter, TypeProperty, TypePropertySignature } from './type';
import { ClassType } from '@deepkit/core';

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
        const pack = unpack(p);
        const processor = new Processor();
        // debugPackStruct(pack);
        const type = processor.run(pack.ops, pack.stack, args);
        return type;
    }

    throw new Error('No type given');
}

export class ReflectionMethod {
    constructor(
        public readonly method: TypeMethod | TypeMethodSignature,
        public readonly reflectionClass: ReflectionClass,
    ) {}

    getParameterNames(): (string)[] {
        return this.getParameters().map(v => v.name);
    }

    getParameter(name: string | number | symbol): TypeParameter | undefined {
        for (const property of this.getParameters()) {
            if (property.name === name) return property;
        }
        return;
    }

    getParameterType(name: string | number | symbol): Type | undefined {
        const parameter = this.getParameter(name);
        if (parameter) return parameter.type;
        return;
    }

    getParameters(): TypeParameter[] {
        return this.method.parameters;
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
    ) {}

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
    description: string = '';
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

    index?: IndexOptions;

    type: Type;

    constructor(
        public readonly property: TypeProperty | TypePropertySignature,
        public readonly reflectionClass: ReflectionClass,
    ) {
        this.type = property.type;
    }

    getName(): number | string | symbol {
        return this.property.name;
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
        return this.property.optional === true || (this.property.type.kind === ReflectionKind.union && this.property.type.types.some(v => v.kind === ReflectionKind.undefined));
    }

    isNullable(): boolean {
        return (this.property.type.kind === ReflectionKind.union && this.property.type.types.some(v => v.kind === ReflectionKind.null));
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

export class ReflectionClass {
    description: string = '';

    data: { [name: string]: any } = {};

    jit: { [name: string]: any } = {};

    protected properties?: ReflectionProperty[];
    protected methods?: ReflectionMethod[];

    constructor(public type: TypeClass) {}

    static from(classType: ClassType, ...args: any[]): ReflectionClass {
        const type = reflect(classType, ...args);
        if (type.kind !== ReflectionKind.class) {
            throw new Error(`Given class is not a class ${classType}`);
        }
        return new ReflectionClass(type);
    }

    getIndexSignatures() {
        throw new Error('todo');
    }

    getPropertyNames(): (string | number | symbol)[] {
        return this.getProperties().map(v => v.getName());
    }

    getProperties(): ReflectionProperty[] {
        if (this.properties) return this.properties;
        this.properties = [];
        for (const member of this.type.types) {
            if (member.kind === ReflectionKind.property || member.kind === ReflectionKind.propertySignature) {
                this.properties.push(new ReflectionProperty(member, this));
            }
        }
        return this.properties;
    }

    getMethodNames(): (string | number | symbol)[] {
        return this.getMethods().map(v => v.getName());
    }

    getMethods(): ReflectionMethod[] {
        if (this.methods) return this.methods;
        this.methods = [];
        for (const member of this.type.types) {
            if (member.kind === ReflectionKind.method || member.kind === ReflectionKind.methodSignature) {
                this.methods.push(new ReflectionMethod(member, this));
            }
        }
        return this.methods;
    }

    getConstructor(): ReflectionMethod | undefined {
        return this.getMethod('constructor');
    }

    getProperty(name: string): ReflectionProperty | undefined {
        for (const property of this.getProperties()) {
            if (property.getName() === name) return property;
        }
        return;
    }

    getMethod(name: string): ReflectionMethod | undefined {
        for (const method of this.getMethods()) {
            if (method.getName() === name) return method;
        }
        return;
    }
}
