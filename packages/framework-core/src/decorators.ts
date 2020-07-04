import 'reflect-metadata';
import {ClassType} from "@super-hornet/core";
import {getClassSchema, PropertySchema, PropertySchemaSerialized} from "@super-hornet/marshal";

export function getActionReturnType<T>(target: ClassType<T>, method: string): PropertySchemaSerialized {
    return getClassSchema(target).getMethod(method).toJSON();
}

export function getActionParameters<T>(target: ClassType<T>, method: string): PropertySchema[] {
    return getClassSchema(target).getMethodProperties(method);
}

export function getActions<T>(target: ClassType<T>): { [name: string]: {} } {
    return Reflect.getMetadata('super-hornet:actions', target.prototype) || {};
}

export function Action(options?: {}) {
    return (target: Object, property: string) => {
        const actions = Reflect.getMetadata('super-hornet:actions', target) || {};
        actions[property] = options || {};

        Reflect.defineMetadata('super-hornet:actions', actions, target);
    };
}

export function Controller<T>(name: string) {
    return (target: ClassType<T>) => {
        Reflect.defineMetadata('super-hornet:controller', {
            name: name,
        }, target);
    };
}
