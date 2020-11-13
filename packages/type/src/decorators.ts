/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {PropertyValidatorError} from './validation';
import {ClassType, eachKey, eachPair, getClassName, isClass, isFunction, isNumber, isObject, isPlainObject, toFastProperties,} from '@deepkit/core';
import getParameterNames from 'get-parameter-names';
import {FlattenIfArray, isArray, JSONEntity} from './utils';
import {ClassDecoratorResult, createClassDecoratorContext, FreeFluidDecorator, isDecoratorContext} from './decorator-builder';
import {jsonSerializer} from './json-serializer';
import {PartialField, typedArrayMap, typedArrayNamesMap, Types} from './models';
import {BackReference, isPrimaryKey, Reference} from './types';
import {extractMethod} from './code-parser';
import {FreeValidationContext, validation} from './validation-decorator';

export enum UnpopulatedCheck {
    None,
    Throw, //throws regular error
    ReturnSymbol, //returns `unpopulatedSymbol`
}

export const unpopulatedSymbol = Symbol('unpopulated');

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

function getGlobal(): any {
    if ('undefined' !== typeof globalThis) return globalThis;
    if ('undefined' !== typeof window) return window;
    throw Error('No global');
}

export function getGlobalStore(): GlobalStore {
    const global = getGlobal();
    if (!global.DeepkitStore) {
        global.DeepkitStore = {
            RegisteredEntities: {},
            unpopulatedCheck: UnpopulatedCheck.Throw,
            enableForwardRefDetection: true,
        } as GlobalStore;
    }

    return global.DeepkitStore;
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

//note: Not all options are supported in all databases.
type IndexOptions = Partial<{
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
    isArray?: true;
    isMap?: true;
    isDecorated?: true;
    isParentReference?: true;
    isOptional?: true;
    isId?: true;
    isPartial?: true;
    typeSet?: true;
    isDiscriminant?: true;
    allowLabelsAsValue?: true;
    methodName?: string;
    groupNames?: string[];
    templateArgs?: PropertySchemaSerialized[];
    classType?: string;
    noValidation?: boolean;
}

/**
 * Contains all resolved information from PropertySchema necessary to feed compiler functions.
 *
 * Internal note: It's on purpose aligned with PropertySchema.
 */
export class PropertyCompilerSchema {
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

    templateArgs: PropertyCompilerSchema[] = [];

    constructor(
        public name: string,
        public classType?: ClassType
    ) {
    }

    /**
     * Returns true when user manually set a default value via PropertySchema/decorator.
     */
    hasManualDefaultValue(): boolean {
        return !this.hasDefaultValue && this.defaultValue !== undefined;
    }

    toString(): string {
        if (this.type === 'array') {
            return `Array<${this.templateArgs[0]}}>`;
        }
        if (this.type === 'map') {
            return `Map<${this.templateArgs[0]}, ${this.templateArgs[1]}>`;
        }
        if (this.type === 'partial') {
            return `Partial<${this.templateArgs[0]}>`;
        }
        if (this.type === 'union') {
            return this.templateArgs.map(v => v.toString()).join(' | ');
        }
        if (this.type === 'class') {
            return getClassName(this.resolveClassType || class {
            });
        }
        return `${this.type}`;
    }

    getSubType(): PropertyCompilerSchema {
        if (this.type === 'partial') return this.templateArgs[0]!;
        if (this.type === 'array') return this.templateArgs[0]!;
        if (this.type === 'map') return this.templateArgs[1]!;
        throw new Error('No array or map type');
    }

    get resolveClassType(): ClassType | undefined {
        return this.classType;
    }

    /**
     * Returns true when `undefined` or a missing value is allowed.
     * This is now only true when `optional` is set, but alos when type is `any`,
     * or when the property has an actual default value (then a undefined value sets the default value instead).
     */
    public isUndefinedAllowed(): boolean {
        return this.isOptional || this.type === 'any' || this.hasManualDefaultValue() || this.hasDefaultValue;
    }

    static createFromPropertySchema(
        propertySchema: PropertySchema,
    ): PropertyCompilerSchema {
        const i = new PropertyCompilerSchema(
            propertySchema.name,
            propertySchema.getResolvedClassTypeForValidType()
        );
        i.type = propertySchema.type;
        i.literalValue = propertySchema.literalValue;
        i.validators = propertySchema.validators;
        i.isOptional = propertySchema.isOptional;
        i.isDiscriminant = propertySchema.isDiscriminant;
        i.allowLabelsAsValue = propertySchema.allowLabelsAsValue;
        i.isReference = propertySchema.isReference;
        i.isParentReference = propertySchema.isParentReference;
        i.hasDefaultValue = propertySchema.hasDefaultValue;
        i.templateArgs = propertySchema.templateArgs;
        return i;
    }
}

/**
 * Represents a class property or method argument definition.
 */
export class PropertySchema extends PropertyCompilerSchema {
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

    templateArgs: PropertySchema[] = [];

    description: string = '';

    constructor(name: string) {
        super(name);
    }

    setType(type: Types) {
        this.type = type;
        this.typeSet = true;
    }

    toString() {
        if (!this.typeSet) return 'undefined';
        if (this.type === 'array') {
            return `${this.templateArgs[0]}[]`;
        }
        if (this.type === 'class') {
            if (this.classTypeForwardRef) {
                const resolved = resolveForwardRef(this.classTypeForwardRef);
                if (resolved) return getClassName(resolved);
                return 'ForwardedRef';
            } else {
                return getClassName(this.getResolvedClassType());
            }
        }
        return super.toString();
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
        if (this.isArray) props['isArray'] = true;
        if (this.isMap) props['isMap'] = true;
        if (this.isDecorated) props['isDecorated'] = true;
        if (this.isDiscriminant) props['isDiscriminant'] = true;
        if (this.isParentReference) props['isParentReference'] = true;
        if (this.isOptional) props['isOptional'] = true;
        if (this.isId) props['isId'] = true;
        if (this.isPartial) props['isPartial'] = true;
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
                throw new Error(`Could not serialize type information for ${this.methodName ? this.methodName + ':' : ''}${this.name}, got type ${getClassName(resolved)}. ` +
                    `Either further specify the type using the @f decorator or use @Entity() decorator at the ${getClassName(resolved)} class.`);
            }
            props['classType'] = name;
        }

        return props;
    }

    static fromJSON(props: PropertySchemaSerialized): PropertySchema {
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
            p.templateArgs = props['templateArgs'].map(v => PropertySchema.fromJSON(v));
        }

        if (props['classType']) {
            const entity = getGlobalStore().RegisteredEntities[props['classType']];
            if (!entity) {
                throw new Error(`Could not unserialize type information for ${p.methodName || ''}:${p.name}, got entity name ${props['classType']}. ` +
                    `Make sure given entity is loaded (imported at least once globally).`);
            }
            p.classType = getClassSchema(entity).classType;
        }

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
            this.templateArgs[0] = new PropertySchema('0');
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

            if (detectForwardRef && isFunction(type)) {
                this.classTypeForwardRef = type;
                delete this.classType;
            }

            if (type instanceof ForwardRef) {
                this.classTypeForwardRef = type;
                delete this.classType;
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
        const s = new PropertySchema(this.name);
        for (const i of eachKey(this)) {
            (s as any)[i] = (this as any)[i];
        }
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
        if (this.isArray || this.isMap) return this.getSubType().getResolvedClassType();

        if (this.classTypeResolved) {
            return this.classTypeResolved;
        }

        if (this.classTypeForwardRef) {
            this.classTypeResolved = resolveForwardRef(this.classTypeForwardRef);
            if (this.classTypeResolved) {
                return this.classTypeResolved;
            }
            throw new Error(`ForwardRef returns no value. ${this.classTypeForwardRef}`);
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

    hashGenerator() {

    };

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

    public addIndex(fieldNames: (keyof T & string)[], name?: string, options?: IndexOptions) {
        name = name || fieldNames.join('_');
        this.indices.set(name, {fields: fieldNames, options: options || {}});
    }

    public clone(classType: ClassType): ClassSchema {
        const s = new ClassSchema(classType);
        s.name = this.name;
        s.collectionName = this.collectionName;
        s.databaseSchemaName = this.databaseSchemaName;
        s.decorator = this.decorator;

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
            s.indices.set(name, {...v});
        }

        s.onLoad = [];
        for (const v of this.onLoad) {
            s.onLoad.push({...v});
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
     * schema.addProperty('anotherOne', f.type(String));
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

        this.classProperties.set(property.name, property);
    }

    protected resetCache() {
        this.jit = {};
        this.getClassProperties()
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

    protected initializeMethod(name: string) {
        if (!this.initializedMethods.has(name)) {
            if (name !== 'constructor' && (!Reflect.getMetadata || !Reflect.hasMetadata('design:returntype', this.classType.prototype, name))) {
                throw new Error(`Method ${name} has no decorators used or is not defined, so reflection does not work. Use @f on the method or arguments. Is emitDecoratorMetadata enabled? Correctly 'reflect-metadata' imported? Return type annotated?`);
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

    public create(propertyValues: JSONEntity<T>): T {
        return jsonSerializer.for(this).deserialize(propertyValues);
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
        Object.defineProperty(proto, classSchemaSymbol, {writable: true, enumerable: false});
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
        Object.defineProperty(classType.prototype, classSchemaSymbol, {writable: true, enumerable: false});
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
        Object.defineProperty(c, 'name', {value: name});
    }

    const classSchema = getOrCreateEntitySchema(c);
    classSchema.name = name;

    return classSchema;
}

export type PlainSchemaProps = { [name: string]: FieldDecoratorResult<any> | PlainSchemaProps | ClassSchema | string | number | boolean };

export type ExtractDefinition<T extends FieldDecoratorResult<any>> = T extends FieldDecoratorResult<infer K> ? K : never;

export type MergeSchemaAndBase<T extends PlainSchemaProps, BASE extends ClassSchema | ClassType | undefined> = BASE extends ClassSchema | ClassType ? ExtractType<BASE> & ExtractClassDefinition<T> : ExtractClassDefinition<T>;

export type ExtractClassDefinition<T extends PlainSchemaProps> = {
    [name in keyof T]:
    T[name] extends PlainSchemaProps ? ExtractClassDefinition<T[name]> :
        T[name] extends ClassSchema<infer K> ? K :
            T[name] extends FieldDecoratorResult<any> ? ExtractDefinition<T[name]> : T
};

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
 * Used to define a entity name for an entity.
 *
 * The name is used for an internal registry, so ot should be a unique one.
 *
 * deepkit/type's database abstraction uses this name to generate the collection name / table name.
 *
 * @category Decorator
 */
export function Entity<T>(name: string, collectionName?: string) {
    return (target: ClassType<T>) => {
        if (getGlobalStore().RegisteredEntities[name]) {
            throw new Error(`deepkit/type entity with name '${name}' already registered. 
            This could be caused by the fact that you used a name twice or that you loaded the entity 
            via different imports.`);
        }

        getGlobalStore().RegisteredEntities[name] = target;
        getOrCreateEntitySchema(target).name = name;
        getOrCreateEntitySchema(target).collectionName = collectionName;
    };
}


class EntityApi {
    t = new ClassSchema(class {
    });

    constructor(target: object) {
        this.t = getClassSchema(target);
    }

    name(name: string) {
        this.t.name = name;

        if (getGlobalStore().RegisteredEntities[name]) {
            throw new Error(`deepkit/type entity with name '${name}' already registered. 
            This could be caused by the fact that you used a name twice or that you loaded the entity 
            via different imports.`);
        }

        getGlobalStore().RegisteredEntities[name] = this.t;
        this.t.name = name;
    }

    description(description: string) {
        this.t.description = description;
    }

    collectionName(name: string) {
        this.t.collectionName = name;
    }
}

export const entity: ClassDecoratorResult<typeof EntityApi> = createClassDecoratorContext(EntityApi);

/**
 * Used to define a database name for an entity. Per default deepkit's database abstraction
 * uses the default database, but you can change that using this decorator.
 *
 * @category Decorator
 */
export function DatabaseName<T>(name: string) {
    return (target: ClassType<T>) => {
        getOrCreateEntitySchema(target).databaseSchemaName = name;
    };
}

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

export function resolveClassTypeOrForward(type: ClassType | ForwardRefFn<ClassType>): ClassType {
    return isFunction(type) ? (type as Function)() : type;
}


/**
 * @throws PropertyValidatorError when validation invalid
 */
export type ValidatorFn = (value: any, propertyName: string, classType?: ClassType) => void;

export type ReferenceActions = 'RESTRICT' | 'NO ACTION' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';

export interface FieldDecoratorResult<T> {
    (target: object, property?: string, parameterIndexOrDescriptor?: any): void;

    /**
     * Sets the name of this property. Important for cases where the actual name is lost during compilation.
     * This is only necessary in constructor arguments.
     */
    name(name: string): this;

    /**
     * Marks this field as owning reference to the foreign class.
     *
     * Its actual value is not written into the document itself, but stored
     * in its own collection/table and a reference is established using its primary field.
     * Without reference() field values are embedded into the main document.
     *
     * Owning reference means: Additional foreign key fields are automatically added if not already explicitly done.
     * Those additional fields are used to store the primary key of the foreign class.
     *
     * ReferenceActions defines what happens when either the target item is deleted (onDelete) or when
     * the primary key of the target item is changed (onUpdate).
     *
     * The default is CASCADE.
     *
     *   - RESTRICT: Forbids to delete the target item or change its primary key.
     *   - NO ACTION: WHen the target item is deled or primary key changed, no action is taken.
     *                The database might however throw FOREIGN KEY constraint failure errors when the target is
     *                deleted without setting this owning reference first to NULL or something different.
     *   - CASCADE: When the target item is deleted, then this item will be deleted as well. If the target primary key changes, then this reference adjusts automatically.
     *   - SET NULL: Sets this reference to NULL when target item is deleted or its primary key changed.
     *   - SET DEFAULT: Sets this reference to DEFAULT when target item is deleted or its primary key changed.
     */
    reference(options?: { onDelete?: ReferenceActions, onUpdate?: ReferenceActions }): FieldDecoratorResult<Reference<T>>;

    /**
     * Marks this reference as not-owning side.
     *
     * options.via: If the foreign class is not directly accessible, you can use a pivot collection/table
     *              using the `via` option. Make sure that the given class in `via` contains both reference
     *              (one back to this class and one to the actual foreign class).
     *
     * options.mappedBy: Explicitly set the name of the @t.reference() of the foreign class to which this backReference belongs to.
     *                   Per default it is automatically detected, but will fail if you the foreign class contains more
     *                   than one @t.reference() to the same class.
     * @param options
     */
    backReference(options?: BackReferenceOptions<FlattenIfArray<T>>): FieldDecoratorResult<BackReference<T>>;

    /**
     * Marks this type as optional (allow to set as undefined). Per default the type is required, this makes it optional.
     * TypeScript has in general its own convention that it most of the times works with optional values as undefined.
     * Some use-cases require to use optional values as null. Use then @t.nullable.
     *
     * Don't mix both .optional and .nullable, as this is most of the time not what you want.
     *
     * @example
     * ```typescript
     *     class Test {
     *         @t.optional label?: string;
     *
     *         @t.optional label2: string | undefined = undefined;
     *     }
     * ```
     *
     * @example
     * ```typescript
     *     class Test {
     *         @t.optional.nullable veryRare: string | undefined | null = null;
     *     }
     * ```
     */
    optional: FieldDecoratorResult<T | undefined>;

    /**
     * Marks this type as nullable (allow to set as null). Per default `undefined` and `null` are treated both as `undefined`,
     * basically ignoring `null` values. Null values fall back per default to the default property value. Using `nullable` keeps
     * the `null` value intact.
     *
     * @example
     * ```typescript
     *     class Test {
     *         @t.nullable label: string | null = null;
     *     }
     * ```
     */
    nullable: FieldDecoratorResult<T | null>;

    /**
     * Sets a default value.
     */
    default(v: T): FieldDecoratorResult<T>;

    /**
     * Sets a description.
     */
    description(description: string): this;

    /**
     * Marks this field as discriminant for the discriminator in union types.
     * See @t.union()
     */
    discriminant: this;

    /**
     * Used to define a field as excluded when serialized from class to different targets (like mongo or plain).
     * PlainToClass or mongoToClass is not effected by this.
     * This exclusion is during compile time, if you need a runtime exclude/include mechanism,
     * please use @t.group('groupName') and use in classToPain/partialClassToPlain the options
     * argument to filter, e.g. {groupsExclude: ['groupName']}.
     */
    exclude(t?: 'all' | 'database' | 'plain' | string): this;

    /**
     * Marks this field as an ID aka primary.
     * This is important if you interact with the database abstraction.
     *
     * Only one field in a class can be the ID.
     */
    primary: FieldDecoratorResult<T & { [isPrimaryKey]?: T }>;

    /**
     * Marks this field as auto increment.
     *
     * Only available for the database abstraction.
     */
    autoIncrement: FieldDecoratorResult<T | undefined>;

    /**
     * Defines template arguments of a generic class. Very handy for types like Observables.
     *
     * ```typescript
     * class Stuff {
     * }
     *
     * class Page {
     *     @t.template(Stuff)
     *     downloadStuff(): Observable<Stuff> {
     *          return new Observable<Stuff>((observer) => {
     *              observer.next(new Stuff());
     *          })
     *     }
     *
     *     //or more verbose way if the type is more complex.
     *     @t.template(f.type(Stuff).optional)
     *     downloadStuffWrapper(): Observable<Stuff | undefined> {
     *          return new Observable<Stuff>((observer) => {
     *              observer.next(new Stuff());
     *          })
     *     }
     * }
     * ```
     */
    template(...templateArgs: (ClassType | ForwardRefFn<any> | ClassSchema | PlainSchemaProps | FieldDecoratorResult<any> | string | number | boolean)[]): this;

    /**
     * Used to define an index on a field.
     */
    index(options?: IndexOptions, name?: string): this;

    /**
     * Adds custom data into the property schema.
     */
    data(key: string, value: any): this;

    /**
     * Puts the property into one or multiple groups.
     * Groups can be used to serialize only a subset of properties.
     * It's recommended to use enums to make sure you don't have magic
     * untyped strings.
     *
     * ```typescript
     * enum Group {
     *     confidential = 'confidential';
     * }
     *
     * class User {
     *     @f username: string;
     *     @t.group(Group.confidential) password: string;
     *
     *     @t.group('bar') foo: string;
     * }
     *
     * const user = new User();
     *
     * const plain = partialClassToPlain(User, user, {groupsExclude: [Group.confidential]});
     * ```
     */
    group(...names: string[]): this;

    /**
     * Used to define a field as MongoDB ObjectId. This decorator is necessary if you want to use Mongo's _id.
     *
     * ```typescript
     * class Page {
     *     @t.mongoId
     *     referenceToSomething?: string;
     *
     *     constructor(
     *         @t.primary.mongoId
     *         public readonly _id: string
     *     ) {
     *
     *     }
     * }
     * ```
     */
    mongoId: FieldDecoratorResult<string>;

    /**
     * Used to define a field as UUID (v4).
     */
    uuid: FieldDecoratorResult<string>;

    /**
     *
     */
    parentReference: this;

    /**
     * Used to define a field as decorated.
     * This is necessary if you want to wrap a field value in the class instance using
     * a own class, like for example for Array manipulations, but keep the JSON and Database value
     * as primitive as possible.
     *
     * Only one field per class can be the decorated one.
     *
     * @category Decorator
     *
     * Example
     * ```typescript
     * export class PageCollection {
     *     @t.type(() => PageClass).decorated
     *     private readonly pages: PageClass[] = [];
     *
     *     constructor(pages: PageClass[] = []) {
     *         this.pages = pages;
     *     }
     *
     *     public count(): number {
     *         return this.pages.length;
     *     }
     *
     *     public add(name: string): number {
     *         return this.pages.push(new PageClass(name));
     *     }
     * }
     *
     * export class PageClass {
     *     @t.uuid
     *     id: string = uuid();
     *
     *     @f
     *     name: string;
     *
     *     @t.type(() => PageCollection)
     *     children: PageCollection = new PageCollection;
     *
     *     constructor(name: string) {
     *         this.name = name;
     *     }
     * }
     * ```
     *
     * If you use classToPlain(PageClass, ...) or classToMongo(PageClass, ...) the field value of `children` will be the type of
     * `PageCollection.pages` (always the field where @Decorated() is applied to), here a array of PagesClass `PageClass[]`.
     */
    decorated: this;

    /**
     * @internal
     */
    partial: this;

    /**
     * Uses an additional modifier to change the PropertySchema.
     */
    use(decorator: (target: object, property: PropertySchema) => void): this;

    /**
     * Adds a custom validator class or validator callback.
     *
     * @example
     * ```typescript
     * import {PropertyValidator, PropertyValidatorError} from '@deepkit/type';
     *
     * class MyCustomValidator implements PropertyValidator {
     *      async validate<T>(value: any, target: ClassType<T>, propertyName: string): PropertyValidatorError | void {
     *          if (value.length > 10) {
     *              return new PropertyValidatorError('too_long', 'Too long :()');
     *          }
     *      };
     * }
     *
     * class Entity {
     *     @t.validator(MyCustomValidator)
     *     name: string;
     *
     *     @t.validator(MyCustomValidator)
     *     name: string;
     *
     *     @t.validator((value: any, target: ClassType, propertyName: string) => {
     *          if (value.length > 255) {
     *              return new PropertyValidatorError('too_long', 'Too long :()');
     *          }
     *     })
     *     title: string;
     * }
     *
     * ```
     */
    validator(
        ...validators: (ClassType<PropertyValidator> | FreeFluidDecorator<ClassType<FreeValidationContext>> | ValidatorFn)[]
    ): this;

    /**
     * Ignores validation on this property.
     */
    noValidation: this;

    /**
     * Creates a PropertySchema object from the given definition.
     */
    buildPropertySchema(name?: string): PropertySchema;

    /**
     * Sets field (column) options for MySQL.
     */
    mysql(options: Partial<MySQLOptions>): FieldDecoratorResult<T>;

    /**
     * Sets field (column) options for PostgreSQL.
     */
    postgres(options: Partial<MySQLOptions>): FieldDecoratorResult<T>;

    /**
     * Sets field (column) options for SQLite.
     */
    sqlite(options: Partial<MySQLOptions>): FieldDecoratorResult<T>;
}

export interface MySQLOptions {
    type: string;
}

export interface PostgresOptions {
    type: string;
}

export interface SqliteOptions {
    type: string;
}

export function isFieldDecorator(t: any): t is FieldDecoratorResult<any> {
    return 'function' === typeof t && 'function' === typeof t.name && 'function' === typeof t.optional;
}

function createFieldDecoratorResult<T>(
    cb: (target: object, property: PropertySchema, returnType: any) => void,
    givenPropertyName: string = '',
    modifier: ((target: object, property: PropertySchema) => void)[] = [],
    root: boolean = false,
): FieldDecoratorResult<T> {
    function resetIfNecessary() {
        //on root we never use the overwritten name, so we set it back
        //for child FieldDecoratorResults created via asName() etc we keep that stuff (since there is root=false)
        if (root) {
            givenPropertyName = '';
            modifier = [];
        }
    }

    function buildPropertySchema(target: object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any): PropertySchema {
        //anon properties
        const propertySchema = new PropertySchema(propertyOrMethodName || String(parameterIndexOrDescriptor));

        for (const mod of modifier) {
            mod(target, propertySchema);
        }

        if (isNumber(parameterIndexOrDescriptor) && (target as any)['prototype']) {
            target = (target as any)['prototype'];
        }

        cb(target, propertySchema!, undefined);

        return propertySchema;
    }

    const fn = (target: object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any) => {
        resetIfNecessary();

        if (propertyOrMethodName === undefined && parameterIndexOrDescriptor === undefined) {
            //was used on a class, just exit
            return;
        }

        if (target === Object) {
            buildPropertySchema(target, propertyOrMethodName, parameterIndexOrDescriptor);
        }

        let returnType;
        let methodName = 'constructor';
        const schema = getOrCreateEntitySchema(target);

        const isMethod = propertyOrMethodName && (Reflect.hasMetadata && Reflect.hasMetadata('design:returntype', target, propertyOrMethodName)) && !isNumber(parameterIndexOrDescriptor);

        if (isNumber(parameterIndexOrDescriptor)) {
            //decorator is used on a method argument
            methodName = propertyOrMethodName || 'constructor';
            const methodsParamNames = schema.getMethodsParamNames(methodName);
            const methodsParamNamesAutoResolved = schema.getMethodsParamNamesAutoResolved(methodName);

            if (!givenPropertyName && methodsParamNames[parameterIndexOrDescriptor]) {
                givenPropertyName = methodsParamNames[parameterIndexOrDescriptor];
            }

            if (givenPropertyName && (
                (methodsParamNames[parameterIndexOrDescriptor] && methodsParamNames[parameterIndexOrDescriptor] !== givenPropertyName)
                || (methodsParamNamesAutoResolved[parameterIndexOrDescriptor] && methodsParamNamesAutoResolved[parameterIndexOrDescriptor] !== givenPropertyName)
            )
            ) {
                //we got a new decorator with a different name on a constructor param
                //since we cant not resolve logically which name to use, we forbid that case.
                throw new Error(`Defining multiple deepkit/type decorators with different names at arguments of ${getClassName(target)}::${methodName} #${parameterIndexOrDescriptor} is forbidden.` +
                    ` @t.asName('name') is required. Got ${methodsParamNames[parameterIndexOrDescriptor] || methodsParamNamesAutoResolved[parameterIndexOrDescriptor]} !== ${givenPropertyName}`);
            }

            if (givenPropertyName) {
                //we only store the name, when we explicitly defined one
                methodsParamNames[parameterIndexOrDescriptor] = givenPropertyName;
            } else if (methodName === 'constructor') {
                //only for constructor methods
                const constructorParamNames = getParameterNames((target as ClassType).prototype.constructor);
                // const constructorParamNames = getCachedParameterNames((target as ClassType).prototype.constructor);
                givenPropertyName = constructorParamNames[parameterIndexOrDescriptor];

                if (givenPropertyName) {
                    methodsParamNamesAutoResolved[parameterIndexOrDescriptor] = givenPropertyName;
                }
            }

            if (methodName === 'constructor') {
                //constructor
                const returnTypes = Reflect.getMetadata && Reflect.getMetadata('design:paramtypes', target);
                if (returnTypes) returnType = returnTypes[parameterIndexOrDescriptor];
            } else {
                //method
                const returnTypes = Reflect.getMetadata && Reflect.getMetadata('design:paramtypes', target, methodName);
                if (returnTypes) returnType = returnTypes[parameterIndexOrDescriptor];
            }

        } else {
            //it's a class property, so propertyOrMethodName contains the actual property name
            if (propertyOrMethodName) {
                returnType = Reflect.getMetadata && Reflect.getMetadata('design:type', target, propertyOrMethodName);

                if (isMethod) {
                    //its a method, so returnType is the actual type
                    returnType = Reflect.getMetadata && Reflect.getMetadata('design:returntype', target, propertyOrMethodName);
                }
            }

            if (!givenPropertyName && propertyOrMethodName) {
                givenPropertyName = propertyOrMethodName;
            }
        }

        const argumentsProperties = schema.getOrCreateMethodProperties(methodName);
        let propertySchema: PropertySchema | undefined = undefined;

        if (isMethod && propertyOrMethodName) {
            if (givenPropertyName && propertyOrMethodName !== givenPropertyName) {
                throw new Error(`${propertyOrMethodName} asName not allowed on methods.`);
            }

            if (!schema.methods[propertyOrMethodName]) {
                schema.methods[propertyOrMethodName] = new PropertySchema(propertyOrMethodName);
            }

            propertySchema = schema.methods[propertyOrMethodName];
        } else {
            if (isNumber(parameterIndexOrDescriptor)) {
                //decorator is used on a method argument. Might be on constructor or any other method.
                if (methodName === 'constructor') {
                    if (!schema.getClassProperties(false).has(givenPropertyName)) {
                        const property = new PropertySchema(givenPropertyName);
                        property.methodName = 'constructor';
                        schema.registerProperty(property);
                        schema.propertyNames.push(givenPropertyName);
                    }

                    propertySchema = schema.getClassProperties(false).get(givenPropertyName)!;
                    argumentsProperties[parameterIndexOrDescriptor] = propertySchema;
                } else {
                    if (!argumentsProperties[parameterIndexOrDescriptor]) {
                        const constructorParamNames = getParameterNames((target as any)[methodName]);
                        const name = constructorParamNames[parameterIndexOrDescriptor] || String(parameterIndexOrDescriptor);
                        argumentsProperties[parameterIndexOrDescriptor] = new PropertySchema(name);
                        argumentsProperties[parameterIndexOrDescriptor].methodName = methodName;
                    }

                    propertySchema = argumentsProperties[parameterIndexOrDescriptor];
                }
            } else {
                if (!givenPropertyName) {
                    throw new Error(`Could not resolve property name for class property on ${getClassName(target)}`);
                }

                if (!schema.getClassProperties(false).has(givenPropertyName)) {
                    schema.registerProperty(new PropertySchema(givenPropertyName));
                    schema.propertyNames.push(givenPropertyName);
                }

                propertySchema = schema.getClassProperties(false).get(givenPropertyName)!;
            }
        }

        for (const mod of modifier) {
            mod(target, propertySchema);
        }

        if (isNumber(parameterIndexOrDescriptor) && (target as any)['prototype']) {
            target = (target as any)['prototype'];
        }

        cb(target, propertySchema!, returnType);
    };

    Object.defineProperty(fn, 'name', {
        get: () => (name: string) => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, name, modifier);
        }
    });

    Object.defineProperty(fn, 'optional', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Optional()]);
        }
    });

    Object.defineProperty(fn, 'nullable', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Nullable()]);
        }
    });

    Object.defineProperty(fn, 'discriminant', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Discriminant()]);
        }
    });

    fn.default = (v: any) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Default(v)]);
    };

    fn.description = (v: string) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.description = v;
        }]);
    };

    fn.exclude = (target: 'all' | 'mongo' | 'plain' | string = 'all') => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Exclude(target)]);
    };

    Object.defineProperty(fn, 'primary', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, IDField()]);
        }
    });

    Object.defineProperty(fn, 'autoIncrement', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
                property.isAutoIncrement = true;
                property.isOptional = true;
            }]);
        }
    });

    Object.defineProperty(fn, 'noValidation', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
                property.noValidation = true;
            }]);
        }
    });

    fn.index = (options?: IndexOptions, name?: string) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Index(options, name)]);
    };

    fn.data = (key: string, value: any) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Data(key, value)]);
    };

    fn.group = (...names: string[]) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, GroupName(...names)]);
    };

    Object.defineProperty(fn, 'mongoId', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, MongoIdField()]);
        }
    });

    Object.defineProperty(fn, 'uuid', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, UUIDField()]);
        }
    });

    Object.defineProperty(fn, 'decorated', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Decorated()]);
        }
    });

    Object.defineProperty(fn, 'parentReference', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, ParentReference()]);
        }
    });

    fn.use = (decorator: (target: object, property: PropertySchema) => void) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, decorator]);
    };

    fn.reference = (options?: { onDelete?: ReferenceActions, onUpdate?: ReferenceActions }) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            if (property.isArray || property.isMap) throw new Error('Reference can not be of type array or map. Inverse the relation, or use backReference()');
            property.isReference = true;
            if (options && options.onDelete) property.referenceOptions.onDelete = options.onDelete;
            if (options && options.onUpdate) property.referenceOptions.onUpdate = options.onUpdate;
            getClassSchema(target).registerReference(property);
        }]);
    };

    Object.defineProperty(fn, 'string', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
                property.setType('string');
            }]);
        }
    });

    Object.defineProperty(fn, 'number', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
                property.setType('number');
            }]);
        }
    });

    Object.defineProperty(fn, 'date', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
                property.setType('date');
            }]);
        }
    });

    Object.defineProperty(fn, 'boolean', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
                property.setType('boolean');
            }]);
        }
    });

    fn.backReference = (options?: BackReferenceOptions<T>) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.backReference = options || {};
            getClassSchema(target).registerReference(property);
        }]);
    };

    fn.template = (...templateArgs: (ClassType | ForwardRefFn<T> | ClassSchema<T> | PlainSchemaProps | FieldDecoratorResult<any> | string | number | boolean)[]) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.templateArgs = [];
            for (const [i, t] of eachPair(templateArgs)) {
                const name = property.name + '_' + i;
                if ('string' === typeof t || 'number' === typeof t || 'boolean' === typeof t) {
                    const p = fRaw.literal(t).buildPropertySchema(name);
                    property.templateArgs.push(p);
                } else if (isFieldDecorator(t)) {
                    //its a decorator @f()
                    //target: object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any
                    const p = t.buildPropertySchema(name);
                    property.templateArgs.push(p);
                } else if (t instanceof ClassSchema) {
                    property.templateArgs.push(fRaw.type(t.classType).buildPropertySchema(name));
                } else if (isPlainObject(t)) {
                    const schema = fRaw.schema(t);
                    property.templateArgs.push(fRaw.type(schema.classType).buildPropertySchema(name));
                } else {
                    const p = new PropertySchema(name);
                    p.setFromJSType(t);
                    property.templateArgs.push(p);
                }
            }
        }]);
    };

    function createValidatorFromFunction(validator: ValidatorFn) {
        return class implements PropertyValidator {
            validate<T>(value: any, propertyName: string, classType?: ClassType): PropertyValidatorError | undefined | void {
                return validator(value, propertyName, classType);
            }
        };
    }

    fn.buildPropertySchema = function (name: string = 'unknown') {
        return buildPropertySchema(Object, name);
    };

    fn.toString = function () {
        return buildPropertySchema(Object, givenPropertyName).toString();
    };

    fn.mysql = (options: MySQLOptions) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.data['mysql'] = options;
        }]);
    };

    fn.postgres = (options: PostgresOptions) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.data['postgres'] = options;
        }]);
    };

    fn.sqlite = (options: SqliteOptions) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.data['sqlite'] = options;
        }]);
    };

    fn.validator = (...validators: (ClassType<PropertyValidator> | ValidatorFn | FreeFluidDecorator<ClassType<FreeValidationContext>>)[]) => {
        resetIfNecessary();
        const validatorClasses: ClassType<PropertyValidator>[] = [];

        for (const validator of validators) {
            if (isDecoratorContext(validation, validator)) {
                const t = validator();
                for (const validator of t.validators) {
                    if (isPropertyValidator(validator)) {
                        validatorClasses.push(validator);
                    } else {
                        validatorClasses.push(createValidatorFromFunction(validator));
                    }
                }
            } else if (isPropertyValidator(validator)) {
                validatorClasses.push(validator);
            } else {
                validatorClasses.push(createValidatorFromFunction(validator));
            }
        }

        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.validators.push(...validatorClasses);
        }]);
    };

    return fn as FieldDecoratorResult<T>;
}

/**
 * Helper for decorators that are allowed to be placed in property declaration and constructor property declaration.
 * We detect the name by reading the constructor' signature, which would be otherwise lost.
 */
export function FieldDecoratorWrapper<T>(
    cb: (target: object, property: PropertySchema, returnType: any) => void,
    root = false
): FieldDecoratorResult<T> {
    return createFieldDecoratorResult<T>(cb, '', [], root);
}

/**
 * @internal
 */
function Decorated() {
    return (target: object, property: PropertySchema) => {
        getOrCreateEntitySchema(target).decorator = property.name;
        property.isDecorated = true;
    };
}

/**
 * @internal
 */
function IDField() {
    return (target: object, property: PropertySchema) => {
        const schema = getOrCreateEntitySchema(target);
        schema.idField = property.name;
        property.isId = true;
        // Index({unique: true}, '_pk')(target, property);
    };
}

/**
 * @internal
 */
function Optional() {
    return (target: object, property: PropertySchema) => {
        property.isOptional = true;
    };
}

/**
 * @internal
 */
function Nullable() {
    return (target: object, property: PropertySchema) => {
        property.isNullable = true;
    };
}

/**
 * @internal
 */
function Default(v: any) {
    return (target: object, property: PropertySchema) => {
        property.defaultValue = v;
    };
}

/**
 * @internal
 */
function Discriminant() {
    return (target: object, property: PropertySchema) => {
        getOrCreateEntitySchema(target).discriminant = property.name;
        property.isDiscriminant = true;
    };
}

/**
 * @internal
 */
function GroupName(...names: string[]) {
    return (target: object, property: PropertySchema) => {
        property.groupNames = names;
    };
}

/**
 * Used to define a field as a reference to a parent.
 *
 * @category Decorator
 *
 * Example one direction.
 * ```typescript
 * class JobConfig {
 *     @t.type(() => Job).parentReference //forward necessary since circular dependency
 *     job: Job;
 *
 * }
 *
 * class Job {
 *     @f config: JobConfig;
 * }
 * ```
 *
 * Example circular parent-child setup.
 * ```typescript
 * export class PageClass {
 *     @t.uuid
 *     id: string = uuid();
 *
 *     @f
 *     name: string;
 *
 *     @t.type(() => PageClass) //forward necessary since circular dependency
 *     children: PageClass[] = [];
 *
 *     @t.type(() => PageClass).optional.parentReference //forward necessary since circular dependency
 *     parent?: PageClass;
 *
 *     constructor(name: string) {
 *         this.name = name;
 *     }
 * ```
 *
 * @internal
 */
export function ParentReference() {
    return (target: object, property: PropertySchema) => {
        property.isParentReference = true;
    };
}

/**
 * Used to define a method as callback which will be called when the object has been completely serialized.
 * When fullLoad is true the callback is called when all references are loaded as well. This is particularly useful
 * when you have @ParentReference() properties, which will be undefined in regular OnLoad callback.
 *
 * Example
 * ```typescript
 * class User {
 *     @OnLoad()
 *     onLoad() {
 *         console.log('self loaded!');
 *     }
 *
 *     @OnLoad({fullLoad: true})
 *     onFullLoad() {
 *         console.log('fully loaded, including parent references');
 *     }
 * }
 *
 * ```
 *
 * @category Decorator
 */
export function OnLoad<T>(options: { fullLoad?: boolean } = {}) {
    return (target: T, property: string) => {
        getOrCreateEntitySchema(target).onLoad.push({
            methodName: property,
            options: options,
        });
    };
}

/**
 * @internal
 */
function Exclude(t: 'all' | string = 'all') {
    return (target: object, property: PropertySchema) => {
        property.exclude = t;
    };
}

type FieldTypes<T> = string | ClassType | ForwardRefFn<T>;

type ForwardRefFn<T> = ForwardRef<T> | (() => T);

class ForwardRef<T> {
    constructor(public forwardRef: () => T) {
    }
}

export function forwardRef<T>(forwardRef: () => T): ForwardRef<T> {
    return new ForwardRef(forwardRef);
}


function resolveForwardRef<T>(forwardRef: ForwardRefFn<T>): T {
    if (forwardRef instanceof ForwardRef) {
        return forwardRef.forwardRef();
    } else {
        return forwardRef();
    }
}

/**
 * Decorator to define a field for an entity.
 */
function Field(type?: FieldTypes<any> | Types | PlainSchemaProps | ClassSchema): FieldDecoratorResult<any> {
    return FieldDecoratorWrapper((target, property, returnType) => {
        const propertyName = property.name;

        if (property.type === 'any' && !property.typeSet) {
            if (type) {
                if ('string' === typeof type) {
                    property.type = type as Types;
                    property.typeSet = true;
                } else if (type instanceof ClassSchema) {
                    property.type = 'class';
                    property.classType = type.classType;
                    property.typeSet = true;
                } else if (isPlainObject(type)) {
                    property.type = 'class';
                    property.classType = fRaw.schema(type).classType;
                    property.typeSet = true;
                } else {
                    property.setFromJSType(type);
                }
            } else {
                property.setFromJSType(returnType);
            }
        }

        const id = getClassName(target) + (property.methodName ? '::' + property.methodName : '') + '::' + propertyName;

        function getTypeName(t: any): string {
            if (t === Object) return 'Object';
            if (t === String) return 'String';
            if (t === Number) return 'Number';
            if (t === Boolean) return 'Boolean';
            if (t === Array) return 'Array';
            if (t === Date) return 'Date';
            if (isFunction(t)) return 'ForwardRef';
            if (t === undefined) return 'undefined';
            if (t === 'any') return 'any';
            if (t === 'union') return 'union';

            return getClassName(t);
        }

        if (!isArray(type) && returnType !== Promise && returnType !== undefined && type !== 'any') {
            //we don't want to check for type mismatch when returnType is a Promise.

            if (type && property.isArray && returnType !== Array) {
                throw new Error(`${id} type mismatch. Given ${property}, but declared is ${getTypeName(returnType)}. ` +
                    `Please use the correct type in @t.type(T).`
                );
            }

            if (type && !property.isArray && returnType === Array) {
                throw new Error(`${id} type mismatch. Given ${property}, but declared is ${getTypeName(returnType)}. ` +
                    `Please use @t.array(MyType) or @t.array(() => MyType), e.g. @t.array(String) for '${propertyName}: string[]'.`);
            }

            if (type && property.isMap && returnType !== Object) {
                throw new Error(`${id} type mismatch. Given ${property}, but declared is ${getTypeName(returnType)}. ` +
                    `Please use the correct type in @t.type(TYPE).`);
            }

            if (!type && returnType === Array) {
                throw new Error(`${id} type mismatch. Given nothing, but declared is Array. You have to specify what type is in that array.  ` +
                    `When you don't declare a type in TypeScript or types are excluded, you need to pass a type manually via @t.type(String).\n` +
                    `If you don't have a type, use @t.any(). If you reference a class with circular dependency, use @t.type(() => MyType).`
                );
            }

            if (!type && returnType === Object) {
                //typescript puts `Object` for undefined types.
                throw new Error(`${id} type mismatch. Given ${property}, but declared is Object or undefined. ` +
                    `Please note that Typescript's reflection system does not support type hints based on interfaces or types, but only classes and primitives (String, Number, Boolean, Date). ` +
                    `When you don't declare a type in TypeScript or types are excluded, you need to pass a type manually via @t.type(String).\n` +
                    `If you don't have a type, use @t.any(). If you reference a class with circular dependency, use @t.type(() => MyType).`
                );
            }
        }
    }, true);
}

const fRaw: any = Field();

fRaw['schema'] = function <T extends FieldTypes<any>, E extends ClassSchema | ClassType>(props: PlainSchemaProps, options: { name?: string, classType?: ClassType } = {}, base?: E): ClassSchema {
    let extendClazz: ClassType | undefined;
    if (base) {
        if (base instanceof ClassSchema) {
            extendClazz = base.classType;
        } else {
            extendClazz = base as ClassType;
        }
    }

    const clazz = extendClazz ? class extends extendClazz {
    } : (options.classType ?? class {
    });

    const schema = createClassSchema(clazz, options.name);

    if (!props) {
        throw new Error('No props given');
    }

    for (const [name, prop] of Object.entries(props!)) {
        if ('string' === typeof prop || 'number' === typeof prop || 'boolean' === typeof prop) {
            schema.addProperty(name, fRaw.literal(prop));
        } else if (isFieldDecorator(prop)) {
            schema.addProperty(name, prop);
        } else if (prop instanceof ClassSchema) {
            schema.addProperty(name, fRaw.type(prop.classType));
        } else {
            const subSchema = fRaw.schema(prop, {name});
            schema.addProperty(name, fRaw.type(subSchema.classType));
        }
    }

    return schema;
};

fRaw['extendSchema'] = function <T extends FieldTypes<any>, E extends ClassSchema | ClassType>(base: E, props: PlainSchemaProps, options: { name?: string, classType?: ClassType } = {}): ClassSchema {
    return fRaw['schema'](props, options, base);
};

fRaw['class'] = function <T extends FieldTypes<any>, E extends ClassSchema | ClassType>(props: PlainSchemaProps, options: { name?: string } = {}, base?: E): ClassType {
    return fRaw.schema(props, options).classType;
};

fRaw['extendClass'] = function <T extends FieldTypes<any>, E extends ClassSchema | ClassType>(base: E, props: PlainSchemaProps, options: { name?: string } = {}): ClassType {
    return fRaw.schema(props, options, base).classType;
};

fRaw['array'] = function <T>(this: FieldDecoratorResult<any>, type: ClassType | ForwardRefFn<T> | ClassSchema<T> | PlainSchemaProps | FieldDecoratorResult<any>): FieldDecoratorResult<ExtractType<T>[]> {
    return Field('array').template(type);
};

fRaw['map'] = function <T extends ClassType | ForwardRefFn<T> | ClassSchema<T> | PlainSchemaProps | FieldDecoratorResult<any>>(type: T, keyType: FieldDecoratorResult<any> = fRaw.any): FieldDecoratorResult<{ [name: string]: ExtractType<T> }> {
    return Field('map').template(keyType, type);
};

fRaw['any'] = Field('any');

fRaw['type'] = function <T extends FieldTypes<any>>(this: FieldDecoratorResult<any>, type: T): FieldDecoratorResult<T> {
    return Field(type);
};

fRaw['literal'] = function <T extends number | string | boolean>(this: FieldDecoratorResult<any>, type: T): FieldDecoratorResult<T> {
    return Field('literal').use((target, property) => {
        property.literalValue = type;
        property.defaultValue = type;
    });
};

fRaw['union'] = function <T>(this: FieldDecoratorResult<any>, ...types: (ClassType | ForwardRefFn<any> | ClassSchema | string | number | boolean | PlainSchemaProps | FieldDecoratorResult<any>)[]): FieldDecoratorResult<T> {
    return Field('union').use((target, property) => {
        property.setType('union');
    }).template(...types);
};

fRaw['partial'] = function <T extends ClassType>(this: FieldDecoratorResult<T>, type: T): FieldDecoratorResult<T> {
    return Field('partial').template(type);
};

fRaw['enum'] = function <T>(this: FieldDecoratorResult<T>, clazz: T, allowLabelsAsValue: boolean = false): FieldDecoratorResult<T> {
    return EnumField(clazz, allowLabelsAsValue);
};

fRaw['moment'] = MomentField();

type ExtractType<T> = T extends ForwardRefFn<infer K> ? K :
    T extends ClassType<infer K> ? K :
        T extends ClassSchema<infer K> ? K :
            T extends PlainSchemaProps ? ExtractClassDefinition<T> :
                T extends FieldDecoratorResult<any> ? ExtractDefinition<T> : T;

type StandardEnum<T> = {
    [id: string]: T | string;
    [nu: number]: string;
}

export interface MainDecorator {
    /**
     * Defines a type for a certain field. This is only necessary for custom classes
     * if the Typescript compiler does not include the reflection type in the build output.
     *
     * ```typescript
     * class User {
     *     //not necessary
     *     @t.type(MyClass)
     *     tags: MyClass = new MyClass;
     * }
     * ```
     */
    type<T extends string | ClassType | ForwardRefFn<any> | ClassSchema | PlainSchemaProps | FieldDecoratorResult<any>>(type: T): FieldDecoratorResult<ExtractType<T>>;

    /**
     * Defines a discriminated union type.
     *
     * ```typescript
     * class ConfigA {
     *     @t.discriminator
     *     kind: string = 'a';
     *
     *     @f
     *     myValue: string = '';
     * }
     *
     * class ConfigB {
     *     @t.discriminator
     *     kind: string = 'b';
     *
     *     @f
     *     myValue2: string = '';
     * }
     *
     * class User {
     *     @t.union(ConfigA, ConfigB)
     *     config: ConfigA | ConfigB = new ConfigA;
     * }
     * ```
     */
    union<T extends (ClassType | ForwardRefFn<any> | ClassSchema | PlainSchemaProps | FieldDecoratorResult<any> | string | number | boolean)[]>(...type: T): FieldDecoratorResult<ExtractType<T[number]>>;

    /**
     * Marks a field as discriminant. This field MUST have a default value.
     * The default value is used to discriminate this class type when used in a union type. See @t.union.
     */
    discriminant<T>(): FieldDecoratorResult<T>;

    /**
     * Marks a field as array.
     *
     * ```typescript
     * class User {
     *     @t.array(@t.string)
     *     tags: string[] = [];
     * }
     * ```
     */
    array<T extends ClassType | ForwardRefFn<any> | ClassSchema | PlainSchemaProps | FieldDecoratorResult<any>>(type: T): FieldDecoratorResult<ExtractType<T>[]>;

    /**
     * Creates a new ClassSchema from a plain schema definition object.
     * If you want to decorate an external/already existing class, use `options.classType`.
     */
    schema<T extends PlainSchemaProps>(props: T, options?: { name?: string, classType?: ClassType }): ClassSchema<ExtractClassDefinition<T>>;

    extendSchema<T extends PlainSchemaProps, BASE extends ClassSchema | ClassType>(base: BASE, props: T, options?: { name?: string, classType?: ClassType }): ClassSchema<MergeSchemaAndBase<T, BASE>>;

    /**
     * Creates a new javascript class from a plain schema definition object.
     */
    class<T extends PlainSchemaProps>(props: T, options?: { name?: string }): ClassType<ExtractClassDefinition<T>>;

    extendClass<T extends PlainSchemaProps, BASE extends ClassSchema | ClassType>(base: BASE, props: T, options?: { name?: string }): ClassType<MergeSchemaAndBase<T, BASE>>;

    /**
     * Marks a field as string.
     */
    string: FieldDecoratorResult<string>;

    /**
     * Marks a field as literal type. Nice with union types.
     *
     * ```typescript
     * @t.literal('a')
     *
     * @t.union(t.literal('a'), t.literal('b')) //'a' | 'b'
     *
     * @t.union('a', 'b') //'a' | 'b'
     * ```
     */
    literal<T extends number | string | boolean>(type: T): FieldDecoratorResult<T>;

    /**
     * Marks a field as number.
     */
    number: FieldDecoratorResult<number>;

    /**
     * Marks a field as boolean.
     */
    boolean: FieldDecoratorResult<boolean>;

    /**
     * Marks a field as Date.
     */
    date: FieldDecoratorResult<Date>;

    /**
     * Marks a field as enum.
     *
     * ```typescript
     * enum MyEnum {
     *     low;
     *     medium;
     *     hight;
     * }
     *
     * class User {
     *     @t.enum(MyEnum)
     *     level: MyEnum = MyEnum.low;
     * }
     * ```
     *
     * If allowLabelsAsValue is set, you can use the enum labels as well for setting the property value using plainToClass().
     *
     * Note: const enums are not supported.
     */
    enum<T>(type: T, allowLabelsAsValue?: boolean): FieldDecoratorResult<T[keyof T]>;

    /**
     * Marks a field as partial of a class entity. It differs in a way to standard Partial<> that
     * it allows path based sub values, like you know from JSON patch.
     *
     * ```typescript
     * class Config {
     *     @f
     *     name?: string;
     *
     *     @f
     *     sub?: Config;
     *
     *     @f
     *     prio: number = 0;
     * }
     *
     * class User {
     *     @t.partial(Config)
     *     config: PartialField<Config> = {};
     * }
     * ```
     */
    partial<T extends ClassType | ForwardRefFn<any> | ClassSchema | PlainSchemaProps | FieldDecoratorResult<any>>(type: T): FieldDecoratorResult<PartialField<ExtractType<T>>>;

    /**
     * Marks a field as Moment.js value. Mongo and JSON transparent uses its toJSON() result.
     * In MongoDB its stored as Date.
     *
     * You have to install moment npm package in order to use it.
     */
    moment: FieldDecoratorResult<any>;

    /**
     * Marks a field as type any. It does not transform the value and directly uses JSON.parse/stringify.
     */
    any: FieldDecoratorResult<any>;

    /**
     * Marks a field as map.
     *
     * ```typescript
     * class User {
     *     @t.map(f.string)
     *     tags: {[k: string]: string};
     *
     *     @t.map(@t.type(() => MyClass))
     *     tags: {[k: string]: MyClass};
     * }
     * ```
     */
    map<T extends ClassType | ForwardRefFn<any> | ClassSchema | PlainSchemaProps | FieldDecoratorResult<any>>(type: T): FieldDecoratorResult<{ [name: string]: ExtractType<T> }>;
}

/**
 * This is the main decorator to define a properties on class or arguments on methods.
 *
 * ```typescript
 * class SubModel {
 *    @f label: string;
 * }
 *
 * export enum Plan {
 *   DEFAULT,
 *   PRO,
 *   ENTERPRISE,
 * }
 *
 * class SimpleModel {
 *   @t.primary.uuid
 *   id: string = uuid();
 *
 *   @t.array(f.string)
 *   tags: string[] = [];
 *
 *   @t.type(ArrayBuffer).optional() //binary
 *   picture?: ArrayBuffer;
 *
 *   @f
 *   type: number = 0;
 *
 *   @t.enum(Plan)
 *   plan: Plan = Plan.DEFAULT;
 *
 *   @f
 *   created: Date = new Date;
 *
 *   @t.array(SubModel)
 *   children: SubModel[] = [];
 *
 *   @t.map(SubModel)
 *   childrenMap: {[key: string]: SubModel} = {};
 *
 *   constructor(
 *       @t.index().name('name') //name is required for minimized code
 *       public name: string
 *   ) {}
 * }
 * ```
 *
 * @category Decorator
 */
export const f: MainDecorator & FieldDecoratorResult<any> = fRaw as any;

export const field: MainDecorator & FieldDecoratorResult<any> = fRaw as any;

export const type: MainDecorator & FieldDecoratorResult<any> = fRaw as any;

export const t: MainDecorator & FieldDecoratorResult<any> = fRaw as any;

/**
 * @internal
 */
function MongoIdField() {
    return (target: object, property: PropertySchema) => {
        property.setType('objectId');
        if (property.name === '_id') {
            property.isOptional = true;
        }
    };
}

/**
 * @internal
 */
function UUIDField() {
    return (target: object, property: PropertySchema) => {
        property.setType('uuid');
    };
}

/**
 * @internal
 */
function Index(options?: IndexOptions, name?: string) {
    return (target: object, property: PropertySchema) => {
        const schema = getOrCreateEntitySchema(target);
        if (property.methodName && property.methodName !== 'constructor') {
            throw new Error('Index could not be used on method arguments.');
        }

        name = name || property.name;
        options = options || {};
        const index = schema.indices.get(name);
        const fields: string[] = [];
        if (index) {
            fields.push(...index.fields);
        }
        fields.push(property.name);

        if (index) {
            options = Object.assign({}, index.options, options);
        }

        schema.indices.set(name, {fields, options});
    };
}

/**
 * @internal
 */
function Data(key: string, value: any) {
    return (target: object, property: PropertySchema) => {
        property.data[key] = value;
    };
}

/**
 * Used to define an index on a class.
 *
 * @category Decorator
 */
export function MultiIndex(fields: string[], options?: IndexOptions, name?: string) {
    return (target: object, property?: string, parameterIndexOrDescriptor?: any) => {
        const classType = (target as any).prototype as ClassType;
        const schema = getOrCreateEntitySchema(classType);

        schema.indices.set(name || fields.join('_'), {fields: fields as string[], options: options || {}});
    };
}

/**
 * Used to define a field as Enum.
 * If allowLabelsAsValue is set, you can use the enum labels as well for setting the property value using plainToClass().
 *
 * @internal
 */
function EnumField<T>(type: any, allowLabelsAsValue = false) {
    return Field('enum').use((target, property) => {
        property.setClassType(type);
        property.allowLabelsAsValue = allowLabelsAsValue;
    });
}

/**
 * @internal
 */
function MomentField<T>() {
    return FieldDecoratorWrapper((target, property, returnType?: any) => {
        property.setType('moment');
    });
}
