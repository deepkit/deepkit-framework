import {
    CacheJitPropertyConverter, ClassSchema,
    classToPlain,
    createClassToXFunction, createJITConverterFromPropertySchema,
    createXToClassFunction,
    getClassSchema, JitConverterOptions,
    jitPartial,
    partialClassToPlain,
    partialPlainToClass,
    plainToClass,
    resolvePropertyCompilerSchema,
} from '@super-hornet/marshal';
import {ClassType, eachKey, isPlainObject, getClassName} from "@super-hornet/core";
import './compiler-templates';
import {FilterQuery} from "mongodb";

export function mongoToClass<T>(classType: ClassType<T> | ClassSchema<T>, record: any, options?: JitConverterOptions): T {
    classType = classType instanceof ClassSchema ? classType : getClassSchema(classType);
    return createXToClassFunction(classType, 'mongo')(record, options);
}

export function classToMongo<T>(classType: ClassType<T> | ClassSchema<T>, instance: T, options?: JitConverterOptions): any {
    classType = classType instanceof ClassSchema ? classType : getClassSchema(classType);

    if (!(instance instanceof classType.classType)) {
        throw new Error(`Could not classToMongo since target is not a class instance of ${getClassName(classType)}`);
    }
    return createClassToXFunction(classType, 'mongo')(instance, options);
}

export function mongoToPlain<T>(classType: ClassType<T> | ClassSchema<T>, record: any) {
    classType = classType instanceof ClassSchema ? classType : getClassSchema(classType);
    return classToPlain(classType, mongoToClass(classType, record));
}

export function plainToMongo<T>(classType: ClassType<T> | ClassSchema<T>, target: { [k: string]: any }): any {
    classType = classType instanceof ClassSchema ? classType : getClassSchema(classType);
    return classToMongo(classType, plainToClass(classType, target));
}

export function partialClassToMongo<T, K extends keyof T>(
    classType: ClassType<T>,
    partial: { [path: string]: any },
    options?: JitConverterOptions
): { [path: string]: any } {
    return jitPartial('class', 'mongo', classType, partial, options);
}

export function partialMongoToClass<T, K extends keyof T>(
    classType: ClassType<T>,
    partial: { [path: string]: any },
    options?: JitConverterOptions
): { [path: string]: any } {
    return jitPartial('mongo', 'class', classType, partial, options);
}

export function partialPlainToMongo<T, K extends keyof T>(
    classType: ClassType<T>,
    target: { [path: string]: any },
    options?: JitConverterOptions
): { [path: string]: any } {
    return partialClassToMongo(classType, partialPlainToClass(classType, target), options);
}

export function partialMongoToPlain<T, K extends keyof T>(
    classType: ClassType<T>,
    target: { [path: string]: any },
    options?: JitConverterOptions
): { [path: string]: any } {
    return partialClassToPlain(classType, partialMongoToClass(classType, target), options);
}

export function propertyClassToMongo<T>(classType: ClassType<T>, name: (keyof T & string) | string, value: any): any {
    return createJITConverterFromPropertySchema('class', 'mongo', getClassSchema(classType).getProperty(name))(value);
}

export function propertyMongoToClass<T>(classType: ClassType<T>, name: (keyof T & string) | string, value: any): any {
    return createJITConverterFromPropertySchema('mongo', 'class', getClassSchema(classType).getProperty(name))(value);
}

export type Converter = (convertClassType: ClassType<any>, path: string, value: any) => any;
export type QueryFieldNames = { [name: string]: boolean };
export type QueryCustomFields = { [name: string]: (name: string, value: any, fieldNames: QueryFieldNames, converter: Converter) => any };

/**
 * Takes a mongo filter query and converts its class values to classType's mongo types, so you
 * can use it to send it to mongo.
 */
export function convertClassQueryToMongo<T, K extends keyof T, Q extends FilterQuery<T>>(
    classType: ClassType<T>,
    query: Q,
    fieldNamesMap: QueryFieldNames = {},
    customMapping: { [name: string]: (name: string, value: any, fieldNamesMap: { [name: string]: boolean }) => any } = {},
): Q {
    const cacheJitPropertyConverter = new CacheJitPropertyConverter('class', 'mongo');

    return convertQueryToMongo(classType, query, (convertClassType: ClassType<any>, path: string, value: any) => {
        return cacheJitPropertyConverter.getJitPropertyConverter(convertClassType).convert(path, value);
    }, fieldNamesMap, customMapping);
}

/**
 * Takes a mongo filter query and converts its plain values to classType's mongo types, so you
 * can use it to send it to mongo.
 */
export function convertPlainQueryToMongo<T, K extends keyof T>(
    classType: ClassType<T>,
    target: FilterQuery<T>,
    fieldNamesMap: QueryFieldNames = {},
    customMapping: QueryCustomFields = {},
): { [path: string]: any } {
    //we need to convert between two formats as we have no compiler for plain -> mongo directly.
    const cacheJitPropertyConverterPlainToClass = new CacheJitPropertyConverter('plain', 'class');
    const cacheJitPropertyConverterClassToMongo = new CacheJitPropertyConverter('class', 'mongo');

    return convertQueryToMongo(classType, target, (convertClassType: ClassType<any>, path: string, value: any) => {
        const property = resolvePropertyCompilerSchema(getClassSchema(convertClassType), path);
        const classValue = cacheJitPropertyConverterPlainToClass.getJitPropertyConverter(convertClassType).convertProperty(property, value);
        return cacheJitPropertyConverterClassToMongo.getJitPropertyConverter(convertClassType).convertProperty(property, classValue)
    }, fieldNamesMap, customMapping);
}

export function convertQueryToMongo<T, K extends keyof T, Q extends FilterQuery<T>>(
    classType: ClassType<T>,
    target: Q,
    converter: Converter,
    fieldNamesMap: QueryFieldNames = {},
    customMapping: QueryCustomFields = {},
): Q {
    const result: { [i: string]: any } = {};
    const schema = getClassSchema(classType);

    for (const i of eachKey(target)) {
        let fieldValue: any = target[i];
        const property = schema.getPropertyOrUndefined(i);

        //when i is a reference, we rewrite it to the foreign key name
        let targetI = property && property.isReference ? property.getForeignKeyName() : i;

        if (i[0] === '$') {
            result[i] = (fieldValue as any[]).map(v => convertQueryToMongo(classType, v, converter, fieldNamesMap, customMapping));
            continue;
        }

        if (isPlainObject(fieldValue)) {
            fieldValue = {...target[i]};

            for (const j of eachKey(fieldValue)) {
                let queryValue: any = (fieldValue as any)[j];

                if (j[0] !== '$') {
                    //its a regular classType object
                    // if (property && property.isReference) {
                    //     fieldValue = fieldValue[property.getResolvedClassSchema().getPrimaryField().name];
                    // }
                    fieldValue = converter(classType, targetI, fieldValue);
                    break;
                } else {
                    //we got a mongo query, e.g. `{$all: []}` as fieldValue
                    if (customMapping[j]) {
                        const mappingResult = customMapping[j](i, queryValue, fieldNamesMap, converter);
                        if (mappingResult) {
                            fieldValue = mappingResult;
                            break;
                        } else {
                            fieldValue = undefined;
                            break;
                        }
                    } else if (j === '$in' || j === '$nin' || j === '$all') {
                        fieldNamesMap[targetI] = true;
                        // if (property && property.isReference) {
                        //     const pk = property.getResolvedClassSchema().getPrimaryField().name;
                        //     queryValue = queryValue.map(v => v[pk]);
                        // }
                        (fieldValue as any)[j] = (queryValue as any[]).map(v => converter(classType, targetI, v));
                    } else if (j === '$text' || j === '$exists' || j === '$mod' || j === '$size' || j === '$type' || j === '$regex' || j === '$where') {
                        // if (property && property.isReference) {
                        //     targetI = i;
                        // } else {
                        //don't transform
                        fieldNamesMap[targetI] = true;
                        // }
                    } else {
                        fieldNamesMap[targetI] = true;
                        // if (property && property.isReference) {
                        //     queryValue = queryValue[property.getResolvedClassSchema().getPrimaryField().name];
                        // }
                        (fieldValue as any)[j] = converter(classType, targetI, queryValue);
                    }
                }
            }
        } else {
            fieldNamesMap[targetI] = true;

            // if (property && property.isReference) {
            //     fieldValue = fieldValue[property.getResolvedClassSchema().getPrimaryField().name];
            // }

            fieldValue = converter(classType, targetI, fieldValue);
        }

        if (fieldValue !== undefined) {
            result[targetI] = fieldValue;
        }
    }

    return result as Q;
}
