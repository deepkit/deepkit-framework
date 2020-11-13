/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {ClassType} from '@deepkit/core';
import {
    ClassDecoratorResult,
    createClassDecoratorContext,
    createPropertyDecoratorContext,
    getClassSchema,
    mergeDecorator,
    PropertyDecoratorResult,
    PropertySchema,
} from '@deepkit/type';
import {ControllerDefinition} from './rpc';

class RpcController {
    name?: string;

    definition?: ControllerDefinition<any>;

    actions = new Map;

    getPath(): string {
        return this.definition ? this.definition.path : this.name || '';
    }
}

class RpcAction {
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

    onDecorator(target: object, property?: string) {
        rpcClass.addAction(property!, this.t)(target);
    }

    action() {
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
