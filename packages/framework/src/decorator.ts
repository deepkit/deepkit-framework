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

import {ClassType, isClass} from '@deepkit/core';
import {InjectToken} from './injector/injector';
import {ProviderWithScope} from './service-container';
import {ClassDecoratorResult, createClassDecoratorContext, createPropertyDecoratorContext, mergeDecorator, PropertyDecoratorResult} from '@deepkit/type';
import {join} from 'path';

export type EventListenerCallback<T> = (event: T) => void | Promise<void>;

export interface EventListener<T> {
    eventToken: EventToken<any>;
    callback: EventListenerCallback<T>;
    priority: number;
}

export type EventOfEventToken<T> = T extends EventToken<infer E> ? E : unknown;

export class EventToken<T extends BaseEvent> {
    constructor(
        public readonly id: string,
    ) {
    }

    listen(callback: (event: T) => void, priority: number = 0): EventListener<T> {
        return {eventToken: this, callback, priority};
    }
}

export class BaseEvent {
    protected stopped = false;

    stopPropagation() {
        this.stopped = true;
    }

    isStopped() {
        return this.stopped;
    }
}

class EventStore {
    token?: EventToken<any>;
    priority: number = 0;
}

class EventClassStore {
    listeners: { eventToken: EventToken<any>, methodName: string, priority: number }[] = [];
}

export const eventClass = createClassDecoratorContext(
    class {
        t = new EventClassStore;

        addListener(eventToken: EventToken<any>, methodName: string, priority: number) {
            this.t.listeners.push({eventToken, methodName, priority});
        }
    }
);
export const eventDispatcher = createPropertyDecoratorContext(
    class {
        t = new EventStore;

        onDecorator(target: object, property?: string) {
            if (!this.t.token) throw new Error('@eventDispatcher.listen(eventToken) is the correct syntax.');
            if (!property) throw new Error('@eventDispatcher.listen(eventToken) works only on class properties.');

            eventClass.addListener(this.t.token, property, this.t.priority)(target);
        }

        listen(eventToken: EventToken<any>, priority: number = 0) {
            if (!eventToken) new Error('@eventDispatcher.listen() No event token given');
            this.t.token = eventToken;
            this.t.priority = priority;
        }
    }
);

export interface ModuleOptions {
    /**
     * Providers.
     */
    providers?: ProviderWithScope[];

    /**
     * Export providers (its token `provide` value) or modules you imported first.
     */
    exports?: (ClassType | InjectToken | string | DynamicModule)[];

    /**
     * RPC controllers.
     */
    controllers?: ClassType[];

    /**
     * Event listeners.
     *
     * @example with simple functions
     * ```typescript
     * {
     *     listeners: [
     *         onEvent.listen((event: MyEvent) => {console.log('event triggered', event);}),
     *     ]
     * }
     * ```
     *
     * @example with services
     * ```typescript
     *
     * class MyListener {
     *     @event.listen(onEvent)
     *     onEvent(event: typeof onEvent['type']) {
     *         console.log('event triggered', event);
     *     }
     * }
     *
     * {
     *     listeners: [
     *         MyListener,
     *     ]
     * }
     * ```
     */
    listeners?: (EventListener<any> | ClassType)[];

    /**
     * Import another module.
     */
    imports?: (ClassType | DynamicModule)[];
}

export interface DynamicModule extends ModuleOptions {
    /**
     * Imports this module as if the root AppModule has imported it
     */
    root?: boolean;

    module: ClassType;
}

export function isDynamicModuleObject(obj: any): obj is DynamicModule {
    return obj.module;
}

export function isModuleToken(obj: any): obj is (ClassType | DynamicModule) {
    return (isClass(obj) && undefined !== deepkit._fetch(obj)) || isDynamicModuleObject(obj);
}

export interface DeepkitModule {
    /**
     * Called when the application bootstraps (for cli commands, rpc/http server, tests, ...)
     *
     * Use onBootstrapServer when you want to execute code only when the rpc/http server starts.
     */
    onBootstrap?: () => void;

    /**
     * Called when the application http server bootstraps.
     * The applications waits for the promise to resolve before bootstrapping completely.
     *
     * Note this is called once per machine.
     *
     * If you want to bootstrap something only once for your entire distributed
     * stack, consider using AppLock.
     */
    onBootstrapServer?: () => Promise<void> | void;

    /**
     * When the applications is shut down. Clean up open resources to not leak memory in unit tests.
     * The applications waits for the promise to resolve before shutting down completely.
     */
    onShutDown?: () => Promise<void> | void;
}

export interface ControllerOptions {
    name: string;
}

class Hornet {
    config?: ModuleOptions;
}

export const deepkit = createClassDecoratorContext(
    class {
        t = new Hornet;

        module(config: ModuleOptions) {
            this.t.config = config;
        }
    }
);

class HttpController {
    baseUrl: string = '';
    actions: HttpAction[] = [];

    getUrl(action: HttpAction): string {
        return join('/', this.baseUrl, action.path);
    }
}

class HttpAction {
    name: string = '';
    path: string = '';
    httpMethod: string = 'GET';
    methodName: string = '';

    parameterRegularExpressions: { [name: string]: any } = {};

    throws: { errorType: ClassType, message?: string }[] = [];
}

class HttpDecorator {
    t = new HttpController;

    controller(baseUrl: string = '') {
        this.t.baseUrl = baseUrl;
    }

    addAction(action: HttpAction) {
        this.t.actions.push(action);
    }
}

export const httpClass: ClassDecoratorResult<typeof HttpDecorator> = createClassDecoratorContext(HttpDecorator);

class HttpActionDecorator {
    t = new HttpAction;

    onDecorator(target: object, property?: string) {
        this.t.methodName = property || '';
        httpClass.addAction(this.t)(target);
    }

    name(name: string) {
        this.t.name = name;
    }

    GET(path: string = '') {
        this.t.httpMethod = 'GET';
        this.t.path = path;
    }

    POST(path: string = '') {
        this.t.httpMethod = 'POST';
        this.t.path = path;
    }

    PUT(path: string = '') {
        this.t.httpMethod = 'PUT';
        this.t.path = path;
    }

    DELETE(path: string = '') {
        this.t.httpMethod = 'DELETE';
        this.t.path = path;
    }

    ANY(path: string = '') {
        this.t.httpMethod = 'ANY';
        this.t.path = path;
    }

    throws(errorType: ClassType, message?: string) {
        this.t.throws.push({errorType, message});
    }

    regexp(parameterName: string, regex: any) {
        this.t.parameterRegularExpressions[parameterName] = regex;
    }
}

export const httpAction: PropertyDecoratorResult<typeof HttpActionDecorator> = createPropertyDecoratorContext(HttpActionDecorator);

export const http = mergeDecorator(httpClass, httpAction);
