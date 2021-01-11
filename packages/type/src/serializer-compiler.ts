/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
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
    name: string = 'var'
) {
    for (let i = 0; i < 10000; i++) {
        const candidate = name + '_' + i;
        if (!rootContext.has(candidate)) {
            rootContext.set(candidate, undefined);
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
    const setNull = property.isNullable ? `${setter} = null;` : '';
    rootContext.set('_default_' + property.name, property.defaultValue);
    const setUndefined = !property.hasDefaultValue && property.defaultValue !== undefined ? `${setter} = ${'_default_' + property.name};` : '';
    const undefinedCompiler = serializerCompilers.get('undefined');
    const nullCompiler = serializerCompilers.get('null');

    undefinedSetterCode = undefinedSetterCode || (undefinedCompiler ? executeCompiler(rootContext, jitStack, undefinedCompiler, setter, accessor, property, serializerCompilers) : '');
    nullSetterCode = nullSetterCode || (nullCompiler ? executeCompiler(rootContext, jitStack, nullCompiler, setter, accessor, property, serializerCompilers) : '');

    const compiler = serializerCompilers.get(property.type);
    let convert = '';
    if (compiler) {
        convert = executeCompiler(rootContext, jitStack, compiler, setter, accessor, property, serializerCompilers);
    } else {
        convert = `//no compiler for ${property.type}
        ${setter} = ${accessor};`;
    }

    return `
        if (${accessor} === undefined) {
            ${setUndefined}
            ${undefinedSetterCode}
        } else if (${accessor} === null) {
            ${setNull}
            ${nullSetterCode}
        } else {
            ${convert}
        }
    `;
}
