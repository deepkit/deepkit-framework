import 'reflect-metadata';
import {ServerMessageActionTypeNames} from "./contract";
import {ClassType, eachKey, getClassName, getClassPropertyName} from "@marcj/estdlib";
import {Observable} from "rxjs";
import {getEntityName, getClassSchema, PropertySchemaSerialized, PropertySchema} from "@marcj/marshal";

type TYPES = ClassType<any> | 'any' | Object | String | Number | Boolean | undefined;

function typeNameOf(type: TYPES): ServerMessageActionTypeNames {
    if (type === Object) return 'Object';
    if (type === String) return 'String';
    if (type === Number) return 'Number';
    if (type === Date) return 'Date';
    if (type === 'Plain') return 'Plain';
    if (type === Boolean) return 'Boolean';
    if (type === 'any') return 'Any';
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
        || classType === 'Plain'
        || classType === undefined
        || classType === Promise
        || classType === Observable
    ) {
        return undefined;
    }

    return getEntityName(classType as ClassType<any>);
}

export function getActionReturnType<T>(target: ClassType<T>, method: string): PropertySchemaSerialized {
    return getClassSchema(target).getMethod(method).toJSON();
}

export function getActionParameters<T>(target: ClassType<T>, method: string): PropertySchema[] {
    if (!target || !target.prototype) {
        throw new Error('Target is undefined or has no prototype.');
    }

    return getClassSchema(target).getMethodProperties(method);
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

export function Controller<T>(name: string) {
    return (target: ClassType<T>) => {
        Reflect.defineMetadata('glut:controller', {
            name: name,
        }, target);
    };
}
