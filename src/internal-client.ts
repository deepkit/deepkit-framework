import {classToPlain, partialClassToPlain, partialPlainToClass, plainToClass, RegisteredEntities, uuid} from "@marcj/marshal";
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
    ServerMessageErrorGeneral
} from "@marcj/glut-core";
import {Subscription} from "rxjs";
import {eachKey, isArray} from "@marcj/estdlib";
import {Injectable} from "injection-js";
import {ProcessLocker} from "./process-locker";

@Injectable()
export class InternalClient {
    private cachedActionsTypes: {
        [controllerName: string]: { [actionName: string]: ActionTypes }
    } = {};

    constructor(
        private locker: ProcessLocker,
        private exchange: Exchange,
    ) {
    }

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
        const replyId = uuid();
        let sub: Subscription | undefined;
        const subject = new MessageSubject<T | ServerMessageComplete | ServerMessageError>(0);
        let timer: any;

        (async () => {
            //check if registered
            const locked = await this.locker.isLocked('peerController/' + controllerName);

            if (!locked) {
                const next = {type: 'error', id: 0, error: `Peer controller ${controllerName} not registered`, code: 'peer_not_registered'} as ServerMessageErrorGeneral;
                subject.next(next);
                return;
            }

            sub = await this.exchange.subscribe('peerController/' + controllerName + '/reply/' + replyId, (reply: any) => {
                if (sub) {
                    sub.unsubscribe();
                }

                if (!subject.isStopped) {
                    subject.next(reply);
                }
            });

            timer = setTimeout(() => {
                if (sub) {
                    sub.unsubscribe();
                }

                if (!subject.isStopped) {
                    subject.error('Timed out.');
                }
            }, timeoutInSeconds * 1000);

            this.exchange.publish('peerController/' + controllerName, {
                replyId: replyId,
                data: messageWithoutId
            });
        })();

        subject.subscribe({
            next: () => {
                clearTimeout(timer);
            }, complete: () => {
                clearTimeout(timer);
            }, error: () => {
                clearTimeout(timer);
            }}).add(() => {
            if (sub) {
                sub.unsubscribe();
            }
        });

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
                    parameters: reply.parameters,
                    returnType: reply.returnType
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
                //todo, handle reject when we sending message fails
                const types = await this.getActionTypes(controller, name);

                for (const i of eachKey(args)) {
                    const type = types.parameters[i];
                    if (undefined === args[i]) {
                        continue;
                    }

                    if (type.type === 'Entity' && type.entityName) {
                        if (!RegisteredEntities[type.entityName]) {
                            throw new Error(`Action's parameter ${controller}::${name}:${i} has invalid entity referenced ${type.entityName}.`);
                        }

                        if (type.partial) {
                            args[i] = partialClassToPlain(RegisteredEntities[type.entityName], args[i]);
                        } else {
                            args[i] = classToPlain(RegisteredEntities[type.entityName], args[i]);
                        }
                    }

                    if (type.type === 'String') {
                        args[i] = type.array ? args[i].map((v: any) => String(v)) : String(args[i]);
                    }

                    if (type.type === 'Number') {
                        args[i] = type.array ? args[i].map((v: any) => Number(v)) : Number(args[i]);
                    }

                    if (type.type === 'Boolean') {
                        args[i] = type.array ? args[i].map((v: any) => Boolean(v)) : Boolean(args[i]);
                    }
                }

                const subject = this.sendMessage<ServerMessageResult>(controller, {
                    name: 'action',
                    controller: controller,
                    action: name,
                    args: args,
                    timeout: timeoutInSeconds,
                }, timeoutInSeconds);

                function deserializeResult(next: any): any {
                    if (types.returnType.type === 'Date') {
                        return new Date(next);
                    }

                    if (types.returnType.type === 'Entity') {
                        const classType = RegisteredEntities[types.returnType.entityName!];

                        if (!classType) {
                            reject(new Error(`Entity ${types.returnType.entityName} now known on client side.`));
                            subject.complete();
                            return;
                        }

                        if (types.returnType.partial) {
                            if (isArray(next)) {
                                return next.map(v => partialPlainToClass(classType, v));
                            } else {
                                return partialPlainToClass(classType, next);
                            }
                        } else {
                            if (isArray(next)) {
                                return next.map(v => plainToClass(classType, v));
                            } else {
                                return plainToClass(classType, next);
                            }
                        }
                    }

                    return next;
                }

                subject.subscribe((reply: ServerMessageResult) => {
                    if (reply.type === 'next/json') {
                        resolve(deserializeResult(reply.next));
                        subject.complete();
                    }

                    if (reply.type === 'error') {
                        //todo, try to find a way to get correct Error instance as well.
                        const error = new Error(reply.error);
                        reject(error);

                        subject.complete();
                    }
                }, (error) => {
                    reject(error);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

}
