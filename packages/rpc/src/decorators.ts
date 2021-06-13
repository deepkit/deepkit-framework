/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType } from '@deepkit/core';
import { ClassDecoratorResult, createClassDecoratorContext, createPropertyDecoratorContext, getClassSchema, mergeDecorator, PropertyDecoratorResult, PropertySchema, } from '@deepkit/type';
import { ControllerDefinition } from './model';

class RpcController {
    name?: string;

    definition?: ControllerDefinition<any>;

    actions = new Map<string, RpcAction>();

    getPath(): string {
        return this.definition ? this.definition.path : this.name || '';
    }
}

export class RpcAction {
    name!: string;
    classType!: ClassType;

    groups: string[] = [];
}

class RpcClass {
    t = new RpcController;

    controller(nameOrDefinition: string | ControllerDefinition<any>) {
        if ('string' === typeof nameOrDefinition) {
            this.t.name = nameOrDefinition;
        } else {
            this.t.definition = nameOrDefinition;
        }
    }

    addAction(name: string, action: RpcAction) {
        this.t.actions.set(name, action);
    }
}

export const rpcClass: ClassDecoratorResult<typeof RpcClass> = createClassDecoratorContext(RpcClass);

class RpcProperty {
    t = new RpcAction;

    onDecorator(classType: ClassType, property: string) {
        this.t.name = property;
        this.t.classType = classType;
        rpcClass.addAction(property!, this.t)(classType);
    }

    action() {
    }

    group(...groups: string[]) {
        this.t.groups.push(...groups);
    }
}

export const rpcProperty: PropertyDecoratorResult<typeof RpcProperty> = createPropertyDecoratorContext(RpcProperty);

export const rpc: typeof rpcClass & typeof rpcProperty = mergeDecorator(rpcClass, rpcProperty) as any;

export function getActionParameters<T>(target: ClassType<T>, method: string): PropertySchema[] {
    return getClassSchema(target).getMethodProperties(method);
}

export function getActions<T>(target: ClassType<T>): Map<string, RpcAction> {
    return rpcClass._fetch(target)?.actions ?? new Map;
}
