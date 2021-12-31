/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, CompilerContext, CustomError, getClassName, isArray, isFunction, isInteger, isIterable, isNumeric, isObject, toFastProperties } from '@deepkit/core';
import {
    AnnotationDefinition,
    binaryTypes,
    copyAndSetParent,
    embeddedAnnotation,
    EmbeddedOptions,
    excludedAnnotation,
    FindType,
    getConstructorProperties,
    getTypeJitContainer,
    hasDefaultValue,
    hasEmbedded,
    isNullable,
    isOptional,
    mongoIdAnnotation,
    OuterType,
    referenceAnnotation,
    ReflectionKind,
    stringifyShortResolvedType,
    stringifyType,
    Type,
    TypeClass,
    TypeFunction,
    TypeIndexSignature,
    TypeNumberBrand,
    TypeObjectLiteral,
    TypeProperty,
    TypePropertySignature,
    TypeTuple,
    TypeUnion,
    uuidAnnotation,
    validationAnnotation
} from './reflection/type';
import { hasCircularReference, ReflectionClass, ReflectionProperty } from './reflection/reflection';
import { extendTemplateLiteral, isExtendable } from './reflection/extends';
import { resolveRuntimeType } from './reflection/processor';
import { createReference, isReference, isReferenceHydrated } from './reference';
import { ValidationFailedItem } from './validator';
import { validators } from './validators';
import { arrayBufferToBase64, base64ToArrayBuffer, base64ToTypedArray, typedArrayToBase64 } from './core';

export class NamingStrategy {
    protected static ids: number = 0;
    id: number = NamingStrategy.ids++;

    getPropertyName(type: TypeProperty | TypePropertySignature): string | number | symbol | undefined {
        return type.name;
    }
}

export interface SerializationOptions {
    groups?: string[];
    excludeGroups?: string[];
    loosely?: boolean;
}

export type SerializeFunction = (data: any, state?: SerializationOptions) => any;

/**
 * Creates a (cached) Partial<T> of the given type and returns a (cached) serializer function for the given registry (serialize or deserialize).
 */
export function getPartialSerializeFunction(type: TypeClass | TypeObjectLiteral, registry: TemplateRegistry, namingStrategy: NamingStrategy = new NamingStrategy()) {
    const jitContainer = getTypeJitContainer(type);
    if (!jitContainer.partialType) {
        jitContainer.partialType = copyAndSetParent(type);
        for (const member of jitContainer.partialType.types) {
            if (member.kind === ReflectionKind.propertySignature || member.kind === ReflectionKind.property) {
                member.optional = true;
            }
        }
    }
    return getSerializeFunction(jitContainer.partialType, registry, namingStrategy);
}

/**
 * Returns a (cached) serializer function for the given registry (serialize or deserialize).
 */
export function getSerializeFunction(type: OuterType, registry: TemplateRegistry, namingStrategy: NamingStrategy = new NamingStrategy(), path: string = '', jitStack = new JitStack()): SerializeFunction {
    const jit = getTypeJitContainer(type);
    const id = registry.id + '_' + namingStrategy.id;
    if (jit[id]) return jit[id];

    jit[id] = createSerializeFunction(type, registry, namingStrategy, path, jitStack);
    toFastProperties(jit);

    return jit[id];
}

export function createSerializeFunction(type: OuterType, registry: TemplateRegistry, namingStrategy: NamingStrategy = new NamingStrategy(), path: string = '', jitStack = new JitStack()): SerializeFunction {
    const compiler = new CompilerContext();

    const state = new TemplateState('result', 'data', compiler, registry, namingStrategy, jitStack, [path]);
    if (state.isDeserialization) {
        state.target = 'deserialize';
    }

    const code = `
        var result;
        state = state ? state : {};
        state.depth = 0;
        ${executeTemplates(state, type)}
        return result;
    `;

    return compiler.build(code, 'data', 'state');
}

export type Guard = (data: any, state?: { errors?: ValidationFailedItem[] }) => boolean;

export function createTypeGuardFunction(type: Type, state?: TemplateState, serializerToUse?: Serializer): undefined | Guard {
    const compiler = new CompilerContext();

    if (state) {
        state = state.fork('result');
        state.compilerContext = compiler;
    } else {
        state = new TemplateState('result', 'data', compiler, (serializerToUse || serializer).typeGuards.getRegistry(1));
    }
    state.path = [new RuntimeCode('_path')];
    state.validation = true;
    state.setterDisabled = false;

    const templates = state.registry.get(type);

    if (!templates.length) return undefined;

    for (const hook of state.registry.preHooks) hook(type, state);
    for (const template of templates) {
        template(type, state);
        if (state.ended) break;
    }
    for (const hook of state.registry.postHooks) hook(type, state);
    for (const hook of state.registry.getDecorator(type)) hook(type, state);

    const code = `
        var result;
        if (_path === undefined) _path = '';
        state = state ? state : {};
        ${state.template}
        return result === true;
    `;
    return compiler.build(code, 'data', 'state', '_path', 'property');
}

export class SerializationError extends CustomError {
    constructor(message: string, public path: string) {
        super(`${!path ? '' : (path && path.startsWith('.') ? path.slice(1) : path) + ': '}` + message);
    }
}

export class RuntimeCode {
    constructor(public code: string) {
    }
}

export function collapsePath(path: (string | RuntimeCode)[], prefix?: string): string {
    return path.filter(v => !!v).map(v => v instanceof RuntimeCode ? v.code : JSON.stringify(v)).join(`+'.'+`) || `''`;
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

    prepare(type: Type): (fn: Function) => { fn: Function | undefined } {
        if (this.getStack().has(type)) {
            throw new Error('Circular jit building detected: ' + stringifyType(type));
        }

        const entry: { fn: Function | undefined } = { fn: undefined };
        this.getStack().set(type, entry);
        return (fn: Function) => {
            entry.fn = fn;
            return entry;
        };
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

export class ContainerAccessor {
    constructor(public container: string | ContainerAccessor, public property: string) {
    }

    toString() {
        return `${this.container}[${this.property}]`;
    }
}

export class TemplateState {
    /**
     * Before and after template content is rendered before/after all other templates.
     * When a template is put into its own function, before/after templates are run outside of this function.
     */
    public template = '';

    public ended = false;
    public setter: string | ContainerAccessor = '';
    public accessor: string | ContainerAccessor = '';

    /**
     * @internal for type guards only.
     */
    public specificality?: number;

    public validation: boolean = false;

    public propertyName?: string | RuntimeCode;
    public setterDisabled: boolean = false;

    public target: 'serialize' | 'deserialize' = 'serialize';

    protected handledAnnotations: AnnotationDefinition[] = [];

    constructor(
        public originalSetter: string | ContainerAccessor,
        public originalAccessor: string | ContainerAccessor,
        public compilerContext: CompilerContext,
        public registry: TemplateRegistry,
        public namingStrategy: NamingStrategy = new NamingStrategy,
        public jitStack: JitStack = new JitStack(),
        public path: (string | RuntimeCode)[] = []
    ) {
        this.setter = originalSetter;
        this.accessor = originalAccessor;
    }

    replaceTemplate(template: string) {
        this.template = template;
    }

    /**
     * Forks as state, with an empty propertyName.
     */
    fork(setter?: string | ContainerAccessor, accessor?: string | ContainerAccessor, path?: (string | RuntimeCode)[]): TemplateState {
        const state = new TemplateState(setter ?? this.setter, accessor ?? this.accessor, this.compilerContext, this.registry, this.namingStrategy, this.jitStack, path || this.path.slice(0));
        state.validation = this.validation;
        state.setterDisabled = this.setterDisabled;
        state.target = this.target;
        state.handledAnnotations = this.handledAnnotations.slice();
        return state;
    }

    clearJit() {
        this.jitStack = new JitStack();
        return this;
    }

    fullFork() {
        return this.fork().forPropertyName(this.propertyName);
    }

    forRegistry(registry: TemplateRegistry) {
        this.registry = registry;
        return this;
    }

    forPropertyName(name?: string | number | symbol | RuntimeCode): this {
        if (name === undefined) return this;
        this.propertyName = name instanceof RuntimeCode ? name : String(name);
        return this;
    }

    disableSetter(): this {
        this.setterDisabled = true;
        return this;
    }

    enableSetter(): this {
        this.setterDisabled = true;
        return this;
    }

    /**
     * Can be used to track which annotation was already handled. Necessary to use with `isAnnotationHandled` to avoid infinite recursive loops
     * when a serializer template issues sub calls depending on annotation data.
     */
    annotationHandled(annotation: AnnotationDefinition<any>): void {
        this.handledAnnotations.push(annotation);
    }

    isAnnotationHandled(annotation: AnnotationDefinition<any>): boolean {
        return this.handledAnnotations.includes(annotation);
    }

    get isSerialization(): boolean {
        return this.registry.serializer.serializeRegistry === this.registry;
    }

    get isDeserialization(): boolean {
        return this.registry.serializer.deserializeRegistry === this.registry;
    }

    extendPath(path: string | RuntimeCode | number | symbol): this {
        this.path.push(path instanceof RuntimeCode ? path : String(path));
        return this;
    }

    assignValidationError(code: string, message: string) {
        this.setContext({ ValidationFailedItem });
        return `if (state.errors) state.errors.push(new ValidationFailedItem(${collapsePath(this.path)}, ${JSON.stringify(code)}, ${JSON.stringify(message)}));`;
    }

    throwCode(type: OuterType | string, error?: string, accessor: string | ContainerAccessor = this.originalAccessor) {
        this.setContext({ SerializationError });
        const to = JSON.stringify(('string' === typeof type ? type : stringifyShortResolvedType(type)).replace(/\n/g, '').replace(/\s+/g, ' ').trim());
        return `throw new SerializationError('Cannot convert ' + ${accessor} + ' to ' + ${to} ${error ? ` + '. ' + ${error}` : ''}, ${collapsePath(this.path)});`;
    }

    /**
     * Adds template code for setting the `this.setter` variable. The expression evaluated in `code` is assigned to `this.setter`.
     * `this.accessor` will point now to `this.setter`.
     */
    addSetter(code: string | { toString(): string }) {
        this.template += `\n${this.setter} = ${code};`;
        this.accessor = String(this.setter);
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
        this.accessor = String(this.setter);
    }

    hasSetterCode(): boolean {
        return !!this.template;
    }
}

export type Template<T extends Type> = (type: T, state: TemplateState) => void;

export type TemplateHook = (type: Type, state: TemplateState) => void;

/**
 * Just sets the state.setter to state.accessor without any modification.
 */
export function noopTemplate(type: Type, state: TemplateState): void {
    state.addSetter(state.accessor);
}

export class TemplateRegistry {
    protected static ids: number = 0;
    id: number = TemplateRegistry.ids++;

    protected templates: { [kind in ReflectionKind]?: Template<any>[] } = {};
    protected decorator: { [kind in ReflectionKind]?: Template<any>[] } = {};

    public preHooks: TemplateHook[] = [];
    public postHooks: TemplateHook[] = [];

    public classTemplates = new Map<ClassType, Template<any>[]>();

    constructor(public serializer: Serializer = new EmptySerializer()) {
    }

    clear() {
        this.templates = {};
        this.preHooks = [];
        this.postHooks = [];
    }

    get(type: Type): Template<Type>[] {
        if (type.kind === ReflectionKind.class) {
            const classTemplates = this.classTemplates.get(type.classType);
            if (classTemplates && classTemplates.length) return classTemplates;
            if (type.classType === Set || type.classType === Map || binaryTypes.includes(type.classType)) return [];
        }
        return this.templates[type.kind] ||= [];
    }

    getDecorator(type: Type): Template<Type>[] {
        return this.decorator[type.kind] ||= [];
    }

    /**
     * Registers a template for all binary classes: ArrayBuffer, Uint8Array, Int8Array, etc.
     */
    registerBinary(template: Template<TypeClass>) {
        for (const classType of binaryTypes) this.registerClass(classType, template);
    }

    /**
     * Registers a template for a given class type.
     *
     * As soon as a single template has registered for the given classType the template registry
     * only returns templates for this particular classType and omits all general purpose ReflectionKind.class templates for this particular classType.
     */
    registerClass(classType: ClassType, template: Template<TypeClass>) {
        this.classTemplates.set(classType, [template]);
    }

    prependClass(classType: ClassType, template: Template<TypeClass>) {
        this.getClassTemplates(classType).unshift(template);
    }

    appendClass(classType: ClassType, template: Template<TypeClass>) {
        this.getClassTemplates(classType).push(template);
    }

    protected getClassTemplates(classType: ClassType): Template<TypeClass>[] {
        let templates = this.classTemplates.get(classType);
        if (!templates) {
            templates = [];
            this.classTemplates.set(classType, templates);
        }
        return templates;
    }

    addPreHook(callback: TemplateHook) {
        this.preHooks.push(callback);
    }

    addPostHook(callback: TemplateHook) {
        this.postHooks.push(callback);
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

    /**
     * Registers additional templates that handle type decorators/annotations. The templates can safely assume that the given type in `state.accessor`
     * is already type-checked to be `T`.
     *
     * Decorator templates run last (after normal templates and postHook).
     *
     * This split between register and registerForDecorator is made to have a distinction between native type templates and additional user-made templates.
     * This allows to fetch only decorator templates and decide upon the result whether additional code is necessary or not. (this would not be possible
     * if everything is added to the `register` call that does always the basic checks).
     */
    addDecorator<T extends ReflectionKind>(kind: T, template: Template<FindType<Type, T>>) {
        this.decorator[kind] ||= [];
        this.decorator[kind]!.push(template);
    }

    prepend<T extends ReflectionKind>(kind: T, template: Template<FindType<Type, T>>) {
        this.templates[kind] ||= [];
        this.templates[kind]!.unshift(template);
    }

    append<T extends ReflectionKind>(kind: T, template: Template<FindType<Type, T>>) {
        this.templates[kind] ||= [];
        this.templates[kind]!.push(template);
    }
}

/**
 * To avoid circular builds, class/object literal code is extract to its own function.
 * if this returns true, code is put into state to call an already existing function.
 */
export function callExtractedFunctionIfAvailable(state: TemplateState, type: Type): boolean {
    const jit = state.jitStack.get(type);
    if (!jit) return false;
    state.addCode(`
    //call jit for ${state.setter}
    ${state.setterDisabled || !state.setter ? '' : `${state.setter} = `}${state.setVariable('jit', jit)}.fn(${state.accessor || 'undefined'}, state, ${collapsePath(state.path)});
    `);
    return true;
}

export function extractStateToFunctionAndCallIt(state: TemplateState, type: Type) {
    const prepare = state.jitStack.prepare(type);
    callExtractedFunctionIfAvailable(state, type);
    return { setFunction: prepare, state: state.fork('result', 'data', [new RuntimeCode('_path')]) };
}

export function buildFunction(state: TemplateState, type: Type): Function {
    let circularCheckBeginning = '';
    let circularCheckEnd = '';
    if (hasCircularReference(type)) {
        circularCheckBeginning = `
            if (state._stack) {
                if (state._stack.includes(data)) return undefined;
            } else {
                state._stack = [];
            }
            state._stack.push(data);
        `;
        circularCheckEnd = `if (state._stack) state._stack.pop();`;
    }
    const code = `
        /*
         Jit code for
         ${stringifyType(type)}
        */
        var result;
        if (_path === undefined) _path = '';
        ${circularCheckBeginning}
        state = state ? state : {};
        state.depth++;
        ${state.template}

        ${circularCheckEnd}

        state.depth--;
        return result;
    `;
    return state.compilerContext.build(code, 'data', 'state', '_path');
}

export function executeTemplates(
    state: TemplateState,
    type: Type,
): string {
    const templates = state.registry.get(type);
    for (const hook of state.registry.preHooks) hook(type, state);
    for (const template of templates) {
        template(type, state);
        if (state.ended) break;
    }
    for (const hook of state.registry.postHooks) hook(type, state);
    for (const template of state.registry.getDecorator(type)) template(type, state);
    return state.template;
}

export function createConverterJSForMember(
    property: ReflectionProperty | TypeProperty | TypePropertySignature | TypeIndexSignature,
    state: TemplateState,
    undefinedSetterCode: string = '',
    nullSetterCode: string = '',
): string {
    const { registry, compilerContext, namingStrategy } = state;
    const type = property instanceof ReflectionProperty ? property.type : property.type;

    undefinedSetterCode = undefinedSetterCode || executeTemplates(state.fork(), { kind: ReflectionKind.undefined });
    nullSetterCode = nullSetterCode || executeTemplates(state.fork(), { kind: ReflectionKind.null });

    let convert = executeTemplates(state.fork(), type);

    let postTransform = '';

    const isSerialization = registry.serializer.serializeRegistry === registry;
    const isDeserialization = registry.serializer.deserializeRegistry === registry;

    if (property instanceof ReflectionProperty) {
        if (isSerialization) {
            if (property.serializer) {
                const fnVar = compilerContext.reserveVariable('transformer', property.serializer);
                postTransform = `${state.setter} = ${fnVar}(${state.setter}, ${compilerContext.reserveConst(property)})`;
            }
        }

        if (isDeserialization) {
            if (property.deserializer) {
                const fnVar = compilerContext.reserveVariable('transformer', property.deserializer);
                postTransform = `${state.setter} = ${fnVar}(${state.setter}, ${compilerContext.reserveConst(property)})`;
            }
        }
    }

    const optional = isOptional(property instanceof ReflectionProperty ? property.property : property);
    const nullable = isNullable(type);
    // const hasDefault = property instanceof ReflectionProperty ? property.hasDefault() : false;

    // // since JSON does not support undefined, we emulate it via using null for serialization, and convert that back to undefined when deserialization happens.
    // // note: When the value is not defined (property.name in object === false), then this code will never run.
    // let defaultValue = isSerialization ? 'null' : 'undefined';

    // // if (property.hasDefault()) {
    // //     defaultValue = `${compilerContext.reserveVariable('defaultValueGetter', property.getDefaultValueFunction())}()`;
    // // } else
    // if (!optional && nullable) {
    //     defaultValue = 'null';
    // }

    //todo: clean that up. Way too much code for that simple functionality

    //note: this code is only reached when ${accessor} was actually defined checked by the 'in' operator.
    return `
        if (${state.accessor} === undefined) {
            if (${optional}) {
                ${undefinedSetterCode}
            }
        } else if (${state.accessor} === null) {
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

export function inAccessor(accessor: ContainerAccessor): string {
    return `'object' === typeof ${accessor.container} && ${accessor.property} in ${accessor.container}`;
}

export function deserializeEmbedded(type: TypeClass, state: TemplateState, container?: string): string {
    const embedded = embeddedAnnotation.getFirst(type);
    if (!embedded) return '';

    const classType = state.compilerContext.reserveConst(type.classType);
    const constructorProperties = getConstructorProperties(type);
    if (!constructorProperties.properties.length) throw new Error(`Can not embed class ${getClassName(type.classType)} since it has no constructor properties`);
    const args: (ContainerAccessor | string)[] = [];
    const loadArgs: string[] = [];
    const setToUndefined = state.compilerContext.reserveName('setToUndefined');
    const params = state.compilerContext.reserveName('params');
    const requiredSet: string[] = ['true'];

    const containerProperty = getEmbeddedProperty(type);
    for (const parameter of constructorProperties.parameters) {
        if (parameter.kind !== ReflectionKind.property) {
            args.push('undefined');
        } else {
            const setter = new ContainerAccessor(params, JSON.stringify(parameter.name));
            args.push(setter);

            if (!isOptional(parameter) && !hasDefaultValue(parameter)) {
                if (isNullable(parameter)) {
                    requiredSet.push(`${setter} !== undefined`);
                } else {
                    requiredSet.push(`${setter} !== undefined && ${setter} !== null`);
                }
            }

            const accessor = getEmbeddedAccessor(type, constructorProperties.properties.length !== 1, state.accessor, state.namingStrategy, parameter, embedded, container);
            const propertyState = state.fork(setter, accessor).extendPath(String(parameter.name));
            if (hasEmbedded(parameter.type)) {
                loadArgs.push(executeTemplates(propertyState, parameter.type));
            } else {
                if (accessor instanceof ContainerAccessor) {
                    const check = !containerProperty ? 'true' : isNullable(containerProperty) ? `${accessor} === undefined` : `(${accessor} === undefined || ${accessor} === null)`;
                    const setUndefined = containerProperty ? `if (${check}) { ${setToUndefined}++; }` : 'if (false) {} ';
                    loadArgs.push(`
                        if (${inAccessor(accessor)}) {
                            ${setUndefined} else {
                                ${executeTemplates(propertyState, parameter.type)}
                            }
                        }`);
                } else {
                    loadArgs.push(executeTemplates(propertyState, parameter.type));
                }
            }
        }
    }

    return `
        const ${params} = {};
        let ${setToUndefined} = 0;
        ${loadArgs.join('\n')}
        if (${requiredSet.join(' && ')}) {
            ${state.setter} = new ${classType}(${args.join(',')});
        } else if (${setToUndefined} === ${constructorProperties.properties.length}) {
            ${state.setter} = undefined;
        }
    `;
}

export function deserializeClass(type: TypeClass, state: TemplateState) {
    const embedded = deserializeEmbedded(type, state);
    if (embedded) {
        state.addCode(embedded);
        return;
    }

    if (callExtractedFunctionIfAvailable(state, type)) return;
    const extract = extractStateToFunctionAndCallIt(state, type);
    state = extract.state;

    const preLines: string[] = [];
    const lines: string[] = [];
    const clazz = ReflectionClass.from(type.classType);

    const constructor = clazz.getConstructorOrUndefined();
    const constructorArguments: string[] = [];
    if (constructor) {
        const parameters = constructor.getParameters();
        for (const parameter of parameters) {
            if (parameter.getVisibility() === undefined) {
                constructorArguments.push('undefined');
                continue;
            }

            const property = clazz.getProperty(parameter.getName());
            if (!property) continue;

            if (property.isSerializerExcluded(state.registry.serializer.name)) {
                continue;
            }
            const argumentName = state.compilerContext.reserveVariable('c_' + parameter.getName());

            const name = JSON.stringify(property.getName());
            const propertyState = state.fork(argumentName, new ContainerAccessor(state.accessor, name)).extendPath(String(property.getName()));
            const staticDefault = property.type.kind === ReflectionKind.literal ? `${argumentName} = ${state.compilerContext.reserveConst(property.type.literal)};` : '';

            const embedded = property.getEmbedded();
            if (embedded) {
                preLines.push(executeTemplates(propertyState, property.type));
            } else {
                preLines.push(`
                    ${argumentName} = undefined;
                    if (${inAccessor(propertyState.accessor as ContainerAccessor)}) {
                        ${createConverterJSForMember(property, propertyState)}
                    } else {
                        ${staticDefault}
                    }
                `);
            }

            constructorArguments.push(argumentName);
        }
    }

    for (const property of clazz.getProperties()) {
        if (constructor && constructor.hasParameter(property.getName())) continue; //already handled in the constructor

        const name = getNameExpression(state.namingStrategy.getPropertyName(property.property), state);

        if (property.isSerializerExcluded(state.registry.serializer.name)) {
            continue;
        }

        const setter = new ContainerAccessor(state.setter, JSON.stringify(property.getName()));
        const staticDefault = !property.hasDefault() && property.type.kind === ReflectionKind.literal ? `${setter} = ${state.compilerContext.reserveConst(property.type.literal)};` : '';

        const propertyState = state.fork(setter, new ContainerAccessor(state.accessor, name)).extendPath(String(property.getName()));
        const embedded = property.getEmbedded();
        if (embedded) {
            lines.push(executeTemplates(propertyState, property.type));
        } else {
            lines.push(`
                if (${name} in ${state.accessor}) {
                    ${createConverterJSForMember(property, propertyState)}
                } else { ${staticDefault} }
            `);
        }
    }

    const classType = state.compilerContext.reserveConst(type.classType);

    state.addCode(`
        if ('object' !== typeof ${state.accessor}) ${state.throwCode(`class ${getClassName(type.classType)}`)}
        ${preLines.join('\n')}
        ${state.setter} = new ${classType}(${constructorArguments.join(', ')});
        ${lines.join('\n')}
    `);

    if (referenceAnnotation.hasAnnotations(type) && !state.isAnnotationHandled(referenceAnnotation)) {
        state.annotationHandled(referenceAnnotation);
        state.setContext({ isObject, createReference, isReferenceHydrated });
        const reflection = ReflectionClass.from(type.classType);
        const referenceClassTypeVar = state.setVariable('referenceClassType', type.classType);
        // in deserialization a reference is created when only the primary key is provided (no object given)
        state.replaceTemplate(`
            if (isObject(${state.accessor})) {
                ${state.template}
            } else {
                let pk;
                ${executeTemplates(state.fork('pk').extendPath(String(reflection.getPrimary().getName())), reflection.getPrimary().getType())}
                ${state.setter} = createReference(${referenceClassTypeVar}, {${JSON.stringify(reflection.getPrimary().getName())}: pk});
            }
        `);
    }

    extract.setFunction(buildFunction(state, type));
}

export function getIndexCheck(state: TemplateState, i: string, type: Type): string {
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
        return '(' + type.types.map(v => getIndexCheck(state, i, v)).join(' || ') + ')';
    }
    return '';
}

function isLiteralType(t: TypeIndexSignature): boolean {
    return t.index.kind === ReflectionKind.literal || (t.index.kind === ReflectionKind.union && t.index.types.some(v => v.kind === ReflectionKind.literal));
}

function isNumberType(t: TypeIndexSignature): boolean {
    return t.index.kind === ReflectionKind.number || (t.index.kind === ReflectionKind.union && t.index.types.some(v => v.kind === ReflectionKind.number));
}

/**
 * Sort, so the order is literal, number, string, symbol.  literal comes first as its the most specific type.
 * We need to do that for numbers since all keys are string|symbol in runtime, and we need to check if a string is numeric first before falling back to string.
 */
export function sortSignatures(signatures: TypeIndexSignature[]) {
    signatures.sort((a, b) => {
        if (isLiteralType(a)) return -1;
        if (isNumberType(a) && !isLiteralType(b)) return -1;
        return +1;
    });
}

export function getStaticDefaultCodeForProperty(member: TypeProperty | TypePropertySignature, setter: string | ContainerAccessor, state: TemplateState) {
    let staticDefault = ``;
    if (!hasDefaultValue(member)) {
        if (member.type.kind === ReflectionKind.literal) {
            staticDefault = `${setter} = ${state.compilerContext.reserveConst(member.type.literal)};`;
        } else if (!isOptional(member) && isNullable(member.type)) {
            staticDefault = `${setter} = null;`;
        }
    }
    return staticDefault;
}

export function getEmbeddedProperty(type: TypeClass): TypeProperty | TypePropertySignature | undefined {
    if (!type.parent) return;
    let resolved: Type = type.parent;
    if (resolved.kind === ReflectionKind.union && resolved.parent) resolved = resolved.parent;
    if (resolved.kind === ReflectionKind.propertySignature || resolved.kind === ReflectionKind.property) return resolved;
    return;
}

function getEmbeddedAccessor(type: TypeClass, autoPrefix: boolean, accessor: string | ContainerAccessor, namingStrategy: NamingStrategy, property: TypeProperty, embedded: EmbeddedOptions, container?: string): string | ContainerAccessor {
    const containerProperty = getEmbeddedProperty(type);

    let embeddedPropertyName = JSON.stringify(namingStrategy.getPropertyName(property));
    if (embedded.prefix !== undefined) {
        embeddedPropertyName = embedded.prefix ? JSON.stringify(embedded.prefix) + ' + ' + embeddedPropertyName : embeddedPropertyName;
    } else if (!container && containerProperty) {
        embeddedPropertyName = JSON.stringify(containerProperty.name) + ` + '_' + ` + embeddedPropertyName;
    }

    if (container) return new ContainerAccessor(container, embeddedPropertyName);

    if ((autoPrefix || embedded.prefix !== undefined)) {
        //if autoPrefix or a prefix is set the embeddedPropertyName is emitted in a container, either manually provided or from accessor.
        if (accessor instanceof ContainerAccessor) return new ContainerAccessor(accessor.container, embeddedPropertyName);
        if (autoPrefix) return new ContainerAccessor(accessor, embeddedPropertyName);
        if (containerProperty) return new ContainerAccessor(accessor, embeddedPropertyName);
    }

    return accessor;
}

export function serializeObjectLiteral(type: TypeObjectLiteral | TypeClass, state: TemplateState) {
    const embedded = embeddedAnnotation.getFirst(type);
    if (embedded) {
        if (type.kind !== ReflectionKind.class) throw new SerializationError(`Object literals can not be embedded`, collapsePath(state.path));
        const constructorProperties = getConstructorProperties(type);
        if (!constructorProperties.properties.length) throw new Error(`Can not embed class ${getClassName(type.classType)} since it has no constructor properties`);

        if (constructorProperties.properties.length === 1) {
            const first = constructorProperties.properties[0];
            let name = getNameExpression(state.namingStrategy.getPropertyName(first), state);
            const setter = getEmbeddedAccessor(type, false, state.setter, state.namingStrategy, first, embedded);
            state.addCode(executeTemplates(state.fork(setter, new ContainerAccessor(state.accessor, name)), first.type));
        } else {
            const lines: string[] = [];

            let pre = '';
            let post = '';
            let container = '';
            if (!(state.setter instanceof ContainerAccessor)) {
                //create own container
                container = state.compilerContext.reserveName('container');
                pre = `let ${container} = {}`;
                post = `${state.setter} = ${container}`;
            }

            for (const property of constructorProperties.properties) {
                const setter = getEmbeddedAccessor(type, true, state.setter, state.namingStrategy, property, embedded, container);
                lines.push(createConverterJSForMember(property, state.fork(setter, new ContainerAccessor(state.accessor, JSON.stringify(property.name)))));
            }

            state.addCode(`
                ${pre}
                ${lines.join('\n')}
                ${post}
            `);
        }
        return;
    }

    if (callExtractedFunctionIfAvailable(state, type)) return;
    const extract = extractStateToFunctionAndCallIt(state, type);
    state = extract.state;

    const v = state.compilerContext.reserveName('v');
    const lines: string[] = [];

    const signatures: TypeIndexSignature[] = [];
    const existing: string[] = [];

    for (const member of type.types) {
        if (member.kind === ReflectionKind.indexSignature) {
            if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;
            signatures.push(member);
        } else if (member.kind === ReflectionKind.propertySignature || member.kind === ReflectionKind.property) {
            if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;

            const name = getNameExpression(state.namingStrategy.getPropertyName(member), state);
            existing.push(name);

            const setter = new ContainerAccessor(v, name);
            const staticDefault = getStaticDefaultCodeForProperty(member, setter, state);

            const propertyState = state.fork(setter, new ContainerAccessor(state.accessor, name)).extendPath(String(member.name));

            if (hasEmbedded(member.type)) {
                lines.push(executeTemplates(propertyState, member.type));
            } else {
                lines.push(`
                if (${name} in ${state.accessor}) {
                    ${createConverterJSForMember(member, propertyState)}
                } else { ${staticDefault} }
            `);
            }
        }
    }

    if (signatures.length) {
        const i = state.compilerContext.reserveName('i');
        const existingCheck = existing.map(v => `${i} === ${v}`).join(' || ') || 'false';
        const signatureLines: string[] = [];

        sortSignatures(signatures);

        for (const signature of signatures) {
            signatureLines.push(`else if (${getIndexCheck(state, i, signature.index)}) {
                ${createConverterJSForMember(signature, state.fork(new ContainerAccessor(v, i), new ContainerAccessor(state.accessor, i)).extendPath(new RuntimeCode(i)))}
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

    state.addCode(`
        if ('object' !== typeof ${state.accessor}) ${state.throwCode(type)}
        let ${v} = {};
        ${lines.join('\n')}
        ${state.setter} = ${v};
    `);

    if (type.kind === ReflectionKind.class) {
        if (referenceAnnotation.hasAnnotations(type) && !state.isAnnotationHandled(referenceAnnotation)) {
            state.annotationHandled(referenceAnnotation);
            state.setContext({ isObject, isReference, isReferenceHydrated });
            const reflection = ReflectionClass.from(type.classType);
            //the primary key is serialised for unhydrated references
            state.replaceTemplate(`
            if (isReference(${state.accessor}) && !isReferenceHydrated(${state.accessor})) {
                ${executeTemplates(state.fork(state.setter, new ContainerAccessor(state.accessor, JSON.stringify(reflection.getPrimary().getName()))), reflection.getPrimary().getType())}
            } else {
                ${state.template}
            }
            `);
        }
    }

    extract.setFunction(buildFunction(state, type));
}

export function typeGuardEmbedded(type: TypeClass, state: TemplateState, embedded: EmbeddedOptions) {
    const constructorProperties = getConstructorProperties(type);
    if (constructorProperties.properties.length) {
        for (const parameter of constructorProperties.parameters) {
            if (parameter.kind === ReflectionKind.property) {
                //we pass 'data' as container, since type guards for TypeClass get their own function always and operate on `data` accessor.
                const accessor = getEmbeddedAccessor(type, constructorProperties.properties.length !== 1, state.accessor, state.namingStrategy, parameter, embedded);
                const propertyState = state.fork(state.setter, accessor).extendPath(String(parameter.name));
                if (hasEmbedded(parameter.type)) {
                    state.addCode(executeTemplates(propertyState, parameter.type));
                } else {
                    if (accessor instanceof ContainerAccessor) {
                        state.addCode(`if (${inAccessor(accessor)}) {${createConverterJSForMember(parameter, propertyState)} }`);
                    } else {
                        state.addCode(createConverterJSForMember(parameter, propertyState));
                    }
                }
            }
        }
    }
}

export function typeGuardObjectLiteral(type: TypeObjectLiteral | TypeClass, state: TemplateState) {
    //this function is used for both, serialize and deserialization. When serializing the type of `type` is strictly correct, so checking embedded fields would lead to wrong results.
    //this embedded check is only necessary when checking types in deserializing.
    if (type.kind === ReflectionKind.class && state.target === 'deserialize') {
        const embedded = embeddedAnnotation.getFirst(type);
        if (embedded) {
            typeGuardEmbedded(type, state, embedded);
            return;
        }
    }

    if (callExtractedFunctionIfAvailable(state, type)) return;
    const extract = extractStateToFunctionAndCallIt(state, type);
    state = extract.state;

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

            const name = member.kind === ReflectionKind.methodSignature || member.kind === ReflectionKind.method
                ? getNameExpression(member.name, state)
                : getNameExpression(state.namingStrategy.getPropertyName(member), state);

            const propertyAccessor = new ContainerAccessor(state.accessor, name);
            const propertyState = state.fork(v, propertyAccessor).extendPath(String(member.name));

            const isEmbedded = member.kind === ReflectionKind.property || member.kind === ReflectionKind.propertySignature
                ? hasEmbedded(member.type) : undefined;

            if (isEmbedded && (member.kind === ReflectionKind.property || member.kind === ReflectionKind.propertySignature)) {
                lines.push(executeTemplates(propertyState, member.type));
            } else {
                const optionalCheck = member.optional ? `&& ${propertyAccessor} !== undefined` : '';
                existing.push(name);

                lines.push(`
                if (${v} ${optionalCheck}) {
                    ${executeTemplates(propertyState,
                    member.kind === ReflectionKind.methodSignature || member.kind === ReflectionKind.method
                        ? { kind: ReflectionKind.function, name: member.name, return: member.return, parameters: member.parameters }
                        : member.type
                )}
                }`);
            }
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

        for (const signature of signatures) {
            signatureLines.push(`else if (${getIndexCheck(state, i, signature.index)}) {
                ${executeTemplates(state.fork(v, new ContainerAccessor(state.accessor, i)).extendPath(new RuntimeCode(i)), signature.type)}
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

    let customValidatorCall = '';
    if (type.kind === ReflectionKind.class) {
        const reflection = ReflectionClass.from(type.classType);
        if (reflection.validationMethod) {
            const resVar = state.setVariable('validationResult');
            const method = state.setVariable('method', reflection.validationMethod);
            customValidatorCall = `
            if (${state.setter}) {
                ${resVar} = ${state.accessor}[${method}]();
                if (${resVar} && state.errors) state.errors.push(new ValidationFailedItem(${resVar}.path || ${collapsePath(state.path)}, ${resVar}.code, ${resVar}.message));
            }
            `;
        }
    }

    state.addCodeForSetter(`
        let ${v} = true;
        if (${state.accessor} && 'object' === typeof ${state.accessor}) {
            ${lines.join('\n')}
            ${state.setter} = ${v};
            ${customValidatorCall}
        } else {
            if (${state.validation}) ${state.assignValidationError('type', 'Not an object')}
            ${state.setter} = false;
        }
    `);

    extract.setFunction(buildFunction(state, type));
}

export function serializeArray(elementType: Type, state: TemplateState) {
    state.setContext({ isIterable });
    const v = state.compilerContext.reserveName('v');
    const i = state.compilerContext.reserveName('i');
    const item = state.compilerContext.reserveName('item');

    //we just use `a.length` to check whether its array-like, because Array.isArray() is way too slow.
    state.addCodeForSetter(`
         if (isIterable(${state.accessor})) {
            ${state.setter} = [];
            let ${i} = 0;
            for (const ${item} of ${state.accessor}) {
                let ${v};
                ${executeTemplates(state.fork(v, item).extendPath(new RuntimeCode(i)), elementType)}
                ${state.setter}.push(${v});
                ${i}++;
            }
         }
    `);
}

export function typeGuardArray(elementType: Type, state: TemplateState) {
    state.setContext({ isIterable });

    const v = state.compilerContext.reserveName('v');
    const i = state.compilerContext.reserveName('i');
    const item = state.compilerContext.reserveName('item');
    //we just use `a.length` to check whether its array-like, because Array.isArray() is way too slow.
    state.addCodeForSetter(`
         let ${v} = false;
         let ${i} = 0;
         if (isIterable(${state.accessor})) {
            for (const ${item} of ${state.accessor}) {
                ${executeTemplates(state.fork(v, item).extendPath(new RuntimeCode(i)), elementType)}
                if (!${v}) break;
                ${i}++;
            }
         } else if (${state.validation}) {
            ${state.assignValidationError('type', 'Not an array')}
         }
         ${state.setter} = ${v};
    `);
}

function serializeTuple(type: TypeTuple, state: TemplateState) {
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
                ${executeTemplates(state.fork(_, new ContainerAccessor(state.accessor, i)).extendPath(new RuntimeCode(i)), member.type.type)}
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
            ${executeTemplates(state.fork(_, new ContainerAccessor(state.accessor, i)).extendPath(new RuntimeCode(i)), member.type)}
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

function typeGuardTuple(type: TypeTuple, state: TemplateState) {
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
                ${executeTemplates(state.fork(v, new ContainerAccessor(state.accessor, i)).extendPath(new RuntimeCode(i)), member.type.type)}
                if (!${v}) {
                    break;
                }
            }
            `);
        } else {
            lines.push(`
            if (${v}) {
                ${executeTemplates(state.fork(v, new ContainerAccessor(state.accessor, i)).extendPath(new RuntimeCode(i)), member.type)}
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

function typeGuardClassMap(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 2) return;

    typeGuardArray(copyAndSetParent({
        kind: ReflectionKind.tuple, types: [
            { kind: ReflectionKind.tupleMember, parent: Object as any, type: type.arguments[0] },
            { kind: ReflectionKind.tupleMember, parent: Object as any, type: type.arguments[1] },
        ]
    }), state);
}

function typeGuardClassSet(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 1) return;

    typeGuardArray(type.arguments[0], state);
}

/**
 * Set is simply serialized as array.
 */
function deserializeTypeClassSet(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 1) return;

    serializeArray(type.arguments[0], state);
    state.addSetter(`new Set(${state.accessor})`);
}

/**
 * Set is simply serialized as array.
 */
function serializeTypeClassSet(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 1) return;

    serializeArray(type.arguments[0], state);
}

function deserializeTypeClassMap(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 2) return;
    serializeArray(copyAndSetParent({
        kind: ReflectionKind.tuple, types: [
            { kind: ReflectionKind.tupleMember, type: type.arguments[0] },
            { kind: ReflectionKind.tupleMember, type: type.arguments[1] },
        ]
    }), state);
    state.addSetter(`new Map(${state.accessor})`);
}

/**
 * Map is simply serialized as array of tuples.
 */
function serializeTypeClassMap(type: TypeClass, state: TemplateState) {
    if (!type.arguments || type.arguments.length !== 2) return;

    serializeArray(copyAndSetParent({
        kind: ReflectionKind.tuple, types: [
            { kind: ReflectionKind.tupleMember, type: type.arguments[0] },
            { kind: ReflectionKind.tupleMember, type: type.arguments[1] },
        ]
    }), state);
}

export function handleUnion(type: TypeUnion, state: TemplateState) {
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
    const lines: string[] = [];

    //since there are type guards that require to access the container (for example Embedded), its necessary to pass the container (if available) to the type guard function
    //and change accessor to point to `data` (argument of the type guard) + index name.
    const property = state.accessor instanceof ContainerAccessor ? `${state.accessor.property}` : 'undefined';
    const args = `${state.accessor instanceof ContainerAccessor ? state.accessor.container : state.accessor}, state, ${collapsePath(state.path)}, ${property}`;
    const accessor = state.accessor instanceof ContainerAccessor ? new ContainerAccessor('data', 'property') : 'data';

    const typeGuards = state.registry.serializer.typeGuards.getSortedTemplateRegistries();

    for (const [specificality, typeGuard] of typeGuards) {
        //loosely type guards are only used for deserialization
        if (state.target === 'serialize' && specificality < 1) continue;

        for (const t of type.types) {
            const fn = createTypeGuardFunction(t, state.fork(undefined, accessor).forRegistry(typeGuard).clearJit());
            if (!fn) continue;
            const guard = state.setVariable('guard' + t.kind, fn);
            const looseCheck = specificality <= 0 ? `state.loosely && ` : '';

            lines.push(`else if (${looseCheck}${guard}(${args})) {
                //type = ${ReflectionKind[t.kind]}, specificality=${specificality}
                ${executeTemplates(state.fullFork(), t)}
            }`);
        }
    }

    state.addCodeForSetter(`
        //type guard for union
        if (false) {} ${lines.join(' ')}
        else {
            ${state.assignValidationError('type', 'Invalid type')}
        }
    `);
}

export function getNameExpression(name: string | number | symbol | undefined, state: TemplateState): string {
    if (undefined === name) return 'undefined';
    if ('string' === typeof name || 'number' === typeof name) return JSON.stringify(name);
    return state.compilerContext.reserveConst(name, 'symbolName');
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

    clear() {
        this.registry = {};
        this.sorted = undefined;
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

    /**
     * @see register
     */
    registerClass(specificality: number, classType: ClassType, template: Template<TypeClass>) {
        this.getRegistry(specificality).registerClass(classType, template);
    }

    /**
     * @see register
     */
    registerBinary(specificality: number, template: Template<TypeClass>) {
        this.getRegistry(specificality).registerBinary(template);
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

    public name: string = 'json';

    constructor() {
        this.registerSerializers();
        this.registerTypeGuards();
        this.registerValidators();
    }

    protected registerValidators() {
    }

    clear() {
        this.serializeRegistry.clear();
        this.deserializeRegistry.clear();
        this.typeGuards.clear();
        this.validators.clear();
    }

    protected registerSerializers() {
        this.deserializeRegistry.register(ReflectionKind.any, (type, state) => state.addSetter(state.accessor));
        this.serializeRegistry.register(ReflectionKind.any, (type, state) => state.addSetter(state.accessor));

        this.deserializeRegistry.register(ReflectionKind.class, deserializeClass);
        this.serializeRegistry.register(ReflectionKind.class, serializeObjectLiteral);
        this.deserializeRegistry.register(ReflectionKind.objectLiteral, serializeObjectLiteral);
        this.serializeRegistry.register(ReflectionKind.objectLiteral, serializeObjectLiteral);

        this.deserializeRegistry.register(ReflectionKind.array, (type, state) => serializeArray(type.type, state));
        this.serializeRegistry.register(ReflectionKind.array, (type, state) => serializeArray(type.type, state));

        this.deserializeRegistry.register(ReflectionKind.tuple, serializeTuple);
        this.serializeRegistry.register(ReflectionKind.tuple, serializeTuple);

        this.deserializeRegistry.register(ReflectionKind.union, handleUnion);
        this.serializeRegistry.register(ReflectionKind.union, handleUnion);

        this.deserializeRegistry.register(ReflectionKind.literal, (type, state) => state.addSetter(state.setVariable('v', type.literal)));
        this.serializeRegistry.register(ReflectionKind.literal, (type, state) => state.addSetter(state.setVariable('v', type.literal)));

        this.serializeRegistry.register(ReflectionKind.undefined, (type, state) => state.addSetter(`null`));
        this.deserializeRegistry.register(ReflectionKind.undefined, (type, state) => state.addSetter(`undefined`));

        this.serializeRegistry.register(ReflectionKind.null, (type, state) => state.addSetter(`null`));
        this.deserializeRegistry.register(ReflectionKind.null, (type, state) => state.addSetter(`null`));

        this.serializeRegistry.register(ReflectionKind.bigint, (type, state) => state.addSetter(`${state.accessor}.toString()`));

        this.deserializeRegistry.registerClass(Date, (type, state) => state.addSetter(`new Date(${state.accessor})`));
        this.serializeRegistry.registerClass(Date, (type, state) => state.addSetter(`${state.accessor}.toJSON()`));

        this.serializeRegistry.register(ReflectionKind.string, (type, state) => state.addSetter(state.accessor));

        this.deserializeRegistry.register(ReflectionKind.string, (type, state) => {
            state.addSetter(`'string' !== typeof ${state.accessor} ? ${state.accessor}+'' : ${state.accessor}`);
        });

        this.deserializeRegistry.addDecorator(ReflectionKind.string, (type, state) => {
            if (uuidAnnotation.getFirst(type)) {
                const v = state.accessor;
                const check = `${v}.length === 36 && ${v}[23] === '-' && ${v}[18] === '-' && ${v}[13] === '-' && ${v}[8] === '-'`;
                state.addCode(`
                    if (!(${check})) ${state.throwCode(type, JSON.stringify('Not a UUID'))}
                `);
            } else if (mongoIdAnnotation.getFirst(type)) {
                const check = `${state.accessor}.length === 24`;
                state.addCode(`
                    if (!(${check})) ${state.throwCode(type, JSON.stringify('Not a MongoId (ObjectId)'))}
                `);
            }
        });

        this.serializeRegistry.register(ReflectionKind.templateLiteral, (type, state) => state.addSetter(state.accessor));
        this.deserializeRegistry.register(ReflectionKind.templateLiteral, (type, state) => {
            state.addSetter(`'string' !== typeof ${state.accessor} ? ${state.accessor}+'' : ${state.accessor}`);
        });

        this.serializeRegistry.register(ReflectionKind.boolean, (type, state) => state.addSetter(state.accessor));
        this.deserializeRegistry.register(ReflectionKind.boolean, (type, state) => {
            state.addSetter(`'boolean' !== typeof ${state.accessor} ? ${state.accessor} == 1 || ${state.accessor} == 'true' : ${state.accessor}`);
        });

        this.serializeRegistry.register(ReflectionKind.promise, (type, state) => executeTemplates(state, type.type));
        this.deserializeRegistry.register(ReflectionKind.promise, (type, state) => executeTemplates(state, type.type));

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

            state.addCodeForSetter(`if (isNaN(${state.accessor})) ${state.throwCode(type)}`);
        });

        //convert binary to base64 (instead of hex, important for primary key hash)
        this.serializeRegistry.registerBinary((type, state) => {
            if (type.classType === ArrayBuffer) {
                state.setContext({ arrayBufferToBase64 });
                state.addSetter(`arrayBufferToBase64(${state.accessor})`);
                return;
            }
            state.setContext({ typedArrayToBase64 });
            state.addSetter(`typedArrayToBase64(${state.accessor})`);
        });

        this.deserializeRegistry.registerBinary((type, state) => {
            if (type.classType === ArrayBuffer) {
                state.setContext({ base64ToArrayBuffer });
                state.addSetter(`${state.accessor} instanceof ArrayBuffer ? ${state.accessor} : base64ToArrayBuffer(${state.accessor})`);
                return;
            }

            state.setContext({ base64ToTypedArray });
            const typedArrayVar = state.setVariable('classType', type.classType);
            state.addSetter(`${state.accessor} instanceof ${typedArrayVar} ? ${state.accessor} : base64ToTypedArray(${state.accessor}, ${typedArrayVar})`);
        });

        this.serializeRegistry.registerClass(Set, serializeTypeClassSet);
        this.serializeRegistry.registerClass(Map, serializeTypeClassMap);

        this.deserializeRegistry.registerClass(Set, deserializeTypeClassSet);
        this.deserializeRegistry.registerClass(Map, deserializeTypeClassMap);
    }

    protected registerTypeGuards() {
        //if nothing else matches in a union, any matches anything
        this.typeGuards.register(20, ReflectionKind.any, (type, state) => state.addSetter('true'));

        this.typeGuards.register(1, ReflectionKind.objectLiteral, (type, state) => typeGuardObjectLiteral(type, state));
        this.typeGuards.register(1, ReflectionKind.class, (type, state) => typeGuardObjectLiteral(type, state));

        // //for deserialization type guards (specifically > 1) we check for embedded type sas well. this is because an embedded could have totally different field names.
        // //and only if the property (where the embedded is placed) has no strict type guard do we look for other fields as well.
        // this.typeGuards.register(2, ReflectionKind.class, (type, state) => typeCheckClassOrObjectLiteral(type, state, true));

        this.typeGuards.register(1, ReflectionKind.string, (type, state) => {
            state.addSetterAndReportErrorIfInvalid('type', 'Not a string', `'string' === typeof ${state.accessor}`);
        });
        this.typeGuards.getRegistry(1).addDecorator(ReflectionKind.string, (type, state) => {
            if (uuidAnnotation.getFirst(type)) {
                const v = state.originalAccessor;
                const check = `${state.setter} && ${v}.length === 36 && ${v}[23] === '-' && ${v}[18] === '-' && ${v}[13] === '-' && ${v}[8] === '-'`;
                state.addSetterAndReportErrorIfInvalid('type', 'Not a UUID', check);
            } else if (mongoIdAnnotation.getFirst(type)) {
                state.addSetterAndReportErrorIfInvalid('type', 'Not a MongoId (ObjectId)', `${state.setter} && ${state.originalAccessor}.length === 24`);
            }
        });
        this.typeGuards.register(50, ReflectionKind.string, (type, state) => state.addSetter(`true`)); //at the end, everything can be converted to string

        this.typeGuards.register(1, ReflectionKind.templateLiteral, (type, state) => {
            state.setContext({ extendTemplateLiteral: extendTemplateLiteral });
            const typeVar = state.setVariable('type', type);
            state.addSetterAndReportErrorIfInvalid('type', 'Invalid literal', `'string' === typeof ${state.accessor} && extendTemplateLiteral({kind: ${ReflectionKind.literal}, literal: ${state.accessor}}, ${typeVar})`);
        });

        this.typeGuards.register(1, ReflectionKind.undefined, (type, state) => state.addSetterAndReportErrorIfInvalid('type', 'Not undefined', `'undefined' === typeof ${state.accessor}`));
        this.typeGuards.register(2, ReflectionKind.undefined, (type, state) => state.addSetter(`null === ${state.accessor}`));

        this.typeGuards.register(1, ReflectionKind.null, (type, state) => state.addSetterAndReportErrorIfInvalid('type', 'Not null', `null === ${state.accessor}`));
        this.typeGuards.register(2, ReflectionKind.null, (type, state) => state.addSetter(`'undefined' === typeof ${state.accessor}`));


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

        this.typeGuards.register(1, ReflectionKind.promise, (type, state) => executeTemplates(state, type.type));
        this.typeGuards.register(1, ReflectionKind.enum, (type, state) => {
            const values = state.setVariable('values', type.values);
            state.addSetterAndReportErrorIfInvalid('type', 'Invalid enum member', `${values}.indexOf(${state.accessor}) >= 0`);
        });
        this.typeGuards.register(1, ReflectionKind.array, (type, state) => typeGuardArray(type.type, state));
        this.typeGuards.register(1, ReflectionKind.tuple, typeGuardTuple);
        this.typeGuards.register(1, ReflectionKind.literal, (type, state) => {
            const v = state.setVariable('v', type.literal);
            state.addSetterAndReportErrorIfInvalid('type', 'Invalid literal', `${v} === ${state.accessor}`);
        });

        this.typeGuards.register(1, ReflectionKind.regexp, ((type, state) => state.addSetterAndReportErrorIfInvalid('type', 'Not a RegExp', `${state.accessor} instanceof RegExp`)));
        this.typeGuards.register(2, ReflectionKind.regexp, ((type, state) => state.addSetter(`'string' === typeof ${state.accessor}`)));
        this.typeGuards.register(0.5, ReflectionKind.regexp, ((type, state) => state.addSetter(`'string' === typeof ${state.accessor} && ${state.accessor}[0] === '/'`)));


        this.typeGuards.getRegistry(1).registerClass(Set, typeGuardClassSet);
        this.typeGuards.getRegistry(1).registerClass(Map, typeGuardClassMap);
        this.typeGuards.getRegistry(1).registerClass(Date, (type, state) => state.addSetter(`${state.accessor} instanceof Date`));
        this.typeGuards.getRegistry(0.5).registerClass(Date, (type, state) => {
            const date = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z$/;
            state.setContext({ date });
            state.addSetter(`'string' === typeof ${state.accessor} && date.exec(${state.accessor}) !== null`);
        });

        //if no type is found (>1), date supports also numbers
        this.typeGuards.getRegistry(1.5).registerClass(Date, (type, state) => {
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
                        ${state.setter} = true;
                    }
                } else {
                    if (${state.validation}) ${state.assignValidationError('type', 'Not a function')}
                    ${state.setter} = false;
                }
            `);
        }));

        this.typeGuards.register(1, ReflectionKind.regexp, (type, state) => state.addSetter(`${state.accessor} instanceof RegExp`));
        this.typeGuards.register(2, ReflectionKind.regexp, (type, state) => state.addSetter(`'string' === typeof ${state.accessor}`));
        this.typeGuards.getRegistry(1).addPostHook((type: Type, state: TemplateState) => {
            for (const validation of validationAnnotation.getAnnotations(type)) {
                const name = validation.name;
                const args = validation.args;

                if (name === 'function') {
                    state.setContext({ ValidationFailedItem });
                    const validatorVar = state.setVariable('validator', (args[0] as TypeFunction).function);
                    state.addCode(`
                        {
                            let error = ${validatorVar}(${state.originalAccessor});
                            if (error) {
                                ${state.setter} = false;
                                if (state.errors) state.errors.push(new ValidationFailedItem(${collapsePath(state.path)}, error.code, error.message));
                            }
                        }
                    `);
                } else {
                    const validator = validators[name];
                    if (validator) {
                        state.setContext({ ValidationFailedItem });
                        const validatorVar = state.setVariable('validator', validator(...args));
                        state.addCode(`
                            {
                                let error = ${validatorVar}(${state.originalAccessor});
                                if (error) {
                                    ${state.setter} = false;
                                    if (state.errors) state.errors.push(new ValidationFailedItem(${collapsePath(state.path)}, error.code, error.message));
                                }
                            }
                        `);
                    }
                }
            }
        });

        this.typeGuards.register(1, ReflectionKind.union, handleUnion);
        this.typeGuards.registerBinary(1, (type, state) => {
            state.addSetter(`${state.accessor} instanceof ${state.setVariable('classType', type.classType)}`);
        });
        this.typeGuards.registerBinary(10, (type, state) => {
            state.addSetter(`'string' === typeof ${state.accessor}`);
        });
    }
}

export class EmptySerializer extends Serializer {
    protected registerValidators() {
    }

    protected registerSerializers() {
    }

    protected registerTypeGuards() {
    }
}

export const serializer: Serializer = new Serializer();
