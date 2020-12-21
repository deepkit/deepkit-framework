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

import { ClassType, toFastProperties } from '@deepkit/core';
import { ClassSchema, createClassSchema, getClassSchema, getXToClassFunction, jitValidate, jsonSerializer, PropertySchema, t, ValidationFailed, ValidationFailedItem } from '@deepkit/type';
import { getActionParameters, getActions } from '../decorators';
import { rpcActionType, rpcActionTypeResponse, RpcInjector, RpcTypes } from '../model';
import { RpcMessage } from '../protocol';
import { RpcResponse } from './kernel';

export type ActionTypes = {
    parameters: PropertySchema[],
    parameterSchema: ClassSchema,
    resultSchema: ClassSchema,
    parametersDeserialize: (value: any) => any,
    parametersValidate: (value: any, path?: string, errors?: ValidationFailedItem[]) => ValidationFailedItem[]
};

export class RpcServerAction {
    protected cachedActionsTypes: { [id: string]: ActionTypes } = {};

    constructor(
        protected controllers: Map<string, ClassType>,
        protected injector: RpcInjector,
    ) {
    }

    public async handleActionTypes(message: RpcMessage, response: RpcResponse) {
        const body = message.parseBody(rpcActionType);
        const types = this.loadTypes(body.controller, body.method);

        response.reply(RpcTypes.ActionTypeResponse, rpcActionTypeResponse, {
            parameters: types.parameters.map(v => v.toJSON()),
            result: types.resultSchema.getProperty('v').toJSON(),
        });
    }

    protected loadTypes(controller: string, method: string) {
        const cacheId = controller + '!' + method;
        let types = this.cachedActionsTypes[cacheId];
        if (types) return types;

        const classType = this.controllers.get(controller);
        if (!classType) {
            throw new Error(`No controller registered for id ${controller}`);
        }

        //todo: implement again
        // const access = await this.security.hasAccess(this.sessionStack.getSessionOrUndefined(), classType, message.method);
        // if (!access) {
        //     throw new Error(`Access denied to action ` + action);
        // }

        const actions = getActions(classType);

        if (!actions.has(method)) {
            console.debug('Action unknown, but method exists.', method);
            throw new Error(`Action unknown ${method}`);
        }

        const parameters = getActionParameters(classType, method);

        const argSchema = createClassSchema();
        for (let i = 0; i < parameters.length; i++) {
            argSchema.registerProperty(parameters[i]);
        }

        const resultSchema = createClassSchema();
        const resultProperty = getClassSchema(classType).getMethod(method).clone();
        resultProperty.name = 'v';
        resultSchema.registerProperty(resultProperty);

        types = this.cachedActionsTypes[cacheId] = {
            parameters: parameters,
            parameterSchema: t.schema({ args: argSchema }),
            resultSchema: resultSchema,
            parametersDeserialize: getXToClassFunction(argSchema, jsonSerializer),
            parametersValidate: jitValidate(argSchema),
        }
        toFastProperties(this.cachedActionsTypes);

        return types;
    }

    public async handleAction(message: RpcMessage, response: RpcResponse) {
        const body = message.parseBody(rpcActionType);

        const classType = this.controllers.get(body.controller);
        if (!classType) throw new Error(`No controller registered for id ${body.controller}`);

        const types = this.loadTypes(body.controller, body.method);

        const value = message.parseBody(types.parameterSchema);

        const controller = this.injector.get(classType);
        const converted = types.parametersDeserialize(value.args);
        const errors = types.parametersValidate(converted);
        if (errors.length) {
            return response.error(new ValidationFailed(errors));
        }

        try {
            const result = await controller[body.method](...Object.values(converted));

            //todo: handle collection, observable, EntitySubject.

            response.reply(RpcTypes.ActionResponseSimple, types.resultSchema, { v: result });
        } catch (error) {
            response.error(error);
        }
    }
}
