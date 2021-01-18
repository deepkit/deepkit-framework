/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { PropertyValidatorError } from './jit-validation';
import {
    ClassType,
    eachPair,
    getClassName,
    extractParameters,
    isFunction,
    isNumber,
    isPlainObject,
} from '@deepkit/core';
import { isArray } from './utils';
import { ClassDecoratorResult, createClassDecoratorContext } from './decorator-builder';
import {
    BackReferenceOptions,
    ClassSchema,
    createClassSchema,
    FieldTypes,
    ForwardRef,
    ForwardRefFn,
    getClassSchema,
    getGlobalStore,
    getOrCreateEntitySchema,
    IndexOptions,
    isPropertyValidator,
    PropertySchema,
    PropertyValidator,
    ReferenceActions
} from './model';
import { PartialField, PatchField, Types } from './types';
import { validators } from './validation-decorator';
import {
    FieldDecoratorResult,
    isFieldDecorator,
    MySQLOptions,
    PostgresOptions,
    SqliteOptions,
    ValidatorFn
} from './field-decorator';
import { Serializer } from './serializer';

export type PlainSchemaProps = { [name: string]: FieldDecoratorResult<any> | PlainSchemaProps | ClassSchema | string | number | boolean };

export type ExtractDefinition<T extends FieldDecoratorResult<any>> = T extends FieldDecoratorResult<infer K> ? K : never;

export type MergeSchemaAndBase<T extends PlainSchemaProps, BASE extends ClassSchema | ClassType | undefined> = BASE extends ClassSchema | ClassType ? ExtractType<BASE> & ExtractClassDefinition<T> : ExtractClassDefinition<T>;

export type ExtractClassProperty<T> =
    T extends PlainSchemaProps ? ExtractClassDefinition<T> :
        T extends ClassSchema<infer K> ? K :
            T extends FieldDecoratorResult<any> ? ExtractDefinition<T> : T

export type OptionalProps<T> = { [name in keyof T]: undefined extends T[name] ? name : never }[keyof T];
export type RequiredProps<T> = { [name in keyof T]: undefined extends T[name] ? never : name }[keyof T];

export type MakeUndefinedOptional<T> =
    { [name in RequiredProps<T>]: T[name] }
    & { [name in OptionalProps<T>]?: T[name] }

export type ExtractClassDefinition<T extends PlainSchemaProps> = MakeUndefinedOptional<{ [name in keyof T]: ExtractClassProperty<T[name]> }>;

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

export function createValidatorFromFunction(validator: ValidatorFn) {
    return class implements PropertyValidator {
        validate<T>(value: any, propertyName: string, classType?: ClassType): PropertyValidatorError | undefined | void {
            return validator(value, propertyName, classType);
        }
    };
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

    function buildPropertySchema(target: object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any, parent?: PropertySchema): PropertySchema {
        //anon properties
        const propertySchema = new PropertySchema(propertyOrMethodName || String(parameterIndexOrDescriptor), parent);

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
                const constructorParamNames = extractParameters((target as ClassType).prototype.constructor);
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
                    }

                    propertySchema = schema.getClassProperties(false).get(givenPropertyName)!;
                    argumentsProperties[parameterIndexOrDescriptor] = propertySchema;
                } else {
                    if (!argumentsProperties[parameterIndexOrDescriptor]) {
                        const constructorParamNames = extractParameters((target as any)[methodName]);
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

    for (const [validatorName, validatorFn] of Object.entries(validators)) {
        Object.defineProperty(fn, validatorName, {
            get: () => (...args: any[]) => {
                resetIfNecessary();
                return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
                    property.validators.push(createValidatorFromFunction((validatorFn as any)(...args)));
                }]);
            }
        });
    }

    Object.defineProperty(fn, 'optional', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Optional()]);
        }
    });


    Object.defineProperty(fn, 'required', {
        get: () => {
            resetIfNecessary();
            return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, Required()]);
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

    fn.transform = (t: (v: any) => any, serializer: string = 'all') => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.serialization.set(serializer, t);
            property.deserialization.set(serializer, t);
        }]);
    };

    fn.serialize = (t: (v: any) => any, serializer: string = 'all') => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.serialization.set(serializer, t);
        }]);
    };

    fn.deserialize = (t: (v: any) => any, serializer: string = 'all') => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.deserialization.set(serializer, t);
        }]);
    };

    fn.description = (v: string) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.description = v;
        }]);
    };

    fn.exclude = (target: 'all' | 'mongo' | 'json' | string = 'all') => {
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

    // Object.defineProperty(fn, 'integer', {
    //     get: () => {
    //         resetIfNecessary();
    //         return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
    //             property.setType('integer');
    //         }]);
    //     }
    // });

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

    fn.generic = fn.template = (...templateArgs: (ClassType | ForwardRefFn<T> | ClassSchema<T> | PlainSchemaProps | FieldDecoratorResult<any> | string | number | boolean)[]) => {
        resetIfNecessary();
        return createFieldDecoratorResult(cb, givenPropertyName, [...modifier, (target: object, property: PropertySchema) => {
            property.templateArgs = [];
            for (const [i, t] of eachPair(templateArgs)) {
                const name = property.name + '_' + i;
                if ('string' === typeof t || 'number' === typeof t || 'boolean' === typeof t) {
                    const p = fRaw.literal(t).buildPropertySchema(name, property);
                    property.templateArgs.push(p);
                } else if (isFieldDecorator(t)) {
                    //its a decorator @f()
                    //target: object, propertyOrMethodName?: string, parameterIndexOrDescriptor?: any
                    const p = t.buildPropertySchema(name,);
                    property.templateArgs.push(p);
                } else if (t instanceof ClassSchema) {
                    property.templateArgs.push(fRaw.type(t.classType).buildPropertySchema(name, property));
                } else if (isPlainObject(t)) {
                    const schema = fRaw.schema(t);
                    property.templateArgs.push(fRaw.type(schema.classType).buildPropertySchema(name, property));
                } else {
                    const p = new PropertySchema(name, property);
                    p.setFromJSType(t);
                    property.templateArgs.push(p);
                }
            }
        }]);
    };

    fn.buildPropertySchema = function (name: string = 'unknown', parent?: PropertySchema) {
        return buildPropertySchema(Object, name, undefined, parent);
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

    fn.validator = (...validators: (ClassType<PropertyValidator> | ValidatorFn)[]) => {
        resetIfNecessary();
        const validatorClasses: ClassType<PropertyValidator>[] = [];

        for (const validator of validators) {
            if (isPropertyValidator(validator)) {
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
function Required() {
    return (target: object, property: PropertySchema) => {
        property.isOptional = false;
        property.manuallySetToRequired = true;
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
        if (isArray(v)) {
            property.defaultValue = () => v.slice(0);
        } else if (isPlainObject(v)) {
            property.defaultValue = () => {
                return { ...v };
            };
        } else {
            property.defaultValue = isFunction(v) ? v : () => v;
        }
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
    schema.fromClass = false;

    if (!props) throw new Error('No props given');

    for (const [name, prop] of Object.entries(props!)) {
        if ('string' === typeof prop || 'number' === typeof prop || 'boolean' === typeof prop) {
            schema.addProperty(name, fRaw.literal(prop));
        } else if (isFieldDecorator(prop)) {
            schema.addProperty(name, prop);
        } else if (prop instanceof ClassSchema) {
            schema.addProperty(name, fRaw.type(prop.classType));
        } else {
            const subSchema = fRaw.schema(prop, { name });
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
    });
};

fRaw['union'] = function <T>(this: FieldDecoratorResult<any>, ...types: (ClassType | ForwardRefFn<any> | ClassSchema | string | number | boolean | PlainSchemaProps | FieldDecoratorResult<any>)[]): FieldDecoratorResult<T> {
    return Field('union').use((target, property) => {
        property.setType('union');
    }).generic(...types);
};

fRaw['partial'] = function <T extends ClassType | ForwardRefFn<any> | ClassSchema | PlainSchemaProps>(this: FieldDecoratorResult<T>, type: T): FieldDecoratorResult<T> {
    let schema = type instanceof ClassSchema ? type.clone() : new ClassSchema(class {
    });

    if (isPlainObject(type)) {
        schema = t.schema(type as PlainSchemaProps);
    } else {
        schema = getClassSchema(type).clone();
    }

    for (const property of schema.getClassProperties().values()) {
        property.isOptional = true; //a Partial<T> is defined in a way that makes all its properties optional
    }

    return Field('partial').generic(schema);
};

fRaw['enum'] = function <T>(this: FieldDecoratorResult<T>, clazz: T, allowLabelsAsValue: boolean = false): FieldDecoratorResult<T> {
    return Field('enum').use((target, property) => {
        property.setFromJSType(clazz);
        property.type = 'enum';
        property.allowLabelsAsValue = allowLabelsAsValue;
    });
};

type EnumValue<T> = T[keyof T];

//this separation is necessary to support older TS version and avoid "error TS2315: Type 'ExtractType' is not generic."
type ExtractType<T> = T extends ForwardRef<infer K> ? ExtractSimpleType<K> :
    T extends () => infer K ? ExtractSimpleType<K> : ExtractSimpleType<T>;

type ExtractSimpleType<T> = T extends ClassType<infer K> ? K :
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

    // /**
    //  * Marks a field as integer.
    //  */
    // integer: FieldDecoratorResult<number>;

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
    enum<T>(type: T, allowLabelsAsValue?: boolean): FieldDecoratorResult<EnumValue<T extends ForwardRef<infer K> ? K : T>>;

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
    partial<T extends ClassType | ForwardRefFn<any> | ClassSchema | PlainSchemaProps>(type: T): FieldDecoratorResult<PartialField<ExtractType<T>>>;

    // /**
    //  * Partial type. Allows deep dot-style paths.
    //  */
    // patch<T extends ClassType | ForwardRefFn<any> | ClassSchema | PlainSchemaProps | FieldDecoratorResult<any>>(type: T): FieldDecoratorResult<PatchField<ExtractType<T>>>;

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

        schema.indices.set(name, { fields, options });
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

        schema.indices.set(name || fields.join('_'), { fields: fields as string[], options: options || {} });
    };
}
