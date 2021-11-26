/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, CompilerContext, CustomError, getClassName, isArray, isFunction, isInteger, isNumeric } from '@deepkit/core';
import {
    FindType,
    isNullable,
    isOptional,
    ReflectionKind,
    stringifyType,
    Type,
    TypeClass,
    TypeIndexSignature,
    TypeIntersection,
    TypeNumberBrand,
    TypeObjectLiteral,
    TypeProperty,
    TypePropertySignature,
    TypeTuple,
    TypeUnion
} from './reflection/type';
import { ReflectionClass, ReflectionProperty, resolveIntersection } from './reflection/reflection';
import { isExtendable } from './reflection/extends';
import { resolveRuntimeType } from './reflection/processor';


export class NamingStrategy {
    getPropertyName(type: TypeProperty | TypePropertySignature): string | number | symbol | undefined {
        return type.name;
    }
}

export interface SerializationOptions {
    groups?: string[];
    excludeGroups?: string[];
    loosely?: boolean;
}

export function createSerializeFunction(type: Type, registry: TemplateRegistry, namingStrategy: NamingStrategy = new NamingStrategy(), path: string = ''): (data: any, options?: SerializationOptions) => any {
    const compiler = new CompilerContext();

    const templates = registry.get(type.kind);
    if (!templates.length) return (data: any) => data;

    const state = new TemplateState('result', 'data', compiler, registry, namingStrategy, [path]);

    for (const template of templates) {
        template(type, state);
        if (state.ended) break;
    }

    const code = `
        var result;
        options = options ? options : {};
        ${state.template}
        return result;
    `;
    return compiler.build(code, 'data', 'options');
}

export type Guard = (data: any) => boolean;

export function createTypeGuardFunction(type: Type, registry: TemplateRegistry, namingStrategy: NamingStrategy = new NamingStrategy(), specificality?: number, path: string = ''): undefined | Guard {
    const compiler = new CompilerContext();

    const templates = registry.get(type.kind);
    if (!templates.length) return undefined;

    const state = new TemplateState('result', 'data', compiler, registry, namingStrategy, [path]);
    state.specificality = specificality;

    for (const template of templates) {
        template(type, state);
        if (state.ended) break;
    }

    const code = `
        var result;
        options = options ? options : {};
        ${state.template}
        return result === true;
    `;
    return compiler.build(code, 'data', 'options');
}

export class SerializationError extends CustomError {
    constructor(message: string, public path: string) {
        super(`${path ? path + ': ' : ''}` + message);
    }
}

class DynamicPath {
    constructor(public code: string) {
    }
}

export class TemplateState {
    public template = '';

    public ended = false;
    public setter = '';
    public accessor = '';

    public specificality?: number;

    constructor(
        public originalSetter: string,
        public originalAccessor: string,
        public readonly compilerContext: CompilerContext,
        public readonly registry: TemplateRegistry,
        public readonly namingStrategy: NamingStrategy,
        public readonly path: (string | DynamicPath)[]
    ) {
        this.setter = originalSetter;
        this.accessor = originalAccessor;
    }

    extendPath(path: string | DynamicPath): (string | DynamicPath)[] {
        const copy = this.path.slice();
        copy.push(path);
        return copy;
    }

    throwCode(type: string) {
        this.setContext({ SerializationError });
        const pathCode = this.path.filter(v => !!v).map(v => v instanceof DynamicPath ? v.code : JSON.stringify(v)).join(`+'.'+`);
        return `throw new SerializationError('Cannot convert ' + ${this.originalAccessor} + ' to ' + ${JSON.stringify(type)}, ${pathCode || ''});`;
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

    constructor(public serializer: Serializer) {
    }

    get(kind: ReflectionKind): Template<Type>[] {
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
    type: Type,
    path: (string | DynamicPath)[]
): string {
    const state = new TemplateState(setter, getter, compilerContext, registry, namingStrategy, path);
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
    path: (string | DynamicPath)[]
) {
    return getTemplateJSForType(setter, accessor, type, state.registry, state.compilerContext, state.namingStrategy, path);
}

export function getTemplateJSForType(
    setter: string,
    accessor: string,
    type: Type,
    registry: TemplateRegistry,
    compilerContext: CompilerContext,
    namingStrategy: NamingStrategy,
    path: (string | DynamicPath)[]
): string {
    const templates = registry.get(type.kind);
    let convert = '';
    if (templates.length) {
        convert = executeTemplates(compilerContext, registry, namingStrategy, templates, setter, accessor, type, path);
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
    property: ReflectionProperty | TypePropertySignature,
    registry: TemplateRegistry,
    compilerContext: CompilerContext,
    namingStrategy: NamingStrategy,
    undefinedSetterCode: string = '',
    nullSetterCode: string = '',
    path: (string | DynamicPath)[]
): string {
    const undefinedCompiler = registry.get(ReflectionKind.undefined);
    const nullCompiler = registry.get(ReflectionKind.null);
    const type = property instanceof ReflectionProperty ? property.type : property;

    undefinedSetterCode = undefinedSetterCode || (undefinedCompiler ? executeTemplates(compilerContext, registry, namingStrategy, undefinedCompiler, setter, accessor, type, path) : '');
    nullSetterCode = nullSetterCode || (nullCompiler ? executeTemplates(compilerContext, registry, namingStrategy, nullCompiler, setter, accessor, type, path) : '');

    const templates = registry.get(type.kind);
    let convert = '';
    if (templates.length) {
        convert = executeTemplates(compilerContext, registry, namingStrategy, templates, setter, accessor, type, path);
    } else {
        convert = `
        //no compiler for ${type.kind}
        ${setter} = ${accessor};`;
    }

    let postTransform = '';

    const isSerialization = registry.serializer.serializeRegistry === registry;
    const isDeserialization = registry.serializer.deserializeRegistry === registry;

    if (property instanceof ReflectionProperty) {
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
    }

    const optional = isOptional(property instanceof ReflectionProperty ? property.property : type);
    const nullable = isNullable(type);
    const hasDefault = property instanceof ReflectionProperty ? property.hasDefault() : false;

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
            if (${!hasDefault || optional}) ${setter} = ${defaultValue};
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
                    ${createConverterJSForProperty(`c_${i}`, `${state.accessor}[${name}]`, reflection, state.registry, state.compilerContext, state.namingStrategy, undefined, undefined, state.extendPath(parameter.getName()))}
                }
            `);
            constructorArguments.push(`c_${i}`);
        }
    }

    for (const property of clazz.getProperties()) {
        const name = getNameExpression(state.namingStrategy.getPropertyName(property.property), state);

        if (property.excludeSerializerNames && (property.excludeSerializerNames.includes('*') || property.excludeSerializerNames.includes(state.registry.serializer.name))) {
            continue;
        }

        lines.push(`
            if (${name} in ${state.accessor}) {
                ${createConverterJSForProperty(
            `${state.setter}[${JSON.stringify(property.getName())}]`,
            `${state.accessor}[${name}]`,
            property,
            state.registry, state.compilerContext, state.namingStrategy,
            undefined, undefined, state.extendPath(String(property.getName()))
        )}
            }
        `);
    }

    for (const member of type.types) {
        if (member.kind === ReflectionKind.indexSignature) {
            //todo, class index signatures
        }
    }

    const classType = state.compilerContext.reserveConst(type.classType);

    state.addCodeForSetter(`
        if ('object' !== typeof ${state.accessor}) ${state.throwCode(`class ${getClassName(type.classType)}`)}

        ${preLines.join('\n')}
        ${state.setter} = new ${classType}(${constructorArguments.join(', ')});
        ${lines.join('\n')}
    `);
}

export function serializeObjectLiteral(type: TypeObjectLiteral | TypeClass, state: TemplateState) {
    const v = state.compilerContext.reserveName('v');
    const lines: string[] = [];

    const signatures: TypeIndexSignature[] = [];
    const existing: string[] = [];

    for (const member of type.types) {
        if (member.kind === ReflectionKind.indexSignature) {
            signatures.push(member);
        } else if (member.kind === ReflectionKind.propertySignature) {
            const name = getNameExpression(state.namingStrategy.getPropertyName(member), state);
            lines.push(`
            if (${name} in ${state.accessor}) {
                ${createConverterJSForProperty(
                `${v}[${JSON.stringify(member.name)}]`,
                `${state.accessor}[${name}]`,
                member,
                state.registry, state.compilerContext, state.namingStrategy,
                undefined, undefined, state.extendPath(String(member.name))
            )}
            }
            `);
        }
    }

    const clazz = type.kind === ReflectionKind.class ? ReflectionClass.from(type.classType) : undefined;
    if (clazz) for (const property of clazz.getProperties()) {
        const name = getNameExpression(state.namingStrategy.getPropertyName(property.property), state);

        if (property.excludeSerializerNames && (property.excludeSerializerNames.includes('*') || property.excludeSerializerNames.includes(state.registry.serializer.name))) {
            continue;
        }

        lines.push(`
            if (${name} in ${state.accessor}) {
                ${createConverterJSForProperty(
            `${v}[${JSON.stringify(property.getName())}]`,
            `${state.accessor}[${name}]`,
            property,
            state.registry, state.compilerContext, state.namingStrategy,
            undefined, undefined, state.extendPath(String(property.getName()))
        )}
            }
        `);
    }

    if (signatures.length) {
        const i = state.compilerContext.reserveName('i');
        const existingCheck = existing.map(v => `${i} === ${v}`).join(' || ') || 'false';
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
                return `isNumeric(${i})`;
            } else if (type.kind === ReflectionKind.string) {
                return `'string' === typeof ${i}`;
            } else if (type.kind === ReflectionKind.symbol) {
                return `'symbol' === typeof ${i}`;
            } else if (type.kind === ReflectionKind.union) {
                return '(' + type.types.map(getIndexCheck).join(' || ') + ')';
            }
            return '';
        }

        for (const signature of signatures) {
            signatureLines.push(`else if (${getIndexCheck(signature.index)}) {
                ${getTemplateJSForTypeForState(
                `${v}[${i}]`,
                `${state.accessor}[${i}]`,
                signature.type,
                state,
                state.extendPath(new DynamicPath(i))
            )}
            }`);
        }

        //the index signature type could be: string, number, symbol.
        //or a literal when it was constructed by a mapped type.
        lines.push(`
        for (const ${i} in ${state.accessor}) {
            if (!${state.accessor}.hasOwnProperty(${i})) continue;
            if (${existingCheck}) continue;
            if (false) {} ${signatureLines.join(' ')}
        }

        `);
    }

    state.addCodeForSetter(`
        if ('object' !== typeof ${state.accessor}) ${state.throwCode(stringifyType(type))}
        let ${v} = {};
        ${lines.join('\n')}
        ${state.setter} = ${v};
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
                ${getTemplateJSForTypeForState(`itemValue`, `${a}[${l}]`, elementType, state, state.extendPath(new DynamicPath(l)))}
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
                ${getTemplateJSForTypeForState(v, `${state.accessor}[${l}]`, elementType, state, state.extendPath(new DynamicPath(l)))}
                if (!${v}) break;
             }
         }
         ${state.setter} = ${v};
    `);
}

function serializeTypeTuple(type: TypeTuple, state: TemplateState) {
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
                ${getTemplateJSForTypeForState(_, `${state.accessor}[${i}]`, member.type.type, state, state.extendPath(new DynamicPath(i)))}
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
            ${getTemplateJSForTypeForState(_, `${state.accessor}[${i}]`, member.type, state, state.extendPath(new DynamicPath(i)))}
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
                ${getTemplateJSForTypeForState(v, `${state.accessor}[${i}]`, member.type.type, state, state.extendPath(new DynamicPath(i)))}
                if (!${v}) {
                    break;
                }
            }
            `);
        } else {
            lines.push(`
            if (${v}) {
                ${getTemplateJSForTypeForState(v, `${state.accessor}[${i}]`, member.type, state, state.extendPath(new DynamicPath(i)))}
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
                state,
                state.extendPath(String(member.name))
            )}
            }`);
        }
    }

    if (signatures.length) {
        const i = state.compilerContext.reserveName('i');
        const existingCheck = existing.map(v => `${i} === ${v}`).join(' || ') || 'false';
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
                return `isNumeric(${i})`;
            } else if (type.kind === ReflectionKind.string) {
                return `'string' === typeof ${i}`;
            } else if (type.kind === ReflectionKind.symbol) {
                return `'symbol' === typeof ${i}`;
            } else if (type.kind === ReflectionKind.union) {
                return '(' + type.types.map(getIndexCheck).join(' || ') + ')';
            }
            return '';
        }

        for (const signature of signatures) {
            signatureLines.push(`else if (${getIndexCheck(signature.index)}) {
                ${getTemplateJSForTypeForState(
                v,
                `${state.accessor}[${i}]`,
                signature.type,
                state,
                state.extendPath(new DynamicPath(i))
            )}
            }`);
        }

        //the index signature type could be: string, number, symbol.
        //or a literal when it was constructed by a mapped type.
        lines.push(`
        if (${v}) for (const ${i} in ${state.accessor}) {
            if (!${state.accessor}.hasOwnProperty(${i})) continue;
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
        if (${state.accessor} && 'object' === typeof ${state.accessor}) {
            ${lines.join('\n')}
            ${state.setter} = ${v};
        } else {
            ${state.setter} = false;
        }
    `);
}

export function serializeTypeIntersection(type: TypeIntersection, state: TemplateState) {
    const { resolved, decorations } = resolveIntersection(type);
    if (resolved.kind === ReflectionKind.never) return;

    return getTemplateJSForTypeForState(state.setter, state.accessor, resolved, state, state.path);
}

export function serializeTypeUnion(type: TypeUnion, state: TemplateState) {
    const lines: string[] = [];

    //detecting which serializer to use in union is a complex topic and allows a key feature: deserializing an encoding that is entirely based on strings (e.g. URL query string)
    //to support for example numeric string, we need to have multiple guards being able to detect their 'loosely type' equivalence, for example
    // - '1234' => number
    // - 1234 => string
    // - 1234 => Date
    // whether one is picked over that strict equivalence (123 => number, '123' => string) depends on the union and whether 'loosely' is active.
    //The order of the union members is not important, only the order in which the guards are registered.

    //examples with loosely active:
    //  number | string
    // -> '1234' => number
    // -> 1234 => number
    // -> 1234abc => string

    //examples with loosely active:
    //  number | boolean
    // -> '1234' => number
    // -> 1234 => number
    // -> 1 => boolean
    // => 'true' => boolean

    //examples with loosely active:
    //  number | Date
    // -> '1234' => number
    // -> 1234 => number
    // -> '2021-11-24T16:21:13.425Z' => Date

    //This feature requires that each serializer can have multiple guards registered in different specificality. We use a convention that
    //the specificality of 1 is the default JS guard (typeof), and anything greater than 2 is a fallback, like number => Date (which should only be used when no other guard tested positively for number).
    //Withing specificality of 1 there are other nuances that further describe the specificality. For example `literal` is more specific than a `string`, so
    //that the literal will always picked first in a type of `'a' | string`. e.g. literal=1.1, string 1.5; other examples
    // Date < string,

    //anything below 0 is a loose guard, for example a numeric string, or numbers as boolean. guards below 0 are only used when enabled manually.
    //guards between 0 and 1 are standard loose types that are necessary to support JSON, e.g. '2021-11-24T16:21:13.425Z' => Date.
    const typeGuards = state.registry.serializer.typeGuards.getSortedTemplateRegistries();

    for (const [specificality, typeGuard] of typeGuards) {
        for (const t of type.types) {
            const fn = createTypeGuardFunction(t, typeGuard);
            if (!fn) continue;
            const guard = state.setVariable('guard' + t.kind, fn);
            const looseCheck = specificality <= 0 ? `options.loosely && ` : '';

            lines.push(`else if (${looseCheck}${guard}(${state.accessor})) { //type = ${ReflectionKind[t.kind]}, specificality=${specificality}
                ${getTemplateJSForTypeForState(state.setter, state.accessor, t, state, state.path)}
            }`);
        }
    }

    state.addCodeForSetter(`
        if (false) {} ${lines.join(' ')}
    `);
}

export class TypeGuardRegistry {
    registry: { [specificality: number]: TemplateRegistry } = {};

    protected sorted?: [specificality: number, registry: TemplateRegistry][];

    getSortedTemplateRegistries() {
        if (!this.sorted) {
            this.sorted = [];
            const registries = Object.entries(this.registry);
            registries.sort((a, b) => {
                return Number(a[0]) - Number(b[0]);
            });
            for (const [spec, reg] of registries) {
                this.sorted.push([Number(spec), reg]);
            }
        }
        return this.sorted;
    }

    constructor(public serializer: Serializer) {
    }

    /**
     *
     * @see register() for specificality explanation.
     */
    getRegistry(specificality: number): TemplateRegistry {
        this.sorted = undefined;
        return this.registry[specificality] ||= new TemplateRegistry(this.serializer);
    }

    /**
     * Registers a new template and replaces all existing (added via register,prepend,append).
     *
     * Specificality defines when the given template guard is executed.
     *
     * - 1 means its used for JS types - exact types. For example for type string `'string' ==== typeof v` is used. Same for number, bigint, and boolean.
     *   Guards of this specificality are used for the `is()` function.
     *
     * - >1 means it acts as a fallback. For example in a union `number | Date`, when a string is given, the Date can allow `string` type as well, so it gets converted to a Date.
     *
     * - >0 && <1 means its acts as a priority guard. For example in a `string | Date`, a string of date-format is converted to a Date instead of a string. This is necessary
     *   to support regular JSON.
     *
     * - <0, anything below 0 means it can optionally be used for loosely types. This is handy when data comes from a string-only encoding like URL query strings.
     *   In this specificality a numeric string is converted to a number or bigint, a 1|0|true|false string converted to boolean .
     */
    register<T extends ReflectionKind>(specificality: number, kind: T, template: Template<FindType<Type, T>>) {
        this.getRegistry(specificality).register(kind, template);
    }
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

    typeGuards = new TypeGuardRegistry(this);

    public name: string = 'default';

    constructor() {
        this.deserializeRegistry.register(ReflectionKind.class, deserializeClass);
        this.serializeRegistry.register(ReflectionKind.class, serializeObjectLiteral);
        this.deserializeRegistry.register(ReflectionKind.objectLiteral, serializeObjectLiteral);
        this.serializeRegistry.register(ReflectionKind.objectLiteral, serializeObjectLiteral);

        this.deserializeRegistry.register(ReflectionKind.tuple, serializeTypeTuple);
        this.serializeRegistry.register(ReflectionKind.tuple, serializeTypeTuple);

        this.deserializeRegistry.register(ReflectionKind.union, serializeTypeUnion);
        this.serializeRegistry.register(ReflectionKind.union, serializeTypeUnion);

        this.serializeRegistry.register(ReflectionKind.intersection, serializeTypeIntersection);
        this.deserializeRegistry.register(ReflectionKind.intersection, serializeTypeIntersection);

        this.deserializeRegistry.register(ReflectionKind.literal, (type, state) => state.addSetter(state.setVariable('v', type.literal)));
        this.serializeRegistry.register(ReflectionKind.literal, (type, state) => state.addSetter(state.setVariable('v', type.literal)));

        this.serializeRegistry.register(ReflectionKind.bigint, (type, state) => state.addSetter(`${state.accessor}.toString()`));

        this.deserializeRegistry.prependClass(Date, (type, state) => state.addSetter(`new Date(${state.accessor})`));
        this.serializeRegistry.prependClass(Date, (type, state) => state.addSetter(`${state.accessor}.toJSON()`));

        this.deserializeRegistry.register(ReflectionKind.string, (type, state) => {
            state.addSetter(`'string' !== typeof ${state.accessor} ? ${state.accessor}+'' : ${state.accessor}`);
        });

        this.deserializeRegistry.register(ReflectionKind.boolean, (type, state) => {
            state.addSetter(`'boolean' !== typeof ${state.accessor} ? ${state.accessor} == 1 || ${state.accessor} == 'true' : ${state.accessor}`);
        });

        this.deserializeRegistry.register(ReflectionKind.bigint, (type, state) => {
            state.setContext({ BigInt });
            state.addSetter(`'bigint' !== typeof ${state.accessor} ? BigInt(${state.accessor}) : ${state.accessor}`);
        });

        this.deserializeRegistry.register(ReflectionKind.enum, (type, state) => {
            state.addSetter(`${state.accessor}`);

            //todo check for valid value
            state.addCodeForSetter(`if (isNaN(${state.accessor})) ${state.throwCode('enum')}`);
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

            state.addCodeForSetter(`if (isNaN(${state.accessor})) ${state.throwCode('number')}`);
        });

        this.typeGuards.register(1, ReflectionKind.string, (type, state) => state.addSetter(`'string' === typeof ${state.accessor}`));
        this.typeGuards.register(10, ReflectionKind.string, (type, state) => state.addSetter(`true`)); //at the end, everything can be converted to string

        this.typeGuards.register(2, ReflectionKind.number, (type, state) => {
            state.setContext({ isNumeric: isNumeric });
            state.addSetter(`'bigint' === typeof ${state.accessor} || 'number' === typeof ${state.accessor} || ('string' === typeof ${state.accessor} && isNumeric(${state.accessor}))`);
        });
        this.typeGuards.register(-0.5, ReflectionKind.number, (type, state) => {
            state.setContext({ isNumeric: isNumeric });
            state.addSetter(`'string' === typeof ${state.accessor} && isNumeric(${state.accessor})`);
        });
        this.typeGuards.register(1, ReflectionKind.number, (type, state) => {
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

        this.typeGuards.register(2, ReflectionKind.bigint, (type, state) => {
            state.setContext({ isNumeric: isNumeric });
            state.addSetter(`'number' === typeof ${state.accessor} || ('string' === typeof ${state.accessor} && isNumeric(${state.accessor}))`);
        });
        this.typeGuards.register(-0.5, ReflectionKind.bigint, (type, state) => {
            state.setContext({ isNumeric: isNumeric });
            state.addSetter(`'string' === typeof ${state.accessor} && isNumeric(${state.accessor})`);
        });
        this.typeGuards.register(1, ReflectionKind.bigint, (type, state) => state.addSetter(`'bigint' === typeof ${state.accessor}`));

        this.typeGuards.register(1, ReflectionKind.boolean, (type, state) => state.addSetter(`'boolean' === typeof ${state.accessor}`));
        this.typeGuards.register(-0.9, ReflectionKind.boolean, (type, state) => state.addSetter(`1 === ${state.accessor} || '1' === ${state.accessor} || 0 === ${state.accessor} || 'true' === ${state.accessor} || 'false' === ${state.accessor}`));

        this.typeGuards.register(1, ReflectionKind.promise, (type, state) => state.addSetter(`${state.accessor} instanceof Promise`));
        this.typeGuards.register(1, ReflectionKind.enum, (type, state) => {
            const values = state.setVariable('values', type.values);
            state.addSetter(`${values}.indexOf(${state.accessor}) >= 0`);
        });
        this.typeGuards.register(1, ReflectionKind.array, (type, state) => typeCheckArray(type.type, state));
        this.typeGuards.register(1, ReflectionKind.tuple, typeGuardTypeTuple);
        this.typeGuards.register(1, ReflectionKind.literal, (type, state) => {
            const v = state.setVariable('v', type.literal);
            state.addSetter(`${v} === ${state.accessor}`);
        });

        this.typeGuards.register(1, ReflectionKind.objectLiteral, typeCheckClassOrObjectLiteral);
        this.typeGuards.getRegistry(1).append(ReflectionKind.class, typeCheckClassOrObjectLiteral);
        this.typeGuards.getRegistry(1).prependClass(Set, typeGuardTypeClassSet);
        this.typeGuards.getRegistry(1).prependClass(Map, typeGuardTypeClassMap);
        this.typeGuards.getRegistry(1).prependClass(Date, (type, state) => state.addSetter(`${state.accessor} instanceof Date`));
        this.typeGuards.getRegistry(0.5).prependClass(Date, (type, state) => {
            const date = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z$/;
            state.setContext({ date });
            state.addSetter(`'string' === typeof ${state.accessor} && date.exec(${state.accessor}) !== null`);
        });

        //if no type is found (>1), date supports also numbers
        this.typeGuards.getRegistry(1.5).prependClass(Date, (type, state) => {
            state.addSetter(`'number' === typeof ${state.accessor}`);
        });

        this.typeGuards.register(1, ReflectionKind.function, ((type, state) => {
            state.setContext({ isFunction: isFunction, isExtendable: isExtendable, resolveRuntimeType: resolveRuntimeType });
            const t = state.setVariable('type', type);
            state.addCodeForSetter(`
                if (isFunction(${state.accessor})) {
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

        this.typeGuards.register(1, ReflectionKind.intersection, (type, state) => {
            const { resolved, decorations } = resolveIntersection(type);
            if (resolved.kind === ReflectionKind.never) return;

            state.addCodeForSetter(getTemplateJSForTypeForState(state.setter, state.accessor, resolved, state, state.path));
        });

        this.typeGuards.register(1, ReflectionKind.union, (type, state) => {
            const lines: string[] = [];

            if (state.specificality === undefined) {
                const typeGuards = state.registry.serializer.typeGuards.getSortedTemplateRegistries();

                for (const [specificality, typeGuard] of typeGuards) {
                    for (const t of type.types) {
                        const fn = createTypeGuardFunction(t, typeGuard, state.namingStrategy, state.specificality);
                        if (!fn) continue;
                        const guard = state.setVariable('guard' + t.kind, fn);
                        const looseCheck = specificality <= 0 ? `options.loosely && ` : '';

                        lines.push(`else if (${looseCheck}${guard}(${state.accessor})) { //type = ${ReflectionKind[t.kind]}, specificality=${specificality}
                        ${getTemplateJSForTypeForState(state.setter, state.accessor, t, state, state.path)}
                    }`);
                    }
                }
            } else {
                const typeGuard = state.registry.serializer.typeGuards.getRegistry(state.specificality);
                for (const t of type.types) {
                    const fn = createTypeGuardFunction(t, typeGuard, state.namingStrategy, state.specificality);
                    if (!fn) continue;
                    const guard = state.setVariable('guard' + t.kind, fn);

                    lines.push(`else if (${guard}(${state.accessor})) { //type = ${ReflectionKind[t.kind]}, specificality=${state.specificality}
                    ${getTemplateJSForTypeForState(state.setter, state.accessor, t, state, state.path)}
                }`);
                }
            }

            state.addCodeForSetter(`
                if (false) {} ${lines.join(' ')}
            `);
        });
    }
}

export const serializer: Serializer = new Serializer();
