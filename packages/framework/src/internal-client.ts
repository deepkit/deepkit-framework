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

import {jsonSerializer, PropertySchema, uuid} from '@deepkit/type';
import {
    ActionTypes,
    ClientMessageWithoutId,
    EntityState,
    handleActiveSubject,
    MessageSubject,
    RemoteController,
    ServerMessageActionTypes,
    ServerMessageComplete,
    ServerMessageError,
    ServerMessageErrorGeneral,
    ServerMessageResult
} from '@deepkit/framework-shared';
import {Subscription} from 'rxjs';
import {asyncOperation, each, eachKey, ProcessLocker} from '@deepkit/core';
import {Exchange} from './exchange/exchange';
import {injectable} from './injector/injector';

/**
 * Internal client for communication with registered peer controllers of connected clients.
 */
@injectable()
export class InternalClient {
    constructor(
        private locker: ProcessLocker,
        private exchange: Exchange,
    ) {
    }

    create(): InternalClientConnection {
        return new InternalClientConnection(this.locker, this.exchange);
    }

    /**
     * Creates a new InternalClientConnection and closes it automatically once cb() is done.
     */
    async auto<T, R = any>(controllerName: string, cb: (controller: RemoteController<T>) => Promise<R>, timeoutInSeconds = 60): Promise<R> {
        const internal = new InternalClientConnection(this.locker, this.exchange);

        try {
            return await cb(internal.peerController(controllerName, timeoutInSeconds));
        } finally {
            internal.destroy();
        }
    }
}


@injectable()
export class InternalClientConnection {
    protected id = uuid();
    protected messageId = 0;
    protected reply: { [id: number]: MessageSubject<any> } = {};

    private controllerSub: { [controllerName: string]: Subscription } = {};

    private cachedActionsTypes: {
        [controllerName: string]: { [actionName: string]: ActionTypes }
    } = {};

    public readonly entityState = new EntityState();

    constructor(
        private locker: ProcessLocker,
        private exchange: Exchange,
    ) {
    }

    /**
     * Closes all open peerController instances.
     */
    public destroy() {
        for (const sub of each(this.controllerSub)) {
            sub.unsubscribe();
        }
    }

    /**
     * It's important to close a peerController instance so all resources can be freed.
     */
    public closePeerController<T>(name: string) {
        if (this.controllerSub[name]) {
            this.controllerSub[name].unsubscribe();
            delete this.controllerSub[name];
        }
    }

    /**
     * Creates a new RemoteController instance and allows to execute remote methods.
     * Use stopPeerController(name) if you're done or InternalClientConnection.destroy();
     */
    public peerController<T>(name: string, timeoutInSeconds = 60): RemoteController<T> {
        const t = this;

        const o = new Proxy(this, {
            get: (target, propertyName) => {
                return function () {
                    const actionName = String(propertyName);
                    const args = Array.prototype.slice.call(arguments);

                    return t.stream('_peer/' + name, actionName, args, timeoutInSeconds);
                };
            }
        });

        return (o as any) as RemoteController<T>;
    }

    protected sendMessage<T = { type: '' }>(
        path: string,
        messageWithoutId: ClientMessageWithoutId,
        timeoutInSeconds = 30
    ): MessageSubject<T | ServerMessageComplete | ServerMessageError> {
        const subject = new MessageSubject<T | ServerMessageComplete | ServerMessageError>(0);
        let timer: any;
        const messageId = this.messageId++;

        if (path.startsWith('_peer/')) {
            const controllerName = path.substr('_peer/'.length);

            subject.setSendMessageModifier((m: any) => {
                return {
                    name: 'peerMessage',
                    controller: controllerName,
                    message: m,
                    timeout: timeoutInSeconds,
                };
            });

            (async () => {
                if (!this.controllerSub[controllerName]) {
                    //check if registered
                    const locked = await this.locker.isLocked('peerController/' + controllerName);

                    if (!locked) {
                        const next = {
                            type: 'error',
                            id: 0,
                            error: `Peer controller ${controllerName} not registered`,
                            code: 'peer_not_registered'
                        } as ServerMessageErrorGeneral;
                        subject.next(next);
                        return;
                    }

                    this.controllerSub[controllerName] = await this.exchange!.subscribe(
                        'peerController/' + controllerName + '/reply/' + this.id, (reply: any) => {
                            if (this.reply[reply.id] && !this.reply[reply.id].isStopped) {
                                this.reply[reply.id].next(reply);
                            }
                        });
                }

                this.reply[messageId] = subject;

                timer = setTimeout(() => {
                    if (!subject.isStopped) {
                        subject.error('Timed out.');
                    }
                }, timeoutInSeconds * 1000);

                subject.subscribe(() => clearTimeout(timer), () => clearTimeout(timer), () => clearTimeout(timer));

                this.exchange!.publish('peerController/' + controllerName, {
                    clientId: this.id,
                    data: {id: messageId, ...messageWithoutId}
                });
            })();

            return subject;
        }

        throw new Error('Non-peer controllers not supported in InternalClient yet');
    }

    public async getActionTypes(controller: string, actionName: string, timeoutInSeconds = 60): Promise<ActionTypes> {
        if (!this.cachedActionsTypes[controller]) {
            this.cachedActionsTypes[controller] = {};
        }

        if (!this.cachedActionsTypes[controller][actionName]) {
            const reply = await this.sendMessage<ServerMessageActionTypes>(controller, {
                name: 'actionTypes',
                controller: controller,
                action: actionName,
                timeout: timeoutInSeconds
            }).firstThenClose();

            if (reply.type === 'error') {
                throw new Error(reply.error);
            } else if (reply.type === 'actionTypes/result') {
                this.cachedActionsTypes[controller][actionName] = {
                    parameters: reply.parameters.map(v => PropertySchema.fromJSON(v)),
                };
            } else {
                throw new Error('Invalid message returned: ' + JSON.stringify(reply));
            }
        }

        return this.cachedActionsTypes[controller][actionName];
    }

    public async stream(controller: string, name: string, args: any[], timeoutInSeconds = 60): Promise<any> {
        return asyncOperation<any>(async (resolve, reject) => {
            try {
                const types = await this.getActionTypes(controller, name);

                for (const i of eachKey(args)) {
                    args[i] = jsonSerializer.serializeProperty(types.parameters[i], args[i]);
                }

                const subject = this.sendMessage<ServerMessageResult>(controller, {
                    name: 'action',
                    controller: controller,
                    action: name,
                    args: args,
                    timeout: timeoutInSeconds,
                }, timeoutInSeconds);

                handleActiveSubject(subject, resolve, reject, controller, name, this.entityState, {});
            } catch (error) {
                reject(error);
            }
        });
    }

}
