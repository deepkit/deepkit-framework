/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, eachKey, eachPair, getClassName, isClass, isConstructable, isFunction, isObject, isPlainObject, toFastProperties } from '@deepkit/core';
import { isArray } from './utils';
import { extractMethod } from './code-parser';
import getParameterNames from 'get-parameter-names';
import { typedArrayMap, typedArrayNamesMap, Types } from './types';
import { FieldDecoratorResult } from './field-decorator';
import { ExtractClassDefinition, PlainSchemaProps, t } from './decorators';

export enum UnpopulatedCheck {
    None,
    Throw, //throws regular error
    ReturnSymbol, //returns `unpopulatedSymbol`
}

export interface GlobalStore {
    RegisteredEntities: { [name: string]: ClassType | ClassSchema };
    unpopulatedCheck: UnpopulatedCheck;
    /**
     * Per default, @deepkit/types tries to detect forward-ref by checking the type in the metadata or given in @t.type(x) to be a function.
     * If so, we treat it as a forwardRef. This does not work for ES5 fake-classes, since everything there is a function.
     * Disable this feature flag to support IE11.
     */
    enableForwardRefDetection: boolean;
}

const global: GlobalStore = {
    RegisteredEntities: {},
    unpopulatedCheck: UnpopulatedCheck.Throw,
    enableForwardRefDetection: true,
};

export function getGlobalStore(): GlobalStore {
    return global;
}

export function resolveClassTypeOrForward(type: ClassType | ForwardRefFn<ClassType>): ClassType {
    return isFunction(type) ? (type as Function)() : type;
}

export type ReferenceActions = 'RESTRICT' | 'NO ACTION' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';

export interface BackReferenceOptions<T> {
    /**
     * Necessary for normalised many-to-many relations. This defines the class of the pivot table/collection.
     */
    via?: ClassType | ForwardRefFn<ClassType>,

    /**
     * A reference/backReference can define which reference on the other side
     * reference back. This is necessary when multiple outgoing references
     * to the same
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


export interface PropertySchemaSerialized {
    name: string;
    type: Types;
    literalValue?: string | number | boolean;
    isDecorated?: true;
    isParentReference?: true;
    isOptional?: true;
    isId?: true;
    typeSet?: true;
    isDiscriminant?: true;
    allowLabelsAsValue?: true;
    methodName?: string;
    groupNames?: string[];
    templateArgs?: PropertySchemaSerialized[];
    classType?: string;
    classTypeName?: string; //the getClassName() when the given classType is not registered using a @entity.name
    noValidation?: boolean;
}

export interface PropertyValidator {
    /**
     * @throws PropertyValidatorError when validation invalid
     */
    validate<T>(value: any, propertyName: string, classType?: ClassType,): void;
}

export function isPropertyValidator(object: any): object is ClassType<PropertyValidator> {
    return isClass(object);
}

export type FieldTypes<T> = string | ClassType | ForwardRefFn<T>;

export type ForwardRefFn<T> = ForwardRef<T> | (() => T);

export class ForwardRef<T> {
    constructor(public forwardRef: () => T) {
    }
}

export function forwardRef<T>(forwardRef: () => T): ForwardRef<T> {
    return new ForwardRef(forwardRef);
}

function resolveForwardRef<T>(forwardRef: ForwardRefFn<T>): T | undefined {
    if (forwardRef instanceof ForwardRef) {
        return forwardRef.forwardRef();
    } else {
        try {
            return forwardRef();
        } catch { return undefined; }
    }
}

export const unpopulatedSymbol = Symbol('unpopulated');

/**
 * Returns the ClassType for a given instance.
 */
export function getClassTypeFromInstance<T>(target: T): ClassType<T> {
    if (!isClassInstance(target)) {
        throw new Error('Target does not seem to be a class instance.');
    }

    return (target as any)['constructor'] as ClassType<T>;
}

/**
 * Returns true when target is a class instance.
 */
export function isClassInstance(target: any): boolean {
    return target
        && target['constructor']
        && Object.getPrototypeOf(target) === (target as any)['constructor'].prototype
        && !isPlainObject(target)
        && isObject(target);
}

/**
 * Returns true if given class has an @entity() or @t defined, and thus became
 * a deepkit/type entity.
 */
export function isRegisteredEntity<T>(classType: ClassType<T>): boolean {
    return classType.prototype.hasOwnProperty(classSchemaSymbol);
}

/**
 * Represents a class property or method argument/return-type definition.
 */
export class PropertySchema {
    /**
     * Returns true when user manually set a default value via PropertySchema/decorator.
     */
    hasManualDefaultValue(): boolean {
        return !this.hasDefaultValue && this.defaultValue !== undefined;
    }

    hasCircularDependency(lookingFor: ClassSchema, classSchemaStack: ClassSchema[] = [], propertyStack: PropertySchema[] = []): boolean {
        if (this.isParentReference) return false;

        if (this.type === 'class') {
            const s = getClassSchema(this.resolveClassType!);
            return s === lookingFor || s.hasCircularDependency(lookingFor, classSchemaStack);
        }

        if (propertyStack.includes(this)) return true;
        propertyStack.push(this);

        for (const arg of this.templateArgs) {
            if (arg.hasCircularDependency(lookingFor, classSchemaStack, propertyStack)) return true;
        }

        return false;
    }

    /**
     * Returns true when `undefined` or a missing value is allowed.
     * This is now only true when `optional` is set, but alos when type is `any`,
     * or when the property has an actual default value (then a undefined value sets the default value instead).
     */
    public isUndefinedAllowed(): boolean {
        return this.isOptional || this.type === 'any' || this.hasManualDefaultValue() || this.hasDefaultValue;
    }

    type: Types = 'any';

    literalValue?: string | number | boolean;

    noValidation: boolean = false;

    /**
     * Object to store JIT function for this schema.
     */
    jit: any = {};

    get isArray() {
        return this.type === 'array';
    }

    get isMap() {
        return this.type === 'map';
    }

    get isPatch() {
        return this.type === 'partial';
    }

    get isPartial() {
        return this.type === 'partial';
    }

    get isTypedArray(): boolean {
        return typedArrayNamesMap.has(this.type);
    }

    groupNames: string[] = [];

    /**
     * Whether given classType can be populated partially (for example in patch mechanisms).
     */

    isOptional: boolean = false;
    isNullable: boolean = false;

    isDiscriminant: boolean = false;

    //for enums
    allowLabelsAsValue: boolean = false;

    isParentReference: boolean = false;

    validators: ClassType<PropertyValidator>[] = [];

    /**
     * Whether its a owning reference.
     */
    isReference: boolean = false;

    referenceOptions: { onDelete: ReferenceActions, onUpdate: ReferenceActions } = {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    };

    /**
     * When the constructor sets a default value.
     */
    hasDefaultValue: boolean = false;

    /**
     * The detected default value OR manual set default value.
     */
    defaultValue: any;

    templateArgs: PropertySchema[] = [];

    /**
     * The getClassName() when the given classType is not registered using a @entity.name
     * Only used when PropertySchema.toJSON/PropertySchema.fromJSON operating on a classType that has no name.
     */
    classTypeName?: string;

    classType?: ClassType;

    /**
     * Whether its a back reference.
     */
    backReference?: BackReferenceOptions<any>;

    /**
     * Whether its a foreign key from a owning reference.
     */
    isReferenceKey: boolean = false;

    index?: IndexOptions;

    /**
     * Used in decorator to check whether type has been set already.
     */
    typeSet: boolean = false;

    /**
     * Whether this property is decorated.
     */
    isDecorated: boolean = false;

    isId: boolean = false;

    isAutoIncrement: boolean = false;

    symbol = Symbol(this.name);

    /**
     * Custom user data.
     */
    data: { [name: string]: any } = {};

    /**
     * When this property belongs to method as argument then this contains the name of the method.
     */
    methodName?: string;

    exclude?: 'all' | 'plain' | string;

    protected classTypeForwardRef?: ForwardRefFn<any>;
    protected classTypeResolved?: ClassType;

    description: string = '';

    constructor(public name: string, public parent?: PropertySchema) {
    }

    setType(type: Types) {
        this.type = type;
        this.typeSet = true;
    }

    toString(): string {
        let affix = this.isOptional ? '?' : '';
        if (!this.typeSet) return 'undefined';
        if (this.isNullable) affix += '|null';

        if (this.type === 'array') {
            return `Array<${this.templateArgs[0]}>${affix}`;
        }
        if (this.type === 'map') {
            return `Map<${this.templateArgs[0]}, ${this.templateArgs[1]}>${affix}`;
        }
        if (this.type === 'partial') {
            return `Partial<${this.templateArgs[0]}>${affix}`;
        }
        if (this.type === 'union') {
            return this.templateArgs.map(v => v.toString()).join(' | ') + affix;
        }
        if (this.type === 'class') {
            if (this.classTypeName) return this.classTypeName + affix;
            if (this.classTypeForwardRef) {
                const resolved = resolveForwardRef(this.classTypeForwardRef);
                if (resolved) return getClassName(resolved) + affix;
                return 'ForwardedRef' + affix;
            } else {
                return getClassName(this.getResolvedClassType()) + affix;
            }
        }
        return `${this.type}${affix}`;
    }

    getSubType(): PropertySchema {
        if (this.type === 'partial') return this.templateArgs[0]!;
        if (this.type === 'array') return this.templateArgs[0]!;
        if (this.type === 'map') return this.templateArgs[1]!;
        throw new Error('No array or map type');
    }

    setClassType(classType?: ClassType) {
        this.classType = classType;
    }

    toJSON(): PropertySchemaSerialized {
        const props: PropertySchemaSerialized = {
            name: this.name,
            type: this.type
        };

        if (this.literalValue !== undefined) props['literalValue'] = this.literalValue;
        if (this.isDecorated) props['isDecorated'] = true;
        if (this.isDiscriminant) props['isDiscriminant'] = true;
        if (this.isParentReference) props['isParentReference'] = true;
        if (this.isOptional) props['isOptional'] = true;
        if (this.isId) props['isId'] = true;
        if (this.allowLabelsAsValue) props['allowLabelsAsValue'] = true;
        if (this.typeSet) props['typeSet'] = true;
        if (this.methodName) props['methodName'] = this.methodName;
        if (this.groupNames.length) props['groupNames'] = this.groupNames;
        props['noValidation'] = this.noValidation;

        if (this.templateArgs.length) {
            props['templateArgs'] = this.templateArgs.map(v => v.toJSON());
        }

        const resolved = this.getResolvedClassTypeForValidType();
        if (resolved) {
            const name = getClassSchema(resolved).name;
            if (!name) {
                props['classTypeName'] = getClassName(resolved);
            } else {
                props['classType'] = name;

            }
        }

        return props;
    }

    static fromJSON(props: PropertySchemaSerialized, parent?: PropertySchema): PropertySchema {
        const p = new PropertySchema(props['name']);
        p.type = props['type'];
        p.literalValue = props['literalValue'];

        if (props['isDecorated']) p.isDecorated = true;
        if (props['isParentReference']) p.isParentReference = true;
        if (props['isDiscriminant']) p.isDiscriminant = true;
        if (props['isOptional']) p.isOptional = true;
        if (props['isId']) p.isId = true;
        if (props['allowLabelsAsValue']) p.allowLabelsAsValue = true;
        if (props['typeSet']) p.typeSet = true;
        if (props['methodName']) p.methodName = props['methodName'];
        if (props['groupNames']) p.groupNames = props['groupNames'];
        if (props['noValidation']) p.noValidation = props['noValidation'];

        if (props['templateArgs']) {
            p.templateArgs = props['templateArgs'].map(v => PropertySchema.fromJSON(v, p));
        }

        if (props['classType']) {
            const entity = getGlobalStore().RegisteredEntities[props['classType']];
            if (!entity) {
                throw new Error(`Could not unserialize type information for ${p.methodName || ''}:${p.name}, got entity name ${props['classType']}. ` +
                    `Make sure given entity is loaded (imported at least once globally) and correctly annoated using @entity.name()`);
            }
            p.classType = getClassSchema(entity).classType;
        }
        p.classTypeName = props['classTypeName'];

        return p;
    }

    static getTypeFromJSType(type: any): Types {
        if (type && typedArrayMap.has(type)) {
            return typedArrayMap.get(type)!;
        }

        return 'any';
    }

    setFromJSValue(value: any) {
        if (value === undefined || value === null) return;

        this.setFromJSType(value.constructor);
    }

    setFromJSType(type: any, detectForwardRef = getGlobalStore().enableForwardRefDetection) {
        if (type === undefined || type === null) return;

        this.type = PropertySchema.getTypeFromJSType(type);
        this.typeSet = this.type !== 'any';

        if (type === Array) {
            //array doesnt have any other options, so we only know its an array
            //of any type
            this.type = 'array';
            this.typeSet = true;
            this.templateArgs[0] = new PropertySchema('0', this);
            return;
        }

        const isCustomObject = !typedArrayMap.has(type)
            && type !== 'any'
            && type !== Array
            && type !== Object
            ;

        if (isCustomObject) {
            this.type = 'class';
            this.classType = type as ClassType;

            if (detectForwardRef && isFunction(type) && !isConstructable(type)) {
                this.classTypeForwardRef = type;
                this.classType = undefined;
            }

            if (type instanceof ForwardRef) {
                this.classTypeForwardRef = type;
                this.classType = undefined;
            }
            this.typeSet = true;
        }
    }

    /**
     * Internal note: for multi pk support, this will return a string[] in the future.
     */
    getForeignKeyName(): string {
        //we stop using capitalizeFirstLetter(this.getResolvedClassSchema().getPrimaryField().name)
        //because that making things easier in the class:mongo compiler templates
        return this.name;
    }

    getResolvedClassSchema(): ClassSchema {
        return getClassSchema(this.getResolvedClassType());
    }

    clone(): PropertySchema {
        const s = new PropertySchema(this.name, this.parent);
        for (const i of eachKey(this)) {
            (s as any)[i] = (this as any)[i];
        }
        s.classTypeResolved = undefined;
        return s;
    }

    public getTemplateArg(position: number): PropertySchema | undefined {
        return this.templateArgs ? this.templateArgs[position] : undefined;
    }

    get resolveClassType(): ClassType | undefined {
        if (this.type === 'class' || this.type === 'enum') {
            return this.getResolvedClassType();
        }
        return;
    }

    getResolvedClassTypeForValidType(): ClassType | undefined {
        if (this.type === 'class' || this.type === 'enum') {
            return this.getResolvedClassType();
        }

        return;
    }

    isResolvedClassTypeIsDecorated(): boolean {
        if (this.type === 'class') {
            const foreignSchema = getClassSchema(this.getResolvedClassType());
            return Boolean(foreignSchema.decorator);
        }

        return false;
    }

    getResolvedClassType(): ClassType {
        if (this.isArray || this.isMap || this.isPartial) return this.getSubType().getResolvedClassType();

        if (this.classTypeResolved) {
            return this.classTypeResolved;
        }

        if (this.classTypeForwardRef) {
            this.classTypeResolved = resolveForwardRef(this.classTypeForwardRef);
            if (this.classTypeResolved) {
                return this.classTypeResolved;
            }
            throw new Error(`ForwardRef returns no value for field ${this.name}`);
        }

        if (!this.classType || isArray(this.classType)) {
            throw new Error(`No ClassType given for field ${this.name}. Use @t.type(() => MyClass) for circular dependencies. Did you \`import 'reflect-metadata'\` in your root script?`);
        }

        return this.classType;
    }
}

export interface EntityIndex {
    fields: string[],
    options: IndexOptions
}

export class ClassSchema<T = any> {
    /**
     * The build id. When a property is added, this buildId changes, so JIT compiler knows when to refresh
     * its cache.
     */
    buildId: number = 0;

    classType: ClassType<T>;
    name?: string;
    description?: string;
    collectionName?: string;
    databaseSchemaName?: string;

    /**
     * Name of the property which this class is decorating.
     * As soon as someone use this class, the actual value of this property is used to serialize.
     */
    decorator?: string;

    /**
     * Name of the property that is a discriminant of this class.
     * This is automatically set when at least one property has @t.discriminant.
     */
    discriminant?: string;

    /**
     * Each method can have its own PropertySchema definition for each argument, where map key = method name.
     */
    protected methodProperties = new Map<string, PropertySchema[]>();
    methods: { [name: string]: PropertySchema } = {};

    /**
     * Object to store JIT function for this schema. This object is automatically cleared once the schema changes (added property for example).
     */
    jit: any = {};

    /**
     * Arbitrary data container to assign additional data to a schema.
     */
    data: { [key: string]: any } = {};

    symbol = Symbol('ClassSchema');

    /**
     * @internal
     */
    protected initializedMethods = new Set<string>();

    protected classProperties = new Map<string, PropertySchema>();

    idField?: keyof T & string;

    propertyNames: string[] = [];

    protected methodsParamNames = new Map<string, string[]>();
    protected methodsParamNamesAutoResolved = new Map<string, string[]>();

    indices = new Map<string, EntityIndex>();

    /**
     * Contains all references, owning reference and back references.
     */
    public readonly references = new Set<PropertySchema>();

    protected referenceInitialized = false;

    protected primaryKeys?: PropertySchema[];
    protected autoIncrements?: PropertySchema[];

    onLoad: { methodName: string, options: { fullLoad?: boolean } }[] = [];
    protected hasFullLoadHooksCheck = false;

    private detectedDefaultValueProperties: string[] = [];

    constructor(classType: ClassType) {
        this.classType = classType;

        this.loadDefaults();
    }

    /**
     * Whether this schema annotated an actual custom class.
    */
    public isCustomClass(): boolean {
        return (this.classType as any) !== Object;
    }

    toString() {
        return `<ClassSchema ${this.getClassName()}>\n` + [...this.getClassProperties().values()].map(v => '   ' + v.name + '=' + v.toString()).join('\n') + '\n</ClassSchema>';
    }

    /**
     * To not force the user to always annotate `.optional` to properties that
     * are actually optional (properties with default values),
     * we automatically read the code of the constructor and check if which properties
     * are actually optional. If we find an assignment, we assume it has a default value,
     * and set property.hasDefaultValue = true;
     */
    protected loadDefaults() {
        const originCode = this.classType.toString();

        const constructorCode = originCode.startsWith('class') ? extractMethod(originCode, 'constructor') : originCode;

        const findAssignment = RegExp(String.raw`this\.([^ \t\.=]+)[^=]*=([^ \n\t;]+)?`, 'g');
        let match: any;

        while ((match = findAssignment.exec(constructorCode)) !== null) {
            const lname = match[1];
            const rname = match[2];
            if (lname === rname) {
                //its a `this.name=name` assignment, very likely to be a direct construct dependency
                //so it's not per-se optional. If it's optional it can be marked as once later on.
                continue;
            }
            this.detectedDefaultValueProperties.push(lname);
        }
    }

    getCollectionName(): string {
        const name = this.collectionName || this.name;
        if (!name) throw new Error(`No entity name set for ${this.getClassName()}`);
        return name;
    }

    public getClassPropertyName(name: string): string {
        return this.getClassName() + '.' + name;
    }

    public getName(): string {
        if (!this.name) throw new Error(`Class ${this.getClassName()} has no entity name set`);

        return this.name;
    }

    public getClassName(): string {
        return getClassName(this.classType);
    }

    getJit(symbol: symbol | string, generator: (classSchema: ClassSchema) => any) {
        let jit = this.jit[symbol];
        if (jit !== undefined) return jit;

        jit = generator(this);
        this.jit[symbol] = jit;
        toFastProperties(this.jit);
        return jit;
    }

    hasFullLoadHooks(): boolean {
        if (this.hasFullLoadHooksCheck) return false;
        this.hasFullLoadHooksCheck = true;
        for (const prop of this.classProperties.values()) {
            if (prop.type === 'class' && prop.getResolvedClassSchema().hasFullLoadHooks()) {
                return true;
            }
        }
        this.hasFullLoadHooksCheck = false;

        return !!this.onLoad.find(v => !!v.options.fullLoad);
    }


    /**
     * Whether a (deep) property references this schema again. Some validation/serialization code
     * needs to add additional check to avoid an call stack overflow.
     */
    public hasCircularDependency(lookingFor?: ClassSchema, stack: ClassSchema[] = []): boolean {
        lookingFor = lookingFor || this;
        if (stack.includes(this)) return true;
        stack.push(this);

        for (const property of this.getClassProperties().values()) {
            if (property.isParentReference) continue;
            if (property.hasCircularDependency(lookingFor, stack)) return true;
        }

        return false;
    }

    public addIndex(fieldNames: (keyof T & string)[], name?: string, options?: IndexOptions) {
        name = name || fieldNames.join('_');
        this.indices.set(name, { fields: fieldNames, options: options || {} });
    }

    public clone(classType?: ClassType): ClassSchema {
        classType ||= class {};
        const s = new ClassSchema(classType);
        classType.prototype[classSchemaSymbol] = s;
        s.name = this.name;
        s.name = this.name;
        s.collectionName = this.collectionName;
        s.databaseSchemaName = this.databaseSchemaName;
        s.decorator = this.decorator;
        s.discriminant = this.discriminant;

        s.classProperties = new Map();
        for (const [i, v] of this.classProperties.entries()) {
            s.classProperties.set(i, v.clone());
        }

        s.methodProperties = new Map();
        for (const [i, properties] of this.methodProperties.entries()) {
            const obj: PropertySchema[] = [];
            for (const v of properties) {
                obj.push(v.clone());
            }
            s.methodProperties.set(i, obj);
        }

        s.idField = this.idField;
        s.propertyNames = this.propertyNames.slice(0);
        s.methodsParamNames = new Map<string, string[]>();
        s.methodsParamNamesAutoResolved = new Map<string, string[]>();
        for (const [m, p] of this.methodsParamNames.entries()) s.methodsParamNames.set(m, p.slice(0));
        for (const [m, p] of this.methodsParamNamesAutoResolved.entries()) s.methodsParamNamesAutoResolved.set(m, p.slice(0));

        s.indices = new Map;
        for (const [name, v] of this.indices.entries()) {
            s.indices.set(name, { ...v });
        }

        s.onLoad = [];
        for (const v of this.onLoad) {
            s.onLoad.push({ ...v });
        }
        return s;
    }

    /**
     * Adds dynamically new properties to the class schema definition.
     * Use the `f` decorator as you already do at the class directly.
     *
     * Note: Once a transform method is called like plainToClass/classToPlain etc
     * this method has no effect anymore since compiler templates are then already built.
     * So make sure to call this addProperty() before calling transform methods.
     *
     * @example
     * ```typescript
     * const schema = getClassSchema(MyClass);
     * //or
     * const schema = createClassSchema(MyClass);
     *
     * schema.addProperty('fieldName', f.string);
     * ```
     */
    public addProperty(name: string, decorator: FieldDecoratorResult<any>) {
        //apply decorator, which adds properties automatically
        decorator(this.classType, name);
        this.resetCache();
    }

    public registerProperty(property: PropertySchema) {
        if (!property.methodName && this.detectedDefaultValueProperties.includes(property.name)) {
            property.hasDefaultValue = true;
        }

        this.propertyNames.push(property.name);
        this.classProperties.set(property.name, property);
    }

    protected resetCache() {
        this.jit = {};
        this.getClassProperties();
        this.primaryKeys = undefined;
        this.autoIncrements = undefined;
        this.buildId++;
    }

    /**
     * Adds dynamically new properties to the class schema definition.
     * Use the `f` decorator as you already do at the class directly.
     *
     * Note: Once a transform method is called like plainToClass/classToPlain etc
     * this method has no effect anymore since compiler templates are then already built.
     * So make sure to call this addMethodProperty() before calling transform methods.
     *
     * @example
     * ```typescript
     * const schema = getClassSchema(MyClass);
     * //or
     * const schema = createClassSchema(MyClass);
     *
     * schema.addMethodProperty('constructor', 0, f.type(String));
     * schema.addMethodProperty('constructor', 1, f.type(String));
     *
     * schema.addMethodProperty('myMethod', 0, f.type(String));
     * ```
     */
    public addMethodProperty(name: string, position: number, decorator: FieldDecoratorResult<any>) {
        decorator(this.classType, name, position);
        this.buildId++;
    }

    /**
     * Returns all annotated arguments as PropertSchema for given method name.
     */
    public getMethodProperties(name: string): PropertySchema[] {
        this.initializeMethod(name);

        return this.methodProperties.get(name) || [];
    }

    public getMethod(name: string): PropertySchema {
        this.initializeMethod(name);

        return this.methods[name];
    }

    /**
     * Internal note: for multi pk support, this will return a PropertySchema[] in the future.
     */
    public getPrimaryField(): PropertySchema {
        if (!this.idField) {
            throw new Error(`Class ${getClassName(this.classType)} has no primary field. Use @t.primary to define one.`);
        }

        return this.getProperty(this.idField);
    }

    public getAutoIncrementField(): PropertySchema | undefined {
        for (const property of this.getClassProperties().values()) {
            if (property.isAutoIncrement) return property;
        }
        return;
    }

    public hasPrimaryFields() {
        if (!this.primaryKeys) this.getPrimaryFields();
        return this.primaryKeys!.length > 0;
    }

    public getPrimaryFields(): PropertySchema[] {
        if (this.primaryKeys) return this.primaryKeys;

        this.primaryKeys = [];
        for (const property of this.getClassProperties().values()) {
            if (property.isId) this.primaryKeys.push(property);
        }

        return this.primaryKeys;
    }

    /**
     * Returns true if the method got a @f decorator.
     */
    public hasMethod(name: string): boolean {
        return !!this.methods[name];
    }

    public registerReference(property: PropertySchema) {
        this.references.add(property);
    }

    public isSchemaOf(classTypeOrSchema: ClassType | ClassSchema): boolean {
        const classSchema = getClassSchema(classTypeOrSchema);
        if (this === classSchema) return true;
        if (classSchema.classType) {
            let currentProto = Object.getPrototypeOf(this.classType.prototype);
            while (currentProto && currentProto !== Object.prototype) {
                if (getClassSchema(currentProto) === classSchema) return true;
                currentProto = Object.getPrototypeOf(currentProto);
            }
        }

        return false;
    }

    public exclude<K extends (keyof T & string)[]>(...properties: K): ClassSchema<Omit<T, K[number]>> {
        const cloned = this.clone();
        for (const name of properties) cloned.classProperties.delete(name);
        return cloned as any;
    }

    public extend<E extends PlainSchemaProps>(props: E, options?: { name?: string, classType?: ClassType }): ClassSchema<T & ExtractClassDefinition<E>> {
        const cloned = this.clone();
        const schema = t.schema(props);
        for (const property of schema.getClassProperties().values()) {
            cloned.registerProperty(property);
        }
        return cloned as any;
    }

    protected initializeMethod(name: string) {
        if (!this.initializedMethods.has(name)) {
            if (name !== 'constructor' && (!Reflect.getMetadata || !Reflect.hasMetadata('design:returntype', this.classType.prototype, name))) {
                throw new Error(`Method ${this.getClassPropertyName(name)} has no decorators used or is not defined, so reflection does not work. Use @t on the method or arguments. Is emitDecoratorMetadata enabled? Correctly 'reflect-metadata' imported? Return type annotated?`);
            }

            if (name !== 'constructor' && !this.methods[name]) {
                const returnType = Reflect.getMetadata && Reflect.getMetadata('design:returntype', this.classType.prototype, name);
                if (returnType !== Promise) {
                    //Promise is not a legit returnType as this is automatically the case for async functions
                    //we assume no meta data is given when Promise is defined, as it basically tells us nothing.
                    this.methods[name] = new PropertySchema(name);
                    this.methods[name].setFromJSType(returnType);
                }
            }

            const properties = this.getOrCreateMethodProperties(name);

            const paramtypes = name === 'constructor'
                ? Reflect.getMetadata && Reflect.getMetadata('design:paramtypes', this.classType)
                : Reflect.getMetadata && Reflect.getMetadata('design:paramtypes', this.classType.prototype, name);

            const names = getParameterNames(this.classType.prototype[name]);

            for (const [i, t] of eachPair(paramtypes)) {
                if (!properties[i]) {
                    properties[i] = new PropertySchema(names[i] || String(i));
                    if (paramtypes[i] !== Object) {
                        properties[i].setFromJSType(t, false);
                    }
                }
            }
            this.initializedMethods.add(name);
        }
    }

    /**
     * @internal
     */
    public getOrCreateMethodProperties(name: string): PropertySchema[] {
        if (!this.methodProperties.has(name)) {
            this.methodProperties.set(name, []);
        }

        return this.methodProperties.get(name)!;
    }

    public initializeProperties() {
    }

    public getClassProperties(initialize: boolean = true): Map<string, PropertySchema> {
        if (initialize) this.initializeProperties();
        return this.classProperties;
    }

    /**
     * @internal
     */
    public getMethodsParamNames(methodName: string): string[] {
        if (!this.methodsParamNames.has(methodName)) this.methodsParamNames.set(methodName, []);

        return this.methodsParamNames.get(methodName)!;
    }

    /**
     * @internal
     */
    public getMethodsParamNamesAutoResolved(methodName: string): string[] {
        if (!this.methodsParamNamesAutoResolved.has(methodName)) this.methodsParamNamesAutoResolved.set(methodName, []);

        return this.methodsParamNamesAutoResolved.get(methodName)!;
    }

    public getDiscriminantPropertySchema(): PropertySchema {
        if (!this.discriminant) {
            throw new Error(`No discriminant property found at class ${this.getClassName()}`);
        }

        return this.getProperty(this.discriminant);
    }

    public getDecoratedPropertySchema(): PropertySchema {
        if (!this.decorator) {
            throw new Error(`No decorated property found`);
        }

        return this.getProperty(this.decorator);
    }

    public getIndex(name: string): EntityIndex | undefined {
        return this.indices.get(name);
    }

    public getPropertyOrUndefined(name: string): PropertySchema | undefined {
        this.initializeProperties();
        return this.classProperties.get(name);
    }

    public hasProperty(name: string): boolean {
        return this.classProperties.has(name);
    }

    // public isOneToOne(propertyName: string): boolean {
    //     const property = this.getProperty(propertyName);
    //     return property.isOwningReference() && property.isId;
    // }
    //
    // public isManyToOne(propertyName: string): boolean {
    //     const property = this.getProperty(propertyName);
    //     return property.isOwningReference() && !property.isId;
    // }
    //
    // public isOneToMany(propertyName: string): boolean {
    //     const property = this.getProperty(propertyName);
    //     return property.isBackReference() && !property.isId;
    // }
    //
    // public isManyToMany(propertyName: string): boolean {
    //     const property = this.getProperty(propertyName);
    //     if (property.isBackReference()) {
    //         const reverseRef = this.findReverseReference(property.getResolvedClassType(), property);
    //         return reverseRef.isArray;
    //     }
    //     return false;
    // }

    /**
     * All references have a counter-part. This methods finds it and errors if not possible.
     *
     * If the given reference is a owning reference it finds the correct backReference,
     *    which can be found by checking all reference options.mappedBy.
     *
     * If the given reference is a back reference it finds the owning reference,
     *    which can be found by using its options.mappedBy.
     *
     * Alternatively we simply check for resolvedClassType to be given `classType`, and if only one
     * found, we return it. When more than one found, we throw an error saying the user he
     * should make its relation mapping not ambiguous.
     */
    public findReverseReference(toClassType: ClassType, fromReference: PropertySchema): PropertySchema {
        if (fromReference.backReference && fromReference.backReference.mappedBy) {
            if (fromReference.getResolvedClassTypeForValidType() === this.classType) {
                return this.getProperty(fromReference.backReference.mappedBy as string);
            }
        }

        const candidates: PropertySchema[] = [];
        for (const backRef of this.references) {
            if (backRef === fromReference) continue;

            //backRef points to something completely different
            if (!backRef.isArray && backRef.getResolvedClassTypeForValidType() !== toClassType) continue;
            if (backRef.isArray && backRef.getSubType().getResolvedClassTypeForValidType() !== toClassType) continue;

            //we found the perfect match, manually annotated
            if (backRef.backReference && backRef.backReference.mappedBy) {
                if (backRef.backReference.mappedBy === fromReference.name) {
                    return backRef;
                }
                continue;
            }

            if (fromReference.backReference && fromReference.backReference.mappedBy && !fromReference.backReference.via) {
                if (fromReference.backReference.mappedBy === backRef.name) {
                    //perfect match
                    return backRef;
                }
                continue;
            }

            //add to candidates if possible
            if (fromReference.backReference && fromReference.backReference.via && backRef.backReference && backRef.backReference.via) {
                if (resolveClassTypeOrForward(fromReference.backReference.via) === resolveClassTypeOrForward(backRef.backReference.via)) {
                    candidates.push(backRef);
                }
                continue;
            }

            if (fromReference.backReference && fromReference.isArray && !fromReference.backReference.via) {
                //other side must be non-array
                if (backRef.isArray) continue;
            }

            candidates.push(backRef);
        }

        if (candidates.length > 1) {
            throw new Error(`Class ${getClassName(this.classType)} has multiple potential reverse references [${candidates.map(v => v.name).join(', ')}] for ${fromReference.name} to class ${getClassName(toClassType)}. ` +
                `Please specify each back reference by using 'mappedBy', e.g. @t.backReference({mappedBy: 'fieldNameOnTheOtherSide'} so its not ambiguous anymore.`);
        }

        if (candidates.length === 1) return candidates[0];

        throw new Error(`Class ${getClassName(this.classType)} has no reference to class ${getClassName(toClassType)} defined.`);
    }

    public getPropertiesByGroup(...groupNames: string[]): PropertySchema[] {
        const result: PropertySchema[] = [];
        this.initializeProperties();
        for (const property of this.classProperties.values()) {
            for (const groupName of property.groupNames) {
                if (groupNames.includes(groupName)) {
                    result.push(property);
                    break;
                }
            }
        }

        return result;
    }

    public getProperty(name: string): PropertySchema {
        this.initializeProperties();
        if (!this.classProperties.has(name)) {
            throw new Error(`Property ${this.getClassName()}.${name} not found`);
        }

        return this.classProperties.get(name)!;
    }
}


/**
 * Returns true if there is a class annotated with @Entity(name).
 */
export function hasClassSchemaByName(name: string): boolean {
    return !!getGlobalStore().RegisteredEntities[name];
}

/**
 * Returns the ClassSchema for an class annotated with @Entity(name).
 * @throws Error if not exists
 */
export function getClassSchemaByName<T = object>(name: string): ClassSchema<T> {
    if (!getGlobalStore().RegisteredEntities[name]) {
        throw new Error(`No deepkit/type class found with name '${name}'`);
    }

    return getClassSchema(getGlobalStore().RegisteredEntities[name]);
}

/**
 * Returns all names registered as @Entity() known to deepkit/type.
 */
export function getKnownClassSchemasNames(): string[] {
    return Object.keys(getGlobalStore().RegisteredEntities);
}

export const classSchemaSymbol = Symbol('classSchema');

/**
 * @hidden
 */
export function getOrCreateEntitySchema<T>(target: object | ClassType<T> | any): ClassSchema {
    const proto = target['prototype'] ? target['prototype'] : target;
    const classType = target['prototype'] ? target as ClassType<T> : target.constructor as ClassType<T>;

    if (!proto.hasOwnProperty(classSchemaSymbol)) {
        Object.defineProperty(proto, classSchemaSymbol, { writable: true, enumerable: false });
    }

    // if (!ClassSchemas.has(proto)) {
    if (!proto[classSchemaSymbol]) {
        //check if parent has a EntitySchema, if so clone and use it as base.

        let currentProto = Object.getPrototypeOf(proto);
        let found = false;
        while (currentProto && currentProto !== Object.prototype) {
            // if (ClassSchemas.has(currentProto)) {
            if (currentProto[classSchemaSymbol]) {
                found = true;
                proto[classSchemaSymbol] = currentProto[classSchemaSymbol].clone(classType);
                // ClassSchemas.set(proto, ClassSchemas.get(currentProto)!.clone(classType));
                break;
            }
            currentProto = Object.getPrototypeOf(currentProto);
        }

        if (!found) {
            proto[classSchemaSymbol] = new ClassSchema(classType);
            // const reflection = new ClassSchema(classType);
            // ClassSchemas.set(proto, reflection);
        }
    }

    return proto[classSchemaSymbol];
}

/**
 * Returns meta information / schema about given entity class.
 */
export function getClassSchema<T>(classTypeIn: ClassType<T> | Object | ClassSchema): ClassSchema<T> {
    if (classTypeIn instanceof ClassSchema) return classTypeIn;
    const classType = (classTypeIn as any)['prototype'] ? classTypeIn as ClassType<T> : classTypeIn.constructor as ClassType<T>;

    if (!classType.prototype.hasOwnProperty(classSchemaSymbol)) {
        Object.defineProperty(classType.prototype, classSchemaSymbol, { writable: true, enumerable: false });
    }

    if (!classType.prototype[classSchemaSymbol]) {
        //check if parent has a ClassSchema, if so clone and use it as base.
        let currentProto = Object.getPrototypeOf(classType.prototype);
        let found = false;
        while (currentProto && currentProto !== Object.prototype) {
            if (currentProto[classSchemaSymbol]) {
                found = true;
                classType.prototype[classSchemaSymbol] = currentProto[classSchemaSymbol].clone(classType);
                // ClassSchemas.set(classType.prototype, ClassSchemas.get(currentProto)!.clone(classType));
                break;
            }
            currentProto = Object.getPrototypeOf(currentProto);
        }

        if (!found) {
            classType.prototype[classSchemaSymbol] = new ClassSchema(classType);
        }
    }

    return classType.prototype[classSchemaSymbol];
}

/**
 * Creates a new ClassSchema for a given external class (you might have no write access to),
 * which can be used to transform data for the given class. You can dynamically add properties
 * and use then the external class as usual with plainToClass, classToPlain, etc.
 *
 * @example
 * ```typescript
 * class ExternalClass {
 *     id!: string;
 *     version!: number;
 *     lists!: number[];
 * }
 *
 * const schema = createClassSchema(ExternalClass);
 * schema.addProperty('id', f.type(String));
 * schema.addProperty('version', f.type(Number));
 * schema.addProperty('lists', f.array(Number));
 *
 * const obj = plainToClass(ExternalClass, {
 *     id: '23',
 *     version: 1,
 *     lists: [12, 23]
 * });
 * ```
 */
export function createClassSchema<T = any>(clazz?: ClassType<T>, name: string = ''): ClassSchema<T> {
    const c = clazz || class {
    };
    if (name) {
        Object.defineProperty(c, 'name', { value: name });
    }

    const classSchema = getOrCreateEntitySchema(c);
    classSchema.name = name;

    return classSchema;
}
