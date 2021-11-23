/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, CompilerContext, isArray, isFunction, isInteger, isNumeric } from '@deepkit/core';
import {
    FindType,
    isNullable,
    isOptional,
    ReflectionKind,
    Type,
    TypeClass,
    TypeIndexSignature,
    TypeNumberBrand,
    TypeObjectLiteral,
    TypeProperty,
    TypePropertySignature,
    TypeTuple, TypeUnion
} from './reflection/type';
import { ReflectionClass, ReflectionProperty, typeOf } from './reflection/reflection';
import { isExtendable } from './reflection/extends';
import { resolveRuntimeType } from './reflection/processor';


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

export function createTypeGuardFunction(type: Type, registry: TemplateRegistry, namingStrategy: NamingStrategy = new NamingStrategy()): (data: any) => any {
    const compiler = new CompilerContext();

    const templates = registry.get(type.kind);
    if (!templates.length) return (data: any) => data;

    const state = new TemplateState('result', 'data', compiler, registry, namingStrategy);

    for (const template of templates) {
        template(type, state);
        if (state.ended) break;
    }

    const code = `
        var result;
        ${state.template}
        return result === true;
    `;
    return compiler.build(code, 'data');
}


export class TemplateState {
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
     * Adds template code for setting the `this.setter` variable manually, so use `${state.setter} = value`.
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

export type Template<T extends Type> = (type: T, state: TemplateState) => void;

export class TemplateRegistry {
    protected templates: { [kind in ReflectionKind]?: Template<any>[] } = {};

    constructor(public serializer: Serializer, public parent?: TemplateRegistry) {
    }

    get(kind: ReflectionKind): Template<Type>[] {
        if (this.parent && !this.templates[kind]) {
            return [...this.parent.get(kind), ...this.templates[kind] ||= []];
        }

        return this.templates[kind] ||= [];
    }

    /**
     * Removes all registered templates.
     */
    unregister(kind: ReflectionKind) {
        this.templates[kind] = undefined;
    }

    /**
     * Registers a new template and replaces all existing (added via register,prepend,append).
     */
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

export function getTemplateJSForTypeForState(
    setter: string,
    accessor: string,
    type: Type,
    state: TemplateState,
) {
    return getTemplateJSForType(setter, accessor, type, state.registry, state.compilerContext, state.namingStrategy);
}

export function getTemplateJSForType(
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

export function deserializeClass(type: TypeClass, state: TemplateState) {
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
        const name = getNameExpression(state.namingStrategy.getPropertyName(property.property), state);

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

export function deserializeObjectLiteral(type: TypeObjectLiteral, state: TemplateState) {
    const lines: string[] = [];

    for (const member of type.types) {
        if (member.kind === ReflectionKind.indexSignature) {
        }

        if (member.kind === ReflectionKind.propertySignature) {
            const name = getNameExpression(state.namingStrategy.getPropertyName(member), state);

            lines.push(getTemplateJSForTypeForState(
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

export function serializeArray(elementType: Type, state: TemplateState) {
    const a = state.compilerContext.reserveName('a');
    const l = state.compilerContext.reserveName('l');

    const optional = isOptional(elementType);

    //we just use `a.length` to check whether its array-like, because Array.isArray() is way too slow.
    state.addCodeForSetter(`
         let ${l} = ${state.accessor}.length;
         let ${a} = ${state.accessor}.slice();
         while (${l}--) {
            //make sure all elements have the correct type
            if (${state.accessor}[${l}] !== undefined && ${state.accessor}[${l}] !== null) {
                let itemValue;
                ${getTemplateJSForTypeForState(`itemValue`, `${a}[${l}]`, elementType, state)}
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

export function typeCheckArray(elementType: Type, state: TemplateState) {
    const v = state.compilerContext.reserveName('v');
    const l = state.compilerContext.reserveName('l');
    state.setContext({ isArray: isArray });

    //we just use `a.length` to check whether its array-like, because Array.isArray() is way too slow.
    state.addCodeForSetter(`
         let ${v} = false;
         if (isArray(${state.accessor})) {
             let ${l} = ${state.accessor}.length;
             while (${l}--) {
                ${getTemplateJSForTypeForState(v, `${state.accessor}[${l}]`, elementType, state)}
                if (!${v}) break;
             }
         }
         ${state.setter} = ${v};
    `);
}

function deserializeTypeTuple(type: TypeTuple, state: TemplateState) {
    //[string, number], easy
    //[...string, number], easy
    //[number, ...string], easy
    //[number, ...string, number, string], medium
    const lines: string[] = [];
    let restEndOffset = 0;
    const _ = state.compilerContext.reserveName('_');
    const i = state.compilerContext.reserveName('i');

    for (let i = 0; i < type.types.length; i++) {
        if (type.types[i].type.kind === ReflectionKind.rest) {
            restEndOffset = type.types.length - (i + 1);
            break;
        }
    }

    for (const member of type.types) {
        if (member.type.kind === ReflectionKind.rest) {
            lines.push(`
            for (; ${i} < ${state.accessor}.length - ${restEndOffset}; ${i}++) {
                ${_} = undefined;
                ${getTemplateJSForTypeForState(_, `${state.accessor}[${i}]`, member.type.type, state)}
                if (${_} !== undefined) {
                    ${state.setter}.push(${_});
                } else if (${member.optional || isOptional(member.type)}) {
                    ${state.setter}.push(undefined);
                }
            }
            `);
        } else {
            lines.push(`
            ${_} = undefined;
            ${getTemplateJSForTypeForState(_, `${state.accessor}[${i}]`, member.type, state)}
            if (${_} !== undefined) {
                ${state.setter}.push(${_});
            } else if (${member.optional || isOptional(member.type)}) {
                ${state.setter}.push(undefined);
            }
            ${i}++;
            `);
        }
    }

    state.addCodeForSetter(`
        let ${_};
        let ${i} = 0;
        ${state.setter} = [];
        ${lines.join('\n')}
    `);
}

function typeGuardTypeTuple(type: TypeTuple, state: TemplateState) {
    //[string, number], easy
    //[...string, number], easy
    //[number, ...string], easy
    //[number, ...string, number, string], medium
    const lines: string[] = [];
    let restEndOffset = 0;
    const v = state.compilerContext.reserveName('v');
    const i = state.compilerContext.reserveName('i');

    for (let i = 0; i < type.types.length; i++) {
        if (type.types[i].type.kind === ReflectionKind.rest) {
            restEndOffset = type.types.length - (i + 1);
            break;
        }
    }

    for (const member of type.types) {
        if (member.type.kind === ReflectionKind.rest) {
            lines.push(`
            for (; ${v} && ${i} < ${state.accessor}.length - ${restEndOffset}; ${i}++) {
                ${getTemplateJSForTypeForState(v, `${state.accessor}[${i}]`, member.type.type, state)}
                if (!${v}) {
                    break;
                }
            }
            `);
        } else {
            lines.push(`
            if (${v}) {
                ${getTemplateJSForTypeForState(v, `${state.accessor}[${i}]`, member.type, state)}
                ${i}++;
            }
            `);
        }
    }

    state.setContext({ isArray: isArray });
    state.addCodeForSetter(`
        let ${v} = isArray(${state.accessor});
        let ${i} = 0;
        ${lines.join('\n')}
        ${state.setter} = ${v};
    `);
}

function typeGuardTypeClassMap(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 2) return;

    state.setContext({ Array });
    state.addSetter(`Array.from(${state.accessor})`);

    typeCheckArray({
        kind: ReflectionKind.tuple, types: [
            { kind: ReflectionKind.tupleMember, type: type.arguments[0] },
            { kind: ReflectionKind.tupleMember, type: type.arguments[1] },
        ]
    }, state);
}

function typeGuardTypeClassSet(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 1) return;

    state.setContext({ Array });
    state.addSetter(`Array.from(${state.accessor})`);

    typeCheckArray(type.arguments[0], state);
}

function getNameExpression(name: string | number | symbol | undefined, state: TemplateState): string {
    if (undefined === name) return 'undefined';
    if ('string' === typeof name || 'number' === typeof name) return JSON.stringify(name);
    return state.compilerContext.reserveConst(name);
}

export function typeCheckClassOrObjectLiteral(type: TypeObjectLiteral | TypeClass, state: TemplateState) {
    const v = state.compilerContext.reserveName('v');
    const lines: string[] = [];

    const signatures: TypeIndexSignature[] = [];
    const existing: string[] = [];


    for (const member of type.types) {
        if (member.kind === ReflectionKind.indexSignature) {
            signatures.push(member);
        } else if (member.kind === ReflectionKind.propertySignature || member.kind === ReflectionKind.property || member.kind === ReflectionKind.methodSignature || member.kind === ReflectionKind.method) {
            if (member.kind === ReflectionKind.property || member.kind === ReflectionKind.method) {
                if (member.abstract) continue;
            }

            const name = member.kind === ReflectionKind.methodSignature || member.kind === ReflectionKind.method
                ? getNameExpression(member.name, state)
                : getNameExpression(state.namingStrategy.getPropertyName(member), state);

            const optionalCheck = member.optional ? `&& ${state.accessor}[${name}] !== undefined` : '';
            existing.push(name);

            lines.push(`
            if (${v} ${optionalCheck}) {
                ${getTemplateJSForTypeForState(
                v,
                `${state.accessor}[${name}]`,
                member.kind === ReflectionKind.methodSignature || member.kind === ReflectionKind.method
                    ? { kind: ReflectionKind.function, name: member.name, return: member.return, parameters: member.parameters }
                    : member.type,
                state
            )}
            }`);
        }
    }

    if (signatures.length) {
        const existingCheck = existing.map(v => `i === ${v}`).join(' || ') || 'false';
        const signatureLines: string[] = [];

        function isLiteralType(t: TypeIndexSignature): boolean {
            return t.index.kind === ReflectionKind.literal || (t.index.kind === ReflectionKind.union && t.index.types.some(v => v.kind === ReflectionKind.literal));
        }

        function isNumberType(t: TypeIndexSignature): boolean {
            return t.index.kind === ReflectionKind.number || (t.index.kind === ReflectionKind.union && t.index.types.some(v => v.kind === ReflectionKind.number));
        }

        //sort, so the order is literal, number, string, symbol.  literal comes first as its the most specific type.
        //we need to do that for numbers since all keys are string|symbol in runtime, and we need to check if a string is numeric first before falling back to string.
        signatures.sort((a, b) => {
            if (isLiteralType(a)) return -1;
            if (isNumberType(a) && !isLiteralType(b)) return -1;
            return +1;
        });

        function getIndexCheck(type: Type): string {
            if (type.kind === ReflectionKind.number) {
                state.setContext({ isNumeric: isNumeric });
                return 'isNumeric(i)';
            } else if (type.kind === ReflectionKind.string) {
                return `'string' === typeof i`;
            } else if (type.kind === ReflectionKind.symbol) {
                return `'string' === typeof i`;
            } else if (type.kind === ReflectionKind.union) {
                return '(' + type.types.map(getIndexCheck).join(' || ') + ')';
            }
            return '';
        }

        for (const signature of signatures) {
            signatureLines.push(`else if (${getIndexCheck(signature.index)}) {
                ${getTemplateJSForTypeForState(
                v,
                `${state.accessor}[i]`,
                signature.type,
                state
            )}
            }`);
        }

        //the index signature type could be: string, number, symbol.
        //or a literal when it was constructed by a mapped type.
        lines.push(`
        if (${v}) for (const i in ${state.accessor}) {
            if (!${state.accessor}.hasOwnProperty(i)) continue;
            if (${existingCheck}) continue;
            if (!${v}) {
                break;
            } ${signatureLines.join(' ')}
            else {
                ${v} = false;
                break;
            }
        }

        `);
    }

    state.addCodeForSetter(`
        let ${v} = true;
        ${lines.join('\n')}
        ${state.setter} = ${v};
    `);
}

export function serializeTypeUnion(type: TypeUnion, state: TemplateState) {
    const lines: string[] = [];

    for (const t of type.types) {
        const fn = createTypeGuardFunction(t, state.registry.serializer.typeGuards);
        const guard = state.setVariable('guard' + t.kind, fn);

        lines.push(`else if (${guard}(${state.accessor})) {
            ${getTemplateJSForTypeForState(
            state.setter,
            state.accessor,
            t,
            state
        )}
        }`);
    }

    state.addCodeForSetter(`
        if (false) {} ${lines.join(' ')}
    `);
}

/**
 * Default serializer that can convert JS data structures to the target type.
 * It coerces types, converts object literals to class instances, and has type guards for JS types.
 *
 * JSONSerializer has the same but for JSON data structures.
 */
export class Serializer {
    serializeRegistry = new TemplateRegistry(this);
    deserializeRegistry = new TemplateRegistry(this);
    typeGuards = new TemplateRegistry(this);

    /**
     * Overwrites type guards specifically for casts (serialization/deserialization), making the checks
     * more loose to allow detecting correct types in unions for types that can be converted (e.g. the string serializer can be picked for a number).
     */
    castTypeGuards = new TemplateRegistry(this, this.typeGuards);

    constructor() {
        this.deserializeRegistry.register(ReflectionKind.class, deserializeClass);
        this.deserializeRegistry.register(ReflectionKind.objectLiteral, deserializeObjectLiteral);
        this.deserializeRegistry.register(ReflectionKind.tuple, deserializeTypeTuple);
        this.deserializeRegistry.register(ReflectionKind.union, serializeTypeUnion);
        this.serializeRegistry.register(ReflectionKind.union, serializeTypeUnion);

        this.serializeRegistry.register(ReflectionKind.bigint, (type, state) => {
            state.addSetter(`${state.accessor}.toString()`);
        });

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

        this.typeGuards.register(ReflectionKind.string, (type, state) => state.addSetter(`'string' === typeof ${state.accessor}`));
        this.typeGuards.register(ReflectionKind.number, (type, state) => {
            if (type.brand !== undefined && type.brand >= TypeNumberBrand.integer && type.brand <= TypeNumberBrand.uint32) {
                state.setContext({ isInteger: isInteger });
                let check = `'number' === typeof ${state.accessor} && isInteger(${state.accessor})`;

                if (type.brand === TypeNumberBrand.uint8) {
                    check += `&& ${state.accessor} <= 255 && ${state.accessor} >= 0`;
                } else if (type.brand === TypeNumberBrand.uint16) {
                    check += `&& ${state.accessor} <= 65535 && ${state.accessor} >= 0`;
                } else if (type.brand === TypeNumberBrand.uint32) {
                    check += `&& ${state.accessor} <= 4294967295 && ${state.accessor} >= 0`;
                } else if (type.brand === TypeNumberBrand.int8) {
                    check += `&& ${state.accessor} <= 128 && ${state.accessor} >= -127`;
                } else if (type.brand === TypeNumberBrand.int16) {
                    check += `&& ${state.accessor} <= 32767 && ${state.accessor} >= -32768`;
                } else if (type.brand === TypeNumberBrand.int32) {
                    check += `&& ${state.accessor} <= 2147483647 && ${state.accessor} >= -2147483648`;
                }
                state.addSetter(check);
            } else {
                state.addSetter(`'number' === typeof ${state.accessor}`);
            }
        });
        this.typeGuards.register(ReflectionKind.bigint, (type, state) => state.addSetter(`'bigint' === typeof ${state.accessor}`));
        this.typeGuards.register(ReflectionKind.boolean, (type, state) => state.addSetter(`'boolean' === typeof ${state.accessor}`));
        this.typeGuards.register(ReflectionKind.promise, (type, state) => state.addSetter(`${state.accessor} instanceof Promise`));
        this.typeGuards.register(ReflectionKind.enum, (type, state) => {
            const values = state.setVariable('values', type.values);
            state.addSetter(`${values}.indexOf(${state.accessor}) >= 0`);
        });
        this.typeGuards.register(ReflectionKind.array, (type, state) => typeCheckArray(type.type, state));
        this.typeGuards.prependClass(Set, typeGuardTypeClassSet);
        this.typeGuards.prependClass(Map, typeGuardTypeClassMap);
        this.typeGuards.register(ReflectionKind.tuple, typeGuardTypeTuple);
        this.typeGuards.prependClass(Date, (type, state) => state.addSetter(`${state.accessor} instanceof Date`));

        this.typeGuards.register(ReflectionKind.literal, (type, state) => {
            const v = state.setVariable('v', type.literal);
            state.addSetter(`${v} === ${state.accessor}`);
        });
        this.typeGuards.register(ReflectionKind.objectLiteral, typeCheckClassOrObjectLiteral);
        this.typeGuards.append(ReflectionKind.class, typeCheckClassOrObjectLiteral);
        this.typeGuards.register(ReflectionKind.function, ((type, state) => {
            state.setContext({ isFunction: isFunction, isExtendable: isExtendable, resolveRuntimeType: resolveRuntimeType });
            const t = state.setVariable('type', type);
            state.addCodeForSetter(`
                if (isFunction(${state.accessor})) {
                    //check if the value has a __type, and check against that
                    if ('__type' in ${state.accessor}) {
                        ${state.setter} = isExtendable(resolveRuntimeType(${state.accessor}), ${t});
                    } else {
                        ${state.setter} = false;
                    }
                } else {
                    ${state.setter} = false;
                }
            `);
        }));

        this.typeGuards.register(ReflectionKind.union, (type, state) => {
            const lines: string[] = [];
            const v = state.compilerContext.reserveName('v');

            for (const t of type.types) {
                const fn = createTypeGuardFunction(t, state.registry, state.namingStrategy);
                const guard = state.setVariable('guard' + t.kind, fn);

                lines.push(`else if (${guard}(${state.accessor})) {
                    ${getTemplateJSForTypeForState(
                    v,
                    state.accessor,
                    t,
                    state
                )}
                }`);
            }

            state.addCodeForSetter(`
                let ${v} = false;
                if (false) {} ${lines.join(' ')}
                ${state.setter} = ${v};
            `);
        });

    }
}

export const serializer: Serializer = new Serializer();
