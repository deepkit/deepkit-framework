import {getCachedParameterNames, Types} from "./mapper";
import {DateValidator, NumberValidator, PropertyValidatorError, StringValidator} from "./validation";
import * as clone from 'clone';
import {ClassType, getClassName, isArray, isNumber, isObject, isPlainObject, isString} from '@marcj/estdlib';
import {Buffer} from "buffer";

/**
 * Registry of all registered entity that used the @Entity('name') decorator.
 */
export const RegisteredEntities: { [name: string]: ClassType<any> } = {};

export interface PropertyValidator {
    validate<T>(value: any, target: ClassType<T>, propertyName: string): PropertyValidatorError | void;
}

type IndexOptions = Partial<{
    unique: boolean,
    spatial: boolean,
    sparse: boolean,
    synchronize: boolean,
    fulltext: boolean,
    where: string,
}>;

export class PropertySchema {
    name: string;
    type: Types = 'any';
    isArray: boolean = false;
    isMap: boolean = false;
    isDecorated: boolean = false;
    isParentReference: boolean = false;
    isOptional: boolean = false;
    isId: boolean = false;

    readonly validators: ClassType<PropertyValidator>[] = [];

    /**
     * For enums.
     */
    allowLabelsAsValue: boolean = false;

    exclude?: 'all' | 'mongo' | 'plain';

    classType?: ClassType<any>;
    classTypeForwardRef?: ForwardedRef<any>;
    classTypeResolved?: ClassType<any>;

    constructor(name: string) {
        this.name = name;
    }

    getValidators(): ClassType<PropertyValidator>[] {
        if (this.type === 'string') {
            return [...[StringValidator], ...this.validators];
        }

        if (this.type === 'date') {
            return [...[DateValidator], ...this.validators];
        }

        if (this.type === 'number') {
            return [...[NumberValidator], ...this.validators];
        }

        return this.validators;
    }

    getResolvedClassTypeForValidType(): ClassType<any> | undefined {
        if (this.type === 'class' || this.type === 'enum') {
            return this.getResolvedClassType();
        }
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
            throw new Error(`No classType given for ${this.name}. Use @Field(forwardRef(() => MyClass)) for circular dependencies.`);
        }

        return this.classType;
    }
}

export interface EntityIndex { name?: string, fields: string[], options: IndexOptions }

export class EntitySchema {
    proto: Object;
    name?: string;
    collectionName?: string;
    databaseName?: string;
    decorator?: string;
    properties: { [name: string]: PropertySchema } = {};
    idField?: string;
    propertyNames: string[] = [];

    indices: EntityIndex[] = [];

    onLoad: { methodName: string, options: { fullLoad?: boolean } }[] = [];

    constructor(proto: Object) {
        this.proto = proto;
    }

    public getIndex(name: string): EntityIndex | undefined {
        for (const index of this.indices) {
            if (index.name === name) {
                return index;
            }
        }
    }

    public getOrCreateProperty(name: string): PropertySchema {

        if (!this.properties[name]) {
            this.properties[name] = new PropertySchema(name);
            this.propertyNames.push(name);
        }

        return this.properties[name];
    }

    public getPropertyOrUndefined(name: string): PropertySchema | undefined {
        if (this.properties[name]) {
            return this.properties[name];
        }
    }

    public getProperty(name: string): PropertySchema {
        if (!this.properties[name]) {
            throw new Error(`Property ${name} not found`);
        }

        return this.properties[name];
    }
}

/**
 * @hidden
 */
export const EntitySchemas = new Map<object, EntitySchema>();

/**
 * @hidden
 */
export function getOrCreateEntitySchema<T>(target: Object | ClassType<T>): EntitySchema {
    const proto = target['prototype'] ? target['prototype'] : target;

    if (!EntitySchemas.has(proto)) {
        //check if parent has a EntitySchema, if so clone and use it as base.

        let currentProto = Object.getPrototypeOf(proto);
        let found = false;
        while (currentProto && currentProto !== Object.prototype) {
            if (EntitySchemas.has(currentProto)) {
                found = true;
                const cloned = clone(EntitySchemas.get(currentProto));
                EntitySchemas.set(proto, cloned!);
                break;
            }
            currentProto = Object.getPrototypeOf(currentProto);
        }

        if (!found) {
            const reflection = new EntitySchema(proto);
            EntitySchemas.set(proto, reflection);
        }
    }

    return EntitySchemas.get(proto)!;
}

/**
 * Returns meta information / schema about given entity class.
 */
export function getEntitySchema<T>(classType: ClassType<T>): EntitySchema {
    if (!EntitySchemas.has(classType.prototype)) {
        //check if parent has a EntitySchema, if so clone and use it as base.
        let currentProto = Object.getPrototypeOf(classType.prototype);
        let found = false;
        while (currentProto && currentProto !== Object.prototype) {
            if (EntitySchemas.has(currentProto)) {
                found = true;
                const cloned = clone(EntitySchemas.get(currentProto));
                EntitySchemas.set(classType.prototype, cloned!);
                break;
            }
            currentProto = Object.getPrototypeOf(currentProto);
        }

        if (!found) {
            const reflection = new EntitySchema(classType.prototype);
            EntitySchemas.set(classType.prototype, reflection);
        }
    }

    return EntitySchemas.get(classType.prototype)!;
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

/**
 * Helper for decorators that are allowed to be placed in property declaration and constructor property declaration.
 * We detect the name by reading the constructor' signature, which would be otherwise lost.
 */
function FieldDecoratorWrapper(
    cb: (target: Object, property: string, returnType?: any) => void
): (target: Object, property?: string, parameterIndexOrDescriptor?: any) => void {
    return (target: Object, property?: string, parameterIndexOrDescriptor?: any) => {
        let returnType;

        if (property) {
            returnType = Reflect.getMetadata('design:type', target, property);
        }

        if (isNumber(parameterIndexOrDescriptor)) {
            const constructorParamNames = getCachedParameterNames(target as ClassType<any>);
            property = constructorParamNames[parameterIndexOrDescriptor];

            const returnTypes = Reflect.getMetadata('design:paramtypes', target);
            returnType = returnTypes[parameterIndexOrDescriptor];
            target = target['prototype'];
        }

        if (!property) {
            throw new Error(`Could not detect property in ${getClassName(target)}`);
        }

        cb(target, property, returnType)
    };
}

function FieldAndClassDecoratorWrapper(
    cb: (target: Object, property?: string, returnType?: any) => void
): (target: Object, property?: string, parameterIndexOrDescriptor?: any) => void {
    return (target: Object, property?: string, parameterIndexOrDescriptor?: any) => {
        let returnType;

        if (property) {
            returnType = Reflect.getMetadata('design:type', target, property);
        }

        if (isNumber(parameterIndexOrDescriptor)) {
            const constructorParamNames = getCachedParameterNames(target as ClassType<any>);
            property = constructorParamNames[parameterIndexOrDescriptor];

            const returnTypes = Reflect.getMetadata('design:paramtypes', target);
            returnType = returnTypes[parameterIndexOrDescriptor];
            target = target['prototype'];
        }

        cb(target, property, returnType)
    };
}

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
 *     @Field(() => PageClass)
 *     @Decorated()
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
 *     @UUIDType()
 *     id: string = uuid();
 *
 *     @Field()
 *     name: string;
 *
 *     @ClassCircular(() => PageCollection)
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
export function Decorated() {
    return FieldDecoratorWrapper((target: Object, property: string) => {
        getOrCreateEntitySchema(target).decorator = property;
        getOrCreateEntitySchema(target).getOrCreateProperty(property).isDecorated = true;
    });
}

/**
 *
 * Used to define a field as a reference to an ID.
 * This is important if you interact with the database abstraction.
 *
 * Only one field can be the ID.
 *
 * @category Decorator
 */
export function IDField() {
    return FieldDecoratorWrapper((target: Object, property: string) => {
        getOrCreateEntitySchema(target).idField = property;
        getOrCreateEntitySchema(target).getOrCreateProperty(property).isId = true;
    });
}

/**
 * Used to define a field as a reference to a parent.
 *
 * @category Decorator
 *
 * Example one direction.
 * ```typescript
 * class JobConfig {
 *     @Type(() => Job) //necessary since circular dependency
 *     @ParentReference()
 *     job: Job;
 *
 * }
 *
 * class Job {
 *     @Field()
 *     config: JobConfig;
 * }
 * ```
 *
 * Example circular parent-child setup.
 * ```typescript
 * export class PageClass {
 *     @UUIDType()
 *     id: string = uuid();
 *
 *     @Field()
 *     name: string;
 *
 *     @Field(() => PageClass)
 *     @ArrayType()
 *     children: Page[] = [];
 *
 *     @Field(() => PageClass)
 *     @ParentReference()
 *     @Optional()
 *     parent?: PageClass;
 *
 *     constructor(name: string) {
 *         this.name = name;
 *     }
 * ```
 */
export function ParentReference() {
    return FieldDecoratorWrapper((target: Object, property: string) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(property).isParentReference = true;
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
 *
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
 * Used to define a field as excluded when serialized to Mongo or JSON.
 * PlainToClass or mongoToClass is not effected by this.
 *
 * @category Decorator
 */
export function Exclude() {
    return FieldDecoratorWrapper((target: Object, property: string) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(property).exclude = 'all';
    });
}

/**
 * Used to define a field as excluded when serialized to Mongo.
 * PlainToClass or mongoToClass is not effected by this.
 *
 * @category Decorator
 */
export function ExcludeToMongo() {
    return FieldDecoratorWrapper((target: Object, property: string) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(property).exclude = 'mongo';
    });
}

/**
 * Used to define a field as excluded when serialized to JSON.
 * PlainToClass or mongoToClass is not effected by this.
 *
 * @category Decorator
 */
export function ExcludeToPlain() {
    return FieldDecoratorWrapper((target: Object, property: string) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(property).exclude = 'plain';
    });
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
 *     @Field(forwardRef(() => Config)
 *     config: Config;

 *
 *     @Field([forwardRef(() => Config])
 *     configArray: Config[] = [];
 *
 *     @FieldArray(forwardRef(() => Config)
 *     configArray: Config[] = [];
 *
 *
 *     @FieldMap(forwardRef(() => Config)
 *     configMap: {[k: string]: Config} = {};
 *
 *     @Field({forwardRef(() => Config})
 *     configMap: {[k: string]: Config} = {};
 * }
 *
 * ```
 */
export function forwardRef<T>(forward: ForwardRefFn<T>): ForwardedRef<T> {
    return new ForwardedRef(forward);
}

interface FieldOptions {
    /**
     * Whether the type is a map. You should prefer the short {} annotation
     *
     * Example short {} annotation
     * ```typescript
     * class User {
     *     @Field({MyClass})
     *     config2: {[name: string]: MyClass} = {};
     * }
     * ```
     *
     * Example verbose annotation is necessary for factory method, if you face circular dependencies.
     * ```typescript
     * class User {
     *     @Field(() => MyClass, {map: true})
     *     config2: {[name: string]: MyClass} = {};
     * }
     * ```
     */
    map?: boolean;

    /**
     * @internal
     */
    array?: boolean;

    /**
     * @internal
     */
    type?: Types;
}

/**
 * Decorator to define a field for an entity.
 *
 * ```typescript
 * class User {
 *     @Field()
 *     @Optional()
 *     num?: number;
 *
 *     @Field()
 *     @Optional()
 *     birthdate?: Date;
 *
 *     @Field()
 *     @Optional()
 *     yes?: Boolean;
 *
 *     @Field([String])
 *     tags: string[] = [];
 *
 *     @Field({String})
 *     flatStringConfigs: {[name: string]: String} = {}};
 *
 *     @FieldAny({})
 *     flatConfig: {[name: string]: any} = {}};
 *
 *     @Field(MyClass)
 *     config: MyClass = new wMyClass;
 *
 *     @Field([MyClass])
 *     configArray: MyClass[] = []];
 *
 *     @Field({MyClass})
 *     configMap: {[name: string]: MyClass} = {}};
 *
 *     constrcutor(
 *         @Field()
 *         @Index({unique: true})
 *         public name: string
 *     ) {}
 * }
 * ```
 *
 * @category Decorator
 */
export function Field(type?: FieldTypes | FieldTypes[] | { [n: string]: FieldTypes }, options?: FieldOptions) {
    return FieldDecoratorWrapper((target: Object, property: string, returnType?: any) => {
        options = options || {};

        const id = getClassName(target) + '::' + property;

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

        if (!options.type) {
            // console.log(`${id} ${returnType} ${typeof type} ${type}`);

            if (type && isArray(type)) {
                type = type[0];
                options.array = true;
            }

            if (type && isPlainObject(type)) {
                type = type[Object.keys(type)[0]];
                options.map = true;
            }

            if (type && options.array && returnType !== Array) {
                throw new Error(`${id} type mismatch. Given ${getTypeDeclaration(type, options)}, but declared is ${getTypeName(returnType)}. ` +
                    `Please use the correct type in @Field().`
                );
            }

            if (type && !options.array && returnType === Array) {
                throw new Error(`${id} type mismatch. Given ${getTypeDeclaration(type, options)}, but declared is ${getTypeName(returnType)}. ` +
                    `Please use @Field([MyType]) or @FieldArray(MyType) or @FieldArray(forwardRef() => MyType)), e.g. @Field([String]) for '${property}: String[]'.`);
            }

            if (type && options.map && returnType !== Object) {
                throw new Error(`${id} type mismatch. Given ${getTypeDeclaration(type, options)}, but declared is ${getTypeName(returnType)}. ` +
                    `Please use the correct type in @Field().`);
            }

            if (!type && returnType === Object) {
                throw new Error(`${id} type mismatch. Given ${getTypeDeclaration(type, options)}, but declared is Object or undefined. ` +
                    `When you don't declare a type in TypeScript, you need to pass a type in @Field(), e.g. @Field(String).\n` +
                    `If you don't have a type, use @FieldAny(). If you reference a class with circular dependency, use @Field(forwardRef(() => MyType)).`
                );
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

            if (type && !options.map && isCustomObject && returnType === Object) {
                throw new Error(`${id} type mismatch. Given ${getTypeDeclaration(type, options)}, but declared is Object or undefined. ` +
                    `The actual type is an Object, but you specified a Class in @Field(T).\n` +
                    `Please declare a type or use @Field({${getClassName(type)}} for '${property}: {[k: string]: ${getClassName(type)}}'.`);
            }

            options.type = 'any';

            if (!type) {
                type = returnType;
            }

            if (type === String) {
                options.type = 'string';
            }

            if (type === Number) {
                options.type = 'number';
            }
            if (type === Date) {
                options.type = 'date';
            }
            if (type === Buffer) {
                options.type = 'binary';
            }
            if (type === Boolean) {
                options.type = 'boolean';
            }
        }

        if (options.array) {
            getOrCreateEntitySchema(target).getOrCreateProperty(property).isArray = true;
        }

        if (options.map) {
            getOrCreateEntitySchema(target).getOrCreateProperty(property).isMap = true;
        }

        const isCustomObject = type !== String
            && type !== String
            && type !== Number
            && type !== Date
            && type !== Buffer
            && type !== Boolean
            && type !== Any
            && type !== Object;

        if (isCustomObject) {
            getOrCreateEntitySchema(target).getOrCreateProperty(property).type = 'class';
            getOrCreateEntitySchema(target).getOrCreateProperty(property).classType = type as ClassType<any>;

            if (type instanceof ForwardedRef) {
                getOrCreateEntitySchema(target).getOrCreateProperty(property).classTypeForwardRef = type;
                delete getOrCreateEntitySchema(target).getOrCreateProperty(property).classType;
            }
            return;
        }

        if (options.type) {
            getOrCreateEntitySchema(target).getOrCreateProperty(property).type = options.type!;
        }
    });
}

/**
 * Same as @Field() but defines type as 'any'. With type any no transformation is applied.
 *
 * ```typescript
 * class User {
 *     @FieldAny()
 *     config: any;
 *
 *     @FieldAny([])
 *     configs: any[];
 *
 *     @FieldAny({})
 *     configMap: {[name: string]: any};
 * }
 *
 * ```
 *
 * @category Decorator
 */
export function FieldAny(type?: {} | Array<any>) {
    if (isObject(type)) {
        return Field({Any});
    }

    if (isArray(type)) {
        return Field([Any]);
    }

    return Field(Any);
}

/**
 * Same as @Field(T) but defines the field as array of type T.
 * This is the same as @Field({T}).
 *
 * Use this method if you reference a circular dependency class, e.g.
 * ```typescript
 *
 * class User {
 *     @FieldMap(() => MyConfig)
 *     config: {[k: string]: MyConfig};
 * }
 * ```
 *
 * ```typescript
 * class User {
 *     @FieldMap(String)
 *     tags: {[k: string]: string};
 *
 *     @Field({String})
 *     tags: {[k: string]: string};
 * }
 * ```
 *
 * @category Decorator
 */
export function FieldMap(type: FieldTypes) {
    return Field({type});
}

/**
 * Same as @Field(T) but defines the field as map of type T.
 *
 * ```typescript
 * class User {
 *     @FieldArray(String)
 *     tags: string[];
 *
 *     @Field([String])
 *     tags: string[];
 * }
 * ```
 *
 * @category Decorator
 */
export function FieldArray(type: FieldTypes) {
    return Field([type]);
}

/**
 * @hidden
 */
function Type<T>(type: Types) {
    return FieldDecoratorWrapper((target: Object, property: string, returnType?: any) => {
        getOrCreateEntitySchema(target).getOrCreateProperty(property).type = type;
    });
}


/**
 * Used to define a field as ObjectId. This decorator is necessary if you want to use Mongo's _id.
 *
 *
 * ```typescript
 * class Page {
 *     @MongoIdField()
 *     referenceToSomething?: string;
 *
 *     constructor(
 *         @IdType()
 *         @MongoIdField()
 *         public readonly _id: string
 *     ) {
 *
 *     }
 * }
 * ```
 *
 * @category Decorator
 */
export function MongoIdField() {
    return Type('objectId');
}

/**
 * Used to define a field as UUID (v4).
 *
 * @category Decorator
 */
export function UUIDField() {
    return Type('uuid');
}

/**
 * Used to define an index on a field.
 *
 * @category Decorator
 */
export function Index(options?: IndexOptions, fields?: string | string[], name?: string) {
    return FieldAndClassDecoratorWrapper((target: Object, property?: string, returnType?: any) => {
        const schema = getOrCreateEntitySchema(target);

        if (isArray(fields)) {
            schema.indices.push({name: name || fields.join('_'), fields: fields as string[], options: options || {}});
        } else if (isString(fields)) {
            schema.indices.push({name: name || fields, fields: [fields] as string[], options: options || {}});
        } else if (property) {
            schema.indices.push({name: name || property, fields: [property] as string[], options: options || {}});
        }
    });
}

/**
 * Used to define a field as Enum.
 *
 * If allowLabelsAsValue is set, you can use the enum labels as well for setting the property value using plainToClass().
 *
 * @category Decorator
 */
export function EnumField<T>(type: any, allowLabelsAsValue = false) {
    return FieldDecoratorWrapper((target: Object, property: string, returnType?: any) => {
        if (property) {
            Type('enum')(target, property);
            getOrCreateEntitySchema(target).getOrCreateProperty(property).classType = type;
            getOrCreateEntitySchema(target).getOrCreateProperty(property).allowLabelsAsValue = allowLabelsAsValue;
        }
    });
}
