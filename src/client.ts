import {Observable, Subscriber, Subject, BehaviorSubject, Subscription} from "rxjs";
import {classToPlain, partialClassToPlain, partialPlainToClass, plainToClass, RegisteredEntities} from "@marcj/marshal";
import {
    ClientMessageAll,
    ClientMessageWithoutId,
    Collection,
    EntitySubject,
    executeActionAndSerialize,
    getActionParameters,
    getActionReturnType,
    getActions,
    MessageSubject,
    RemoteController,
    ServerMessageActionType,
    ServerMessageActionTypes,
    ServerMessageAll,
    ServerMessageAuthorize,
    ServerMessageComplete,
    ServerMessageError,
    ServerMessagePeerChannelMessage,
    ServerMessageResult,
    StreamBehaviorSubject,
    CollectionPaginationEvent,
} from "@marcj/glut-core";
import {applyDefaults, ClassType, eachKey, isArray, sleep, getClassName, each} from "@marcj/estdlib";
import {EntityState} from "./entity-state";

export class SocketClientConfig {
    host: string = '127.0.0.1';

    port: number = 8080;

    ssl: boolean = false;

    token: any = undefined;
}

type ActionTypes = { parameters: ServerMessageActionType[], returnType: ServerMessageActionType };

export class AuthorizationError extends Error {
}

let _clientId = 0;

export class SocketClient {
    public socket?: WebSocket;

    /**
     * True when the connection established (without authentication)
     */
    private connected: boolean = false;
    private loggedIn: boolean = false;

    private messageId: number = 0;
    private connectionTries = 0;

    private currentConnectionId: number = 0;

    private replies: {
        [messageId: string]: (data: any) => void
    } = {};

    private connectionPromise?: Promise<void>;

    public readonly entityState = new EntityState();
    private config: SocketClientConfig;

    public readonly disconnected = new Subject<number>();
    public readonly reconnected = new Subject<number>();

    public readonly clientId = _clientId++;

    /**
     * true when the connection fully established (after authentication)
     */
    public readonly connection = new BehaviorSubject<boolean>(false);

    private cachedActionsTypes: {
        [controllerName: string]: { [actionName: string]: ActionTypes }
    } = {};

    public constructor(
        config: SocketClientConfig | Partial<SocketClientConfig> = {},
    ) {
        this.config = config instanceof SocketClientConfig ? config : applyDefaults(SocketClientConfig, config);
    }

    protected registeredControllers: {[name: string]: {controllerInstance: any, sub: Subscription}} = {};

    public isConnected(): boolean {
        return this.connected;
    }

    public isLoggedIn(): boolean {
        return this.loggedIn;
    }

    public async registerController<T>(name: string, controllerInstance: T): Promise<Subscription> {
        if (this.registeredControllers[name]) {
            throw new Error(`Controller with name ${name} already registered.`);
        }

        const peerActionTypes: {
            [name: string]: {
                parameters: ServerMessageActionType[],
                returnType: ServerMessageActionType
            }
        } = {};

        return new Promise(async (resolve, reject) => {
            const activeSubject = await this.sendMessage<ServerMessagePeerChannelMessage>({
                name: 'peerController/register',
                controllerName: name,
            });

            activeSubject.subscribe(async (message) => {
                if (message.type === 'error') {
                    reject(new Error(message.error));
                }

                if (message.type === 'ack') {
                    const sub = new Subscription(() => {
                        activeSubject.sendMessage({
                            name: 'peerController/unregister',
                            controllerName: name,
                        }).firstOrUndefinedThenClose();
                    });

                    this.registeredControllers[name] = {controllerInstance, sub};

                    resolve(sub);
                }

                if (message.type === 'peerController/message') {
                    const data = message.data as {
                        name: 'actionTypes',
                        action: string,
                    } | {
                        name: 'action'
                        action: string,
                        args: any[],
                    };

                    const actions = getActions(controllerInstance.constructor as ClassType<T>);

                    if (!actions[data.action]) {
                        activeSubject.sendMessage({
                            name: 'peerController/message',
                            controllerName: name,
                            replyId: message.replyId,
                            data: {type: 'error', id: 0, error: `Action ${data.action} does not exist.`}
                        });
                        return;
                    }

                    if (data.name === 'actionTypes') {
                        peerActionTypes[data.action] = {
                            parameters: getActionParameters(controllerInstance.constructor as ClassType<T>, data.action),
                            returnType: getActionReturnType(controllerInstance.constructor as ClassType<T>, data.action),
                        };

                        const result: ServerMessageActionTypes = {
                            type: 'actionTypes/result',
                            id: 0, //will be overwritten
                            parameters: peerActionTypes[data.action].parameters,
                            returnType: peerActionTypes[data.action].returnType,
                        };

                        activeSubject.sendMessage({
                            name: 'peerController/message',
                            controllerName: name,
                            replyId: message.replyId,
                            data: result
                        });
                    }

                    if (data.name === 'action') {
                        try {
                            let actionResult: any = executeActionAndSerialize(peerActionTypes[data.action], controllerInstance, data.action, data.args);

                            if (actionResult && actionResult.then) {
                                actionResult = await actionResult;
                            }

                            if (actionResult instanceof Observable) {
                                activeSubject.sendMessage({
                                    name: 'peerController/message',
                                    controllerName: name,
                                    replyId: message.replyId,
                                    data: {type: 'error', id: 0, error: `Action ${data.action} returned Observable, which is not supported.`}
                                });
                                console.warn(`Action ${data.action} returned Observable, which is not supported.`);
                            }

                            activeSubject.sendMessage({
                                name: 'peerController/message',
                                controllerName: name,
                                replyId: message.replyId,
                                data: {type: 'next/json', id: message.id, next: actionResult}
                            });
                        } catch (error) {
                            console.warn('Error in peer controller', getClassName(controllerInstance.constructor), data.action, error);

                            activeSubject.sendMessage({
                                name: 'peerController/message',
                                controllerName: name,
                                replyId: message.replyId,
                                data: {type: 'error', id: 0, error: error instanceof Error ? error.message : error.toString()}
                            });
                        }
                    }
                }
            }, (error) => {
                console.warn('peer action error', name, error);
            });
        });
    }

    public peerController<T>(name: string, timeoutInSeconds = 60): RemoteController<T> {
        const t = this;

        const o = new Proxy(this, {
            get: (target, propertyName) => {
                return function () {
                    const actionName = String(propertyName);
                    const args = Array.prototype.slice.call(arguments);

                    return t.stream('_peer/' + name, actionName, args, {timeoutInSeconds: timeoutInSeconds});
                };
            }
        });

        return (o as any) as RemoteController<T>;
    }

    public controller<T>(name: string, timeoutInSeconds = 60): RemoteController<T> {
        const t = this;

        const o = new Proxy(this, {
            get: (target, propertyName) => {
                return function () {
                    const actionName = String(propertyName);
                    const args = Array.prototype.slice.call(arguments);

                    return t.stream(name, actionName, args, {timeoutInSeconds: timeoutInSeconds});
                };
            }
        });

        return (o as any) as RemoteController<T>;
    }

    protected onMessage(event: MessageEvent) {
        const message = JSON.parse(event.data.toString()) as ServerMessageAll;
        // console.log('onMessage', message);

        if (!message) {
            throw new Error(`Got invalid message: ` + event.data);
        }

        if (message.type === 'entity/remove' || message.type === 'entity/patch' || message.type === 'entity/update' || message.type === 'entity/removeMany') {
            this.entityState.handleEntityMessage(message);
            return;
        } else if (message.type === 'push-message') {
            //handle shizzle
        } else if (message.type === 'channel') {
            //not built in yet
        } else {
            if (this.replies[message.id]) {
                this.replies[message.id](message);
            }
        }
    }

    public async onConnected(): Promise<void> {

    }

    protected async doConnect(): Promise<void> {
        const port = this.config.port;

        this.connectionTries++;
        if (!this.config.host) {
            throw new Error('No host configured');
        }

        const url = this.config.host.startsWith('ws+unix') ?
            this.config.host :
            ((this.config.ssl ? 'wss://' : 'ws://') + this.config.host + ':' + port);

        this.socket = undefined;

        return new Promise<void>((resolve, reject) => {
            try {
                const socket = this.socket = new WebSocket(url);

                socket.onmessage = (event: MessageEvent) => {
                    this.onMessage(event);
                };

                socket.onclose = () => {
                    if (this.connected) {
                        this.connection.next(false);
                        this.onDisconnect();
                    }
                    this.connected = false;
                    this.loggedIn = false;

                    this.disconnected.next(this.currentConnectionId);
                    this.currentConnectionId++;
                };

                socket.onerror = (error: any) => {
                    if (this.connected) {
                        this.connection.next(false);
                        this.onDisconnect();
                    }
                    this.connected = false;
                    this.loggedIn = false;

                    this.disconnected.next(this.currentConnectionId);
                    this.currentConnectionId++;

                    reject(new Error(`Could not connect to ${this.config.host}:${port}. Reason: ${error}`));
                };

                socket.onopen = async () => {
                    //it's important to place it here, since authenticate() sends messages and checks this.connected.
                    this.connected = true;
                    this.connectionTries = 0;

                    if (this.config.token) {
                        if (!await this.authenticate()) {
                            this.connected = false;
                            this.connectionTries = 0;
                            socket.close();
                            reject(new AuthorizationError());
                            return;
                        }
                    }

                    this.connection.next(true);
                    await this.onConnected();

                    resolve();
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Simply connect with login using the token, without auto re-connect.
     */
    public async connect(): Promise<void> {
        while (this.connectionPromise) {
            await sleep(0.01);
            await this.connectionPromise;
        }

        if (this.connection.value) {
            return;
        }

        this.connectionPromise = this.doConnect();

        try {
            await this.connectionPromise;
        } finally {
            delete this.connectionPromise;
        }

        if (this.connection.value && this.currentConnectionId > 0) {
            this.reconnected.next(this.currentConnectionId);
        }
    }

    public async getActionTypes(controller: string, actionName: string, timeoutInSeconds = 60): Promise<ActionTypes> {
        if (!this.cachedActionsTypes[controller]) {
            this.cachedActionsTypes[controller] = {};
        }

        if (!this.cachedActionsTypes[controller][actionName]) {
            const reply = await this.sendMessage<ServerMessageActionTypes>({
                name: 'actionTypes',
                controller: controller,
                action: actionName,
                timeout: timeoutInSeconds,
            }, {timeout: timeoutInSeconds}).firstThenClose();

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

    public async stream(controller: string, name: string, args: any[], options?: {
        useThisCollection?: Collection<any>,
        timeoutInSeconds?: number,
        useThisStreamBehaviorSubject?: StreamBehaviorSubject<any>,
    }): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            try {
                //todo, handle reject when we sending message fails

                let returnValue: any;

                const timeoutInSeconds = options && options.timeoutInSeconds ? options.timeoutInSeconds : 60;

                const subscribers: { [subscriberId: number]: Subscriber<any> } = {};
                let subscriberIdCounter = 0;
                let streamBehaviorSubject: StreamBehaviorSubject<any> | undefined;

                const types = await this.getActionTypes(controller, name, timeoutInSeconds);

                for (const i of eachKey(args)) {
                    const type = types.parameters[i];

                    if (!type) continue;

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

                const activeSubject = this.sendMessage<ServerMessageResult>({
                    name: 'action',
                    controller: controller,
                    action: name,
                    args: args,
                    timeout: timeoutInSeconds
                }, {timeout: timeoutInSeconds});

                function deserializeResult(next: any): any {
                    if (types.returnType.type === 'Date') {
                        return new Date(next);
                    }

                    if (types.returnType.type === 'Entity') {
                        const classType = RegisteredEntities[types.returnType.entityName!];

                        if (!classType) {
                            reject(new Error(`Entity ${types.returnType.entityName} now known on client side.`));
                            activeSubject.close();
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

                activeSubject.subscribe((reply: ServerMessageResult) => {
                    if (reply.type === 'type') {
                        if (reply.returnType === 'subject') {
                            if (options && options.useThisStreamBehaviorSubject) {
                                streamBehaviorSubject = options.useThisStreamBehaviorSubject;
                                streamBehaviorSubject.next(reply.data);
                            } else {
                                streamBehaviorSubject = new StreamBehaviorSubject(reply.data);
                            }

                            const reconnectionSub = activeSubject.reconnected.subscribe(() => {
                                reconnectionSub.unsubscribe();
                                this.stream(controller, name, args, {useThisStreamBehaviorSubject: streamBehaviorSubject});
                            });

                            streamBehaviorSubject.addTearDown(async () => {
                                reconnectionSub.unsubscribe();
                                //user unsubscribed the entity subject, so we stop syncing changes
                                await activeSubject.sendMessage({
                                    name: 'subject/unsubscribe',
                                    forId: reply.id,
                                }).firstOrUndefinedThenClose();
                            });
                            resolve(streamBehaviorSubject);
                        }

                        if (reply.returnType === 'entity') {
                            if (reply.item) {
                                const classType = RegisteredEntities[reply.entityName || ''];

                                if (!classType) {
                                    throw new Error(`Entity ${reply.entityName} not known. (known: ${Object.keys(RegisteredEntities).join(',')})`);
                                }

                                const subject = this.entityState.handleEntity(classType, reply.item!);
                                subject.addTearDown(async () => {
                                    //user unsubscribed the entity subject, so we stop syncing changes
                                    await activeSubject.sendMessage({
                                        name: 'entity/unsubscribe',
                                        forId: reply.id,
                                    }).firstOrUndefinedThenClose();
                                });

                                resolve(subject);
                            } else {
                                resolve(new EntitySubject(undefined));
                            }
                        }

                        if (reply.returnType === 'observable') {
                            returnValue = new Observable((observer) => {
                                const subscriberId = ++subscriberIdCounter;

                                subscribers[subscriberId] = observer;

                                activeSubject.sendMessage({
                                    forId: reply.id,
                                    name: 'observable/subscribe',
                                    subscribeId: subscriberId
                                }).firstOrUndefinedThenClose();

                                return {
                                    unsubscribe(): void {
                                        activeSubject.sendMessage({
                                            forId: reply.id,
                                            name: 'observable/unsubscribe',
                                            subscribeId: subscriberId
                                        }).firstOrUndefinedThenClose();
                                    }
                                };
                            });
                            resolve(returnValue);
                        }

                        if (reply.returnType === 'collection') {
                            const classType = RegisteredEntities[reply.entityName];
                            if (!classType) {
                                throw new Error(`Entity ${reply.entityName} not known. (known: ${Object.keys(RegisteredEntities).join(',')})`);
                            }

                            const collection = new Collection<any>(classType);

                            if (reply.pagination.active) {
                                collection.pagination._activate();
                                collection.pagination.setItemsPerPage(reply.pagination.itemsPerPage);
                                collection.pagination.setTotal(reply.pagination.total);
                                collection.pagination.setPage(reply.pagination.page);
                                collection.pagination.setSort(reply.pagination.sort);
                                collection.pagination.setParameters(reply.pagination.parameters);

                                collection.pagination.event.subscribe((event: CollectionPaginationEvent) => {
                                    if (event.type === 'apply') {
                                        activeSubject.sendMessage({
                                            forId: reply.id,
                                            name: 'collection/pagination',
                                            sort: collection.pagination.getSort(),
                                            parameters: collection.pagination.getParameters(),
                                            page: collection.pagination.getPage(),
                                            itemsPerPage: collection.pagination.getItemsPerPage(),
                                        }).firstOrUndefinedThenClose();
                                    }
                                });
                            }

                            returnValue = collection;

                            collection.addTeardown(async () => {
                                await this.entityState.unsubscribeCollection(collection);

                                //collection unsubscribed, so we stop syncing changes
                                activeSubject.sendMessage({
                                    forId: reply.id,
                                    name: 'collection/unsubscribe'
                                }).firstOrUndefinedThenClose();
                            });
                            //do not resolve yet, since we want to wait until the collection has bee populated.
                        }
                    }

                    if (reply.type === 'next/json') {
                        resolve(deserializeResult(reply.next));
                        activeSubject.close();
                    }

                    if (reply.type === 'next/observable') {

                        if (subscribers[reply.subscribeId]) {
                            subscribers[reply.subscribeId].next(deserializeResult(reply.next));
                        }
                    }

                    if (reply.type === 'next/subject') {
                        if (streamBehaviorSubject) {
                            if (streamBehaviorSubject.isUnsubscribed()) {
                                throw new Error('Next StreamBehaviorSubject failed due to already unsubscribed.');
                            }
                            streamBehaviorSubject.next(deserializeResult(reply.next));
                        }
                    }

                    if (reply.type === 'append/subject') {
                        if (streamBehaviorSubject) {
                            if (streamBehaviorSubject.isUnsubscribed()) {
                                throw new Error('Next StreamBehaviorSubject failed due to already unsubscribed.');
                            }
                            const append = deserializeResult(reply.append);
                            streamBehaviorSubject.append(append);
                        }
                    }

                    if (reply.type === 'next/collection') {
                        this.entityState.handleCollectionNext(returnValue, reply.next);
                        resolve(returnValue);
                    }

                    if (reply.type === 'complete') {
                        if (returnValue instanceof Collection) {
                            returnValue.complete();
                        }

                        if (streamBehaviorSubject) {
                            streamBehaviorSubject.complete();
                        }

                        activeSubject.close();
                    }

                    if (reply.type === 'error') {
                        //todo, try to find a way to get correct Error instance as well.
                        const error = new Error(reply.error);

                        if (returnValue instanceof Collection) {
                            returnValue.error(error);
                        } else if (streamBehaviorSubject) {
                            streamBehaviorSubject.error(error);
                        } else {
                            reject(error);
                        }

                        activeSubject.close();
                    }

                    if (reply.type === 'error/observable') {
                        //todo, try to find a way to get correct Error instance as well.
                        const error = new Error(reply.error);
                        if (subscribers[reply.subscribeId]) {
                            subscribers[reply.subscribeId].error(error);
                        }

                        delete subscribers[reply.subscribeId];
                        activeSubject.close();
                    }

                    if (reply.type === 'complete/observable') {
                        if (subscribers[reply.subscribeId]) {
                            subscribers[reply.subscribeId].complete();
                        }

                        delete subscribers[reply.subscribeId];
                        activeSubject.close();
                    }
                }, (error) => {
                    reject(error);
                }, () => {

                });
            } catch (error) {
                reject(error);
            }
        });
    }

    public send(message: ClientMessageAll) {
        if (this.socket === undefined) {
            throw new Error('Socket not created yet');
        }

        this.socket.send(JSON.stringify(message));
    }

    public sendMessage<T = { type: '' }, K = T | ServerMessageComplete | ServerMessageError>(
        messageWithoutId: ClientMessageWithoutId,
        options?: {
            dontWaitForConnection?: boolean,
            connectionId?: number,
            timeout?: number
        }
    ): MessageSubject<K> {
        this.messageId++;
        const messageId = this.messageId;
        const dontWaitForConnection = !!(options && options.dontWaitForConnection);
        const timeout = options && options.timeout ? options.timeout : 30;
        const connectionId = options && options.connectionId ? options.connectionId : this.currentConnectionId;

        const message = {
            id: messageId, ...messageWithoutId
        };

        const reply = (message: ClientMessageWithoutId): MessageSubject<any> => {
            if (connectionId === this.currentConnectionId) {
                return this.sendMessage(message, {dontWaitForConnection, connectionId});
            }

            console.warn('Connection meanwhile dropped.', connectionId, this.currentConnectionId);
            const nextSubject = new MessageSubject(connectionId, reply);
            nextSubject.complete();
            nextSubject.unsubscribe();

            return nextSubject;
        };

        const subject = new MessageSubject<K>(connectionId, reply);

        setTimeout(() => {
            if (!subject.closed) {
                subject.error('Server timed out');
                subject.unsubscribe();
            }
        }, timeout * 1000);

        const sub = this.disconnected.subscribe((disconnectedConnectionId: number) => {
            if (disconnectedConnectionId === connectionId) {
                subject.complete();
                subject.unsubscribe();
            }
        });

        subject.subscribe({error: () => {}}).add(() => {
            delete this.replies[messageId];
            sub.unsubscribe();
        });

        this.replies[messageId] = (reply: K) => {
            if (!subject.closed) {
                subject.next(reply);
            }
        };

        if (dontWaitForConnection) {
            this.send(message);
        } else {
            this.connect().then(() => this.send(message), (error) => {
                subject.error(error);
                subject.unsubscribe();
            });
        }

        return subject;
    }

    private async authenticate(): Promise<boolean> {
        // console.log('authenticate send', this.config.token);

        const reply = await this.sendMessage<ServerMessageAuthorize>({
            name: 'authenticate',
            token: this.config.token,
        }, {dontWaitForConnection: true}).firstThenClose();

        // console.log('authenticate reply', reply);

        if (reply.type === 'authenticate/result') {
            this.loggedIn = reply.result;
        }

        if (reply.type === 'error') {
            throw new Error(reply.error);
        }

        return this.loggedIn;
    }

    protected onDisconnect() {
        for (const con of each(this.registeredControllers)) {
            con.sub.unsubscribe();
        }

        this.registeredControllers = {};
        this.cachedActionsTypes = {};
    }

    public disconnect() {
        this.connected = false;
        this.loggedIn = false;
        this.currentConnectionId++;

        this.disconnected.next(this.currentConnectionId);
        this.connection.next(false);

        this.onDisconnect();

        if (this.socket) {
            this.socket.close();
            delete this.socket;
        }
    }
}
