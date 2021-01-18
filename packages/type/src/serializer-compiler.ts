/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { PropertySchema } from './model';
import { JitStack } from './jit';
import { SerializerCompilers } from './serializer';

export type TypeConverterCompilerContext = Map<string, any>;
export type ReserveVariable = (name?: string) => string;

export class CompilerState {
    public template = '';

    public ended = false;
    public setter = '';
    public accessor = '';

    constructor(
        public originalSetter: string,
        public originalAccessor: string,
        public readonly rootContext: TypeConverterCompilerContext,
        public readonly jitStack: JitStack,
        public readonly serializerCompilers: SerializerCompilers,
    ) {
        this.setter = originalSetter;
        this.accessor = originalAccessor;
    }

    /**
     * Adds template code for setting the `this.setter` variable. The expression evaluated in `code` is assigned to `this.setter`.
     * `this.accessor` will point now to `this.setter`.
     */
    addSetter(code: string) {
        this.template += `\n${this.setter} = ${code};`;
        this.accessor = this.setter;
    }

    forceEnd() {
        this.ended = true;
    }

    public setVariable(name?: string, value?: any): string {
        name = reserveVariable(this.rootContext, name);
        if (value !== undefined) {
            this.rootContext.set(name, value);
        }
        return name;
    }

    setContext(values: { [name: string]: any }) {
        for (const i in values) {
            if (!values.hasOwnProperty(i)) continue;
            this.rootContext.set(i, values[i]);
        }
    }

    /**
     * Adds template code for setting the `this.setter` variable manually, so use `${this.setter} = value`.
     * `this.accessor` will point now to `this.setter`.
     */
    addCodeForSetter(code: string) {
        this.template += '\n' + code;
        this.accessor = this.setter;
    }

    hasSetterCode(): boolean {
        return !!this.template;
    }
}

export type TypeConverterCompiler = (
    property: PropertySchema,
    compiler: CompilerState
) => void;

export function reserveVariable(
    rootContext: TypeConverterCompilerContext,
    name: string = 'var',
    value?: any
) {
    for (let i = 0; i < 10000; i++) {
        const candidate = name + '_' + i;
        if (!rootContext.has(candidate)) {
            rootContext.set(candidate, undefined);
            rootContext.set(candidate, value);
            return candidate;
        }
    }
    throw new Error('Too many context variables');
}

export function executeCompiler(
    rootContext: TypeConverterCompilerContext,
    jitStack: JitStack,
    compiler: TypeConverterCompiler,
    setter: string,
    getter: string,
    property: PropertySchema,
    serializerCompilers: SerializerCompilers
): string {
    const state = new CompilerState(setter, getter, rootContext, jitStack, serializerCompilers);
    compiler(property, state);
    return state.template;
}

export function getDataConverterJS(
    setter: string,
    accessor: string,
    property: PropertySchema,
    serializerCompilers: SerializerCompilers,
    rootContext: TypeConverterCompilerContext,
    jitStack: JitStack,
    undefinedSetterCode: string = '',
    nullSetterCode: string = ''
): string {
    const undefinedCompiler = serializerCompilers.get('undefined');
    const nullCompiler = serializerCompilers.get('null');

    undefinedSetterCode = undefinedSetterCode || (undefinedCompiler ? executeCompiler(rootContext, jitStack, undefinedCompiler, setter, accessor, property, serializerCompilers) : '');
    nullSetterCode = nullSetterCode || (nullCompiler ? executeCompiler(rootContext, jitStack, nullCompiler, setter, accessor, property, serializerCompilers) : '');

    const compiler = serializerCompilers.get(property.type);
    let convert = '';
    if (compiler) {
        convert = executeCompiler(rootContext, jitStack, compiler, setter, accessor, property, serializerCompilers);
    } else {
        convert = `
        //no compiler for ${property.type}
        ${setter} = ${accessor};`;
    }

    let postTransform = '';

    const isSerialization = serializerCompilers.serializer.fromClass === serializerCompilers;
    const isDeserialization = serializerCompilers.serializer.toClass === serializerCompilers;

    if (isSerialization) {
        const transformer = property.serialization.get(serializerCompilers.serializer.name) || property.serialization.get('all');
        if (transformer) {
            const fnVar = reserveVariable(rootContext, 'transformer');
            rootContext.set(fnVar, transformer);
            postTransform = `${setter} = ${fnVar}(${setter})`;
        }
    }

    if (isDeserialization) {
        const transformer = property.deserialization.get(serializerCompilers.serializer.name) || property.deserialization.get('all');
        if (transformer) {
            const fnVar = reserveVariable(rootContext, 'transformer');
            rootContext.set(fnVar, transformer);
            postTransform = `${setter} = ${fnVar}(${setter})`;
        }
    }

    // since JSON does not support undefined, we emulate it via using null for serialization, and convert that back to undefined when deserialization happens
    // not: When the value is not defined (property.name in object === false), then this code will never run.
    let defaultValue = isSerialization ? 'null' : 'undefined';
    if (!property.hasDefaultValue && property.defaultValue !== undefined) {
        defaultValue = `${reserveVariable(rootContext, 'defaultValue', property.defaultValue)}()`;
    } else if (!property.isOptional && property.isNullable ) { 
        defaultValue = 'null';
    }

    return `
        if (${accessor} === undefined) {
            ${setter} = ${defaultValue}; 
            ${undefinedSetterCode}
        } else if (${accessor} === null) {
            //null acts on transport layer as telling an explicitely set undefined
            //this is to support actual undefined as value across a transport layer. Otherwise it
            //would be impossible to set a already set value to undefined back (since JSON.stringify() omits that information)
            if (${property.isNullable}) {
                ${setter} = null;
                ${nullSetterCode}
            } else {
                if (${property.isOptional}) ${setter} = ${defaultValue};
                ${undefinedSetterCode}
            }
        } else {
            ${convert}
            ${postTransform}
        }
    `;
}
