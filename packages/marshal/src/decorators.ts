import {PropertyValidatorError} from "./validation";
import {
    ClassType,
    eachKey,
    eachPair,
    getClassName,
    isClass,
    isFunction,
    isNumber,
    isObject,
    isPlainObject,
} from '@super-hornet/core';
import * as getParameterNames from "get-parameter-names";
import {isArray} from "./utils";
import {Buffer} from "buffer";

interface GlobalStore {
    RegisteredEntities: { [name: string]: ClassType<any> };
    unpopulatedCheckActive: boolean;
}

function getGlobal(): any {
    if ('undefined' !== typeof globalThis) return globalThis;
    if ('undefined' !== typeof window) return window;
    throw Error('No global');
}

export function getGlobalStore(): GlobalStore {
    const global = getGlobal();
    if (!global.MarshalStore) {
        global.MarshalStore = {
            RegisteredEntities: {},
            unpopulatedCheckActive: true,
        } as GlobalStore;
    }

    return global.MarshalStore;
}

export type Types =
    'objectId'
    | 'uuid'
    | 'class'
    | 'map'
    | 'partial'
    | 'array'
    | 'union'
    | 'moment'
    | 'date'
    | 'string'
    | 'boolean'
    | 'Int8Array'
    | 'Uint8Array'
    | 'Uint8ClampedArray'
    | 'Int16Array'
    | 'Uint16Array'
    | 'Int32Array'
    | 'Uint32Array'
    | 'Float32Array'
    | 'Float64Array'
    | 'arrayBuffer'
    | 'number'
    | 'enum'
    | 'any';


/**
 * Type for @f.partial().
 *
 * Differs to standard Partial<> in a way that it supports sub class fields using dot based paths (like mongoDB)
 */
export type PartialField<T> = {
    [P in keyof T & string]?: T[P]
} & {
    //it's currently not possible to further define it
    //https://github.com/Microsoft/TypeScript/issues/12754
    [path: string]: any
}

export type PartialEntity<T> = { [name in keyof T & string]?: T[name] };

export const typedArrayMap = new Map<any, Types>();
typedArrayMap.set(String, 'string');
typedArrayMap.set(Number, 'number');
typedArrayMap.set(Date, 'date');
typedArrayMap.set(Boolean, 'boolean');
typedArrayMap.set(Int8Array, 'Int8Array');
typedArrayMap.set(Buffer, 'Uint8Array');
typedArrayMap.set(Uint8Array, 'Uint8Array');
typedArrayMap.set(Uint8ClampedArray, 'Uint8ClampedArray');
typedArrayMap.set(Int16Array, 'Int16Array');
typedArrayMap.set(Uint16Array, 'Uint16Array');
typedArrayMap.set(Int32Array, 'Int32Array');
typedArrayMap.set(Uint32Array, 'Uint32Array');
typedArrayMap.set(Float32Array, 'Float32Array');
typedArrayMap.set(Float64Array, 'Float64Array');
typedArrayMap.set(ArrayBuffer, 'arrayBuffer');

export const typedArrayNamesMap = new Map<Types, any>();
typedArrayNamesMap.set('Int8Array', Int8Array);
typedArrayNamesMap.set('Uint8Array', Uint8Array);
typedArrayNamesMap.set('Uint8ClampedArray', Uint8ClampedArray);
typedArrayNamesMap.set('Int16Array', Int16Array);
typedArrayNamesMap.set('Uint16Array', Uint16Array);
typedArrayNamesMap.set('Int32Array', Int32Array);
typedArrayNamesMap.set('Uint32Array', Uint32Array);
typedArrayNamesMap.set('Float32Array', Float32Array);
typedArrayNamesMap.set('Float64Array', Float64Array);

export function isTypedArray(type: Types): boolean {
    return typedArrayNamesMap.has(type);
}

export interface PropertyValidator {
    validate<T>(value: any, propertyName: string, classType?: ClassType<any>,): PropertyValidatorError | undefined | void;
}

export function isPropertyValidator(object: any): object is ClassType<PropertyValidator> {
    return isClass(object);
}

type IndexOptions = Partial<{
    unique: boolean,
    spatial: boolean,
    sparse: boolean,
    synchronize: boolean,
    fulltext: boolean,
    where: string,
}>;


export interface PropertySchemaSerialized {
    name: string;
    type: Types;
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
}

/**
 * Contains all resolved information from PropertySchema necessary to feed compiler functions.
 *
 * Internal note: It's on purpose aligned with PropertySchema.
 */
export class PropertyCompilerSchema {
    type: Types = 'any';

    get isArray() {
        return this.type === 'array';
    }

    get isMap() {
        return this.type === 'map';
    }

    get isPartial() {
        return this.type === 'partial';
    }

    groupNames: string[] = [];

    /**
     * Whether given classType can be populated partially (for example in patch mechanisms).
     */

    isOptional: boolean = false;
    isDiscriminant: boolean = false;

    //for enums
    allowLabelsAsValue: boolean = false;

    isParentReference: boolean = false;

    validators: ClassType<PropertyValidator>[] = [];

    /**
     * Whether its a owning reference.
     */
    isReference: boolean = false;

    hasDefaultValue: boolean = false;

    defaultValue: any;

    templateArgs: PropertyCompilerSchema[] = [];

    constructor(
        public name: string,
        public classType?: ClassType<any> | ClassType<any>[]
    ) {
    }

    toString() {
        if (this.type === 'array') {
            return `Array`;
        }
        if (this.type === 'map') {
            return `Map`;
        }
        if (this.type === 'partial') {
            return `Partial`;
        }
        if (this.type === 'union') {
            return this.resolveUnionTypes.map(v => getClassName(v)).join(' | ');
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


    get resolveClassType(): ClassType<any> | undefined {
        return isArray(this.classType) ? undefined : this.classType;
    }

    get resolveUnionTypes(): ClassType<any>[] {
        return isArray(this.classType) ? this.classType : [];
    }

    public isActualOptional(): boolean {
        return this.isOptional || this.type === 'any';
    }

    static createFromPropertySchema(
        propertySchema: PropertySchema,
    ): PropertyCompilerSchema {
        const i = new PropertyCompilerSchema(
            propertySchema.name,
            propertySchema.getResolvedClassTypeForValidType()
        );
        i.type = propertySchema.type;
        i.validators = propertySchema.validators;
        i.isOptional = propertySchema.isOptional;
        i.isDiscriminant = propertySchema.isDiscriminant;
        i.allowLabelsAsValue = propertySchema.allowLabelsAsValue;
        i.isReference = propertySchema.isReference;
        i.isParentReference = propertySchema.isParentReference;
        i.hasDefaultValue = propertySchema.hasDefaultValue;
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
    protected classTypeResolved?: ClassType<any>;

    protected unionTypes?: (ClassType<any> | ForwardRefFn<any>)[];
    protected unionResolved?: ClassType<any>[];

    templateArgs: PropertySchema[] = [];

    constructor(name: string) {
        super(name);
    }

    toString() {
        if (!this.typeSet) return 'undefined';
        if (this.type === 'array') {
            return `${this.templateArgs[0]}[]`;
        }
        if (this.type === 'map') {
            return `Map<${this.templateArgs[0]}, ${this.templateArgs[1]}>`;
        }
        if (this.type === 'partial') {
            return `Partial<${this.templateArgs[0]}>`;
        }
        if (this.type === 'class') {
            if (this.classTypeForwardRef) {
                const resolved = this.classTypeForwardRef();
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

    setClassType(classType?: ClassType<any>) {
        this.classType = classType;
    }

    toJSON(): PropertySchemaSerialized {
        const props: PropertySchemaSerialized = {
            name: this.name,
            type: this.type
        };

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

        if (this.templateArgs) {
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

        if (props['isDecorated']) p.isDecorated = true;
        if (props['isParentReference']) p.isParentReference = true;
        if (props['isDiscriminant']) p.isDiscriminant = true;
        if (props['isOptional']) p.isOptional = true;
        if (props['isId']) p.isId = true;
        if (props['allowLabelsAsValue']) p.allowLabelsAsValue = true;
        if (props['typeSet']) p.typeSet = true;
        if (props['methodName']) p.methodName = props['methodName'];
        if (props['groupNames']) p.groupNames = props['groupNames'];

        if (props['templateArgs']) {
            p.templateArgs = props['templateArgs'].map(v => PropertySchema.fromJSON(v));
        }

        if (props['classType']) {
            const entity = getGlobalStore().RegisteredEntities[props['classType']];
            if (!entity) {
                throw new Error(`Could not unserialize type information for ${p.methodName || ''}:${p.name}, got entity name ${props['classType']}. ` +
                    `Make sure given entity is loaded (imported at least once globally).`);
            }
            p.classType = entity;
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

    setUnionTypes(types: (ClassType<any> | ForwardRefFn<any>)[]) {
        this.type = 'union';
        this.unionTypes = types;
    }

    setFromJSType(type: any) {
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
            this.classType = type as ClassType<any>;

            if (isFunction(type)) {
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

    get resolveClassType(): ClassType<any> | undefined {
        if (this.type === 'class' || this.type === 'enum') {
            return this.getResolvedClassType();
        }
        return;
    }

    get resolveUnionTypes(): ClassType<any>[] {
        if (this.type === 'union') {
            return this.getResolvedUnionTypes();
        }

        return [];
    }

    getResolvedClassTypeForValidType(): ClassType<any>[] | ClassType<any> | undefined {
        if (this.type === 'class' || this.type === 'enum') {
            return this.getResolvedClassType();
        }

        if (this.type === 'union') {
            return this.getResolvedUnionTypes();
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

    getResolvedUnionTypes(): ClassType<any>[] {
        if (this.unionResolved) {
            return this.unionResolved;
        }

        this.unionResolved = [];
        if (this.unionTypes) {
            for (const v of this.unionTypes) {
                this.unionResolved.push(isFunction(v) ? (v as any)() : v);
            }
        }

        return this.unionResolved;
    }

    getResolvedClassType(): ClassType<any> {
        if (this.isArray || this.isMap) return this.getSubType().getResolvedClassType();

        if (this.classTypeResolved) {
            return this.classTypeResolved;
        }

        if (this.classTypeForwardRef) {
            this.classTypeResolved = this.classTypeForwardRef();
            if (this.classTypeResolved) {
                return this.classTypeResolved;
            }
            throw new Error(`ForwardRef returns no value. ${this.classTypeForwardRef}`);
        }

        if (!this.classType || isArray(this.classType)) {
            throw new Error(`No ClassType given for field ${this.name}. Use @f.type(() => MyClass) for circular dependencies.`);
        }

        return this.classType;
    }
}

export interface EntityIndex {
    name: string,
    fields: string[],
    options: IndexOptions
}

export class ClassSchema<T = any> {
    classType: ClassType<T>;
    name?: string;
    collectionName?: string;
    databaseName?: string;

    /**
     * Name of the property which this class is decorating.
     * As soon as someone use this class, the actual value of this property is used to serialize.
     */
    decorator?: string;

    /**
     * Name of the property that is a discriminant of this class.
     * This is automatically set when at least one property has @f.discriminant.
     */
    discriminant?: string;

    /**
     * Each method can have its own PropertySchema definition for each argument, where map key = method name.
     */
    protected methodProperties = new Map<string, PropertySchema[]>();
    methods: { [name: string]: PropertySchema } = {};

    /**
     * @internal
     */
    protected initializedMethods = new Set<string>();

    protected classProperties = new Map<string, PropertySchema>();

    idField?: keyof T & string;
    propertyNames: string[] = [];

    protected methodsParamNames = new Map<string, string[]>();
    protected methodsParamNamesAutoResolved = new Map<string, string[]>();

    indices: EntityIndex[] = [];

    /**
     * Contains all references, owning reference and back references.
     */
    public readonly references = new Set<PropertySchema>();

    protected referenceInitialized = false;
    protected hasDefaultsInitialized = false;

    protected primaryKeys?: PropertySchema[];

    onLoad: { methodName: string, options: { fullLoad?: boolean } }[] = [];
    protected hasFullLoadHooksCheck = false;

    constructor(classType: ClassType<any>) {
        this.classType = classType;
    }

    loadDefaults() {
        if (this.hasDefaultsInitialized) return;

        //its important that the class supports calling the constructor without any values
        //same for proxy instances btw.
        try {
            const instance: any = new this.classType();
            for (const property of this.classProperties.values()) {
                if (instance[property.name] !== null && instance[property.name] !== undefined) {
                    try {
                        property.defaultValue = instance[property.name];
                        property.hasDefaultValue = true;
                    } catch (error) {
                        //we simply ignore it
                    }
                }
            }
        } catch (error) {
            throw new Error(
                `Class ${this.getClassName()} constructor is not callable without values. ` +
                `Make sure not to depend on constructor arguments. This is necessary for default value checking. ` +
                `Error: ${error}`
            );
        }
        this.hasDefaultsInitialized = true;
    }

    public getClassName(): string {
        return getClassName(this.classType);
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

    public addIndex(name: string, options?: IndexOptions) {
        this.indices.push({name: name, fields: [name], options: options || {}});
    }

    public clone(classType: ClassType<any>): ClassSchema {
        const s = new ClassSchema(classType);
        s.name = this.name;
        s.collectionName = this.collectionName;
        s.databaseName = this.databaseName;
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

        s.indices = [];
        for (const v of this.indices) {
            s.indices.push({...v});
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
            throw new Error(`Class ${getClassName(this.classType)} has no primary field. Use @f.primary() to define one.`)
        }

        return this.getProperty(this.idField);
    }

    public getPrimaryFields(): PropertySchema[] {
        if (this.primaryKeys) return this.primaryKeys;

        this.primaryKeys = [];
        for (const property of this.getClassProperties().values()) {
            if (property.isId) this.primaryKeys.push(property);
        }
        if (!this.primaryKeys.length) throw new Error(`Entity ${this.getClassName()} has no primary fields. Use @f.primary() to define one.`);

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

    protected initializeMethod(name: string) {
        if (!this.initializedMethods.has(name)) {
            if (name !== 'constructor' && !Reflect.hasMetadata('design:returntype', this.classType.prototype, name)) {
                throw new Error(`Method ${name} has no decorators used or is not defined, so reflection does not work. Use @f on the method or arguments. Is emitDecoratorMetadata enabled?`);
            }

            if (name !== 'constructor' && !this.methods[name]) {
                const returnType = Reflect.getMetadata('design:returntype', this.classType.prototype, name);
                if (returnType !== Promise) {
                    //Promise is not a legit returnType as this is automatically the case for async functions
                    //we assume no meta data is given when Promise is defined, as it basically tells us nothing.
                    this.methods[name] = new PropertySchema(name);
                    this.methods[name].setFromJSType(returnType);
                }
            }

            const properties = this.getOrCreateMethodProperties(name);

            const paramtypes = name === 'constructor'
                ? Reflect.getMetadata('design:paramtypes', this.classType)
                : Reflect.getMetadata('design:paramtypes', this.classType.prototype, name);

            for (const [i, t] of eachPair(paramtypes)) {
                if (!properties[i]) {
                    properties[i] = new PropertySchema(String(i));
                    if (paramtypes[i] !== Object) {
                        properties[i].setFromJSType(t)
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

    /**
     * Before accessing `classProperties`, its necessary to call this method.
     */
    public initializeProperties() {
        // we don't create for now a new field as 'foreign key' as the field itself
        // is the foreignKey. This will probably change once we support composite primary keys.
        // when we do this, we need to mark those fields as 'implementation detail'
        // since generating 2 fields is for RDMBS, and having everything as object {} is for mongoDB
        // better, so this functionality depends actually on the database, rather than on Marshal itself.
        // if (!this.referenceInitialized) {
        //     this.referenceInitialized = true;
        //     for (const reference of this.references.values()) {
        //         if (reference.isReference) {
        //
        //             // const schema = reference.getResolvedClassSchema();
        //             // const name = reference.name + capitalizeFirstLetter(schema.getPrimaryField().name);
        //             // if (!this.classProperties.has(name)) {
        //             //     const foreignKey = schema.getPrimaryField().clone();
        //             //     foreignKey.isReference = false;
        //             //     foreignKey.backReference = undefined;
        //             //     foreignKey.index = {...reference.index};
        //             //     foreignKey.name = name;
        //             //     foreignKey.isId = reference.isId;
        //             //     this.classProperties.set(name, foreignKey);
        //             //     getClassSchema(this.classType).addIndex(foreignKey.name, foreignKey.index);
        //             // }
        //             // this.classProperties.get(name)!.isReferenceKey = true;
        //         }
        //     }
        // }
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
        for (const index of this.indices) {
            if (index.name === name) {
                return index;
            }
        }
        return;
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
    public findReverseReference(toClassType: ClassType<any>, fromReference: PropertySchema): PropertySchema {
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

            //add to candidates if possible
            if (fromReference.backReference && fromReference.backReference.via && backRef.backReference && backRef.backReference.via) {
                if (resolveClassTypeOrForward(fromReference.backReference.via) === resolveClassTypeOrForward(backRef.backReference.via)) {
                    candidates.push(backRef);
                }
            } else {
                candidates.push(backRef);
            }
        }

        if (candidates.length > 1) {
            throw new Error(`Class ${getClassName(this.classType)} has multiple potential reverse references [${candidates.map(v => v.name).join(', ')}] for ${fromReference.name} to class ${getClassName(toClassType)}. ` +
                `Please specify each back reference by using 'mappedBy', e.g. @f.backReference({mappedBy: 'fieldNameOnTheOtherSide'} so its not ambiguous anymore.`);
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
        throw new Error(`No Marshal class found with name '${name}'`);
    }

    return getClassSchema(getGlobalStore().RegisteredEntities[name]);
}

/**
 * Returns all names registered as @Entity() known to Marshal.
 */
export function getKnownClassSchemasNames(): string[] {
    return Object.keys(getGlobalStore().RegisteredEntities);
}

const classSchemaSymbol = Symbol('classSchema');

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
export function getClassSchema<T>(classTypeIn: ClassType<T> | Object): ClassSchema<T> {
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
    //this is necessary to give the class a dynamic name if it has none
    const o = {
        [name]: clazz || new class {
        }
    };

    const classSchema = getOrCreateEntitySchema(o[name]);
    classSchema.name = name;

    return classSchema;
}

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
 * Returns true if given class has an @Entity() or @f defined, and thus became
 * a Marshal entity.
 */
export function isRegisteredEntity<T>(classType: ClassType<T>): boolean {
    return classType.prototype.hasOwnProperty(classSchemaSymbol);
}

/**
 * Used to define a entity name for an entity.
 *
 * The name is used for an internal registry, so ot should be a unique one.
 *
 * Marshal's database abstraction uses this name to generate the collection name / table name.
 *
 * @category Decorator
 */
export function Entity<T>(name: string, collectionName?: string) {
    return (target: ClassType<T>) => {
        if (getGlobalStore().RegisteredEntities[name]) {
            throw new Error(`Marshal entity with name '${name}' already registered. 
            This could be caused by the fact that you used a name twice or that you loaded the entity 
            via different imports.`)
        }

        getGlobalStore().RegisteredEntities[name] = target;
        getOrCreateEntitySchema(target).name = name;
        getOrCreateEntitySchema(target).collectionName = collectionName;
    };
}

/**
 * Used to define a database name for an entity. Per default marshal's database abstraction
 * uses the default database, but you can change that using this decorator.
 *
 * @category Decorator
 */
export function DatabaseName<T>(name: string) {
    return (target: ClassType<T>) => {
        getOrCreateEntitySchema(target).databaseName = name;
    };
}

export interface BackReferenceOptions<T> {
    /**
     * Necessary for normalised many-to-many relations. This defines the class of the pivot table/collection.
     */
    via?: ClassType<any> | ForwardRefFn<ClassType<any>>,

    /**
     * A reference/backReference can define which reference on the other side
     * reference back. This is necessary when multiple outgoing references
     * to the same
     */
    mappedBy?: T extends ClassType<infer K> ? keyof K & string : '',
}

export function resolveClassTypeOrForward(type: ClassType<any> | ForwardRefFn<ClassType<any>>): ClassType<any> {
    return isFunction(type) ? (type as Function)() : type;
}


export type ValidatorFn = (value: any, propertyName: string, classType?: ClassType<any>) => PropertyValidatorError | undefined | void;

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
     */
    reference(): this;

    /**
     * Marks this reference as not-owning side.
     *
     * options.via: If the foreign class is not directly accessible, you can use a pivot collection/table
     *              using the `via` option. Make sure that the given class in `via` contains both reference
     *              (one back to this class and one to the actual foreign class).
     *
     * options.mappedBy: Explicitly set the name of the @f.reference() of the foreign class to which this backReference belongs to.
     *                   Per default it is automatically detected, but will fail if you the foreign class contains more
     *                   than one @f.reference() to this class.
     * @param options
     */
    backReference(options?: BackReferenceOptions<T>): this;

    /**
     * Marks this type as optional (allow to set as undefined). Per default the type is required, this makes it optional.
     */
    optional: this;

    /**
     * Marks this field as discriminant for the discriminator in union types.
     * See @f.union()
     */
    discriminant: this;

    /**
     * Used to define a field as excluded when serialized from class to different targets (like mongo or plain).
     * PlainToClass or mongoToClass is not effected by this.
     * This exclusion is during compile time, if you need a runtime exclude/include mechanism,
     * please use @f.group('groupName') and use in classToPain/partialClassToPlain the options
     * argument to filter, e.g. {groupsExclude: ['groupName']}.
     */
    exclude(t?: 'all' | 'database' | 'plain' | string): this;

    /**
     * Marks this field as an ID aka primary.
     * This is important if you interact with the database abstraction.
     *
     * Only one field in a class can be the ID.
     */
    primary: this;

    /**
     * Defines template arguments of a generic class. Very handy for types like Observables.
     *
     * ```typescript
     * class Stuff {
     * }
     *
     * class Page {
     *     @f.template(Stuff)
     *     downloadStuff(): Observable<Stuff> {
     *          return new Observable<Stuff>((observer) => {
     *              observer.next(new Stuff());
     *          })
     *     }
     *
     *     //or more verbose way if the type is more complex.
     *     @f.template(f.type(Stuff).optional)
     *     downloadStuffWrapper(): Observable<Stuff | undefined> {
     *          return new Observable<Stuff>((observer) => {
     *              observer.next(new Stuff());
     *          })
     *     }
     * }
     * ```
     */
    template(...templateArgs: (FieldDecoratorResult<any> | FieldTypes<any>)[]): this;

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
     *     @f.group(Group.confidential) password: string;
     *
     *     @f.group('bar') foo: string;
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
     *     @f.mongoId
     *     referenceToSomething?: string;
     *
     *     constructor(
     *         @f.primary.mongoId
     *         public readonly _id: string
     *     ) {
     *
     *     }
     * }
     * ```
     */
    mongoId: this;

    /**
     * Used to define a field as UUID (v4).
     */
    uuid: this;

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
     *     @f.type(() => PageClass).decorated
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
     *     @f.uuid
     *     id: string = uuid();
     *
     *     @f
     *     name: string;
     *
     *     @f.type(() => PageCollection)
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
     * import {PropertyValidator, PropertyValidatorError} from '@super-hornet/marshal';
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
     *     @f.validator(MyCustomValidator)
     *     name: string;
     *
     *     @f.validator(MyCustomValidator)
     *     name: string;
     *
     *     @f.validator((value: any, target: ClassType<any>, propertyName: string) => {
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
        ...validators: (ClassType<PropertyValidator> | ValidatorFn)[]
    ): this;

    /**
     * Creates a PropertySchema object from the given definition.
     */
    buildPropertySchema(name?: string): PropertySchema;
}

export function isFieldDecorator(t: any): t is FieldDecoratorResult<any> {
    return isFunction(t) && isFunction(t.name) && isFunction(t.optional)
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

    function buildPropertySchema(target: object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any) {
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

        const isMethod = propertyOrMethodName && Reflect.hasMetadata('design:returntype', target, propertyOrMethodName) && !isNumber(parameterIndexOrDescriptor);

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
                throw new Error(`Defining multiple Marshal decorators with different names at arguments of ${getClassName(target)}::${methodName} #${parameterIndexOrDescriptor} is forbidden.` +
                    ` @f.asName('name') is required. Got ${methodsParamNames[parameterIndexOrDescriptor] || methodsParamNamesAutoResolved[parameterIndexOrDescriptor]} !== ${givenPropertyName}`)
            }

            if (givenPropertyName) {
                //we only store the name, when we explicitly defined one
                methodsParamNames[parameterIndexOrDescriptor] = givenPropertyName;
            } else if (methodName === 'constructor') {
                //only for constructor methods
                const constructorParamNames = getParameterNames((target as ClassType<any>).prototype.constructor);
                // const constructorParamNames = getCachedParameterNames((target as ClassType<any>).prototype.constructor);
                givenPropertyName = constructorParamNames[parameterIndexOrDescriptor];

                if (givenPropertyName) {
                    methodsParamNamesAutoResolved[parameterIndexOrDescriptor] = givenPropertyName;
                }
            }

            if (methodName === 'constructor') {
                //constructor
                const returnTypes = Reflect.getMetadata('design:paramtypes', target);
                if (returnTypes) returnType = returnTypes[parameterIndexOrDescriptor];
            } else {
                //method
                const returnTypes = Reflect.getMetadata('design:paramtypes', target, methodName);
                if (returnTypes) returnType = returnTypes[parameterIndexOrDescriptor];
            }

        } else {
            //it's a class property, so propertyOrMethodName contains the actual property name
            if (propertyOrMethodName) {
                returnType = Reflect.getMetadata('design:type', target, propertyOrMethodName);

                if (isMethod) {
                    //its a method, so returnType is the actual type
                    returnType = Reflect.getMetadata('design:returntype', target, propertyOrMethodName);
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
                        schema.getClassProperties(false).set(givenPropertyName, new PropertySchema(givenPropertyName));
                        schema.propertyNames.push(givenPropertyName);
                    }

                    propertySchema = schema.getClassProperties(false).get(givenPropertyName)!;
                    argumentsProperties[parameterIndexOrDescriptor] = propertySchema;
                } else {
                    if (!argumentsProperties[parameterIndexOrDescriptor]) {
                        argumentsProperties[parameterIndexOrDescriptor] = new PropertySchema(String(parameterIndexOrDescriptor));
                        argumentsProperties[parameterIndexOrDescriptor].methodName = methodName;
                    }

                    propertySchema = argumentsProperties[parameterIndexOrDescriptor];
                }
            } else {
                if (!givenPropertyName) {
                    throw new Error(`Could not resolve property name for class property on ${getClassName(target)}`);
                }

                if (!schema.getClassProperties(false).has(givenPropertyName)) {
                    schema.getClassProperties(false).set(givenPropertyName, new PropertySchema(givenPropertyName));
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

    Object.defineProperty(fn, 'discriminant', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Discriminant()]);
        }
    });

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

    fn.reference = () => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.isReference = true;
            getClassSchema(target).registerReference(property);
        }]);
    };

    Object.defineProperty(fn, 'string', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
                property.type = 'string';
            }]);
        }
    });

    Object.defineProperty(fn, 'number', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
                property.type = 'number';
            }]);
        }
    });

    Object.defineProperty(fn, 'date', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
                property.type = 'date';
            }]);
        }
    });

    Object.defineProperty(fn, 'boolean', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
                property.type = 'boolean';
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

    fn.template = (...templateArgs: any[]) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.templateArgs = [];
            for (const [i, t] of eachPair(templateArgs)) {
                if (isFieldDecorator(t)) {
                    //its a decorator @f()
                    //target: object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any
                    const p = t.buildPropertySchema(String(i));
                    property.templateArgs.push(p);
                } else {
                    const p = new PropertySchema(String(i));
                    p.setFromJSType(t);
                    property.templateArgs.push(p);
                }
            }
        }]);
    };

    function createValidator(validator: ValidatorFn) {
        return class implements PropertyValidator {
            validate<T>(value: any, propertyName: string, classType?: ClassType<any>): PropertyValidatorError | undefined | void {
                return validator(value, propertyName, classType);
            }
        };
    }

    fn.buildPropertySchema = function(name: string = 'unknown') {
        return buildPropertySchema(Object, name);
    }

    fn.validator = (...validators: (ClassType<PropertyValidator> | ValidatorFn)[]) => {
        resetIfNecessary();
        const validatorClasses: ClassType<PropertyValidator>[] = [];

        for (const validator of validators) {
            const validatorClass: ClassType<PropertyValidator> = isPropertyValidator(validator) ? validator : createValidator(validator);
            validatorClasses.push(validatorClass);
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
        getOrCreateEntitySchema(target).idField = property.name;
        property.isId = true;
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
 *     @f.type(() => Job).parentReference //forward necessary since circular dependency
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
 *     @f.uuid
 *     id: string = uuid();
 *
 *     @f
 *     name: string;
 *
 *     @f.type(() => PageClass) //forward necessary since circular dependency
 *     children: PageClass[] = [];
 *
 *     @f.type(() => PageClass).optional.parentReference //forward necessary since circular dependency
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

type FieldTypes<T> = string | ClassType<T> | ForwardRefFn<T>;

type ForwardRefFn<T> = () => T;

/**
 * Decorator to define a field for an entity.
 */
function Field(type?: FieldTypes<any> | Types) {
    return FieldDecoratorWrapper((target, property, returnType) => {
        const propertyName = property.name;

        if (property.type === 'any' && !property.typeSet) {
            if (type) {
                if ('string' === typeof type) {
                    property.type = type as Types;
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
                    `Please use the correct type in @f.type(T).`
                );
            }

            if (type && !property.isArray && returnType === Array) {
                throw new Error(`${id} type mismatch. Given ${property}, but declared is ${getTypeName(returnType)}. ` +
                    `Please use @f.array(MyType) or @f.array(() => MyType), e.g. @f.array(String) for '${propertyName}: string[]'.`);
            }

            if (type && property.isMap && returnType !== Object) {
                throw new Error(`${id} type mismatch. Given ${property}, but declared is ${getTypeName(returnType)}. ` +
                    `Please use the correct type in @f.type(TYPE).`);
            }

            if (!type && returnType === Array) {
                throw new Error(`${id} type mismatch. Given nothing, but declared is Array. You have to specify what type is in that array.  ` +
                    `When you don't declare a type in TypeScript or types are excluded, you need to pass a type manually via @f.type(String).\n` +
                    `If you don't have a type, use @f.any(). If you reference a class with circular dependency, use @f.type(() => MyType).`
                );
            }

            if (!type && returnType === Object) {
                //typescript puts `Object` for undefined types.
                throw new Error(`${id} type mismatch. Given ${property}, but declared is Object or undefined. ` +
                    `Please note that Typescript's reflection system does not support type hints based on interfaces or types, but only classes and primitives (String, Number, Boolean, Date). ` +
                    `When you don't declare a type in TypeScript or types are excluded, you need to pass a type manually via @f.type(String).\n` +
                    `If you don't have a type, use @f.any(). If you reference a class with circular dependency, use @f.type(() => MyType).`
                );
            }
        }

        const isCustomObject = !typedArrayMap.has(type)
            && type !== Object
            && typeof type !== 'string'
            && !isFunction(type);

        if (type && !isArray(type) && !property.isMap && !property.isPartial && isCustomObject && returnType === Object) {
            throw new Error(`${id} type mismatch. Given ${property}, but declared is Object or undefined. ` +
                `The actual type is an object, but you specified a class in @f.type(T).\n` +
                `Please declare a type or use @f.map(${getClassName(type)}) for '${propertyName}: {[k: string]: ${getClassName(type)}}'.`);
        }
    }, true);
}

const fRaw: any = Field();

fRaw['array'] = function <T extends FieldTypes<any>>(this: FieldDecoratorResult<any>, type: T | ClassType<any> | ForwardRefFn<any>): FieldDecoratorResult<T> {
    return Field('array').template(type);
};

fRaw['map'] = function <T extends FieldTypes<any>>(this: FieldDecoratorResult<any>, type: T | ClassType<any> | ForwardRefFn<any>, keyType: 'any' | 'string' | 'number' = 'any'): FieldDecoratorResult<T> {
    const keyTypeProp = f.type(keyType);
    return Field('map').template(keyTypeProp, type);
};

fRaw['any'] = Field('any');

fRaw['type'] = function <T extends FieldTypes<any>>(this: FieldDecoratorResult<any>, type: T): FieldDecoratorResult<T> {
    return Field(type);
};

fRaw['union'] = function <T>(this: FieldDecoratorResult<any>, ...types: (ClassType<any> | ForwardRefFn<any>)[]): FieldDecoratorResult<T> {
    return UnionField(...types);
};

fRaw['partial'] = function <T extends ClassType<any>>(this: FieldDecoratorResult<T>, type: T): FieldDecoratorResult<T> {
    return Field('partial').template(type);
};

fRaw['enum'] = function <T>(this: FieldDecoratorResult<T>, clazz: T, allowLabelsAsValue: boolean = false): FieldDecoratorResult<T> {
    return EnumField(clazz, allowLabelsAsValue);
};

fRaw['moment'] = MomentField();

export interface MainDecorator {
    /**
     * Defines a type for a certain field. This is only necessary for custom classes
     * if the Typescript compiler does not include the reflection type in the build output.
     *
     * ```typescript
     * class User {
     *     //not necessary
     *     @f.type(MyClass)
     *     tags: MyClass = new MyClass;
     * }
     * ```
     */
    type<T extends FieldTypes<any>>(type: T): FieldDecoratorResult<T>;

    /**
     * Defines a discriminated union type.
     *
     * ```typescript
     * class ConfigA {
     *     @f.discriminator
     *     kind: string = 'a';
     *
     *     @f
     *     myValue: string = '';
     * }
     *
     * class ConfigB {
     *     @f.discriminator
     *     kind: string = 'b';
     *
     *     @f
     *     myValue2: string = '';
     * }
     *
     * class User {
     *     @f.union(ConfigA, ConfigB)
     *     config: ConfigA | ConfigB = new ConfigA;
     * }
     * ```
     */
    union<T extends ClassType<any>, K extends ForwardRefFn<any>>(...type: T[] | K[]): FieldDecoratorResult<void>;

    /**
     * Marks a field as discriminant. This field MUST have a default value.
     * The default value is used to discriminate this class type when used in a union type. See @f.union.
     */
    discriminant<T>(): FieldDecoratorResult<T>;

    /**
     * Marks a field as array.
     *
     * ```typescript
     * class User {
     *     @f.array(@f.string)
     *     tags: string[] = [];
     * }
     * ```
     */
    array<T extends FieldTypes<any> | FieldDecoratorResult<any>>(type: T): FieldDecoratorResult<T>;

    /**
     * Marks a field as string.
     */
    string: FieldDecoratorResult<string>;

    /**
     * Marks a field as number.
     */
    number: FieldDecoratorResult<string>;

    /**
     * Marks a field as boolean.
     */
    boolean: FieldDecoratorResult<string>;

    /**
     * Marks a field as Date.
     */
    date: FieldDecoratorResult<string>;

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
     *     @f.enum(MyEnum)
     *     level: MyEnum = MyEnum.low;
     * }
     * ```
     *
     * If allowLabelsAsValue is set, you can use the enum labels as well for setting the property value using plainToClass().
     *
     * Note: const enums are not supported.
     */
    enum<T>(type: T, allowLabelsAsValue?: boolean): FieldDecoratorResult<T>;

    /**
     * Marks a field as partial of a class entity. It differs in a way to standard Partial<> that
     * it allows path based sub values, like you know from JSON patch.
     *
     * ```typescript
     * class Config {
     *     @f.optional()
     *     name?: string;
     *
     *     @f.optional()
     *     sub?: Config;
     *
     *     @f
     *     prio: number = 0;
     * }
     *
     * class User {
     *     @f.partial(Config)
     *     config: PartialField<Config> = {};
     * }
     * ```
     */
    partial(type: FieldDecoratorResult<any> | FieldTypes<any>): this;

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
     *     @f.map(f.string)
     *     tags: {[k: string]: string};
     *
     *     @f.map(@f.type(() => MyClass))
     *     tags: {[k: string]: MyClass};
     * }
     * ```
     */
    map(type: FieldDecoratorResult<any> | FieldTypes<any>): this;
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
 *   @f.primary().uuid()
 *   id: string = uuid();
 *
 *   @f.array(String)
 *   tags: string[] = [];
 *
 *   @f.type(ArrayBuffer).optional() //binary
 *   picture?: ArrayBuffer;
 *
 *   @f
 *   type: number = 0;
 *
 *   @f.enum(Plan)
 *   plan: Plan = Plan.DEFAULT;
 *
 *   @f
 *   created: Date = new Date;
 *
 *   @f.array(SubModel)
 *   children: SubModel[] = [];
 *
 *   @f.map(SubModel)
 *   childrenMap: {[key: string]: SubModel} = {};
 *
 *   constructor(
 *       @f.index().asName('name') //asName is required for minimized code
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
        property.type = 'objectId';
    };
}

/**
 * @internal
 */
function UUIDField() {
    return (target: object, property: PropertySchema) => {
        property.type = 'uuid';
    };
}

/**
 * @internal
 */
function Index(options?: IndexOptions, name?: string) {
    return (target: object, property: PropertySchema) => {
        const schema = getOrCreateEntitySchema(target);
        if (property.methodName) {
            throw new Error('Index could not be used on method arguments.');
        }

        property.index = options || {};
        schema.indices.push({name: name || property.name, fields: [property.name], options: options || {}});
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
        const classType = (target as any).prototype as ClassType<any>;
        const schema = getOrCreateEntitySchema(classType);

        schema.indices.push({name: name || fields.join('_'), fields: fields as string[], options: options || {}});
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
function UnionField<T>(...types: (ClassType<any> | ForwardRefFn<any>)[]) {
    return Field('union').use((target, property) => {
        property.setUnionTypes(types);
    });
}

/**
 * @internal
 */
function MomentField<T>() {
    return FieldDecoratorWrapper((target, property, returnType?: any) => {
        property.type = 'moment';
    });
}
