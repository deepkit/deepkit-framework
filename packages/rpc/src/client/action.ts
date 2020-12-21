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

import { toFastProperties } from '@deepkit/core';
import { ClassSchema, createClassSchema, getXToClassFunction, jsonSerializer, PropertySchema, t } from '@deepkit/type';
import { rpcAction, rpcActionType, rpcActionTypeResponse, RpcTypes } from '../model';
import { RpcClient } from './client';

type ControllerStateActionState = {
     promise?: Promise<void>, 
     parameters?: string[], 
     parameterSchema?: ClassSchema, 
     resultSchema?: ClassSchema<{ v: any }>,
     resultProperty?: PropertySchema,
     resultDecoder?: (value: any) => any,
};

export class RpcControllerState {
    protected state: { [method: string]: ControllerStateActionState } = {};
    public peerId?: string;

    constructor(
        public controller: string
    ) {

    }

    getState(method: string): ControllerStateActionState {
        let state = this.state[method];
        if (state) return state;
        state = this.state[method] = {};
        toFastProperties(this.state);
        return state;
    }

}

export class RpcActionClient {
    constructor(protected client: RpcClient) {
    }

    public action<T>(controller: RpcControllerState, method: string, args: any[], recipient?: string) {
        return new Promise<any>(async (resolve, reject) => {
            const state = controller.getState(method);
            if (!state.parameterSchema) await this.loadActionTypes(controller, method);

            const argsObject: any = {};

            for (let i = 0; i < args.length; i++) {
                argsObject[state.parameters![i]] = args[i];
            }

            const subject = this.client.sendMessage(RpcTypes.Action, state.parameterSchema!, {
                controller: controller.controller,
                method: method,
                args: argsObject
            }, {peerId: controller.peerId}).onReply((next) => {
                if (next.type === RpcTypes.ActionResponseSimple) {
                    subject.release();
                    const result = next.parseBody(state.resultSchema!);
                    const type = state.resultProperty!.type;

                    if (type === 'string' || type === 'number' || type === 'boolean') {
                        resolve(result.v);
                    } else {
                        //everything else needs full jsonSerialize
                        resolve(state.resultDecoder!(result).v);
                    }
                    return;
                }

                subject.release();
                if (next.isError()) {
                    reject(next.getError());
                } else {
                    reject(new Error(`Unexpected type received ${next.type}`));
                }
            });
        });
    }

    public async loadActionTypes(controller: RpcControllerState, method: string): Promise<void> {
        const state = controller.getState(method);

        if (state.promise) {
            await state.promise;
        }

        if (!state.parameters) {
            state.promise = new Promise<void>(async (resolve, reject) => {
                const parsed = await this.client.sendMessage(RpcTypes.ActionType, rpcActionType, {
                    controller: controller.controller,
                    method: method,
                }, {peerId: controller.peerId}).firstThenClose(RpcTypes.ActionTypeResponse, rpcActionTypeResponse);

                state.parameters = [];
                const argsSchema = createClassSchema();
                for (const property of parsed.parameters) {
                    argsSchema.registerProperty(PropertySchema.fromJSON(property));
                    state.parameters.push(property.name);
                }
                state.parameterSchema = rpcAction.extend({ args: t.type(argsSchema) });

                state.resultSchema = createClassSchema();
                const resultProperty = PropertySchema.fromJSON(parsed.result);
                resultProperty.name = 'v';
                state.resultSchema.registerProperty(resultProperty);
                state.resultProperty = resultProperty;
                state.resultDecoder = getXToClassFunction(state.resultSchema, jsonSerializer);

                resolve();
            });
            await state.promise;
        }
    }

}
