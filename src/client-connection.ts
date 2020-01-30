import {Inject, Injectable, Injector} from "injection-js";
import {Subscription} from "rxjs";
import {Application, SessionStack} from "./application";
import {ActionTypes, ClientMessageAll, ConnectionMiddleware, ConnectionWriter, executeAction, getActionParameters, getActions} from "@marcj/glut-core";
import {arrayRemoveItem, each} from "@marcj/estdlib";
import {uuid} from "@marcj/marshal";
import {Exchange} from "./exchange";
import {ProcessLock, ProcessLocker} from "./process-locker";

@Injectable()
export class ClientConnection {
    protected id: string = uuid();

    protected timeoutTimers: any[] = [];
    protected destroyed = false;
    protected usedControllers: { [path: string]: { i: any, p: Promise<any> } } = {};

    private cachedActionsTypes: {
        [controllerName: string]: { [actionName: string]: ActionTypes }
    } = {};

    private registeredPeerControllers: { [name: string]: { sub: Subscription, lock: ProcessLock } } = {};

    protected pushMessageReplyId = 0;
    protected pushMessageReplies: { [id: string]: (data: any) => void } = {};

    protected clientUsedPeerControllers: { [controllerName: string]: Subscription } = {};

    constructor(
        protected app: Application,
        protected sessionStack: SessionStack,
        protected injector: Injector,
        protected locker: ProcessLocker,
        protected exchange: Exchange,
        protected connectionMiddleware: ConnectionMiddleware,
        protected writer: ConnectionWriter,
        @Inject('remoteAddress') public readonly remoteAddress: string,
    ) {
    }

    /**
     * Is called when connection breaks or client disconnects.
     */
    public async destroy() {
        if (this.destroyed) return;

        this.connectionMiddleware.destroy();
        this.destroyed = true;

        for (const timeout of this.timeoutTimers) {
            clearTimeout(timeout);
        }

        for (const sub of each(this.clientUsedPeerControllers)) {
            sub.unsubscribe();
        }

        for (const usedController of each(this.usedControllers)) {
            await usedController.p;
            if (usedController.i.destroy) {
                usedController.i.destroy();
            }
        }

        for (const peer of each(this.registeredPeerControllers)) {
            peer.sub.unsubscribe();
            peer.lock.unlock();
        }

        this.registeredPeerControllers = {};
    }

    public isActive(): boolean {
        return !this.destroyed;
    }

    public isLocal(): boolean {
        return this.remoteAddress === '127.0.0.1'
            || this.remoteAddress === '::1';
    }

    /**
     * Creates a regular timer using setTimeout() and automatically cancel it once the connection breaks or server stops.
     */
    public setTimeout(cb: () => void, timeout: number): any {
        const timer = setTimeout(() => {
            cb();
            arrayRemoveItem(this.timeoutTimers, timer);
        }, timeout);
        this.timeoutTimers.push(timer);
        return timer;
    }

    // public async sendPushMessage(data: any): Promise<any> {
    //     const replyId = ++this.pushMessageReplyId;
    //
    //     return new Promise<any>((resolve, reject) => {
    //         this.pushMessageReplies[replyId] = (data: any) => {
    //             resolve(data);
    //             delete this.pushMessageReplies[replyId];
    //         };
    //
    //         this.writer.write({
    //             type: 'push-message',
    //             replyId: replyId,
    //             next: data
    //         });
    //     });
    // }

    public async onMessage(raw: string) {
        if ('string' === typeof raw) {
            const message = JSON.parse(raw) as ClientMessageAll;

            if (message.name === 'push-message/reply') {
                if (!this.pushMessageReplies[message.replyId]) {
                    throw new Error(`No reply callback for push-message ${message.replyId}`);
                }

                this.pushMessageReplies[message.replyId](message.data);
            }

            if (message.name === 'peerController/unregister') {
                if (!this.registeredPeerControllers[message.controllerName]) {
                    this.writer.sendError(message.id, `Controller with name ${message.controllerName} not registered.`);
                    return;
                }

                this.registeredPeerControllers[message.controllerName].sub.unsubscribe();
                await this.registeredPeerControllers[message.controllerName].lock.unlock();
                delete this.registeredPeerControllers[message.controllerName];
            }

            /**
             * Message from peer controller to client.
             */
            if (message.name === 'peerController/message') {
                if (!this.registeredPeerControllers[message.controllerName]) {
                    this.writer.sendError(message.id, `Controller with name ${message.controllerName} not registered.`);
                    return;
                }

                this.exchange.publish('peerController/' + message.controllerName + '/reply/' + message.clientId, message.data);
                return;
            }

            /**
             * Message from client to peer controller.
             */
            if (message.name === 'peerMessage') {
                await this.sendToPeerController(message.id, message.controller.substring('_peer/'.length), message.message, message.timeout);
            }

            if (message.name === 'peerController/register') {
                const access = await this.app.isAllowedToRegisterPeerController(this.injector, this.sessionStack.getSessionOrUndefined(), message.controllerName);

                if (!access) {
                    this.writer.sendError(message.id, 'Access denied to register controller ' + message.controllerName);
                    return;
                }

                try {
                    if (this.registeredPeerControllers[message.controllerName]) {
                        this.writer.sendError(message.id, `Controller with name ${message.controllerName} already registered.`);
                        return;
                    }

                    //check if registered
                    const locked = await this.locker.isLocked('peerController/' + message.controllerName);
                    if (locked) {
                        this.writer.sendError(message.id, `Controller with name ${message.controllerName} already registered in exchange.`);
                        return;
                    }

                    const lock = await this.locker.acquireLock('peerController/' + message.controllerName);

                    try {
                        const sub = await this.exchange.subscribe('peerController/' + message.controllerName,
                            (controllerMessage: { clientId: string, data: any }) => {
                                this.writer.write({
                                    id: message.id,
                                    type: 'peerController/message',
                                    clientId: controllerMessage.clientId,
                                    data: controllerMessage.data
                                });
                            });

                        this.registeredPeerControllers[message.controllerName] = {
                            sub: sub,
                            lock: lock,
                        };
                    } catch (error) {
                        await lock.unlock();
                        throw error;
                    }

                    this.writer.ack(message.id);
                } catch (error) {
                    this.writer.sendError(message.id, `Controller with name ${message.controllerName} could not register. ` + error);
                }
                return;
            }

            if (message.name === 'action') {
                try {
                    if (message.controller.startsWith('_peer/')) {
                        await this.sendToPeerController(message.id, message.controller.substring('_peer/'.length), message, message.timeout);
                    } else {
                        try {
                            const {value, encoding} = await this.action(message.controller, message.action, message.args);
                            await this.connectionMiddleware.actionMessageOut(message, value, encoding, message.controller, message.action, this.writer);
                        } catch (error) {
                            console.debug(`Error in action ${message.controller}.${message.action}:`, error);
                            await this.writer.sendError(message.id, error);
                        }
                    }
                } catch (error) {
                    console.debug(`Error in action wrapper ${message.controller}.${message.action}:`, error);
                }
                return;
            }

            if (message.name === 'actionTypes') {
                try {
                    if (message.controller.startsWith('_peer/')) {
                        await this.sendToPeerController(message.id, message.controller.substring('_peer/'.length), message, message.timeout);
                    } else {
                        const {parameters} = await this.getActionTypes(message.controller, message.action);

                        this.writer.write({
                            type: 'actionTypes/result',
                            id: message.id,
                            parameters: parameters.map(v => v.toJSON()),
                        });
                    }
                } catch (error) {
                    this.writer.sendError(message.id, error);
                }
                return;
            }

            if (message.name === 'authenticate') {
                try {
                    this.sessionStack.setSession(await this.app.authenticate(this.injector, message.token));
                } catch (error) {
                    console.error('authentication error', error);
                }

                this.writer.write({
                    type: 'authenticate/result',
                    id: message.id,
                    result: this.sessionStack.isSet(),
                });
                return;
            }

            await this.connectionMiddleware.messageIn(message, this.writer);
        }
    }

    protected async sendToPeerController(
        messageId: number,
        controllerName: string,
        message: object,
        timeout: number = 20,
    ) {
        const access = await this.app.isAllowedToSendToPeerController(this.injector, this.sessionStack.getSessionOrUndefined(), controllerName);

        if (!access) {
            this.writer.sendError(messageId, `Access denied to peer controller ` + controllerName, 'access_denied');
            return;
        }

        //check if registered
        const locked = await this.locker.isLocked('peerController/' + controllerName);

        if (!locked) {
            this.writer.sendError(messageId, `Peer controller ${controllerName} not registered`, 'peer_not_registered');
            return;
        }

        //todo, rework that and request from the exchange a new tcp port forwarding to the peer directly. But is that then really faster?
        // We could register multiple broker, that could be used instead of always the exchange server. For many connections this could solve
        // bottleneck issues.

        let timeoutTimer: any = null;

        if (!this.clientUsedPeerControllers[controllerName]) {
            const sub = await this.exchange.subscribe('peerController/' + controllerName + '/reply/' + this.id, (reply: any) => {
                this.writer.write(reply);
            });

            this.clientUsedPeerControllers[controllerName] = new Subscription(() => {
                sub.unsubscribe();
                this.exchange.publish('peerController/' + controllerName, {
                    data: {name: 'peerUser/end'},
                    clientId: this.id,
                });
            });
        }

        timeoutTimer = setTimeout(() => {
            if (this.clientUsedPeerControllers[controllerName]) {
                this.clientUsedPeerControllers[controllerName].unsubscribe();
                delete this.clientUsedPeerControllers[controllerName];
            }
            this.writer.sendError(messageId, `Peer timed out ` + controllerName, 'peer_timeout');
        }, timeout * 1000);

        //this subscribe is just for checking timeout
        const timeoutSub = await this.exchange.subscribe('peerController/' + controllerName + '/reply/' + this.id, (reply: any) => {
            if (reply.id === messageId) {
                clearTimeout(timeoutTimer);
                timeoutSub.unsubscribe();
            }
        });

        this.exchange.publish('peerController/' + controllerName, {
            clientId: this.id,
            data: {
                ...message,
                controller: controllerName
            }
        }).catch((error) => {
            console.error(`Could not publish peerController/${controllerName} message`, error);
        });
    }

    public async getActionTypes(controller: string, action: string)
        : Promise<ActionTypes> {

        if (!this.cachedActionsTypes[controller]) {
            this.cachedActionsTypes[controller] = {};
        }

        if (!this.cachedActionsTypes[controller][action]) {

            const controllerClass = await this.app.resolveController(controller);

            if (!controllerClass) {
                throw new Error(`Controller not found for ${controller}`);
            }

            const access = await this.app.hasAccess(this.injector, this.sessionStack.getSessionOrUndefined(), controllerClass, action);
            if (!access) {
                throw new Error(`Access denied to action ` + action);
            }

            const actions = getActions(controllerClass);

            if (!actions[action]) {
                console.log('Action unknown, but method exists.', action);
                throw new Error(`Action unknown ${action}`);
            }

            this.cachedActionsTypes[controller][action] = {
                parameters: getActionParameters(controllerClass, action),
            };
        }

        return this.cachedActionsTypes[controller][action];
    }

    public async action(controller: string, action: string, args: any[]) {
        const controllerClass = await this.app.resolveController(controller);

        if (!controllerClass) {
            throw new Error(`Controller not found for ${controller}`);
        }

        const access = await this.app.hasAccess(this.injector, this.sessionStack.getSessionOrUndefined(), controllerClass, action);
        if (!access) {
            throw new Error(`Access denied to action ` + action);
        }

        const controllerInstance = this.injector.get(controllerClass);

        if (!this.usedControllers[controller]) {
            this.usedControllers[controller] = {
                i: controllerInstance,
                p: controllerInstance.initPerConnection ? controllerInstance.initPerConnection() : Promise.resolve()
            };
        }

        await this.usedControllers[controller].p;

        const methodName = action;
        const fullName = `${controller}::${action}`;

        if ((controllerInstance as any)[methodName]) {
            const actions = getActions(controllerClass);

            if (!actions[methodName]) {
                console.log('Action unknown, but method exists.', fullName);
                throw new Error(`Action unknown ${fullName}`);
            }

            const types = await this.getActionTypes(controller, action);

            return await executeAction(types, controller, controllerInstance, methodName, args);
        }

        throw new Error(`Action unknown ${fullName}`);
    }
}
