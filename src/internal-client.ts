import {classToPlain, partialClassToPlain, partialPlainToClass, plainToClass, RegisteredEntities, uuid, PropertySchema, propertyClassToPlain} from "@marcj/marshal";
import {Exchange} from "./exchange";
import {
    ActionTypes,
    ClientMessageWithoutId,
    MessageSubject,
    RemoteController,
    ServerMessageActionTypes,
    ServerMessageComplete,
    ServerMessageError,
    ServerMessageResult,
    ServerMessageErrorGeneral, handleActiveSubject
} from "@marcj/glut-core";
import {Subscription} from "rxjs";
import {eachKey, isArray, each} from "@marcj/estdlib";
import {Injectable} from "injection-js";
import {ProcessLocker} from "./process-locker";
import {EntityState} from "../../client";

/**
 * Internal client for communication with registered peer controllers of connected clients.
 */
@Injectable()
export class InternalClient {

    constructor(
        private locker: ProcessLocker,
        private exchange: Exchange,
    ) {
    }

    create(): InternalClientConnection {
        return new InternalClientConnection(this.locker, this.exchange);
    }
}


export class InternalClientConnection {
    protected id = uuid();
    protected messageId = 0;
    protected reply: {[id: number]: MessageSubject<any>} = {};

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

                    return t.stream(name, actionName, args, timeoutInSeconds);
                };
            }
        });

        return (o as any) as RemoteController<T>;
    }

    protected sendMessage<T = { type: '' }>(
        controllerName: string,
        messageWithoutId: ClientMessageWithoutId,
        timeoutInSeconds = 30
    ): MessageSubject<T | ServerMessageComplete | ServerMessageError> {
        const subject = new MessageSubject<T | ServerMessageComplete | ServerMessageError>(0);
        let timer: any;
        const messageId = this.messageId++;

        //todo, move logic from SocketClient.sendMessage to here.
        //put

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
                    const next = {type: 'error', id: 0, error: `Peer controller ${controllerName} not registered`, code: 'peer_not_registered'} as ServerMessageErrorGeneral;
                    subject.next(next);
                    return;
                }

                this.controllerSub[controllerName] = await this.exchange.subscribe(
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

            this.exchange.publish('peerController/' + controllerName, {
                clientId: this.id,
                data: {id: messageId, ...messageWithoutId}
            });
        })();

        return subject;
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
        return new Promise<any>(async (resolve, reject) => {
            try {
                const types = await this.getActionTypes(controller, name);

                for (const i of eachKey(args)) {
                    args[i] = propertyClassToPlain(Object, name, args[i], types.parameters[i]);
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
