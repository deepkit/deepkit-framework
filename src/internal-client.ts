import {MessageSubject, Promisify} from "../../client";
import {classToPlain, partialClassToPlain, partialPlainToClass, plainToClass, RegisteredEntities, uuid} from "@marcj/marshal";
import {Exchange} from "./exchange";
import {ActionTypes, ClientMessageWithoutId, ServerMessageActionTypes, ServerMessageComplete, ServerMessageError, ServerMessageResult} from "@marcj/glut-core";
import {Subscription} from "rxjs";
import {eachKey, isArray} from "@marcj/estdlib";
import {Injectable} from "injection-js";

@Injectable()
export class InternalClient {
    private cachedActionsTypes: {
        [controllerName: string]: { [actionName: string]: ActionTypes }
    } = {};

    constructor(
        private exchange: Exchange,
    ) {
    }

    public peerController<T>(name: string): Promisify<T> {
        const t = this;

        const o = new Proxy(this, {
            get: (target, propertyName) => {
                return function () {
                    const actionName = String(propertyName);
                    const args = Array.prototype.slice.call(arguments);

                    return t.stream(name, actionName, ...args);
                };
            }
        });

        return (o as any) as Promisify<T>;
    }

    protected sendMessage<T = { type: '' }, K = T | ServerMessageComplete | ServerMessageError>(
        controllerName: string,
        messageWithoutId: ClientMessageWithoutId
    ): MessageSubject<K> {
        const replyId = uuid();
        let sub: Subscription | undefined;

        (async () => {
            sub = await this.exchange.subscribe('peerController/' + controllerName + '/reply/' + replyId, (reply: any) => {
                subject.next(reply);
                if (sub) {
                    sub.unsubscribe();
                }
            });

            this.exchange.publish('peerController/' + controllerName, {
                replyId: replyId,
                data: messageWithoutId
            });
        })();

        const subject = new MessageSubject<K>(() => {
            if (sub) {
                sub.unsubscribe();
            }
        });

        return subject;
    }

    public async getActionTypes(controller: string, actionName: string): Promise<ActionTypes> {
        if (!this.cachedActionsTypes[controller]) {
            this.cachedActionsTypes[controller] = {};
        }

        if (!this.cachedActionsTypes[controller][actionName]) {
            const reply = await this.sendMessage<ServerMessageActionTypes>(controller, {
                name: 'actionTypes',
                controller: controller,
                action: actionName
            }).firstAndClose();

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

    public async stream(controller: string, name: string, ...args: any[]): Promise<any> {
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
                    args: args
                });

                function deserializeResult(next: any): any {
                    if (types.returnType.type === 'Date') {
                        return new Date(next);
                    }

                    if (types.returnType.type === 'Entity') {
                        const classType = RegisteredEntities[types.returnType.entityName!];

                        if (!classType) {
                            reject(new Error(`Entity ${types.returnType.entityName} now known on client side.`));
                            subject.close();
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
                        subject.close();
                    }

                    if (reply.type === 'error') {
                        //todo, try to find a way to get correct Error instance as well.
                        const error = new Error(reply.error);
                        reject(error);

                        subject.close();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

}
