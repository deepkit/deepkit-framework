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
import {
    ClassDecoratorResult,
    createClassDecoratorContext,
    createPropertyDecoratorContext,
    mergeDecorator,
    PropertyDecoratorResult,
    reflect,
} from '@deepkit/type';
import { ControllerDefinition } from './model.js';

export class RpcController {
    // Defaults to the name of the class
    name: string = '';

    classType?: ClassType;

    definition?: ControllerDefinition<any>;

    strictSerialization: boolean = true;
    logValidationErrors: boolean = false;

    actions = new Map<string, RpcAction>();

    getPath(): string {
        const name = this.definition ? this.definition.path : this.name;
        return name || (this.classType ? reflect(this.classType).typeName || this.classType.name : '');
    }
}

export class RpcAction {
    name!: string;
    classType!: ClassType;

    category: string = '';
    description: string = '';

    strictSerialization?: boolean;
    logValidationErrors?: boolean;

    groups: string[] = [];
    data: { [name: string]: any } = {};
}

class RpcClass {
    t = new RpcController;

    controller(nameOrDefinition?: string | ControllerDefinition<any>) {
        if ('string' === typeof nameOrDefinition) {
            this.t.name = nameOrDefinition;
        } else {
            this.t.definition = nameOrDefinition;
        }
    }

    /**
     * Enables validation and fast serialization for this controller (default).
     * This forces the data to be strictly checked and serialized according to the type.
     *
     * Disabling can be useful for cases where you have invalid runtime data, but still want to work with it.
     * If the RPC action returns different data than specified in the return type,
     * then it is ignored and serialized as is.
     * If the client sends invalid data, it is ignored and deserialized as is.
     *
     * Useful in combination with `logValidationErrors()` to at least know where
     * the invalid data comes from if strict validation is not enabled.
     *
     * Note this has serious performance implications if disabled, as the serialization and deserialization
     * is much slower. If invalid data is passed, de-/serialization happens twice, if logValidationErrors is active.
     */
    strictSerialization(active: boolean = true) {
        this.t.strictSerialization = active;
    }

    /**
     * Logs validation errors to the logger for invalid passed arguments or
     * invalid return values. This also logs if serialization or deserialization
     * failed due to invalid data.
     *
     * Per default disabled.
     */
    logValidationErrors(active: boolean = true) {
        this.t.logValidationErrors = active;
    }

    addAction(name: string, action: RpcAction) {
        this.t.actions.set(name, action);
    }

    onDecorator(classType: ClassType) {
        this.t.classType = classType;
    }
}

export const rpcClass: ClassDecoratorResult<typeof RpcClass> = createClassDecoratorContext(RpcClass);

class RpcProperty {
    t = new RpcAction;

    onDecorator(classType: ClassType, property: string | undefined) {
        if (!property) return;
        this.t.name = property;
        this.t.classType = classType;
        rpcClass.addAction(property!, this.t)(classType);
    }

    action() {
    }

    category(name: string) {
        this.t.category = name;
    }

    description(text: string) {
        this.t.description = text;
    }

    group(...groups: string[]) {
        this.t.groups.push(...groups);
    }

    options(options: Partial<RpcAction>) {
        Object.assign(this.t, options);
    }

    /**
     * @see RpcClass.strictSerialization
     */
    strictSerialization(active: boolean = true) {
        this.t.strictSerialization = active;
    }

    /**
     * @see RpcClass.logValidationErrors
     */
    logValidationErrors(active: boolean = true) {
        this.t.logValidationErrors = active;
    }

    data(name: string, value: any) {
        this.t.data[name] = value;
    }
}

export const rpcProperty: PropertyDecoratorResult<typeof RpcProperty> = createPropertyDecoratorContext(RpcProperty);

export const rpc: typeof rpcClass & typeof rpcProperty = mergeDecorator(rpcClass, rpcProperty) as any;

export function getActions<T>(target: ClassType<T>): Map<string, RpcAction> {
    const parent = Object.getPrototypeOf(target);
    const results = parent ? getActions(parent) : new Map<string, RpcAction>();

    const data = rpcClass._fetch(target);
    if (!data) return results;

    for (const action of data.actions.values()) {
        const existing = results.get(action.name)!;
        if (existing) {
            existing.groups.push(...action.groups);
            Object.assign(existing.data, action.data);
        } else {
            if (action.strictSerialization === undefined) {
                action.strictSerialization = data.strictSerialization;
            }
            if (action.logValidationErrors === undefined) {
                action.logValidationErrors = data.logValidationErrors;
            }
            results.set(action.name, action);
        }
    }

    return results;
}
