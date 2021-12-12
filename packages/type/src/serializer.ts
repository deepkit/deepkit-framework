/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, CompilerContext, CustomError, getClassName, isArray, isFunction, isInteger, isNumeric, isObject } from '@deepkit/core';
import {
    FindType,
    getDecoratorMetas,
    isNullable,
    isOptional,
    ReflectionKind,
    stringifyType,
    Type,
    TypeClass,
    TypeFunction,
    TypeIndexSignature,
    TypeIntersection,
    TypeLiteral,
    TypeNumberBrand,
    TypeObjectLiteral,
    TypeProperty,
    TypePropertySignature,
    TypeTuple,
    TypeUnion
} from './reflection/type';
import { ReflectionClass, ReflectionProperty, resolveIntersection } from './reflection/reflection';
import { extendTemplateLiteral, isExtendable } from './reflection/extends';
import { resolveRuntimeType } from './reflection/processor';
import { createReference, isReference, isReferenceHydrated } from './reference';
import { ValidationFailedItem } from './validator';
import { validators } from './validators';

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

export function createSerializeFunction(type: Type, registry: TemplateRegistry, namingStrategy: NamingStrategy = new NamingStrategy(), path: string = '', jitStack = new JitStack()): (data: any, options?: SerializationOptions) => any {
    const compiler = new CompilerContext();

    const templates = registry.get(type.kind);
    if (!templates.length) return (data: any) => data;

    const state = new TemplateState('result', 'data', compiler, registry, namingStrategy, jitStack, [path]);

    const code = `
        var result;
        options = options ? options : {};
        ${executeTemplates(state, templates, 'result', 'data', type, [])}
        return result;
    `;

    return compiler.build(code, 'data', 'options');
}

export type Guard = (data: any, options?: { errors?: ValidationFailedItem[] }) => boolean;

interface TypeGuardOptions {
    type: Type;
    registry: TemplateRegistry;
    namingStrategy?: NamingStrategy;
    specificality?: number;
    path?: (string | DynamicPath)[];
    jitStack?: JitStack;
    validation?: true;
}

export function createTypeGuardFunction(options: TypeGuardOptions): undefined | Guard {
    const compiler = new CompilerContext();

    const templates = options.registry.get(options.type.kind);
    if (!templates.length) return undefined;

    const state = new TemplateState(
        'result', 'data',
        compiler, options.registry,
        options.namingStrategy || new NamingStrategy(),
        options.jitStack || new JitStack(),
        options.path || []
    );
    state.specificality = options.specificality;
    if (options.validation) state.validation = true;

    for (const template of templates) {
        template(options.type, state);
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

function collapsePath(path: (string | DynamicPath)[], prefix?: string): string {
    return path.filter(v => !!v).map(v => v instanceof DynamicPath ? v.code : JSON.stringify(v)).join(`+'.'+`) || `''`;
}

export class JitStack {
    protected stack?: Map<Type, { fn: Function | undefined }>;

    getStack() {
        if (!this.stack) this.stack = new Map<Type, { fn: Function | undefined }>();
        return this.stack;
    }

    has(type: Type): boolean {
        return this.getStack().has(type);
    }

    get(type: Type) {
        return this.getStack().get(type);
    }

    getOrCreate(type: Type, create: () => Function): { fn: Function | undefined } {
        const stack = this.getStack();
        if (stack.has(type)) return stack.get(type)!;

        const entry: { fn: Function | undefined } = { fn: undefined };
        this.getStack().set(type, entry);
        entry.fn = create();
        return entry;
    }
}

export class TemplateState {
    public template = '';

    public ended = false;
    public setter = '';
    public accessor = '';

    /**
     * @internal for type guards only.
     */
    public specificality?: number;

    public validation: boolean = false;

    constructor(
        public originalSetter: string,
        public originalAccessor: string,
        public readonly compilerContext: CompilerContext,
        public readonly registry: TemplateRegistry,
        public readonly namingStrategy: NamingStrategy,
        public readonly jitStack: JitStack,
        public readonly path: (string | DynamicPath)[]
    ) {
        this.setter = originalSetter;
        this.accessor = originalAccessor;
    }

    get isSerialization(): boolean {
        return this.registry.serializer.serializeRegistry === this.registry;
    }

    get isDeserialization(): boolean {
        return this.registry.serializer.deserializeRegistry === this.registry;
    }

    extendPath(path: string | DynamicPath): (string | DynamicPath)[] {
        const copy = this.path.slice();
        copy.push(path);
        return copy;
    }

    assignValidationError(code: string, message: string) {
        this.setContext({ ValidationFailedItem });
        return `if (options.errors) options.errors.push(new ValidationFailedItem(${collapsePath(this.path)}, ${JSON.stringify(code)}, ${JSON.stringify(message)}));`;
    }

    throwCode(type: string, error?: string) {
        this.setContext({ SerializationError });
        return `throw new SerializationError('Cannot convert ' + ${this.originalAccessor} + ' to ' + ${JSON.stringify(type)} ${error ? ` + ${error}` : ''}, ${collapsePath(this.path)});`;
    }

    /**
     * Adds template code for setting the `this.setter` variable. The expression evaluated in `code` is assigned to `this.setter`.
     * `this.accessor` will point now to `this.setter`.
     */
    addSetter(code: string) {
        this.template += `\n${this.setter} = ${code};`;
        this.accessor = this.setter;
    }

    addSetterAndReportErrorIfInvalid(errorCode: string, message: string, code: string) {
        this.addSetter(code);
        if (this.validation) {
            this.addCodeForSetter(`if (!${this.setter}) ${this.assignValidationError(errorCode, message)}`);
        }
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

    addCode(code: string) {
        this.template += '\n' + code;
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
    parentState: TemplateState,
    templates: Template<any>[],
    setter: string,
    getter: string,
    type: Type,
    path: (string | DynamicPath)[]
): string {
    //object literals and classes get their own function
    const needsFunction = type.kind === ReflectionKind.class || type.kind === ReflectionKind.objectLiteral;
    if (needsFunction) {
        const jit = parentState.jitStack.getOrCreate(type, () => {
            const state = new TemplateState(
                'result', 'data',
                new CompilerContext(), parentState.registry,
                parentState.namingStrategy, parentState.jitStack,
                [new DynamicPath('_path')]
            );
            state.validation = parentState.validation;
            state.specificality = parentState.specificality;
            for (const template of templates) {
                template(type, state);
                if (state.ended) break;
            }

            let circularCheckBeginning = '';
            let circularCheckEnd = '';
            if (type.kind === ReflectionKind.class) {
                const reflection = ReflectionClass.from(type.classType);
                if (reflection.hasCircularReference()) {
                    circularCheckBeginning = `
                        if (options._stack) {
                            if (options._stack.includes(data)) return undefined;
                        } else {
                            options._stack = [];
                        }
                        options._stack.push(data);
                    `;
                    circularCheckEnd = `if (options._stack) options._stack.pop();`;
                }
            }
            const code = `
                /*
                 Jit code for
                 ${stringifyType(type)}
                */
                var result;
                ${circularCheckBeginning}
                options = options ? options : {};
                ${state.template}

                ${circularCheckEnd}
                return result;
            `;
            return state.compilerContext.build(code, 'data', 'options', '_path');
        });
        return `${setter} = ${parentState.setVariable('jit', jit)}.fn(${getter}, options, ${collapsePath(path)});`;
    } else {
        const state = new TemplateState(setter, getter, parentState.compilerContext, parentState.registry, parentState.namingStrategy, parentState.jitStack, path);
        state.validation = parentState.validation;
        state.specificality = parentState.specificality;
        for (const template of templates) {
            template(type, state);
            if (state.ended) break;
        }
        return state.template;
    }
}

export function getTemplateJSForTypeForState(
    setter: string,
    accessor: string,
    type: Type,
    state: TemplateState,
    path: (string | DynamicPath)[]
) {
    const templates = state.registry.get(type.kind);
    let convert = '';
    if (templates.length) {
        convert = executeTemplates(state, templates, setter, accessor, type, path);
    } else {
        convert = `//no template for ${type.kind}`;
    }

    return convert;
}

export function createConverterJSForMember(
    setter: string,
    accessor: string,
    property: ReflectionProperty | TypePropertySignature | TypeIndexSignature,
    state: TemplateState,
    undefinedSetterCode: string = '',
    nullSetterCode: string = '',
    path: (string | DynamicPath)[]
): string {
    const { registry, compilerContext, namingStrategy } = state;
    const undefinedCompiler = registry.get(ReflectionKind.undefined);
    const nullCompiler = registry.get(ReflectionKind.null);
    const type = property instanceof ReflectionProperty ? property.type : property.type;

    undefinedSetterCode = undefinedSetterCode || (undefinedCompiler ? executeTemplates(state, undefinedCompiler, setter, accessor, { kind: ReflectionKind.undefined }, path) : '');
    nullSetterCode = nullSetterCode || (nullCompiler ? executeTemplates(state, nullCompiler, setter, accessor, { kind: ReflectionKind.null }, path) : '');

    const templates = registry.get(type.kind);
    let convert = '';
    if (templates.length) {
        convert = executeTemplates(state, templates, setter, accessor, type, path);
    } else {
        convert = `
        //no template for ${type.kind}
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

    const optional = isOptional(property instanceof ReflectionProperty ? property.property : property);
    const nullable = isNullable(type);
    const hasDefault = property instanceof ReflectionProperty ? property.hasDefault() : false;

    // // since JSON does not support undefined, we emulate it via using null for serialization, and convert that back to undefined when deserialization happens.
    // // note: When the value is not defined (property.name in object === false), then this code will never run.
    let defaultValue = isSerialization ? 'null' : 'undefined';

    // // if (property.hasDefault()) {
    // //     defaultValue = `${compilerContext.reserveVariable('defaultValueGetter', property.getDefaultValueFunction())}()`;
    // // } else
    // if (!optional && nullable) {
    //     defaultValue = 'null';
    // }

    return `
        //this code is only reached when ${accessor} was actually defined checked by the 'in' operator.
        if (${accessor} === undefined) {
            if (${optional}) {
                ${undefinedSetterCode}
            }
        } else if (${accessor} === null) {
            //null acts on transport layer as telling an explicitly set undefined
            //this is to support actual undefined as value across a transport layer. Otherwise it
            //would be impossible to set a already set value to undefined back or override default value (since JSON.stringify() omits that information)
            if (${nullable}) {
                ${nullSetterCode}
            } else {
                if (${optional}) {
                    ${undefinedSetterCode}
                }
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

            const property = clazz.getProperty(parameter.getName());

            if (!property) {
                //might be handy to support also constructor parameters that are not properties.
                continue;
            }

            const name = JSON.stringify(parameter.getName());

            if (property.excludeSerializerNames && (property.excludeSerializerNames.includes('*') || property.excludeSerializerNames.includes(state.registry.serializer.name))) {
                continue;
            }

            const staticDefault = parameter.type.kind === ReflectionKind.literal ? `c_${i} = ${state.compilerContext.reserveConst(parameter.type.literal)};` : '';

            preLines.push(`
                var c_${i};
                if (${name} in ${state.accessor}) {
                    ${createConverterJSForMember(`c_${i}`,
                `${state.accessor}[${name}]`, property, state, undefined, undefined, state.extendPath(parameter.getName()))}
                } else {
                    ${staticDefault}
                }
            `);
            constructorArguments.push(`c_${i}`);
        }
    }

    for (const property of clazz.getProperties()) {
        if (constructor && constructor.hasParameter(property.getName())) continue; //already handled in the constructor

        const name = getNameExpression(state.namingStrategy.getPropertyName(property.property), state);

        if (property.excludeSerializerNames && (property.excludeSerializerNames.includes('*') || property.excludeSerializerNames.includes(state.registry.serializer.name))) {
            continue;
        }

        const setter = `${state.setter}[${JSON.stringify(property.getName())}]`;
        const staticDefault = !property.hasDefault() && property.type.kind === ReflectionKind.literal ? `${setter} = ${state.compilerContext.reserveConst(property.type.literal)};` : '';

        lines.push(`
            if (${name} in ${state.accessor}) {
                ${createConverterJSForMember(
            setter,
            `${state.accessor}[${name}]`,
            property,
            state,
            undefined, undefined, state.extendPath(String(property.getName()))
        )}
            } else { ${staticDefault} }
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

            const setter = `${v}[${JSON.stringify(member.name)}]`;
            let staticDefault = ``;
            if (member.type.kind === ReflectionKind.literal) {
                staticDefault = `${setter} = ${state.compilerContext.reserveConst(member.type.literal)};`;
            } else if (!isOptional(member) && isNullable(member.type)) {
                staticDefault = `${setter} = null;`;
            }

            lines.push(`
            if (${name} in ${state.accessor}) {
                ${createConverterJSForMember(
                setter,
                `${state.accessor}[${name}]`,
                member,
                state,
                undefined, undefined, state.extendPath(String(member.name))
            )}
            } else { ${staticDefault} }
            `);
        }
    }

    const clazz = type.kind === ReflectionKind.class ? ReflectionClass.from(type.classType) : undefined;
    if (clazz) for (const property of clazz.getProperties()) {
        const name = getNameExpression(state.namingStrategy.getPropertyName(property.property), state);

        if (property.excludeSerializerNames && (property.excludeSerializerNames.includes('*') || property.excludeSerializerNames.includes(state.registry.serializer.name))) {
            continue;
        }

        const setter = `${v}[${JSON.stringify(property.getName())}]`;
        const staticDefault = property.type.kind === ReflectionKind.literal ? `${setter} = ${state.compilerContext.reserveConst(property.type.literal)};` : '';

        lines.push(`
            if (${name} in ${state.accessor}) {
                ${createConverterJSForMember(
            setter,
            `${state.accessor}[${name}]`,
            property,
            state,
            undefined, undefined, state.extendPath(String(property.getName()))
        )}
            } else { ${staticDefault} }
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
            } else if (type.kind === ReflectionKind.templateLiteral) {
                state.setContext({ extendTemplateLiteral: extendTemplateLiteral });
                const typeVar = state.setVariable('type', type);
                return `'string' === typeof ${i} && extendTemplateLiteral({kind: ${ReflectionKind.literal}, literal: ${i}}, ${typeVar})`;
            } else if (type.kind === ReflectionKind.union) {
                return '(' + type.types.map(getIndexCheck).join(' || ') + ')';
            }
            return '';
        }

        for (const signature of signatures) {
            signatureLines.push(`else if (${getIndexCheck(signature.index)}) {
                ${createConverterJSForMember(
                `${v}[${i}]`,
                `${state.accessor}[${i}]`,
                signature,
                state,
                undefined, undefined, state.extendPath(new DynamicPath(i))
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
    state.setContext({ isArray });

    //we just use `a.length` to check whether its array-like, because Array.isArray() is way too slow.
    state.addCodeForSetter(`
    if (isArray(${state.accessor})) {
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
    }
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
         } else if (${state.validation}) {
            ${state.assignValidationError('type', 'Not an array')}
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
        if (isArray(${state.accessor})) {
            let ${v} = true; isArray(${state.accessor});
            let ${i} = 0;
            ${lines.join('\n')}
            ${state.setter} = ${v};
        } else {
            if (${state.validation}) ${state.assignValidationError('type', 'Not an array')}
            ${state.setter} = false;
        }
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

export function typeCheckClassOrObjectLiteralSecondIteration(type: TypeObjectLiteral | TypeClass, state: TemplateState) {
    return typeCheckClassOrObjectLiteral(type, state, true);
}

export function typeCheckClassOrObjectLiteral(type: TypeObjectLiteral | TypeClass, state: TemplateState, secondIteration: boolean = false) {
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

            if (member.name === 'constructor') continue;

            if (secondIteration && (member.kind === ReflectionKind.propertySignature || member.kind === ReflectionKind.property)) {
                //for the second type guard iteration, we ignore literal types, because they can be set without being actually required.
                if (member.type.kind === ReflectionKind.literal) continue;

                //for the second type guard iteration, we ignore all properties that have a default value, because they will set a value if not available.
                if (member.kind === ReflectionKind.property && member.default) continue;
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
            if (${state.validation}) ${state.assignValidationError('type', 'Not an object')}
            ${state.setter} = false;
        }
    `);
}

export function serializeTypeIntersection(type: TypeIntersection, state: TemplateState) {
    const { resolved, decorations } = resolveIntersection(type);
    if (resolved.kind === ReflectionKind.never) return;

    if (resolved.kind === ReflectionKind.class) {
        state.setContext({ isObject, isReference, isReferenceHydrated });
        const reflection = ReflectionClass.from(resolved.classType);
        const decoratorMetaNames = getDecoratorMetas(decorations);
        if (decoratorMetaNames.includes('reference') && reflection.hasPrimary()) {
            if (state.isSerialization) {
                //the primary key is serialised for unhydrated references
                state.addCodeForSetter(`
                if (isReference(${state.accessor}) && !isReferenceHydrated(${state.accessor})) {
                    ${getTemplateJSForTypeForState(state.setter, `${state.accessor}[${JSON.stringify(reflection.getPrimary().getName())}]`, reflection.getPrimary().getType(), state, state.path)}
                } else {
                    ${getTemplateJSForTypeForState(state.setter, state.accessor, resolved, state, state.path)}
                }
                `);
            } else {
                state.setContext({ createReference });
                const referenceClassTypeVar = state.setVariable('referenceClassType', resolved.classType);
                //in deserialization a reference is created when only the primary key is provided (no object given)
                state.addCodeForSetter(`
                if (isObject(${state.accessor})) {
                    ${getTemplateJSForTypeForState(state.setter, state.accessor, resolved, state, state.path)}
                } else {
                    ${state.setter} = createReference(${referenceClassTypeVar}, {${JSON.stringify(reflection.getPrimary().getName())}: ${state.accessor}});
                }
                `);
            }
            return;
        }
    }

    state.addCodeForSetter(getTemplateJSForTypeForState(state.setter, state.accessor, resolved, state, state.path));
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
            const fn = createTypeGuardFunction({ type: t, registry: typeGuard });
            if (!fn) continue;
            const guard = state.setVariable('guard' + t.kind, fn);
            const looseCheck = specificality <= 0 ? `options.loosely && ` : '';

            lines.push(`else if (${looseCheck}${guard}(${state.accessor})) { //type = ${ReflectionKind[t.kind]}, specificality=${specificality}
                ${getTemplateJSForTypeForState(state.setter, state.accessor, t, state, state.path)}
            }`);
        }
    }

    state.addCodeForSetter(`
        if (false) {
        } ${lines.join(' ')}
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

    validators = new TemplateRegistry(this);

    public name: string = 'default';

    constructor() {
        this.registerSerializers();
        this.registerTypeGuards();
        this.registerValidators();
    }

    protected registerValidators() {
        this.validators.register(ReflectionKind.number, () => {

        });
    }

    protected registerSerializers() {
        this.deserializeRegistry.register(ReflectionKind.class, deserializeClass);
        this.serializeRegistry.register(ReflectionKind.class, serializeObjectLiteral);
        this.deserializeRegistry.register(ReflectionKind.objectLiteral, serializeObjectLiteral);
        this.serializeRegistry.register(ReflectionKind.objectLiteral, serializeObjectLiteral);

        this.deserializeRegistry.register(ReflectionKind.array, (type, state) => serializeArray(type.type, state));
        this.serializeRegistry.register(ReflectionKind.array, (type, state) => serializeArray(type.type, state));

        this.deserializeRegistry.register(ReflectionKind.tuple, serializeTypeTuple);
        this.serializeRegistry.register(ReflectionKind.tuple, serializeTypeTuple);

        this.deserializeRegistry.register(ReflectionKind.union, serializeTypeUnion);
        this.serializeRegistry.register(ReflectionKind.union, serializeTypeUnion);

        this.serializeRegistry.register(ReflectionKind.intersection, serializeTypeIntersection);
        this.deserializeRegistry.register(ReflectionKind.intersection, serializeTypeIntersection);

        this.deserializeRegistry.register(ReflectionKind.literal, (type, state) => state.addSetter(state.setVariable('v', type.literal)));
        this.serializeRegistry.register(ReflectionKind.literal, (type, state) => state.addSetter(state.setVariable('v', type.literal)));

        this.serializeRegistry.register(ReflectionKind.undefined, (type, state) => state.addSetter(`null`));
        this.deserializeRegistry.register(ReflectionKind.undefined, (type, state) => state.addSetter(`undefined`));

        this.serializeRegistry.register(ReflectionKind.null, (type, state) => state.addSetter(`null`));
        this.deserializeRegistry.register(ReflectionKind.null, (type, state) => state.addSetter(`null`));

        this.serializeRegistry.register(ReflectionKind.bigint, (type, state) => state.addSetter(`${state.accessor}.toString()`));

        this.deserializeRegistry.prependClass(Date, (type, state) => state.addSetter(`new Date(${state.accessor})`));
        this.serializeRegistry.prependClass(Date, (type, state) => state.addSetter(`${state.accessor}.toJSON()`));

        this.serializeRegistry.register(ReflectionKind.string, (type, state) => state.addSetter(state.accessor));
        this.deserializeRegistry.register(ReflectionKind.string, (type, state) => {
            state.addSetter(`'string' !== typeof ${state.accessor} ? ${state.accessor}+'' : ${state.accessor}`);
        });

        this.serializeRegistry.register(ReflectionKind.templateLiteral, (type, state) => state.addSetter(state.accessor));
        this.deserializeRegistry.register(ReflectionKind.templateLiteral, (type, state) => {
            state.addSetter(`'string' !== typeof ${state.accessor} ? ${state.accessor}+'' : ${state.accessor}`);
        });

        this.serializeRegistry.register(ReflectionKind.boolean, (type, state) => state.addSetter(state.accessor));
        this.deserializeRegistry.register(ReflectionKind.boolean, (type, state) => {
            state.addSetter(`'boolean' !== typeof ${state.accessor} ? ${state.accessor} == 1 || ${state.accessor} == 'true' : ${state.accessor}`);
        });

        this.serializeRegistry.register(ReflectionKind.bigint, (type, state) => state.addSetter(state.accessor));
        this.deserializeRegistry.register(ReflectionKind.bigint, (type, state) => {
            state.setContext({ BigInt });
            state.addSetter(`'bigint' !== typeof ${state.accessor} ? BigInt(${state.accessor}) : ${state.accessor}`);
        });

        this.serializeRegistry.register(ReflectionKind.enum, (type, state) => state.addSetter(state.accessor));
        this.deserializeRegistry.register(ReflectionKind.enum, (type, state) => {
            state.addSetter(`${state.accessor}`);

            //todo check for valid value
            state.addCodeForSetter(`if (isNaN(${state.accessor})) ${state.throwCode('enum')}`);
        });

        this.serializeRegistry.register(ReflectionKind.regexp, (type, state) => state.addSetter(`${state.accessor}.toString()`));
        this.deserializeRegistry.register(ReflectionKind.regexp, (type, state) => {
            state.setContext({ RegExp });
            state.addCodeForSetter(`

            try {
            ${state.setter} = 'string' === typeof ${state.accessor}
                ? ${state.accessor}[0] === '/'
                    ? new RegExp(${state.accessor}.slice(1, ${state.accessor}.lastIndexOf('/')), ${state.accessor}.slice(1 + ${state.accessor}.lastIndexOf('/')))
                    : new RegExp(${state.accessor})
                : ${state.accessor}
            } catch (error) {
                ${state.throwCode('regexp', 'error')}
            }
            `);
        });

        this.serializeRegistry.register(ReflectionKind.number, (type, state) => state.addSetter(state.accessor));
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

    }

    protected registerTypeGuards() {
        this.typeGuards.register(1, ReflectionKind.string, (type, state) => state.addSetterAndReportErrorIfInvalid('type', 'Not a string', `'string' === typeof ${state.accessor}`));
        this.typeGuards.register(1, ReflectionKind.templateLiteral, (type, state) => {
            state.setContext({ extendTemplateLiteral: extendTemplateLiteral });
            const typeVar = state.setVariable('type', type);
            state.addSetterAndReportErrorIfInvalid('type', 'Invalid literal', `'string' === typeof ${state.accessor} && extendTemplateLiteral({kind: ${ReflectionKind.literal}, literal: ${state.accessor}}, ${typeVar})`);
        });

        this.typeGuards.register(1, ReflectionKind.undefined, (type, state) => state.addSetterAndReportErrorIfInvalid('type', 'Not undefined', `'undefined' === typeof ${state.accessor}`));
        this.typeGuards.register(2, ReflectionKind.undefined, (type, state) => state.addSetter(`null === ${state.accessor}`));

        this.typeGuards.register(1, ReflectionKind.null, (type, state) => state.addSetterAndReportErrorIfInvalid('type', 'Not null', `null === ${state.accessor}`));
        this.typeGuards.register(2, ReflectionKind.null, (type, state) => state.addSetter(`'undefined' === typeof ${state.accessor}`));

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
                state.addSetterAndReportErrorIfInvalid('type', `Not a ${type.brand === undefined ? 'number' : TypeNumberBrand[type.brand]}`, check);
            } else {
                state.addSetterAndReportErrorIfInvalid('type', 'Not a number', `'number' === typeof ${state.accessor}`);
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
        this.typeGuards.register(1, ReflectionKind.bigint, (type, state) => state.addSetterAndReportErrorIfInvalid('type', 'Not a bigint', `'bigint' === typeof ${state.accessor}`));

        this.typeGuards.register(1, ReflectionKind.boolean, (type, state) => state.addSetterAndReportErrorIfInvalid('type', 'Not a boolean', `'boolean' === typeof ${state.accessor}`));
        this.typeGuards.register(-0.9, ReflectionKind.boolean, (type, state) => {
            state.addSetter(`1 === ${state.accessor} || '1' === ${state.accessor} || 0 === ${state.accessor} || 'true' === ${state.accessor} || 'false' === ${state.accessor}`);
        });

        this.typeGuards.register(1, ReflectionKind.promise, (type, state) => state.addSetterAndReportErrorIfInvalid('type', 'Not a Promise', `${state.accessor} instanceof Promise`));
        this.typeGuards.register(1, ReflectionKind.enum, (type, state) => {
            const values = state.setVariable('values', type.values);
            state.addSetterAndReportErrorIfInvalid('type', 'Invalid enum member', `${values}.indexOf(${state.accessor}) >= 0`);
        });
        this.typeGuards.register(1, ReflectionKind.array, (type, state) => typeCheckArray(type.type, state));
        this.typeGuards.register(1, ReflectionKind.tuple, typeGuardTypeTuple);
        this.typeGuards.register(1, ReflectionKind.literal, (type, state) => {
            const v = state.setVariable('v', type.literal);
            state.addSetterAndReportErrorIfInvalid('type', 'Invalid literal', `${v} === ${state.accessor}`);
        });

        this.typeGuards.register(1, ReflectionKind.regexp, ((type, state) => state.addSetterAndReportErrorIfInvalid('type', 'Not a RegExp', `${state.accessor} instanceof RegExp`)));
        this.typeGuards.register(2, ReflectionKind.regexp, ((type, state) => state.addSetter(`'string' === typeof ${state.accessor}`)));
        this.typeGuards.register(0.5, ReflectionKind.regexp, ((type, state) => state.addSetter(`'string' === typeof ${state.accessor} && ${state.accessor}[0] === '/'`)));

        this.typeGuards.register(1, ReflectionKind.objectLiteral, typeCheckClassOrObjectLiteral);
        this.typeGuards.register(2, ReflectionKind.objectLiteral, typeCheckClassOrObjectLiteralSecondIteration);
        this.typeGuards.getRegistry(1).append(ReflectionKind.class, typeCheckClassOrObjectLiteral);
        this.typeGuards.getRegistry(2).append(ReflectionKind.class, typeCheckClassOrObjectLiteralSecondIteration);

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
                    if (${state.validation}) ${state.assignValidationError('type', 'Not a function')}
                    ${state.setter} = false;
                }
            `);
        }));

        this.typeGuards.register(1, ReflectionKind.regexp, (type, state) => state.addSetter(`${state.accessor} instanceof RegExp`));
        this.typeGuards.register(2, ReflectionKind.regexp, (type, state) => state.addSetter(`'string' === typeof ${state.accessor}`));

        this.typeGuards.register(1, ReflectionKind.intersection, (type, state) => {
            const { resolved, decorations } = resolveIntersection(type);
            if (resolved.kind === ReflectionKind.never) return;

            state.addCodeForSetter(getTemplateJSForTypeForState(state.setter, state.accessor, resolved, state, state.path));

            for (const decorator of decorations) {
                if (state.validation && decorator.kind === ReflectionKind.objectLiteral && decorator.types[0].kind === ReflectionKind.propertySignature && decorator.types[0].name === '__meta'
                    && decorator.types[0].type.kind === ReflectionKind.objectLiteral && decorator.types[0].type.types[0].kind === ReflectionKind.propertySignature && decorator.types[0].type.types[0].name === 'id'
                    && decorator.types[0].type.types[0].type.kind === ReflectionKind.literal && decorator.types[0].type.types[0].type.literal === 'validator') {
                    const name = ((((decorator.types[0] as TypePropertySignature).type as TypeObjectLiteral).types[1] as TypePropertySignature).type as TypeLiteral).literal as string;
                    const args = ((((decorator.types[0] as TypePropertySignature).type as TypeObjectLiteral).types[2] as TypePropertySignature).type as TypeTuple).types;
                    if (name === 'function') {
                        state.setContext({ ValidationFailedItem });
                        const validatorVar = state.setVariable('validator', (args[0].type as TypeFunction).function);
                        state.addCode(`
                            {
                                let error = ${validatorVar}(${state.originalAccessor});
                                if (error) {
                                    ${state.setter} = false;
                                    if (options.errors) options.errors.push(new ValidationFailedItem(${collapsePath(state.path)}, error.code, error.message));
                                }
                            }
                        `);
                    } else {
                        const validator = validators[name];
                        if (validator) {
                            const argTypes = args.map(v => v.type);
                            state.setContext({ ValidationFailedItem });
                            const validatorVar = state.setVariable('validator', validator(...argTypes));
                            state.addCode(`
                            {
                                let error = ${validatorVar}(${state.originalAccessor});
                                if (error) {
                                    ${state.setter} = false;
                                    if (options.errors) options.errors.push(new ValidationFailedItem(${collapsePath(state.path)}, error.code, error.message));
                                }
                            }
                        `);
                        }
                    }
                }
            }
        });

        this.typeGuards.register(1, ReflectionKind.union, (type, state) => {
            const lines: string[] = [];

            if (state.specificality === undefined) {
                const typeGuards = state.registry.serializer.typeGuards.getSortedTemplateRegistries();

                for (const [specificality, typeGuard] of typeGuards) {
                    for (const t of type.types) {
                        const fn = createTypeGuardFunction({
                            type: t, registry: typeGuard,
                            namingStrategy: state.namingStrategy,
                            specificality: state.specificality
                        });
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
                    const fn = createTypeGuardFunction({
                        type: t, registry: typeGuard,
                        namingStrategy: state.namingStrategy,
                        specificality: state.specificality
                    });
                    if (!fn) continue;
                    const guard = state.setVariable('guard' + t.kind, fn);

                    lines.push(`else if (${guard}(${state.accessor})) { //type = ${ReflectionKind[t.kind]}, specificality=${state.specificality}
                        ${getTemplateJSForTypeForState(state.setter, state.accessor, t, state, state.path)}
                    }`);
                }
            }

            state.addCodeForSetter(`
                if (false) {} ${lines.join(' ')}
                else {
                    ${state.assignValidationError('type', 'Invalid type')}
                }
            `);
        });
    }
}

export const serializer: Serializer = new Serializer();
