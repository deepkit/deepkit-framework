/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, CompilerContext } from '@deepkit/core';
import { ReflectionKind, Type, TypeClass, TypeObjectLiteral, TypeProperty, TypePropertySignature } from './reflection/type';
import { ReceiveType, ReflectionClass, ReflectionProperty } from './reflection/reflection';
import { JSONSingle } from './utils';
import { resolvePacked } from './reflection/processor';

export function cast<T>(data: JSONSingle<T>, serializer = jsonSerializer, type?: ReceiveType<T>): T {
    const fn = createSerializeFunction(resolvePacked(type!), serializer.deserializeRegistry);
    return fn(data) as T;
}

export class NamingStrategy {
    getPropertyName(type: TypeProperty | TypePropertySignature): string | number | symbol | undefined {
        return type.name;
    }
}

export function createSerializeFunction(type: Type, registry: TemplateRegistry, namingStrategy: NamingStrategy = new NamingStrategy()): (data: any) => any {
    const compiler = new CompilerContext();

    const templates = registry.get(type.kind);
    if (!templates.length) return (data: any) => data;

    const state = new TemplateState('result', 'data', compiler, registry, namingStrategy);

    for (const template of templates) {
        template(type, state);
        if (state.ended) break;
    }

    //todo: what decides result initial value?
    //result = {}
    //result = [];
    //result = new type.classType
    const code = `
        var result;
        ${state.template}
        return result;
    `;
    return compiler.build(code, 'data');
}

type FindType<T extends Type, LOOKUP extends ReflectionKind> = { [P in keyof T]: T[P] extends LOOKUP ? T : never }[keyof T]

class TemplateState {
    public template = '';

    public ended = false;
    public setter = '';
    public accessor = '';

    constructor(
        public originalSetter: string,
        public originalAccessor: string,
        public readonly compilerContext: CompilerContext,
        public readonly registry: TemplateRegistry,
        public readonly namingStrategy: NamingStrategy
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

    /**
     * Stop executing next templates.
     */
    stop() {
        this.ended = true;
    }

    setVariable(name: string, value?: any): string {
        return this.compilerContext.reserveVariable(name, value);
    }

    setContext(values: { [name: string]: any }) {
        for (const i in values) {
            if (!values.hasOwnProperty(i)) continue;
            this.compilerContext.context.set(i, values[i]);
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

type Template<T extends Type> = (type: T, state: TemplateState) => void;

class TemplateRegistry {
    protected templates: { [kind in ReflectionKind]?: Template<any>[] } = {};

    constructor(public serializer: Serializer) {}

    get(kind: ReflectionKind): Template<any>[] {
        return this.templates[kind] || [];
    }

    register<T extends ReflectionKind>(kind: T, template: Template<FindType<Type, T>>) {
        this.templates[kind] = [template];
    }

    prepend<T extends ReflectionKind>(kind: T, template: Template<FindType<Type, T>>) {
        this.templates[kind] ||= [];
        this.templates[kind]!.unshift(template);
    }

    append<T extends ReflectionKind>(kind: T, template: Template<FindType<Type, T>>) {
        this.templates[kind] ||= [];
        this.templates[kind]!.push(template);
    }

    prependClass(classType: ClassType, template: Template<FindType<Type, ReflectionKind.class>>) {
        this.prepend(ReflectionKind.class, (type, state) => {
            if (type.classType === classType) {
                template(type, state);
                state.stop();
            }
        });
    }
}

export function executeTemplates(
    compilerContext: CompilerContext,
    registry: TemplateRegistry,
    namingStrategy: NamingStrategy,
    templates: Template<any>[],
    setter: string,
    getter: string,
    type: Type
): string {
    const state = new TemplateState(setter, getter, compilerContext, registry, namingStrategy);
    for (const template of templates) {
        template(type, state);
        if (state.ended) break;
    }
    return state.template;
}

export function createConverterJSForType(
    setter: string,
    accessor: string,
    type: Type,
    registry: TemplateRegistry,
    compilerContext: CompilerContext,
    namingStrategy: NamingStrategy
): string {
    const templates = registry.get(type.kind);
    let convert = '';
    if (templates.length) {
        convert = executeTemplates(compilerContext, registry, namingStrategy, templates, setter, accessor, type);
    } else {
        convert = `
        //no compiler for ${type.kind}
        ${setter} = ${accessor};`;
    }

    return convert;
}

export function createConverterJSForProperty(
    setter: string,
    accessor: string,
    reflection: ReflectionProperty,
    registry: TemplateRegistry,
    compilerContext: CompilerContext,
    namingStrategy: NamingStrategy,
    undefinedSetterCode: string = '',
    nullSetterCode: string = ''
): string {
    const undefinedCompiler = registry.get(ReflectionKind.undefined);
    const nullCompiler = registry.get(ReflectionKind.null);

    undefinedSetterCode = undefinedSetterCode || (undefinedCompiler ? executeTemplates(compilerContext, registry, namingStrategy, undefinedCompiler, setter, accessor, reflection.type) : '');
    nullSetterCode = nullSetterCode || (nullCompiler ? executeTemplates(compilerContext, registry, namingStrategy, nullCompiler, setter, accessor, reflection.type) : '');

    const templates = registry.get(reflection.type.kind);
    let convert = '';
    if (templates.length) {
        convert = executeTemplates(compilerContext, registry, namingStrategy, templates, setter, accessor, reflection.type);
    } else {
        convert = `
        //no compiler for ${reflection.type.kind}
        ${setter} = ${accessor};`;
    }

    let postTransform = '';

    const isSerialization = registry.serializer.serializeRegistry === registry;
    const isDeserialization = registry.serializer.deserializeRegistry === registry;

    return convert;
    // if (isSerialization) {
    //     const transformer = type.serialization.get(registry.serializer.name) || type.serialization.get('all');
    //     if (transformer) {
    //         const fnVar = compilerContext.reserveVariable('transformer', transformer);
    //         postTransform = `${setter} = ${fnVar}(${setter})`;
    //     }
    // }
    //
    // if (isDeserialization) {
    //     const transformer = type.deserialization.get(registry.serializer.name) || type.deserialization.get('all');
    //     if (transformer) {
    //         const fnVar = compilerContext.reserveVariable('transformer', transformer);
    //         postTransform = `${setter} = ${fnVar}(${setter})`;
    //     }
    // }

    // since JSON does not support undefined, we emulate it via using null for serialization, and convert that back to undefined when deserialization happens.
    // note: When the value is not defined (property.name in object === false), then this code will never run.
    // let defaultValue = isSerialization ? 'null' : 'undefined';
    // if (!type.hasDefaultValue && type.defaultValue !== undefined) {
    //     defaultValue = `${compilerContext.reserveVariable('defaultValue', type.defaultValue)}()`;
    // } else if (!type.isOptional && type.isNullable) {
    //     defaultValue = 'null';
    // }
    //
    // return `
    //     if (${accessor} === undefined) {
    //         if (${!type.hasDefaultValue || type.isOptional}) ${setter} = ${defaultValue};
    //         ${undefinedSetterCode}
    //     } else if (${accessor} === null) {
    //         //null acts on transport layer as telling an explicitly set undefined
    //         //this is to support actual undefined as value across a transport layer. Otherwise it
    //         //would be impossible to set a already set value to undefined back (since JSON.stringify() omits that information)
    //         if (${type.isNullable}) {
    //             ${setter} = null;
    //             ${nullSetterCode}
    //         } else {
    //             if (${type.isOptional}) ${setter} = ${defaultValue};
    //             ${undefinedSetterCode}
    //         }
    //     } else {
    //         ${convert}
    //         ${postTransform}
    //     }
    // `;
}

function deserializeClass(type: TypeClass, state: TemplateState) {
    const preLines: string[] = [];
    const lines: string[] = [];
    const clazz = new ReflectionClass(type);

    const constructor = clazz.getConstructor();
    const constructorArguments: string[] = [];
    if (constructor) {
        const parameters = constructor.getParameters();

        for (let i = 0; i < parameters.length; i++) {
            const parameter = parameters[i];
            if (parameter.visibility === undefined) continue;
            const reflection = clazz.getProperty(parameter.name);
            if (!reflection) continue;

            preLines.push(`
                var c_${i};
                ${createConverterJSForProperty(`c_${i}`, `${state.accessor}[${JSON.stringify(parameter.name)}]`, reflection, state.registry, state.compilerContext, state.namingStrategy)}
            `);
            constructorArguments.push(`c_${i}`);
        }
    }

    for (const member of type.types) {
        if (member.kind === ReflectionKind.indexSignature) {

        }

        if (member.kind === ReflectionKind.propertySignature || member.kind === ReflectionKind.property) {
            lines.push(createConverterJSForType(
                `${state.setter}[${JSON.stringify(member.name)}]`,
                `${state.accessor}[${JSON.stringify(state.namingStrategy.getPropertyName(member))}]`,
                member.type,
                state.registry,
                state.compilerContext,
                state.namingStrategy
            ));
        }
    }

    const classType = state.compilerContext.reserveConst(type.classType);

    state.addCodeForSetter(`
        ${preLines.join('\n')}
        ${state.setter} = new ${classType}(${constructorArguments.join(', ')});
        ${lines.join('\n')}
    `);
}

function deserializeObjectLiteral(type: TypeObjectLiteral, state: TemplateState) {
    const lines: string[] = [];

    for (const member of type.types) {
        if (member.kind === ReflectionKind.indexSignature) {
        }

        if (member.kind === ReflectionKind.propertySignature) {
            lines.push(createConverterJSForType(
                `${state.setter}[${JSON.stringify(member.name)}]`,
                `${state.accessor}[${JSON.stringify(member.name)}]`,
                member.type,
                state.registry,
                state.compilerContext,
                state.namingStrategy,
            ));
        }
    }

    state.addCodeForSetter(`
        ${state.setter} = {};
        ${lines.join('\n')}
    `);
}

class Serializer {
    serializeRegistry = new TemplateRegistry(this);
    deserializeRegistry = new TemplateRegistry(this);

    constructor() {
        this.deserializeRegistry.register(ReflectionKind.class, deserializeClass);
        this.deserializeRegistry.register(ReflectionKind.objectLiteral, deserializeObjectLiteral);
    }

    public serialize<T, D extends T>(data: D) {

    }
}

class JSONSerializer extends Serializer {
    constructor() {
        super();

        this.serializeRegistry.prependClass(Date, (type, state) => {
            state.addSetter(`${state.accessor}.toJSON()`);
        });

        this.deserializeRegistry.prependClass(Date, (type, state) => {
            state.setContext({ Date });
            state.addSetter(`new Date(${state.accessor})`);
        });

        this.deserializeRegistry.register(ReflectionKind.string, (type, state) => {
            state.addSetter(`'string' !== typeof ${state.accessor} ? ${state.accessor}+'' : ${state.accessor}`);
        });

        this.deserializeRegistry.register(ReflectionKind.number, (type, state) => {
            if (type.brand === 0) {
                state.addSetter(`Math.trunc(${state.accessor})`);
            } else {
                state.setContext({ Number });
                state.addSetter(`'number' !== typeof ${state.accessor} ? Number(${state.accessor}) : ${state.accessor}`);
            }
        });
    }
}

export const jsonSerializer = new JSONSerializer;

