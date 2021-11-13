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
import { isNullable, isOptional, ReflectionKind, Type, TypeClass, TypeNumberBrand, TypeObjectLiteral, TypeProperty, TypePropertySignature, TypeTuple } from './reflection/type';
import { ReceiveType, ReflectionClass, ReflectionProperty } from './reflection/reflection';
import { JSONPartial } from './utils';
import { resolvePacked } from './reflection/processor';

export function cast<T>(data: JSONPartial<T>, serializer = jsonSerializer, type?: ReceiveType<T>): T {
    const fn = createSerializeFunction(resolvePacked(type!), serializer.deserializeRegistry);
    return fn(data) as T;
}

export function serialize<T>(data: T, serializer = jsonSerializer, type?: ReceiveType<T>): T {
    const fn = createSerializeFunction(resolvePacked(type!), serializer.serializeRegistry);
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

    constructor(public serializer: Serializer) {
    }

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

export function createConverterJSForTypeForState(
    setter: string,
    accessor: string,
    type: Type,
    state: TemplateState,
) {
    return createConverterJSForType(setter, accessor, type, state.registry, state.compilerContext, state.namingStrategy);
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
    property: ReflectionProperty,
    registry: TemplateRegistry,
    compilerContext: CompilerContext,
    namingStrategy: NamingStrategy,
    undefinedSetterCode: string = '',
    nullSetterCode: string = ''
): string {
    const undefinedCompiler = registry.get(ReflectionKind.undefined);
    const nullCompiler = registry.get(ReflectionKind.null);

    undefinedSetterCode = undefinedSetterCode || (undefinedCompiler ? executeTemplates(compilerContext, registry, namingStrategy, undefinedCompiler, setter, accessor, property.type) : '');
    nullSetterCode = nullSetterCode || (nullCompiler ? executeTemplates(compilerContext, registry, namingStrategy, nullCompiler, setter, accessor, property.type) : '');

    const templates = registry.get(property.type.kind);
    let convert = '';
    if (templates.length) {
        convert = executeTemplates(compilerContext, registry, namingStrategy, templates, setter, accessor, property.type);
    } else {
        convert = `
        //no compiler for ${property.type.kind}
        ${setter} = ${accessor};`;
    }

    let postTransform = '';

    const isSerialization = registry.serializer.serializeRegistry === registry;
    const isDeserialization = registry.serializer.deserializeRegistry === registry;

    if (isSerialization) {
        if (property.serializer) {
            const fnVar = compilerContext.reserveVariable('transformer', property.serializer);
            postTransform = `${setter} = ${fnVar}(${setter}, ${compilerContext.reserveConst(property)})`;
        }
    }

    if (isDeserialization) {
        if (property.deserializer) {
            const fnVar = compilerContext.reserveVariable('transformer', property.deserializer);
            postTransform = `${setter} = ${fnVar}(${setter}, ${compilerContext.reserveConst(property)})`;
        }
    }

    const optional = property.isOptional();
    const nullable = isNullable(property.type);

    // since JSON does not support undefined, we emulate it via using null for serialization, and convert that back to undefined when deserialization happens.
    // note: When the value is not defined (property.name in object === false), then this code will never run.
    let defaultValue = isSerialization ? 'null' : 'undefined';
    // if (property.hasDefault()) {
    //     defaultValue = `${compilerContext.reserveVariable('defaultValueGetter', property.getDefaultValueFunction())}()`;
    // } else
    if (!optional && nullable) {
        defaultValue = 'null';
    }

    return `
        if (${accessor} === undefined) {
            if (${!property.hasDefault() || optional}) ${setter} = ${defaultValue};
            ${undefinedSetterCode}
        } else if (${accessor} === null) {
            //null acts on transport layer as telling an explicitly set undefined
            //this is to support actual undefined as value across a transport layer. Otherwise it
            //would be impossible to set a already set value to undefined back or override default value (since JSON.stringify() omits that information)
            if (${nullable}) {
                ${setter} = null;
                ${nullSetterCode}
            } else {
                if (${optional}) ${setter} = ${defaultValue};
                ${undefinedSetterCode}
            }
        } else {
            ${convert}
            ${postTransform}
        }
    `;
}

function deserializeClass(type: TypeClass, state: TemplateState) {
    const preLines: string[] = [];
    const lines: string[] = [];
    const clazz = ReflectionClass.from(type.classType);

    const constructor = clazz.getConstructor();
    const constructorArguments: string[] = [];
    if (constructor) {
        const parameters = constructor.getParameters();

        for (let i = 0; i < parameters.length; i++) {
            const parameter = parameters[i];
            if (parameter.getVisibility() === undefined) continue;
            const reflection = clazz.getProperty(parameter.getName());
            if (!reflection) continue;

            const name = JSON.stringify(parameter.getName());
            preLines.push(`
                var c_${i};
                if (${name} in ${state.accessor}) {
                    ${createConverterJSForProperty(`c_${i}`, `${state.accessor}[${name}]`, reflection, state.registry, state.compilerContext, state.namingStrategy)}
                }
            `);
            constructorArguments.push(`c_${i}`);
        }
    }

    for (const property of clazz.getProperties()) {
        const name = JSON.stringify(state.namingStrategy.getPropertyName(property.property));

        lines.push(`
            if (${name} in ${state.accessor}) {
                ${createConverterJSForProperty(
            `${state.setter}[${JSON.stringify(property.getName())}]`,
            `${state.accessor}[${name}]`,
            property,
            state.registry, state.compilerContext, state.namingStrategy
        )}
            }
        `);
    }

    for (const member of type.types) {
        if (member.kind === ReflectionKind.indexSignature) {

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
            const name = JSON.stringify(state.namingStrategy.getPropertyName(member));

            lines.push(createConverterJSForTypeForState(
                `${state.setter}[${JSON.stringify(member.name)}]`,
                `${state.accessor}[${name}]`,
                member.type,
                state
            ));
        }
    }

    state.addCodeForSetter(`
        ${state.setter} = {};
        ${lines.join('\n')}
    `);
}

function serializeArray(elementType: Type, state: TemplateState) {
    const a = state.compilerContext.reserveName('a');
    const l = state.compilerContext.reserveName('l');

    const optional = isOptional(elementType);

    //we just use `a.length` to check whether its array-like, because Array.isArray() is way too slow.
    state.addCodeForSetter(`
         let ${l} = ${state.accessor}.size;
         let ${a} = ${state.accessor}.slice();
         while (${l}--) {
            //make sure all elements have the correct type
            if (${state.accessor}[${l}] !== undefined && ${state.accessor}[${l}] !== null) {
                let itemValue;
                ${createConverterJSForTypeForState(`itemValue`, `${a}[${l}]`, elementType, state)}
                if (${!optional} && itemValue === undefined) {
                    ${a}.splice(${l}, 1);
                } else {
                    ${a}[${l}] = itemValue;
                }
            }
         }
         ${state.setter} = ${a};
    `);
}

/**
 * Set is simply serialized as array.
 */
function deserializeTypeClassSet(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 1) return;

    state.setContext({ Array });
    serializeArray(type.arguments[0], state);
    state.addSetter(`new Set(${state.accessor})`);
}

/**
 * Set is simply serialized as array.
 */
function serializeTypeClassSet(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 1) return;

    state.setContext({ Array });
    state.addSetter(`Array.from(${state.accessor})`);

    serializeArray(type.arguments[0], state);
}

function deserializeTypeClassMap(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 2) return;
    state.setContext({ Array });
    serializeArray({
        kind: ReflectionKind.tuple, types: [
            { kind: ReflectionKind.tupleMember, type: type.arguments[0] },
            { kind: ReflectionKind.tupleMember, type: type.arguments[1] },
        ]
    }, state);
    state.addSetter(`new Map(${state.accessor})`);
}

/**
 * Map is simply serialized as array of tuples.
 */
function serializeTypeClassMap(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 2) return;

    state.setContext({ Array });
    state.addSetter(`Array.from(${state.accessor})`);

    serializeArray({
        kind: ReflectionKind.tuple, types: [
            { kind: ReflectionKind.tupleMember, type: type.arguments[0] },
            { kind: ReflectionKind.tupleMember, type: type.arguments[1] },
        ]
    }, state);
}

function deserializeTypeTuple(type: TypeTuple, state: TemplateState) {
    //[string, number], easy
    //[...string, number], easy
    //[number, ...string], easy
    //[number, ...string, number, string], medium
    const lines: string[] = [];
    let restEndOffset = 0;

    for (let i = 0; i < type.types.length; i++) {
        if (type.types[i].type.kind === ReflectionKind.rest) {
            restEndOffset = type.types.length - (i + 1);
            break;
        }
    }

    for (const member of type.types) {
        if (member.type.kind === ReflectionKind.rest) {
            lines.push(`
            for (; i < ${state.accessor}.length - ${restEndOffset}; i++) {
                _ = undefined;
                ${createConverterJSForTypeForState(`_`, `${state.accessor}[i]`, member.type.type, state)}
                if (_ !== undefined) {
                    ${state.setter}.push(_);
                } else if (${member.optional || isOptional(member.type)}) {
                    ${state.setter}.push(undefined);
                }
            }
            `);
        } else {
            lines.push(`
            _ = undefined;
            ${createConverterJSForTypeForState(`_`, `${state.accessor}[i]`, member.type, state)}
            if (_ !== undefined) {
                ${state.setter}.push(_);
            } else if (${member.optional || isOptional(member.type)}) {
                ${state.setter}.push(undefined);
            }
            i++;
            `);
        }
    }

    state.addCodeForSetter(`
        {
            let _;
            let i = 0;
            ${state.setter} = [];
            ${lines.join('\n')}
        }
    `);
}

class Serializer {
    serializeRegistry = new TemplateRegistry(this);
    deserializeRegistry = new TemplateRegistry(this);

    constructor() {
        this.deserializeRegistry.register(ReflectionKind.class, deserializeClass);
        this.deserializeRegistry.register(ReflectionKind.objectLiteral, deserializeObjectLiteral);
        this.serializeRegistry.prependClass(Set, serializeTypeClassSet);
        this.serializeRegistry.prependClass(Map, serializeTypeClassMap);

        this.deserializeRegistry.prependClass(Set, deserializeTypeClassSet);
        this.deserializeRegistry.prependClass(Map, deserializeTypeClassMap);
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

        this.serializeRegistry.register(ReflectionKind.bigint, (type, state) => {
            state.addSetter(`${state.accessor}.toString()`);
        });


        this.deserializeRegistry.prependClass(Date, (type, state) => {
            state.setContext({ Date });
            state.addSetter(`new Date(${state.accessor})`);
        });

        this.deserializeRegistry.register(ReflectionKind.tuple, deserializeTypeTuple);

        this.deserializeRegistry.register(ReflectionKind.string, (type, state) => {
            state.addSetter(`'string' !== typeof ${state.accessor} ? ${state.accessor}+'' : ${state.accessor}`);
        });

        this.deserializeRegistry.register(ReflectionKind.boolean, (type, state) => {
            state.addSetter(`'boolean' !== typeof ${state.accessor} ? ${state.accessor} == 1 : ${state.accessor}`);
        });

        this.deserializeRegistry.register(ReflectionKind.bigint, (type, state) => {
            state.setContext({ BigInt });
            state.addSetter(`'bigint' !== typeof ${state.accessor} ? BigInt(${state.accessor}) : ${state.accessor}`);
        });

        this.deserializeRegistry.register(ReflectionKind.enum, (type, state) => {
            throw new Error('Enum not implemented');
        });

        this.deserializeRegistry.register(ReflectionKind.number, (type, state) => {
            if (type.brand !== undefined && type.brand < TypeNumberBrand.float) {
                state.addSetter(`Math.trunc(${state.accessor})`);
                if (type.brand === TypeNumberBrand.uint8) {
                    state.addSetter(`${state.accessor} > 255 ? 255 : ${state.accessor} < 0 ? 0 : ${state.accessor}`);
                } else if (type.brand === TypeNumberBrand.uint16) {
                    state.addSetter(`${state.accessor} > 65535 ? 65535 : ${state.accessor} < 0 ? 0 : ${state.accessor}`);
                } else if (type.brand === TypeNumberBrand.uint32) {
                    state.addSetter(`${state.accessor} > 4294967295 ? 4294967295 : ${state.accessor} < 0 ? 0 : ${state.accessor}`);
                } else if (type.brand === TypeNumberBrand.int8) {
                    state.addSetter(`${state.accessor} > 128 ? 128 : ${state.accessor} < -127 ? -127 : ${state.accessor}`);
                } else if (type.brand === TypeNumberBrand.int16) {
                    state.addSetter(`${state.accessor} > 32767 ? 32767 : ${state.accessor} < -32768 ? -32768 : ${state.accessor}`);
                } else if (type.brand === TypeNumberBrand.int32) {
                    state.addSetter(`${state.accessor} > 2147483647 ? 2147483647 : ${state.accessor} < -2147483648 ? -2147483648 : ${state.accessor}`);
                }
            } else {
                state.setContext({ Number });
                state.addSetter(`'number' !== typeof ${state.accessor} ? Number(${state.accessor}) : ${state.accessor}`);
                if (type.brand === TypeNumberBrand.uint8) {
                    state.addSetter(`${state.accessor} > 3.40282347e+38 ? 3.40282347e+38 : ${state.accessor} < -3.40282347e+38 ? -3.40282347e+38 : ${state.accessor}`);
                }
            }
        });
    }
}

export const jsonSerializer = new JSONSerializer;

