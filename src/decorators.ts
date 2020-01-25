import {Types} from "./mapper";
import {
    BooleanValidator,
    DateValidator,
    NumberValidator,
    ObjectIdValidator,
    PropertyValidatorError,
    StringValidator,
    UUIDValidator
} from "./validation";
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
    each
} from '@marcj/estdlib';
import {Buffer} from "buffer";
import * as getParameterNames from "get-parameter-names";
import {capitalizeFirstLetter} from "./utils";

/**
 * Registry of all registered entity that used the @Entity('name') decorator.
 */
export const RegisteredEntities: { [name: string]: ClassType<any> } = {};
export const MarshalGlobal = {unpopulatedCheckActive: true};

/**
 * Type for @f.partial().
 *
 * Differs to standard Partial<> in a way that it supports sub class fields using dot based paths (like mongoDB)
 */
export type PartialField<T> = {
    [P in keyof T]?: T[P]
} & {
    //it's currently not possible to further define it
    //https://github.com/Microsoft/TypeScript/issues/12754
    [path: string]: any
}

export interface PropertyValidator {
    validate<T>(value: any, target: ClassType<T>, propertyName: string, propertySchema: PropertySchema): PropertyValidatorError | void;
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
    allowLabelsAsValue?: true;
    methodName?: string;
    templateArgs?: PropertySchemaSerialized[];
    classType?: string;
}

/**
 * Represents a class property or method argument definition.
 */
export class PropertySchema {
    name: string;

    type: Types = 'any';
    isArray: boolean = false;
    isMap: boolean = false;

    /**
     * Whether its a owning reference.
     */
    isReference: boolean = false;

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

    isParentReference: boolean = false;
    isOptional: boolean = false;
    isId: boolean = false;

    /**
     * Whether given classType can be populated partially (for example in patch mechanisms).
     */
    isPartial: boolean = false;

    /**
     * When this property belongs to method as argument then this contains the name of the method.
     */
    methodName?: string;

    readonly validators: ClassType<PropertyValidator>[] = [];

    /**
     * For enums.
     */
    allowLabelsAsValue: boolean = false;

    exclude?: 'all' | 'mongo' | 'plain';

    templateArgs?: PropertySchema[];

    classType?: ClassType<any>;
    classTypeForwardRef?: ForwardedRef<any>;
    classTypeResolved?: ClassType<any>;

    constructor(name: string) {
        this.name = name;
    }

    toJSON(): PropertySchemaSerialized {
        const props: PropertySchemaSerialized = {
            name: this.name,
            type: this.type
        };

        if (this.isArray) props['isArray'] = true;
        if (this.isMap) props['isMap'] = true;
        if (this.isDecorated) props['isDecorated'] = true;
        if (this.isParentReference) props['isParentReference'] = true;
        if (this.isOptional) props['isOptional'] = true;
        if (this.isId) props['isId'] = true;
        if (this.isPartial) props['isPartial'] = true;
        if (this.allowLabelsAsValue) props['allowLabelsAsValue'] = true;
        if (this.typeSet) props['typeSet'] = true;
        if (this.methodName) props['methodName'] = this.methodName;

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

        if (props['isArray']) p.isArray = true;
        if (props['isMap']) p.isMap = true;
        if (props['isDecorated']) p.isDecorated = true;
        if (props['isParentReference']) p.isParentReference = true;
        if (props['isOptional']) p.isOptional = true;
        if (props['isId']) p.isId = true;
        if (props['isPartial']) p.isPartial = true;
        if (props['allowLabelsAsValue']) p.allowLabelsAsValue = true;
        if (props['typeSet']) p.typeSet = true;
        if (props['methodName']) p.methodName = props['methodName'];

        if (props['templateArgs']) {
            p.templateArgs = props['templateArgs'].map(v => PropertySchema.fromJSON(v));
        }

        if (props['classType']) {
            const entity = RegisteredEntities[props['classType']];
            if (!entity) {
                throw new Error(`Could not unserialize type information for ${p.methodName || ''}:${p.name}, got entity name ${props['classType']}. ` +
                    `Make sure given entity is loaded (imported at least once globally).`);
            }
            p.classType = entity;
        }

        return p;
    }

    static getTypeFromJSType(type: any): Types {
        if (type === String) {
            return 'string';
        } else if (type === Number) {
            return 'number';
        } else if (type === Date) {
            return 'date';
        } else if (type === Buffer) {
            return 'binary';
        } else if (type === Boolean) {
            return 'boolean';
        }

        return 'any';
    }

    setFromJSValue(value: any) {
        if (value === undefined || value === null) return;

        this.setFromJSType(value.constructor);
    }

    setFromJSType(type: any) {
        if (type === undefined || type === null) return;

        this.type = PropertySchema.getTypeFromJSType(type);

        const isCustomObject = type !== String
            && type !== String
            && type !== Number
            && type !== Date
            && type !== Buffer
            && type !== Boolean
            && type !== Any
            && type !== Object;

        if (isCustomObject) {
            this.type = 'class';
            this.classType = type as ClassType<any>;

            if (type instanceof ForwardedRef) {
                this.classTypeForwardRef = type;
                delete this.classType;
            }
        }
    }

    /**
     * Internal note: for multi pk support, this will return a string[] in the future.
     */
    getForeignKeyName(): string {
        return this.name + capitalizeFirstLetter(this.getResolvedClassSchema().getPrimaryField().name);
    }

    /**
     * When this.classType is referenced, this returns the fields necessary to instantiate a proxy object.
     */
    getRequiredForeignFieldsForProxy(): PropertySchema[] {
        return [this.getResolvedClassSchema().getPrimaryField(), ...this.getResolvedClassSchema().getMethodProperties('constructor')]
    }

    getResolvedClassSchema(): ClassSchema {
        return getClassSchema(this.getResolvedClassType());
    }

    clone(): PropertySchema {
        const s = new PropertySchema(this.name);
        for (const i of eachKey(this)) {
            s[i] = (this as any)[i];
        }
        return s;
    }

    public getTemplateArg(position: number): PropertySchema | undefined {
        return this.templateArgs ? this.templateArgs[position] : undefined;
    }

    getForeignClassDecorator(): PropertySchema | undefined {
        if (this.type === 'class') {
            const targetClass = this.getResolvedClassType();
            if (getClassSchema(targetClass).decorator) {
                return getClassSchema(targetClass).getDecoratedPropertySchema();
            }
        }
    }

    getValidators(): ClassType<PropertyValidator>[] {
        if (this.type === 'string') {
            return [StringValidator, ...this.validators];
        }

        if (this.type === 'date') {
            return [DateValidator, ...this.validators];
        }

        if (this.type === 'number') {
            return [NumberValidator, ...this.validators];
        }

        if (this.type === 'uuid') {
            return [UUIDValidator, ...this.validators];
        }

        if (this.type === 'objectId') {
            return [ObjectIdValidator, ...this.validators];
        }

        if (this.type === 'boolean') {
            return [BooleanValidator, ...this.validators];
        }

        return this.validators;
    }

    getResolvedClassTypeForValidType(): ClassType<any> | undefined {
        if (this.type === 'class' || this.type === 'enum') {
            return this.getResolvedClassType();
        }
    }

    isResolvedClassTypeIsDecorated(): boolean {
        if (this.type === 'class') {
            const foreignSchema = getClassSchema(this.getResolvedClassType());
            return Boolean(foreignSchema.decorator);
        }

        return false;
    }

    getResolvedClassType(): ClassType<any> {
        if (this.classTypeResolved) {
            return this.classTypeResolved;
        }

        if (this.classTypeForwardRef) {
            this.classTypeResolved = this.classTypeForwardRef.forward();
            if (this.classTypeResolved) {
                return this.classTypeResolved;
            }
            throw new Error(`ForwardRef returns no value. ${this.classTypeForwardRef.forward}`);
        }

        if (!this.classType) {
            throw new Error(`No ClassType given for field ${this.name}. Use @f.forward(() => MyClass) for circular dependencies.`);
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

    decorator?: string;

    /**
     * Each method can have its own PropertySchema definition for each argument, where map key = method name.
     */
    protected methodProperties = new Map<string, PropertySchema[]>();
    methods: { [name: string]: PropertySchema } = {};

    /**
     * @internal
     */
    protected initializedMethods: { [name: string]: true } = {};

    classProperties: { [name: string]: PropertySchema } = {};

    idField?: string;
    propertyNames: string[] = [];

    protected methodsParamNames = new Map<string, string[]>();
    protected methodsParamNamesAutoResolved = new Map<string, string[]>();

    indices: EntityIndex[] = [];

    /**
     * Contains all references, owning reference and back references.
     */
    public readonly references = new Set<PropertySchema>();

    protected referenceInitialized = false;

    onLoad: { methodName: string, options: { fullLoad?: boolean } }[] = [];

    constructor(classType: ClassType<any>) {
        this.classType = classType;
    }

    public getClassName(): string {
        return getClassName(this.classType);
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

        s.classProperties = {};
        for (const [i, v] of eachPair(this.classProperties)) {
            s.classProperties[i] = v.clone();
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
     * Returns all annotated arguments as PropertSchema for given method name.
     */
    public getMethodProperties(name: string): PropertySchema[] {
        this.initializeMethod(name);

        return this.methodProperties.get(name)!;
    }

    public getMethod(name: string): PropertySchema {
        this.initializeMethod(name);

        return this.methods[name];
    }

    /**
     * Returns a perfect hash from the primary key(s).
     */
    public getPrimaryFieldRepresentation(item: T): any {
        return item[this.getPrimaryField().name];
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
        if (!this.initializedMethods[name]) {
            if (!Reflect.hasMetadata('design:returntype', this.classType.prototype, name)) {
                throw new Error(`Method ${name} has no decorators used, so reflection does not work. Use @f on the method or arguments.`);
            }

            if (!this.methods[name]) {
                const returnType = Reflect.getMetadata('design:returntype', this.classType.prototype, name);
                if (returnType !== Promise) {
                    //Promise is not a legit returnType as this is automatically the case for async functions
                    //we assume no meta data is given when Promise is defined, as it basically tells us nothing.
                    this.methods[name] = new PropertySchema(name);
                    this.methods[name].setFromJSType(returnType);
                }
            }

            const properties = this.getOrCreateMethodProperties(name);

            const paramtypes = Reflect.getMetadata('design:paramtypes', this.classType.prototype, name);
            for (const [i, t] of eachPair(paramtypes)) {
                if (!properties[i]) {
                    properties[i] = new PropertySchema(String(i));
                    if (properties[i].type === 'any' && paramtypes[i] !== Object) {
                        properties[i].setFromJSType(t)
                    }
                }
            }
            this.initializedMethods[name] = true;
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

    protected initializeProperties() {
        if (!this.referenceInitialized) {
            this.referenceInitialized = true;
            for (const reference of this.references.values()) {
                const schema = reference.getResolvedClassSchema();
                const name = reference.name + capitalizeFirstLetter(schema.getPrimaryField().name);

                if (!this.classProperties[name]) {
                    const foreignKey = schema.getPrimaryField().clone();
                    foreignKey.isReference = false;
                    foreignKey.backReference = undefined;
                    foreignKey.index = {...reference.index};
                    foreignKey.name = name;
                    this.classProperties[name] = foreignKey;
                    getClassSchema(this.classType).addIndex(foreignKey.name, foreignKey.index);
                }

                this.classProperties[name].isReferenceKey = true;
            }
        }
    }

    public getAllReferences(): PropertySchema[] {
        this.initializeProperties();
        return Object.values(this.classProperties).filter(v => {
            return v.backReference || v.isReference;
        });
    }


    public getClassProperties(): { [name: string]: PropertySchema } {
        this.initializeProperties();
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
    }

    public getPropertyOrUndefined(name: string): PropertySchema | undefined {
        this.initializeProperties();
        if (this.classProperties[name]) {
            return this.classProperties[name];
        }
    }

    public hasProperty(name: string): boolean {
        return Boolean(this.classProperties[name]);
    }

    public findForReference(classType: ClassType<any>, name?: string): PropertySchema {
        if (name) return this.getProperty(name);
        for (const property of each(this.getClassProperties())) {
            if (property.getResolvedClassTypeForValidType() === classType) return property;
        }

        throw new Error(`No reference found to class ${getClassName(classType)}`);
    }

    public getProperty(name: string): PropertySchema {
        this.initializeProperties();
        if (!this.classProperties[name]) {
            throw new Error(`Property ${name} not found`);
        }

        return this.classProperties[name];
    }
}

/**
 * @hidden
 */
export const ClassSchemas = new Map<object, ClassSchema>();

/**
 * @hidden
 */
export function getOrCreateEntitySchema<T>(target: Object | ClassType<T>): ClassSchema {
    const proto = target['prototype'] ? target['prototype'] : target;
    const classType = target['prototype'] ? target as ClassType<T> : target.constructor as ClassType<T>;

    if (!ClassSchemas.has(proto)) {
        //check if parent has a EntitySchema, if so clone and use it as base.

        let currentProto = Object.getPrototypeOf(proto);
        let found = false;
        while (currentProto && currentProto !== Object.prototype) {
            if (ClassSchemas.has(currentProto)) {
                found = true;
                ClassSchemas.set(proto, ClassSchemas.get(currentProto)!.clone(classType));
                break;
            }
            currentProto = Object.getPrototypeOf(currentProto);
        }

        if (!found) {
            const reflection = new ClassSchema(classType);
            ClassSchemas.set(proto, reflection);
        }
    }

    return ClassSchemas.get(proto)!;
}

/**
 * Returns meta information / schema about given entity class.
 */
export function getClassSchema<T>(classTypeIn: ClassType<T> | Object): ClassSchema {
    const classType = classTypeIn['prototype'] ? classTypeIn as ClassType<T> : classTypeIn.constructor as ClassType<T>;

    if (!ClassSchemas.has(classType.prototype)) {
        //check if parent has a EntitySchema, if so clone and use it as base.
        let currentProto = Object.getPrototypeOf(classType.prototype);
        let found = false;
        while (currentProto && currentProto !== Object.prototype) {
            if (ClassSchemas.has(currentProto)) {
                found = true;
                ClassSchemas.set(classType.prototype, ClassSchemas.get(currentProto)!.clone(classType));
                break;
            }
            currentProto = Object.getPrototypeOf(currentProto);
        }

        if (!found) {
            const reflection = new ClassSchema(classType);
            ClassSchemas.set(classType.prototype, reflection);
        }
    }

    return ClassSchemas.get(classType.prototype)!;
}

/**
 * Returns the ClassType for a given instance.
 */
export function getClassTypeFromInstance<T>(target: T): ClassType<T> {
    if (!target
        || !target['constructor']
        || Object.getPrototypeOf(target) !== (target as any)['constructor'].prototype
        || isPlainObject(target)
        || !isObject(target)
    ) {
        throw new Error('Target does not seem to be a class instance.');
    }

    return target['constructor'] as ClassType<T>;
}

/**
 * Returns true if given class has an @Entity() or @f defined, and thus became
 * a Marshal entity.
 */
export function isRegisteredEntity<T>(classType: ClassType<T>): boolean {
    return ClassSchemas.has(classType.prototype);
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
        if (RegisteredEntities[name]) {
            throw new Error(`Marshal entity with name '${name}' already registered. 
            This could be caused by the fact that you used a name twice or that you loaded the entity 
            via different imports.`)
        }

        RegisteredEntities[name] = target;
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

export type BackReferenceOptions<T> = {
    via?: ClassType<any> | ForwardRefFn<ClassType<any>>,
    mappedBy?: keyof T,
};

export function resolveClassTypeOrForward(type: ClassType<any> | ForwardRefFn<ClassType<any>>): ClassType<any> {
    return isFunction(type) ? (type as Function)() : type;
}

export interface FieldDecoratorResult<T> {
    (target: Object, property?: string, parameterIndexOrDescriptor?: any): void;

    /**
     * Sets the name of this property. Important for cases where the actual name is lost during compilation.
     */
    asName(name: string): this;

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
     * options.mappedBy: Explicitly set the name of the reference of the foreign class.
     *                   Per default it is automatically detected, but will fail if you the foreign class contains more
     *                   than one references to the current class.
     * @param options
     */
    backReference(options?: {
        via?: ClassType<any> | ForwardRefFn<any>,
        mappedBy?: keyof T,
    }): this;

    /**
     * Marks this field as optional. The validation requires field values per default, this makes it optional.
     */
    optional(): this;

    /**
     * Used to define a field as excluded when serialized from class to different targets (currently to Mongo or JSON).
     * PlainToClass or mongoToClass is not effected by this.
     */
    exclude(t?: 'all' | 'mongo' | 'plain'): this;

    /**
     * Marks this field as an ID aka primary.
     * This is important if you interact with the database abstraction.
     *
     * Only one field in a class can be the ID.
     */
    primary(): this;

    /**
     * @see primary
     * @deprecated
     */
    asId(): this;

    /**
     * Defines template arguments of a tempalted class. Very handy for types like Observables.
     *
     * ```typescript
     * class Stuff {
     * }
     *
     * class Page {
     *     @f.t(Stuff)
     *     downloadStuff(): Observable<Stuff> {
     *          return new Observable<Stuff>((observer) => {
     *              observer.next(new Stuff());
     *          })
     *     }
     *
     *     //or more verbose way if the type is more complex.
     *     @f.t(f.type(Stuff).optional())
     *     downloadStuffWrapper(): Observable<Stuff | undefined> {
     *          return new Observable<Stuff>((observer) => {
     *              observer.next(new Stuff());
     *          })
     *     }
     * }
     * ```
     */
    template(...templateArgs: any[]): this;

    /**
     * Used to define an index on a field.
     */
    index(options?: IndexOptions, name?: string): this;

    /**
     * Used to define a field as MongoDB ObjectId. This decorator is necessary if you want to use Mongo's _id.
     *
     * ```typescript
     * class Page {
     *     @f.mongoId()
     *     referenceToSomething?: string;
     *
     *     constructor(
     *         @f.id().mongoId()
     *         public readonly _id: string
     *     ) {
     *
     *     }
     * }
     * ```
     */
    mongoId(): this;

    /**
     * Used to define a field as UUID (v4).
     */
    uuid(): this;

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
     *     @f.forward(() => PageClass).decorated()
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
     *     @f.uuid()
     *     id: string = uuid();
     *
     *     @f
     *     name: string;
     *
     *     @f.forward(() => PageCollection)
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
    decorated(): this;

    /**
     * Marks a field as array. You should prefer `@f.array(T)` syntax.
     *
     * ```typescript
     * class User {
     *     @f.type(String).asArray()
     *     tags: strings[] = [];
     * }
     * ```
     */
    asArray(): this;

    /**
     * @internal
     */
    asPartial(): this;

    /**
     * Marks a field as map. You should prefer `@f.map(T)` syntax.
     *
     * ```typescript
     * class User {
     *     @f.type(String).asMap()
     *     tags: {[name: string]: string} = [];
     * }
     * ```
     */
    asMap(): this;

    /**
     * Uses an additional modifier to change the PropertySchema.
     */
    use(decorator: (target: Object, property: PropertySchema) => void): this;

    /**
     * Adds a custom validator class or validator callback.
     *
     * @example
     * ```typescript
     * import {PropertyValidator, PropertyValidatorError} from '@marcj/marshal';
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
        validator: ClassType<PropertyValidator> | ((value: any, target: ClassType<any>, propertyName: string) => PropertyValidatorError | void)
    ): this;
}

function createFieldDecoratorResult<T>(
    cb: (target: Object, property: PropertySchema, returnType: any, modifiedOptions: FieldOptions) => void,
    givenPropertyName: string = '',
    modifier: ((target: Object, property: PropertySchema) => void)[] = [],
    modifiedOptions: FieldOptions = {},
    root = false,
): FieldDecoratorResult<T> {
    function resetIfNecessary() {
        //on root we never use the overwritten name, so we set it back
        //for child FieldDecoratorResults created via asName() etc we keep that stuff (since there is root=false)
        if (root) {
            givenPropertyName = '';
            modifier = [];
            modifiedOptions = {};
        }
    }

    const fn = (target: Object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any) => {
        resetIfNecessary();

        if (target === Object) {
            const propertySchema = new PropertySchema(String(parameterIndexOrDescriptor));

            for (const mod of modifier) {
                mod(target, propertySchema);
            }

            if (isNumber(parameterIndexOrDescriptor) && target['prototype']) {
                target = target['prototype'];
            }

            cb(target, propertySchema!, undefined, {...modifiedOptions});
            return;
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
                    if (!schema.classProperties[givenPropertyName]) {
                        schema.classProperties[givenPropertyName] = new PropertySchema(givenPropertyName);
                        schema.propertyNames.push(givenPropertyName);
                    }

                    propertySchema = schema.classProperties[givenPropertyName];
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

                if (!schema.classProperties[givenPropertyName]) {
                    schema.classProperties[givenPropertyName] = new PropertySchema(givenPropertyName);
                    schema.propertyNames.push(givenPropertyName);
                }

                propertySchema = schema.classProperties[givenPropertyName];
            }
        }

        for (const mod of modifier) {
            mod(target, propertySchema);
        }

        if (isNumber(parameterIndexOrDescriptor) && target['prototype']) {
            target = target['prototype'];
        }

        cb(target, propertySchema!, returnType, {...modifiedOptions});
    };

    fn.asName = (name: string) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, name, modifier, modifiedOptions);
    };

    fn.optional = () => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Optional()], modifiedOptions);
    };

    fn.exclude = (target: 'all' | 'mongo' | 'plain' = 'all') => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Exclude(target)], modifiedOptions);
    };

    fn.primary = fn.asId = () => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, IDField()], modifiedOptions);
    };

    fn.index = (options?: IndexOptions, name?: string) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Index(options, name)], modifiedOptions);
    };

    fn.mongoId = () => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, MongoIdField()], modifiedOptions);
    };

    fn.uuid = () => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, UUIDField()], modifiedOptions);
    };

    fn.decorated = () => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Decorated()], modifiedOptions);
    };

    fn.use = (decorator: (target: Object, property: PropertySchema) => void) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, decorator], modifiedOptions);
    };

    fn.reference = () => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, modifier, {...modifiedOptions, reference: true});
    };

    fn.backReference = (options?: BackReferenceOptions<T>) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, modifier, {
            ...modifiedOptions,
            backReference: options || {}
        });
    };

    fn.asArray = () => {
        resetIfNecessary();
        if (modifiedOptions.map) throw new Error('Field is already defined as map.');
        return createFieldDecoratorResult(cb, givenPropertyName, modifier, {...modifiedOptions, array: true});
    };

    fn.template = (...templateArgs: any[]) => {
        resetIfNecessary();
        if (modifiedOptions.template) throw new Error('Field has already template args defined.');
        return createFieldDecoratorResult(cb, givenPropertyName, modifier, {
            ...modifiedOptions,
            template: templateArgs
        });
    };

    fn.asPartial = () => {
        resetIfNecessary();
        if (modifiedOptions.partial) throw new Error('Field is already defined as partial.');
        return createFieldDecoratorResult(cb, givenPropertyName, modifier, {...modifiedOptions, partial: true});
    };

    fn.asMap = () => {
        resetIfNecessary();
        if (modifiedOptions.array) throw new Error('Field is already defined as array.');
        return createFieldDecoratorResult(cb, givenPropertyName, modifier, {...modifiedOptions, map: true});
    };

    fn.validator = (validator: ClassType<PropertyValidator> | ((value: any, target: ClassType<any>, propertyName: string) => PropertyValidatorError | void)) => {
        resetIfNecessary();

        const validatorClass: ClassType<PropertyValidator> = isPropertyValidator(validator) ? validator : class implements PropertyValidator {
            validate<T>(value: any, target: ClassType<T>, propertyName: string): PropertyValidatorError | void {
                try {
                    return validator(value, target, propertyName);
                } catch (error) {
                    return new PropertyValidatorError('error', error.message ? error.message : error);
                }
            }
        };

        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: Object, property: PropertySchema) => {
            property.validators.push(validatorClass);
        }], modifiedOptions);
    };

    return fn;
}

/**
 * Helper for decorators that are allowed to be placed in property declaration and constructor property declaration.
 * We detect the name by reading the constructor' signature, which would be otherwise lost.
 */
export function FieldDecoratorWrapper<T>(
    cb: (target: Object, property: PropertySchema, returnType: any, modifiedOptions: FieldOptions) => void,
    root = false
): FieldDecoratorResult<T> {
    return createFieldDecoratorResult<T>(cb, '', [], {}, root);
}

/**
 * @internal
 */
function Decorated() {
    return (target: Object, property: PropertySchema) => {
        getOrCreateEntitySchema(target).decorator = property.name;
        property.isDecorated = true;
    };
}

/**
 * @internal
 */
function IDField() {
    return (target: Object, property: PropertySchema) => {
        getOrCreateEntitySchema(target).idField = property.name;
        property.isId = true;
    };
}

/**
 * @internal
 */
function Optional() {
    return (target: Object, property: PropertySchema) => {
        property.isOptional = true;
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
 *     @f.forward(() => Job) //forward necessary since circular dependency
 *     @ParentReference()
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
 *     @f.uuid()
 *     id: string = uuid();
 *
 *     @f
 *     name: string;
 *
 *     @f.forwardArray(() => PageClass) //forward necessary since circular dependency
 *     children: Page[] = [];
 *
 *     @f.forward(() => PageClass).optional() //forward necessary since circular dependency
 *     @ParentReference()
 *     parent?: PageClass;
 *
 *     constructor(name: string) {
 *         this.name = name;
 *     }
 * ```
 */
export function ParentReference() {
    return FieldDecoratorWrapper((target, property) => {
        property.isParentReference = true;
    });
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
function Exclude(t: 'all' | 'mongo' | 'plain' = 'all') {
    return (target: Object, property: PropertySchema) => {
        property.exclude = t;
    };
}

type FieldTypes = String | Number | Date | ClassType<any> | ForwardedRef<any>;

class Any {
}

type ForwardRefFn<T> = () => T;

class ForwardedRef<T> {
    constructor(public readonly forward: ForwardRefFn<T>) {
    }
}

/**
 * Allows to refer to references which are not yet defined.
 *
 * For instance, if you reference a circular dependency or a not yet defined variable.
 *
 * ```typescript
 * class User {
 *     @f.forward(() => Config)
 *     config: Config;
 *
 *     @f.forwardArray(() => Config)
 *     configArray: Config[] = [];
 *
 *     @f.forwardMap(() => Config)
 *     configMap: {[k: string]: Config} = {};
 *
 * ```
 */
export function forwardRef<T>(forward: ForwardRefFn<T>): ForwardedRef<T> {
    return new ForwardedRef(forward);
}

/**
 * @internal
 */
interface FieldOptions {
    template?: any[];
    map?: boolean;
    array?: boolean;
    partial?: boolean;
    reference?: boolean;
    backReference?: BackReferenceOptions<any>;
}

/**
 * Decorator to define a field for an entity.
 */
function Field(oriType?: FieldTypes) {
    return FieldDecoratorWrapper((target, property, returnType, options) => {
        if (property.typeSet) return;
        property.typeSet = true;
        let type = oriType;

        const propertyName = property.name;
        const id = getClassName(target) + (property.methodName ? '::' + property.methodName : '') + '::' + propertyName;

        function getTypeName(t: any): string {
            if (t === Object) return 'Object';
            if (t === String) return 'String';
            if (t === Number) return 'Number';
            if (t === Boolean) return 'Boolean';
            if (t instanceof ForwardedRef) return 'ForwardedRef';
            if (t === Buffer) return 'Buffer';
            if (t === Date) return 'Date';
            if (t === undefined) return 'undefined';

            return getClassName(t);
        }

        function getTypeDeclaration(t: any, options: FieldOptions): string {
            if (options.array) return `${getTypeName(t)}[]`;
            if (options.map) return `{[key: string]: ${getTypeName(t)}}`;
            return getTypeName(t);
        }

        if (returnType !== Promise && type !== Any) {
            //we don't want to check for type mismatch when returnType is a Promise.

            if (type && options.array && returnType !== Array) {
                throw new Error(`${id} type mismatch. Given ${getTypeDeclaration(type, options)}, but declared is ${getTypeName(returnType)}. ` +
                    `Please use the correct type in @f.type(T).`
                );
            }

            if (type && !options.array && returnType === Array) {
                throw new Error(`${id} type mismatch. Given ${getTypeDeclaration(type, options)}, but declared is ${getTypeName(returnType)}. ` +
                    `Please use @f.array(MyType) or @f.forwardArray(() => MyType), e.g. @f.array(String) for '${propertyName}: String[]'.`);
            }

            if (type && options.map && returnType !== Object) {
                throw new Error(`${id} type mismatch. Given ${getTypeDeclaration(type, options)}, but declared is ${getTypeName(returnType)}. ` +
                    `Please use the correct type in @f.type(TYPE).`);
            }

            if (!type && returnType === Array) {
                throw new Error(`${id} type mismatch. Given nothing, but declared is Array. You have to specify what type is in that array.  ` +
                    `When you don't declare a type in TypeScript or types are excluded, you need to pass a type manually via @f.type(String).\n` +
                    `If you don't have a type, use @f.any(). If you reference a class with circular dependency, use @f.forward(forwardRef(() => MyType)).`
                );
            }

            if (!type && returnType === Object) {
                //typescript puts `Object` for undefined types.
                throw new Error(`${id} type mismatch. Given ${getTypeDeclaration(type, options)}, but declared is Object or undefined. ` +
                    `Please note that Typescript's reflection system does not support type hints based on interfaces or types, but only classes and primitives (String, Number, Boolean, Date). ` +
                    `When you don't declare a type in TypeScript or types are excluded, you need to pass a type manually via @f.type(String).\n` +
                    `If you don't have a type, use @f.any(). If you reference a class with circular dependency, use @f.forward(() => MyType).`
                );
            }
        }

        const isCustomObject = type !== String
            && type !== String
            && type !== Number
            && type !== Date
            && type !== Buffer
            && type !== Boolean
            && type !== Any
            && type !== Object
            && !(type instanceof ForwardedRef);

        if (type && !options.map && !options.partial && isCustomObject && returnType === Object) {
            throw new Error(`${id} type mismatch. Given ${getTypeDeclaration(type, options)}, but declared is Object or undefined. ` +
                `The actual type is an Object, but you specified a Class in @f.type(T).\n` +
                `Please declare a type or use @f.map(${getClassName(type)}) for '${propertyName}: {[k: string]: ${getClassName(type)}}'.`);
        }

        if (!type) {
            type = returnType;
        }

        if (options.partial) {
            property.isPartial = true;
        }

        if (options.array) {
            property.isArray = true;
        }

        if (options.map) {
            property.isMap = true;
        }

        if (options.reference) {
            property.isReference = true;
            getClassSchema(target).registerReference(property);
        }

        if (options.backReference) {
            property.backReference = options.backReference;
            getClassSchema(target).registerReference(property);
        }

        if (options.template) {
            property.templateArgs = [];
            for (const [i, t] of eachPair(options.template)) {
                if (isFunction(t) && isFunction(t.asName) && isFunction(t.optional)) {
                    //its a decorator @f()
                    //target: Object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any
                    t.use((target: Object, incomingProperty: PropertySchema) => {
                        property.templateArgs!.push(incomingProperty);
                    })(Object, undefined, i);
                } else {
                    const p = new PropertySchema(String(i));
                    p.setFromJSType(t);
                    property.templateArgs.push(p);
                }
            }
        }

        if (property.type === 'any') {
            property.setFromJSType(type);
        }
    }, true);
}

const fRaw: any = Field();

fRaw['array'] = function <T extends FieldTypes>(this: FieldDecoratorResult<any>, type: T): FieldDecoratorResult<T> {
    return Field(type).asArray();
};

fRaw['map'] = function <T extends FieldTypes>(this: FieldDecoratorResult<any>, type: T): FieldDecoratorResult<T> {
    return Field(type).asMap();
};

fRaw['any'] = function (this: FieldDecoratorResult<any>): FieldDecoratorResult<any> {
    return Field(Any);
};

fRaw['type'] = function <T extends FieldTypes>(this: FieldDecoratorResult<any>, type: T): FieldDecoratorResult<T> {
    return Field(type);
};

fRaw['partial'] = function <T extends ClassType<any>>(this: FieldDecoratorResult<T>, type: T): FieldDecoratorResult<T> {
    return Field(type).asPartial();
};

fRaw['enum'] = function <T>(this: FieldDecoratorResult<T>, clazz: T, allowLabelsAsValue = false): FieldDecoratorResult<T> {
    return EnumField(clazz, allowLabelsAsValue);
};

fRaw['moment'] = function <T>(this: FieldDecoratorResult<T>): FieldDecoratorResult<T> {
    return MomentField();
};

fRaw['forward'] = function <T extends ClassType<any>>(this: FieldDecoratorResult<T>, f: () => T): FieldDecoratorResult<T> {
    return Field(forwardRef(f));
};

fRaw['forwardArray'] = function <T extends ClassType<any>>(this: FieldDecoratorResult<T>, f: () => T): FieldDecoratorResult<T> {
    return Field(forwardRef(f)).asArray();
};

fRaw['forwardMap'] = function <T extends ClassType<any>>(this: FieldDecoratorResult<T>, f: () => T): FieldDecoratorResult<T> {
    return Field(forwardRef(f)).asMap();
};

fRaw['forwardPartial'] = function <T extends ClassType<any>>(this: FieldDecoratorResult<T>, f: () => T): FieldDecoratorResult<T> {
    return Field(forwardRef(f)).asPartial();
};

export interface MainDecorator {
    /**
     * Defines a type for a certain field. This is only necessary for custom classes
     * if the Typescript compiler does not include the reflection type in the build output.
     *
     * ```typescript
     * class User {
     *     @f.type(MyClass)
     *     tags: MyClass = new MyClass;
     * }
     * ```
     */
    type<T extends FieldTypes>(type: T): FieldDecoratorResult<T>;

    /**
     * Marks a field as array.
     *
     * ```typescript
     * class User {
     *     @f.array(String)
     *     tags: string[] = [];
     * }
     * ```
     */
    array<T extends FieldTypes>(type: T): FieldDecoratorResult<T>;

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
    partial<T extends ClassType<any>>(type: T): FieldDecoratorResult<T>;

    /**
     * Marks a field as Moment.js value. Mongo and JSON transparent uses its toJSON() result.
     * In MongoDB its stored as Date.
     *
     * You have to install moment npm package in order to use it.
     */
    moment(): FieldDecoratorResult<any>;

    /**
     * Marks a field as type any. It does not transform the value and directly uses JSON.parse/stringify.
     */
    any(): FieldDecoratorResult<any>;

    /**
     * Marks a field as map.
     *
     * ```typescript
     * class User {
     *     @f.map(String)
     *     tags: {[k: string]: string};
     *
     *     @f.forwardMap(() => MyClass)
     *     tags: {[k: string]: MyClass};
     * }
     * ```
     */
    map<T extends FieldTypes>(type: T): FieldDecoratorResult<T>;

    /**
     * Forward references a type, required for circular reference.
     *
     * ```typescript
     * class User {
     *     @f.forward(() => User)).optional()
     *     parent: User;
     * }
     * ```
     */
    forward<T extends ClassType<any>>(f: () => T): FieldDecoratorResult<T>;

    /**
     * Forward references a type in an array, required for circular reference.
     *
     * ```typescript
     * class User {
     *     @f.forwardArray(() => User)).optional()
     *     parents: User[] = [];
     * }
     * ```
     */
    forwardArray<T extends ClassType<any>>(f: () => T): FieldDecoratorResult<T>;

    /**
     * Forward references a type in a map, required for circular reference.
     *
     * ```typescript
     * class User {
     *     @f.forwardRef(() => User)).optional()
     *     parents: {[name: string]: User} = {}};
     * }
     * ```
     */
    forwardMap<T extends ClassType<any>>(f: () => T): FieldDecoratorResult<T>;

    /**
     * Marks a field as partial of a class entity.
     *
     * ```typescript
     * class Config {
     *     @f.optional()
     *     name?: string;
     *
     *     @f
     *     prio: number = 0;
     * }
     *
     * class User {
     *     @f.forwardPartial(() => Config)
     *     config: PartialField<Config> = {};
     * }
     * ```
     */
    forwardPartial<T extends ClassType<any>>(type: () => T): FieldDecoratorResult<T>;
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
 *   @f.type(Buffer).optional() //binary
 *   picture?: Buffer;
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

/**
 * @hidden
 */
function Type<T>(type: Types) {
    return (target: Object, property: PropertySchema) => {
        property.type = type;
    };
}

/**
 * @internal
 */
function MongoIdField() {
    return (target: Object, property: PropertySchema) => {
        property.type = 'objectId';
    };
}

/**
 * @internal
 */
function UUIDField() {
    return (target: Object, property: PropertySchema) => {
        property.type = 'uuid';
    };
}

/**
 * @internal
 */
function Index(options?: IndexOptions, name?: string) {
    return (target: Object, property: PropertySchema) => {
        const schema = getOrCreateEntitySchema(target);
        if (property.methodName) {
            throw new Error('Index could not be used on method arguments.');
        }

        property.index = options || {};
        schema.indices.push({name: name || property.name, fields: [property.name], options: options || {}});
    };
}

/**
 * Used to define an index on a class.
 *
 * @category Decorator
 */
export function MultiIndex(fields: string[], options: IndexOptions, name?: string) {
    return (target: Object, property?: string, parameterIndexOrDescriptor?: any) => {
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
    return FieldDecoratorWrapper((target, property, returnType?: any) => {
        if (property) {
            Type('enum')(target, property);
            property.classType = type;
            property.allowLabelsAsValue = allowLabelsAsValue;
        }
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
