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
import {ClassType, eachKey, eachPair, getClassName, isArray, isNumber, isObject, isPlainObject} from '@marcj/estdlib';
import {Buffer} from "buffer";
import * as getParameterNames from "get-parameter-names";

/**
 * Registry of all registered entity that used the @Entity('name') decorator.
 */
export const RegisteredEntities: { [name: string]: ClassType<any> } = {};

export interface PropertyValidator {
    validate<T>(value: any, target: ClassType<T>, propertyName: string, propertySchema: PropertySchema): PropertyValidatorError | void;
}

type IndexOptions = Partial<{
    unique: boolean,
    spatial: boolean,
    sparse: boolean,
    synchronize: boolean,
    fulltext: boolean,
    where: string,
}>;

/**
 * Represents a class property or method argument definition.
 */
export class PropertySchema {
    name: string;

    type: Types = 'any';
    isArray: boolean = false;
    isMap: boolean = false;

    typeSet: boolean = false;

    /**
     * Whether this property is decorated.
     */
    isDecorated: boolean = false;

    isParentReference: boolean = false;
    isOptional: boolean = false;
    isId: boolean = false;

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

    classType?: ClassType<any>;
    classTypeForwardRef?: ForwardedRef<any>;
    classTypeResolved?: ClassType<any>;

    constructor(name: string) {
        this.name = name;
    }

    clone(): PropertySchema {
        const s = new PropertySchema(this.name);
        for (const i of eachKey(this)) {
            s[i] = this[i];
        }
        return s;
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
            throw new Error(`No classType given for ${this.name}. Use @f.forward(() => MyClass) for circular dependencies.`);
        }

        return this.classType;
    }
}

export interface EntityIndex {
    name: string,
    fields: string[],
    options: IndexOptions
}

export class ClassSchema {
    proto: Object;
    name?: string;
    collectionName?: string;
    databaseName?: string;
    decorator?: string;

    /**
     * Each method can have its own PropertySchema definition for each argument, where map key = method name.
     */
    methodProperties = new Map<string, PropertySchema[]>();
    normalizedMethodProperties: {[name: string]: true} = {};

    classProperties: { [name: string]: PropertySchema } = {};

    idField?: string;
    propertyNames: string[] = [];

    methodsParamNames = new Map<string, string[]>();
    methodsParamNamesAutoResolved = new Map<string, string[]>();

    indices: EntityIndex[] = [];

    onLoad: { methodName: string, options: { fullLoad?: boolean } }[] = [];

    constructor(proto: Object) {
        this.proto = proto;
    }

    public clone(proto: Object): ClassSchema {
        const s = new ClassSchema(proto);
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
     *
     * notice: The user is allowed to annotated partial arguments, which means you end up having
     * in this array only a subset of annotated method arguments. Check always for undefined when accessing an
     * array item.
     */
    public getMethodProperties(name: string): PropertySchema[] {
        const properties = this.getOrCreateMethodProperties(name);
        if (!this.normalizedMethodProperties[name]) {
            for (const [i, p] of eachPair(properties)) {
                if (!p) {
                    properties[i] = new PropertySchema(String(i));
                    const returnTypes = Reflect.getMetadata('design:paramtypes', this.proto, name);
                    if (returnTypes) {
                        properties[i].type = returnTypes
                    }
                }
            }
            this.normalizedMethodProperties[name] = true;
        }

        return properties;
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

    public getClassProperties(): { [name: string]: PropertySchema } {
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
        if (this.classProperties[name]) {
            return this.classProperties[name];
        }
    }

    public hasProperty(name: string): boolean {
        return Boolean(this.classProperties[name]);
    }

    public getProperty(name: string): PropertySchema {
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

    if (!ClassSchemas.has(proto)) {
        //check if parent has a EntitySchema, if so clone and use it as base.

        let currentProto = Object.getPrototypeOf(proto);
        let found = false;
        while (currentProto && currentProto !== Object.prototype) {
            if (ClassSchemas.has(currentProto)) {
                found = true;
                ClassSchemas.set(proto, ClassSchemas.get(currentProto)!.clone(proto));
                break;
            }
            currentProto = Object.getPrototypeOf(currentProto);
        }

        if (!found) {
            const reflection = new ClassSchema(proto);
            ClassSchemas.set(proto, reflection);
        }
    }

    return ClassSchemas.get(proto)!;
}

/**
 * Returns meta information / schema about given entity class.
 */
export function getClassSchema<T>(classType: ClassType<T>): ClassSchema {
    if (!ClassSchemas.has(classType.prototype)) {
        //check if parent has a EntitySchema, if so clone and use it as base.
        let currentProto = Object.getPrototypeOf(classType.prototype);
        let found = false;
        while (currentProto && currentProto !== Object.prototype) {
            if (ClassSchemas.has(currentProto)) {
                found = true;
                ClassSchemas.set(classType.prototype, ClassSchemas.get(currentProto)!.clone(classType.prototype));
                break;
            }
            currentProto = Object.getPrototypeOf(currentProto);
        }

        if (!found) {
            const reflection = new ClassSchema(classType.prototype);
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
        || Object.getPrototypeOf(target) !== target['constructor'].prototype
        || isPlainObject(target)
        || !isObject(target)
    ) {
        throw new Error('Target does not seem to be a class instance.');
    }

    return target['constructor'] as ClassType<T>;
}

/**
 * Returns true if given class has an @Entity() or @Field()s defined, and thus became
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

export interface FieldDecoratorResult {
    (target: Object, property?: string, parameterIndexOrDescriptor?: any): void;

    /**
     * Sets the name of this property. Important for cases where the actual name is lost during compilation.
     * @param name
     */
    asName(name: string): FieldDecoratorResult;

    /**
     * @see Optional
     */
    optional(): FieldDecoratorResult;

    /**
     * Used to define a field as excluded when serialized from class to different targets (currently to Mongo or JSON).
     *
     * @see Exclude
     */
    exclude(t?: 'all' | 'mongo' | 'plain'): FieldDecoratorResult;

    /**
     * @see IDField
     */
    asId(): FieldDecoratorResult;

    id(): FieldDecoratorResult;

    /**
     * @see Index
     */
    index(options?: IndexOptions, name?: string): FieldDecoratorResult;

    /**
     * Mongo's ObjectID.
     * @see MongoIdField
     */
    mongoId(): FieldDecoratorResult;

    /**
     * @see UUIDField
     */
    uuid(): FieldDecoratorResult;

    /**
     * @see Decorated
     */
    decorated(): FieldDecoratorResult;

    /**
     * @see FieldArray
     */
    asArray(): FieldDecoratorResult;

    /**
     * @see FieldMap
     */
    asMap(): FieldDecoratorResult;

    /**
     * Uses an additional decorator.
     * @see FieldMap
     */
    use(decorator: (target: Object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any) => void): FieldDecoratorResult;
}

function createFieldDecoratorResult(
    cb: (target: Object, property: PropertySchema, returnType: any, modifiedOptions: FieldOptions) => void,
    givenPropertyName: string = '',
    modifier: ((target: Object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any) => void)[] = [],
    modifiedOptions: FieldOptions = {},
    root = false,
): FieldDecoratorResult {
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

        let returnType;
        let methodName = 'constructor';
        const schema = getOrCreateEntitySchema(target);

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
                    ` @Field.asName('name') is required. Got ${methodsParamNames[parameterIndexOrDescriptor] || methodsParamNamesAutoResolved[parameterIndexOrDescriptor]} !== ${givenPropertyName}`)
            }

            if (givenPropertyName) {
                //we only store the name, when we explicitly defined one
                methodsParamNames[parameterIndexOrDescriptor] = givenPropertyName;
            } else if (methodName === 'constructor') {
                //only for constructor methods
                const constructorParamNames = getParameterNames((target as ClassType<any>).prototype.constructor);
                // const constructorParamNames = getCachedParameterNames((target as ClassType<any>).prototype.constructor);
                givenPropertyName = constructorParamNames[parameterIndexOrDescriptor];
                if (!givenPropertyName) {
                    console.debug('constructorParamNames', parameterIndexOrDescriptor, constructorParamNames);
                    throw new Error('Unable not extract constructor argument names');
                }

                if (methodsParamNames[parameterIndexOrDescriptor] && methodsParamNames[parameterIndexOrDescriptor] !== givenPropertyName) {
                    //we got a new decorator with a different name on a constructor param
                    //since we cant not resolve logically which name to use, we forbid that case.
                    throw new Error(`Defining multiple Marshal decorators with different names at arguments of ${getClassName(target)}::${methodName} is forbidden.` +
                        ` @Field.asName('name') is required.`)
                }

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
            }

            if (!givenPropertyName && propertyOrMethodName) {
                givenPropertyName = propertyOrMethodName;
            }
        }

        const argumentsProperties = schema.getOrCreateMethodProperties(methodName);
        let propertySchema: PropertySchema | undefined = undefined;

        if (isNumber(parameterIndexOrDescriptor)) {
            //decorator is used on a method argument. Might be on constructor or any other method.
            if (methodName === 'constructor') {
                if (!givenPropertyName) {
                    throw new Error(`Could not resolve property name for class property on ${getClassName(target)} ${propertyOrMethodName}`);
                }
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

        for (const mod of modifier) {
            mod(target, propertyOrMethodName, parameterIndexOrDescriptor);
        }

        if (isNumber(parameterIndexOrDescriptor) && target['prototype']) {
            target = target['prototype'];
        }

        cb(target, propertySchema!, returnType, {...modifiedOptions});
    };

    fn.asName = (name: string) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, name, [...modifier, Optional()], modifiedOptions);
    };

    fn.optional = () => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Optional()], modifiedOptions);
    };

    fn.exclude = (target: 'all' | 'mongo' | 'plain' = 'all') => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Exclude(target)], modifiedOptions);
    };

    fn.id = fn.asId = () => {
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

    fn.use = (decorator: (target: Object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any) => void) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, decorator], modifiedOptions);
    };

    fn.asArray = () => {
        resetIfNecessary();
        if (modifiedOptions.map) throw new Error('Field is already defined as map.');
        return createFieldDecoratorResult(cb, givenPropertyName, modifier, {...modifiedOptions, array: true});
    };

    fn.asMap = () => {
        resetIfNecessary();
        if (modifiedOptions.array) throw new Error('Field is already defined as array.');
        return createFieldDecoratorResult(cb, givenPropertyName, modifier, {...modifiedOptions, map: true});
    };

    return fn;
}

/**
 * Helper for decorators that are allowed to be placed in property declaration and constructor property declaration.
 * We detect the name by reading the constructor' signature, which would be otherwise lost.
 */
export function FieldDecoratorWrapper(
    cb: (target: Object, property: PropertySchema, returnType: any, modifiedOptions: FieldOptions) => void,
    root = false
): FieldDecoratorResult {
    return createFieldDecoratorResult(cb, '', [], {}, root);
}

/**
 * Used to define a field as decorated.
 * This is necessary if you want to wrap a field value in the class instance using
 * a own class, like for example for Array manipulations, but keep the JSON and Database value
 * as primitive as possible.
 *
 * Only one field per class can be the decorated one.
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
function Decorated() {
    return FieldDecoratorWrapper((target, property) => {
        getOrCreateEntitySchema(target).decorator = property.name;
        property.isDecorated = true;
    });
}

/**
 *
 * Used to define a field as a reference to an ID.
 * This is important if you interact with the database abstraction.
 *
 * Only one field can be the ID.
 */
function IDField() {
    return FieldDecoratorWrapper((target, property) => {
        getOrCreateEntitySchema(target).idField = property.name;
        property.isId = true;
    });
}

/**
 * Used to mark a field as optional. The validation requires field values per default, this makes it optional.
 */
function Optional() {
    return FieldDecoratorWrapper((target, property) => {
        property.isOptional = true;
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
 *     @f.forward(() => Job) //forward necessary since circular dependency
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
 * Used to define a field as excluded when serialized from class to different targets (currently to Mongo or JSON).
 * PlainToClass or mongoToClass is not effected by this.
 */
function Exclude(t: 'all' | 'mongo' | 'plain' = 'all') {
    return FieldDecoratorWrapper((target, property) => {
        property.exclude = t;
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
 */
export function Field(oriType?: FieldTypes | FieldTypes[] | { [n: string]: FieldTypes }) {
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
                    `When you don't declare a type in TypeScript or types are excluded, you need to pass a type manually via @f.type(String).\n` +
                    `If you don't have a type, use @f.any(). If you reference a class with circular dependency, use @f.forward(() => MyType).`
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
                    `The actual type is an Object, but you specified a Class in @f.type(T).\n` +
                    `Please declare a type or use @f.map(${getClassName(type)} for '${propertyName}: {[k: string]: ${getClassName(type)}}'.`);
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
            property.isArray = true;
        }

        if (options.map) {
            property.isMap = true;
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
            property.type = 'class';
            property.classType = type as ClassType<any>;

            if (type instanceof ForwardedRef) {
                property.classTypeForwardRef = type;
                delete property.classType;
            }
            return;
        }

        if (property.type === 'any') {
            property.type = options.type!;
        }
    }, true);
}

declare type TYPES = FieldTypes | FieldTypes[] | { [n: string]: FieldTypes };

const fRaw = Field();

fRaw['array'] = function (this: FieldDecoratorResult, type: TYPES): FieldDecoratorResult {
    return Field(type).asArray();
};

fRaw['map'] = function (this: FieldDecoratorResult, type: TYPES): FieldDecoratorResult {
    return Field(type).asMap();
};

fRaw['any'] = function (this: FieldDecoratorResult): FieldDecoratorResult {
    return Field(Any);
};

fRaw['type'] = function (this: FieldDecoratorResult, type: TYPES): FieldDecoratorResult {
    return Field(type);
};

fRaw['enum'] = function (this: FieldDecoratorResult, clazz: any, allowLabelsAsValue = false): FieldDecoratorResult {
    return EnumField(clazz, allowLabelsAsValue);
};

fRaw['forward'] = function (this: FieldDecoratorResult, f: () => TYPES): FieldDecoratorResult {
    return Field(forwardRef(f));
};

fRaw['forwardArray'] = function (this: FieldDecoratorResult, f: () => TYPES): FieldDecoratorResult {
    return Field(forwardRef(f)).asArray();
};

fRaw['forwardMap'] = function (this: FieldDecoratorResult, f: () => TYPES): FieldDecoratorResult {
    return Field(forwardRef(f)).asMap();
};

/**
 * Same as @Field() but a short version @f where you can use it like `@f public name: string;`.
 */
export const f: FieldDecoratorResult & {
    type: (type: TYPES) => FieldDecoratorResult,
    array: (type: TYPES) => FieldDecoratorResult,
    enum: <T>(type: any, allowLabelsAsValue?: boolean) => FieldDecoratorResult,
    any: () => FieldDecoratorResult,
    map: (type: TYPES) => FieldDecoratorResult,
    forward: (f: () => TYPES) => FieldDecoratorResult,
    forwardArray: (f: () => TYPES) => FieldDecoratorResult,
    forwardMap: (f: () => TYPES) => FieldDecoratorResult,
} = fRaw as any;

/**
 * @hidden
 */
function Type<T>(type: Types) {
    return FieldDecoratorWrapper((target, property, returnType: any) => {
        property.type = type;
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
 */
function MongoIdField() {
    return Type('objectId');
}

/**
 * Used to define a field as UUID (v4).
 */
function UUIDField() {
    return Type('uuid');
}

/**
 * Used to define an index on a field.
 */
function Index(options?: IndexOptions, name?: string) {
    return FieldDecoratorWrapper((target, property) => {
        const schema = getOrCreateEntitySchema(target);
        if (property.methodName) {
            throw new Error('Index could not be used on method arguments.');
        }

        schema.indices.push({name: name || property.name, fields: [property.name], options: options || {}});
    });
}

/**
 * Used to define an index on a class.
 *
 * @category Decorator
 */
export function MultiIndex(fields: string[], options: IndexOptions, name?: string) {
    return (target: Object, property?: string, parameterIndexOrDescriptor?: any) => {
        const schema = getOrCreateEntitySchema(target);

        schema.indices.push({name: name || fields.join('_'), fields: fields as string[], options: options || {}});
    };
}

/**
 * Used to define a field as Enum.
 *
 * If allowLabelsAsValue is set, you can use the enum labels as well for setting the property value using plainToClass().
 */
function EnumField<T>(type: any, allowLabelsAsValue = false) {
    return FieldDecoratorWrapper((target, property, returnType?: any) => {
        if (property) {
            Type('enum')(target, property.name);
            property.classType = type;
            property.allowLabelsAsValue = allowLabelsAsValue;
        }
    });
}
