/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {ClassSchema, getClassSchema, PropertyCompilerSchema} from './decorators';
import {TypeConverterCompiler} from './serializer-compiler';
import {ClassType} from '@deepkit/core';
import {
    getClassToXFunction,
    getPartialClassToXFunction,
    getPartialXToClassFunction,
    getPropertyClassToXFunction,
    getPropertyXtoClassFunction,
    getXToClassFunction,
    JitConverterOptions,
    resolvePropertyCompilerSchema
} from './jit';
import {AnyEntity, ExtractClassType, PlainOrFullEntityFromClassTypeOrSchema} from './utils';
import {validate, ValidationFailed} from './validation';
import {binaryTypes, Types} from './models';

type CompilerTypes = Types | 'undefined' | 'null';

export class SerializerCompilers {
    public compilers = new Map<string, TypeConverterCompiler>();

    constructor(public serializer: Serializer, public parent?: SerializerCompilers) {
    }

    append(type: CompilerTypes, compiler: TypeConverterCompiler) {
        const old = this.get(type);

        this.compilers.set(type, (property, compilerState) => {
            if (compilerState.ended) return;

            if (old) {
                old(property, compilerState);
                if (compilerState.ended) return;
                compiler(property, compilerState);
                return;
            }

            if (!this.parent) return;
            const parent = this.parent.get(type);
            if (!parent) return;

            parent(property, compilerState);
            if (compilerState.ended) return;
            compiler(property, compilerState);
        });
    }

    prepend(type: CompilerTypes, compiler: TypeConverterCompiler) {
        const old = this.get(type);

        this.compilers.set(type, (property, compilerState) => {
            compiler(property, compilerState);
            if (compilerState.ended) return;

            if (old) {
                old(property, compilerState);
                return;
            }

            if (this.parent) {
                const parent = this.parent.get(type);
                if (parent) {
                    parent(property, compilerState);
                    return;
                }
            }
        });
    }

    /**
     * Registers a new compiler template for a certain type in certain direction
     * (for example: plain to class or class to plain).
     *
     * Note: Don't handle isArray/isMap/isPartial or isOptional at `property` as those are already handled before
     * your compiler code is called. Focus on marshalling the given type as fast and clear as possible.
     * The value you can access via `accessor` is at this stage never undefined and never null.
     *
     * Note: When you come from `class` to x (fromClass.register) then values additionally are
     * guaranteed to have certain value types since the TS system enforces it.
     * If a user overwrites with `as any` its not our business to convert them implicitly.
     *
     * Warning: Context is shared across types, so make sure either your assigned names are unique or generate new variable
     * name using `reserveVariable`.
     *
     * INTERNAL WARNING: Coming from `plain` to `x` the property values usually come from user input which makes
     * it necessary to check the type and convert it if necessary. This is extremely important to not
     * introduce security issues. Deepkiting from plain to your target format is made by calling first jsonSerializer.deserialize()
     * and then yourSerializer.serialize() with the result, deepkit/type is fast enough to buy this convenience
     * (of not having to declare too many compiler templates).
     */
    register(type: CompilerTypes, compiler: TypeConverterCompiler) {
        this.compilers.set(type, compiler);
    }

    /**
     * Removes a compiler.
     */
    reset(type: CompilerTypes) {
        this.compilers.delete(type);
    }

    /**
     * Sets a noop compiler, basically disabling serialization for this type.
     */
    noop(type: CompilerTypes) {
        this.compilers.set(type, (property, state) => {
            state.addSetter(`${state.accessor}`);
        });
    }

    /**
     * Adds a compiler template all typed arrays (Uint8Array, ...) and ArrayBuffer.
     */
    registerForBinary(compiler: TypeConverterCompiler) {
        for (const type of binaryTypes) this.register(type, compiler);
    }

    fork(serializer: Serializer) {
        return new SerializerCompilers(serializer, this);
    }

    get(type: CompilerTypes): TypeConverterCompiler | undefined {
        const t = this.compilers.get(type);
        if (t) return t;

        return this.parent ? this.parent.get(type) : undefined;
    }

    has(type: CompilerTypes): boolean {
        if (this.compilers.has(type)) return true;

        return this.parent ? this.parent.has(type) : false;
    }
}

export class Serializer {
    public toClass = new SerializerCompilers(this);
    public fromClass = new SerializerCompilers(this);

    public toClassSymbol: symbol;
    public fromClassSymbol: symbol;
    public partialToClassSymbol: symbol;
    public partialFromClassSymbol: symbol;

    constructor(
        public readonly name: string
    ) {
        this.toClassSymbol = Symbol('toClass-' + name);
        this.fromClassSymbol = Symbol('fromClass-' + name);
        this.partialToClassSymbol = Symbol('partialToClass-' + name);
        this.partialFromClassSymbol = Symbol('partialFromClass-' + name);
    }

    fork(name: string): ClassType<Serializer> {
        const self = this;

        abstract class Res extends Serializer {
            constructor() {
                super(name);
                this.toClass = self.toClass.fork(this);
                this.fromClass = self.fromClass.fork(this);
            }
        }

        return Res as any;
    }

    public for<T extends ClassType | ClassSchema>(schemaOrType: T): ScopedSerializer<ClassSchema<ExtractClassType<T>>> {
        return new ScopedSerializer(this, getClassSchema(schemaOrType));
    }

    /**
     * Serializes given class instance value to the serializer format.
     */
    serializeProperty(property: PropertyCompilerSchema, value: any): any {
        return getPropertyClassToXFunction(property, this)(value);
    }

    /**
     * Converts serialized value to class type.
     */
    deserializeProperty(property: PropertyCompilerSchema, value: any): any {
        return getPropertyXtoClassFunction(property, this)(value);
    }

    /**
     * Converts given serialized data to the class instance.
     */
    deserializeMethodResult(property: PropertyCompilerSchema, value: any): any {
        return getPropertyXtoClassFunction(property, this)(value);
    }
}

type FirstParameter<T> = T extends ((a: infer A) => any) ? A : never;

export class ScopedSerializer<T extends ClassSchema> {
    protected _serialize?: (instance: ExtractClassType<T>, options?: JitConverterOptions) => any = undefined;
    protected _deserialize?: (data: any, options?: JitConverterOptions, parents?: any[]) => ExtractClassType<T> = undefined;

    protected _partialSerialize?: (instance: { [name: string]: any }, options?: JitConverterOptions) => any = undefined;
    protected _partialDeserialize?: <P extends { [name: string]: any }>(
        data: P,
        options?: JitConverterOptions
    ) => Pick<ExtractClassType<T>, keyof P> = undefined;

    constructor(public readonly serializer: Serializer, protected schema: T) {
    }

    from<S extends Serializer, SC extends ReturnType<S['for']>>(serializer: S, ...args: Parameters<SC['deserialize']>): ReturnType<this['serialize']> {
        return this.serialize((serializer.for(this.schema).deserialize as any)(...args)) as any;
    }

    to<S extends Serializer, SC extends ReturnType<S['for']>>(serializer: S, ...args: Parameters<this['deserialize']>): ReturnType<SC['serialize']> {
        return serializer.for(this.schema).serialize((this.deserialize as any)(...args)) as any;
    }

    fromPartial<S extends Serializer, SC extends ReturnType<S['for']>>(serializer: S, a: FirstParameter<ReturnType<S['for']>['partialDeserialize']>, options?: JitConverterOptions) {
        return this.partialSerialize(serializer.for(this.schema).partialDeserialize(a, options));
    }

    toPartial<S extends Serializer, SC extends ReturnType<S['for']>, A extends FirstParameter<this['partialDeserialize']>>(serializer: S, a: A): ReturnType<SC['partialSerialize']> {
        return serializer.for(this.schema).partialSerialize((this.partialDeserialize as any)(a)) as any;
    }

    fromPatch<S extends Serializer>(serializer: S, a: FirstParameter<ReturnType<S['for']>['patchDeserialize']>, options?: JitConverterOptions) {
        return this.patchSerialize(serializer.for(this.schema).patchDeserialize(a, options));
    }

    toPatch<S extends Serializer, SC extends ReturnType<S['for']>>(serializer: S, ...args: Parameters<this['patchDeserialize']>) {
        return serializer.for(this.schema).patchSerialize((this.patchDeserialize as any)(...args));
    }

    /**
     * Serializes given class instance to the serialization format.
     */
    serialize(instance: ExtractClassType<T>, options?: JitConverterOptions): any {
        if (!this._serialize) this._serialize = getClassToXFunction(this.schema, this.serializer);
        return this._serialize(instance, options);
    }

    /**
     * Same as `deserialize` but with validation before creating the class instance.
     *
     * ```typescript
     * try {
     *     const entity = painSerializer.for(MyEntity).validatedDeserialize({field1: 'value'});
     *     entity instanceof MyEntity; //true
     * } catch (error) {
     *     if (error instanceof ValidationFailed) {
     *         //handle that case.
     *     }
     * }
     * ```
     */
    validatedDeserialize(
        data: PlainOrFullEntityFromClassTypeOrSchema<T>,
        options?: JitConverterOptions
    ): ExtractClassType<T> {
        const errors = validate(this.schema, data);
        if (errors.length) throw new ValidationFailed(errors);

        if (!this._deserialize) this._deserialize = getXToClassFunction(this.schema, this.serializer);
        return this._deserialize(data, options);
    }

    /**
     * Converts given data in form of this serialization format to the target (default JS primitive/class) type.
     */
    deserialize(
        data: PlainOrFullEntityFromClassTypeOrSchema<T>,
        options?: JitConverterOptions,
        parents?: any[]
    ): ExtractClassType<T> {
        if (!this._deserialize) this._deserialize = getXToClassFunction(this.schema, this.serializer);
        return this._deserialize(data, options, parents);
    }

    /**
     * Serialized one property value from class instance to serialization target.
     *
     * Property name is either a property name or a deep path (e.g. config.value)
     */
    serializeProperty(name: (keyof ExtractClassType<T> & string) | string, value: any): any {
        const property = this.schema.getClassProperties().get(name) ?? resolvePropertyCompilerSchema(this.schema, name);
        return getPropertyClassToXFunction(property, this.serializer)(value);
    }

    /**
     * Converts given data in form of this serialization format to the target (default JS primitive/class) type.
     *
     * Property name is either a property name or a deep path (e.g. config.value)
     */
    deserializeProperty(name: (keyof ExtractClassType<T> & string) | string, value: any) {
        const property = this.schema.getClassProperties().get(name) ?? resolvePropertyCompilerSchema(this.schema, name);
        return getPropertyXtoClassFunction(property, this.serializer)(value);
    }

    serializeMethodArgument(methodName: string, property: number, value: any): ReturnType<this['serializeProperty']> {
        return getPropertyClassToXFunction(this.schema.getMethodProperties(methodName)[property], this.serializer)(value);
    }

    deserializeMethodArgument(methodName: string, property: number, value: any) {
        return getPropertyXtoClassFunction(this.schema.getMethodProperties(methodName)[property], this.serializer)(value);
    }

    serializeMethodResult(methodName: string, value: any): ReturnType<this['serializeProperty']> {
        return getPropertyClassToXFunction(this.schema.getMethod(methodName), this.serializer)(value);
    }

    deserializeMethodResult(methodName: string, value: any) {
        return getPropertyXtoClassFunction(this.schema.getMethod(methodName), this.serializer)(value);
    }

    /**
     * Serialized a partial instance to the serialization format.
     */
    partialSerialize<R extends { [name: string]: any }>(
        data: R,
        options?: JitConverterOptions
    ): AnyEntity<R> {
        if (!this._partialSerialize) this._partialSerialize = getPartialClassToXFunction(this.schema, this.serializer);
        return this._partialSerialize(data, options);
    }

    /**
     * Converts data in form of this serialization format to the same partial target (default JS primitive/class) type.
     */
    partialDeserialize<P extends { [name: string]: any }>(
        data: P,
        options?: JitConverterOptions
    ): Pick<ExtractClassType<T>, keyof P> {
        if (!this._partialDeserialize) this._partialDeserialize = getPartialXToClassFunction(this.schema, this.serializer);
        return this._partialDeserialize(data, options);
    }

    public patchDeserialize<R extends { [name: string]: any }>(
        partial: R,
        options?: JitConverterOptions
    ): { [F in keyof R]?: any } {
        const result: Partial<{ [F in keyof R]: any }> = {};
        for (const i in partial) {
            if (!partial.hasOwnProperty(i)) continue;
            const property = this.schema.getClassProperties().get(i) ?? resolvePropertyCompilerSchema(this.schema, i);
            result[i] = getPropertyXtoClassFunction(property, this.serializer)(partial[i], options?.parents ?? [], options);
        }

        return result;
    }

    public patchSerialize<T, R extends object>(
        partial: R,
        options?: JitConverterOptions
    ): { [F in keyof R]?: any } {
        const result: Partial<{ [F in keyof R]: any }> = {};
        for (const i in partial) {
            if (!partial.hasOwnProperty(i)) continue;
            const property = this.schema.getClassProperties().get(i) ?? resolvePropertyCompilerSchema(this.schema, i);
            result[i] = getPropertyClassToXFunction(property, this.serializer)(partial[i], options);
        }

        return result;
    }
}

export const emptySerializer = new class extends Serializer {
    constructor() {
        super('empty');
    }
};
