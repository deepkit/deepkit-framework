import 'reflect-metadata';
import {Provider} from "injection-js";
import {Application} from "./application";
import {ClassType, eachKey, getClassName} from "@marcj/estdlib";
import {ApplicationServerConfig} from "./application-server";
import {ServerMessageActionType, ServerMessageActionTypeNames} from '@marcj/glut-core';
import {getEntityName} from '@marcj/marshal';
import {Observable} from 'rxjs';

export interface ApplicationDecoratorOptions {
    config: ApplicationServerConfig | Partial<ApplicationServerConfig>,
    serverProviders: Provider[],
    connectionProviders: Provider[],
    controllers: ClassType<any>[];
    entitiesForTypeOrm: ClassType<any>[];
    notifyEntities: ClassType<any>[];
}

type TYPES = ClassType<any> | Object | String | Number | Boolean | undefined;

export interface ControllerOptions {
    name: string;
}

export function ApplicationModule<T extends Application>(config: Partial<ApplicationDecoratorOptions>) {
    return (target: ClassType<T>) => {
        Reflect.defineMetadata('glut:module', config, target);
    };
}

export function getApplicationModuleOptions<T extends Application>(target: ClassType<T>): Partial<ApplicationDecoratorOptions> {
    return Reflect.getMetadata('glut:module', target) || {};
}

export function getControllerOptions<T>(target: ClassType<T>): ControllerOptions | undefined {
    return Reflect.getMetadata('glut:controller', target);
}

function typeNameOf(type: TYPES): ServerMessageActionTypeNames {
    if (type === Object) return 'Object';
    if (type === String) return 'String';
    if (type === Number) return 'Number';
    if (type === Date) return 'Date';
    if (type === Boolean) return 'Boolean';
    if (type === undefined) return 'undefined';

    return 'Entity';
}

function getSafeEntityName(classType: any): string | undefined {
    if (
        classType === Object
        || classType === String
        || classType === Number
        || classType === Boolean
        || classType === Array
        || classType === Date
        || classType === undefined
        || classType === Promise
        || classType === Observable
    ) {
        return undefined;
    }

    return getEntityName(classType as ClassType<any>);
}

export function getActionReturnType<T>(target: ClassType<T>, method: string): ServerMessageActionType {
    const returnType = Reflect.getMetadata('design:returntype', target.prototype, method);

    //returnType might be Array in case of "string[], number[]" etc. The actual type is lost.
    //when it's "Object" and meta is undefined, we should print a warning saying the serialisation might be wrong.

    const meta = Reflect.getMetadata('glut:returnType', target.prototype, method) as {
        type: TYPES,
        partial: true
    };

    if (meta) {
        const typeName = typeNameOf(meta.type);
        try {
            return {
                type: typeName,
                array: returnType === Array,
                entityName: typeName === 'Entity' ? getSafeEntityName(meta.type) : undefined,
                partial: meta.partial
            };
        } catch (error) {
            console.error(error);
            throw new Error(`Error in parsing @ReturnType of ${getClassName(target)}::${method}: ${error}`);
        }
    }

    const typeName = typeNameOf(returnType);

    function getValidTypeOf(t: any): any {
        if (
            returnType === Array
            || returnType === Promise
            || returnType === Observable
        ) {
            return undefined;
        }

        return t;
    }

    try {
        return {
            type: typeNameOf(getValidTypeOf(returnType)),
            array: returnType === Array,
            entityName: typeName === 'Entity' ? getSafeEntityName(returnType) : undefined,
            partial: false
        };
    } catch (error) {
        throw new Error(`Error in parsing returnType of ${getClassName(target)}::${method}: ${error}`);
    }
}

export function getActionParameters<T>(target: ClassType<T>, method: string): ServerMessageActionType[] {
    if (!target || !target.prototype) {
        throw new Error('Target is undefined or has no prototype.');
    }

    const paramTypes = Reflect.getMetadata('design:paramtypes', target.prototype, method);

    if (!paramTypes) {
        throw new Error('EmitDecoratorMetadata is not enabled.');
    }

    const result: ServerMessageActionType[] = [];

    for (const i of eachKey(paramTypes)) {
        const returnType = paramTypes[i];

        const meta = Reflect.getMetadata('glut:parameters:' + i, target.prototype, method) as {
            type: ClassType<any> | String | Number | Boolean | undefined,
            partial: true
        };

        if (!meta && returnType === Array) {
            throw Error(`${getClassName(target)}::${method} argument ${i} is an Array. You need to specify it's content using e.g. @ParamType(String).`);
        }

        if (!meta && returnType === Object) {
            throw Error(`${getClassName(target)}::${method} argument ${i} is an Object with unknown structure. Define an entity and use @ParamType(MyEntity).`);
        }

        if (meta) {
            const typeName = typeNameOf(meta.type);
            try {
                result.push({
                    type: typeName,
                    array: returnType === Array,
                    entityName: typeName === 'Entity' ? getSafeEntityName(meta.type) : undefined,
                    partial: meta.partial
                });
            } catch (error) {
                throw new Error(`Error in parsing in argument ${i} of ${getClassName(target)}::${method}: ${error}`);
            }
            continue;
        }

        const typeName = typeNameOf(returnType);
        try {
            result.push({
                type: typeName,
                array: false,
                entityName: typeName === 'Entity' ? getSafeEntityName(returnType) : undefined,
                partial: false
            });
        } catch (error) {
            throw new Error(`Error in parsing in argument ${i} of ${getClassName(target)}::${method}: ${error}`);
        }
    }

    return result;
}

export function getActions<T>(target: ClassType<T>): { [name: string]: {} } {
    return Reflect.getMetadata('glut:actions', target.prototype) || {};
}

export function Action(options?: {}) {
    return (target: Object, property: string) => {
        const actions = Reflect.getMetadata('glut:actions', target) || {};
        actions[property] = options || {};

        Reflect.defineMetadata('glut:actions', actions, target);
    };
}

export function ReturnType<T>(returnType: ClassType<T> | String | Number | Boolean | undefined) {
    return (target: Object, property: string) => {
        return Reflect.defineMetadata('glut:returnType', {
            type: returnType,
            partial: false
        }, target, property);
    };
}

export function PartialEntityReturnType<T>(returnType: ClassType<T> | String | Number | Boolean | undefined) {
    return (target: Object, property: string) => {
        return Reflect.defineMetadata('glut:returnType', {
            type: returnType,
            partial: true
        }, target, property);
    };
}

export function ParamType<T>(paramType: ClassType<T> | String | Number | Boolean | undefined) {
    return (target: Object, property: string, parameterIndex: number) => {
        return Reflect.defineMetadata('glut:parameters:' + parameterIndex, {
            type: paramType,
            partial: false
        }, target, property);
    };
}

export function PartialParamType<T>(paramType: ClassType<T> | String | Number | Boolean | undefined) {
    return (target: Object, property: string, parameterIndex: number) => {
        return Reflect.defineMetadata('glut:parameters:' + parameterIndex, {
            type: paramType,
            partial: true
        }, target, property);
    };
}

export function Controller<T>(name: string) {
    return (target: ClassType<T>) => {
        Reflect.defineMetadata('glut:controller', {
            name: name,
        }, target);
    };
}
