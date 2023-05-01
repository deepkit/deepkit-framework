/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { AfterViewInit, ApplicationRef, inject, NgModule, OnDestroy, Type, ɵComponentDef as ComponentDef, ɵNG_COMP_DEF as NG_COMP_DEF } from '@angular/core';
import { getClassName, throttleTime } from '@deepkit/core';
import { EventDispatcher, EventDispatcherUnsubscribe, EventOfEventToken, EventToken } from '@deepkit/event';
import { Subscription } from 'rxjs';

export function observeAction() {
    return function (target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>): TypedPropertyDescriptor<any> | void {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            const result = originalMethod.apply(this, args);

            if (result && result.then) {
                result.then(() => {
                    ReactiveChangeDetectionModule.tick();
                }, () => {
                    ReactiveChangeDetectionModule.tick();
                });
            } else {
                ReactiveChangeDetectionModule.tick();
            }

            return result;
        };

        return descriptor;
    };
}

const lazyValuesStore = new WeakMap<any, object>();
const lazyValuesSubscriptions = new WeakMap<any, object>();
const lazyValuesDestroyed = new WeakMap<any, object>();

function lazyInitialize(target: any, map: WeakMap<any, object> = lazyValuesStore): any {
    let object = map.get(target);
    if (object) return object;
    object = {};
    map.set(target, object);
    return object;
}

function getRealMethodHookName(value: string): string {
    return 'ng' + value.substr(0, 1).toUpperCase() + value.substr(1);
}

function addComponentHook<T>(target: T, hookName: 'onDestroy' | 'onChanges' | 'onInit' | 'afterViewInit', fn: (this: T) => void) {
    const cdef: ComponentDef<any> = ((target as any).constructor as any)[NG_COMP_DEF];
    if (cdef) {
        //prod build
        const ori = (cdef as any)[hookName];
        ((cdef as any)['onDestroy'] as any) = function (this: any, ...args: any[]) {
            fn.call(this);
            ori && (ori as any).apply(this, args);
        };
    } else {
        const ori = (target as any).constructor.prototype[getRealMethodHookName(hookName)];
        (target as any).constructor.prototype[getRealMethodHookName(hookName)] = function (this: any, ...args: any[]) {
            fn.call(this);
            ori && (ori as any).apply(this, args);
        };
    }
}

/**
 * Automatically unsubscribe the value (calling unsubscribe() on the current value)
 * when ngOnDestroy is called or a new value has been set.
 * When the component is already destroyed, newly set values will be unscubribed immediately.
 * This makes sure when a component is destroyed too fast before a async operation is completed
 * that the result is unsubscribed, otherwise it would be a memory leak.
 */
export function unsubscribe<T extends OnDestroy>() {
    return function (target: T, propertyKey: string | symbol) {

        function unsub(value: any) {
            if (value && value.unsubscribe) {
                try {
                    value.unsubscribe();
                } catch (error) {
                    console.log('Subscription was already unsubscribed.', getClassName(target), propertyKey);
                }
            }
        }

        Object.defineProperty(target, propertyKey, {
            enumerable: true,
            configurable: false, //even with true the prop cant be deleted using `delete this.name`
            get() {
                const store = lazyInitialize(this);
                return store[propertyKey];
            },

            set(value) {
                const destroyed = lazyInitialize(this, lazyValuesDestroyed);
                const store = lazyInitialize(this);
                unsub(store[propertyKey]);
                if (destroyed['destroyed']) {
                    unsub(value);
                }
                store[propertyKey] = value;
            }
        });

        addComponentHook(target, 'onDestroy', function () {
            const destroyed = lazyInitialize(this, lazyValuesDestroyed);
            destroyed['destroyed'] = true;
            const store = lazyInitialize(this);
            if (store[propertyKey]) {
                unsub(store[propertyKey]);
            }
        });
    };
}

export interface EventHandler<T extends EventToken> {
    dispatch(event?: EventOfEventToken<T>): Promise<any>;

    listen(listener: (event: T['event']) => any | Promise<any>, order?: number): EventDispatcherUnsubscribe;
}

/**
 * Creates a new function that calls the given event dispatcher with the given arguments.
 *
 * It's important to call this function either in constructor or as property initializer (as it uses Angular's fetch()).
 *
 * @example
 * ```typescript
 * const userAdded = new EventToken<User>('user.added');
 *
 * class MyComponent {
 *     userAdded = eventHandler(userAdded);
 *
 *     async save() {
 *         const user = new User;
 *         await this.api.saveUser(user);
 *         this.userAdded.dispatch(user);
 *     }
 * }
 */
export function eventHandler<T extends EventToken, C>(eventToken: T, component: C): EventHandler<T> {
    const eventDispatcher = inject(EventDispatcher);

    const listeners: EventDispatcherUnsubscribe[] = [];
    addComponentHook((component as any).constructor, 'onDestroy', function () {
        for (const listener of listeners) listener();
    });

    return {
        dispatch(event?: EventOfEventToken<T>): Promise<any> {
            return eventDispatcher.dispatch(eventToken, event);
        },
        listen(listener: (event: T['event']) => any | Promise<any>, order: number = 0): EventDispatcherUnsubscribe {
            const unsub = eventDispatcher.listen(eventToken, listener);
            listeners.push(unsub);
            return unsub;
        }
    };
}

/**
 * Listens on the given event token and calls the method when the event is triggered.
 *
 * @example
 * ```typescript
 *
 * const MyEvent = new EventToken('my-event');
 *
 * @Component({
 *     //..
 * });
 * class MyComponent {
 *     @EventListener(MyEvent)
 *     onMyEvent(event: MyEvent) {
 *         console.log('event triggered', event);
 *     }
 * }
 * ```
 */
export function EventListener(eventToken: EventToken) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalConstructor = target.constructor;

        const newConstructor: any = function (...args: any[]) {
            const instance = new originalConstructor(...args);
            const store = lazyInitialize(instance);
            const eventDispatcher = inject(EventDispatcher);
            console.log('listen', eventToken, propertyKey);
            store['Ωlistener_' + propertyKey] = eventDispatcher.listen(eventToken, (event) => {
                instance[propertyKey](event);
            });
            return instance;
        };
        newConstructor.prototype = originalConstructor.prototype;
        target.constructor = newConstructor;
        addComponentHook(newConstructor, 'onDestroy', function () {
            const store = lazyInitialize(this);
            const unsubscribe = store['Ωlistener_' + propertyKey];
            if (unsubscribe) unsubscribe();
        });
    };
}

/**
 * Important for components that use material design, which need Tick in AfterViewInit.
 */
export function reactiveComponent<T extends AfterViewInit>() {
    return function (target: Type<T>) {
        addComponentHook(target.prototype, 'afterViewInit', function () {
            ReactiveChangeDetectionModule.tick();
        });
    };
}

/**
 * Automatically subscribes on the value (when set) to trigger application ticks automatically.
 * When value is changed, the old subscription is cancelled and a new on the new value is created.
 *
 * Optionally @observe({unsubscribe: true}) unsubscribes the whole value as well (calling unsubscribe() on current value) on NgOnDestroy or when net property value is set.
 */
export function observe<T extends OnDestroy>(options: { unsubscribe?: true } = {}) {
    return function (target: T, propertyKey: string | symbol) {

        function unsub(value: any) {
            if (value && value.unsubscribe) {
                try {
                    value.unsubscribe();
                } catch (error) {
                    console.log('Subscription was already unsubscribed.', getClassName(target), propertyKey);
                }
            }
        }

        Object.defineProperty(target, propertyKey, {
            enumerable: true,
            configurable: false, //even with true the prop cant be deleted using `delete this.name`
            get() {
                const store = lazyInitialize(this);
                return store[propertyKey];
            },

            set(value) {
                const destroyed = lazyInitialize(this, lazyValuesDestroyed);
                const store = lazyInitialize(this);
                const subscriptions = lazyInitialize(this, lazyValuesSubscriptions);

                if (subscriptions[propertyKey]) {
                    unsub(subscriptions[propertyKey] as Subscription);
                    delete subscriptions[propertyKey];
                }

                if (options.unsubscribe && store[propertyKey] && store[propertyKey].unsubscribe) {
                    unsub(store[propertyKey]);
                }

                if (!destroyed['destroyed'] && value && value.subscribe) {
                    subscriptions[propertyKey] = value.subscribe(() => {
                        ReactiveChangeDetectionModule.tick();
                    });
                }
                if (destroyed['destroyed'] && options.unsubscribe) {
                    unsub(value);
                }

                ReactiveChangeDetectionModule.tick();

                store[propertyKey] = value;
            }
        });

        addComponentHook(target, 'onDestroy', function () {
            const destroyed = lazyInitialize(this, lazyValuesDestroyed);
            destroyed['destroyed'] = true;
            const store = lazyInitialize(this);
            const subscriptions = lazyInitialize(this, lazyValuesSubscriptions);

            if (subscriptions[propertyKey]) {
                unsub(subscriptions[propertyKey]);
                delete subscriptions[propertyKey];
            }

            if (options.unsubscribe) {
                unsub(store[propertyKey]);
            }
        });
    };
}

@NgModule({})
export class ReactiveChangeDetectionModule {
    private static a: ApplicationRef;
    // private static lastAnimationFrame?: number;
    private static throttled: Function;

    constructor(a: ApplicationRef) {
        ReactiveChangeDetectionModule.a = a;

        ReactiveChangeDetectionModule.throttled = throttleTime(() => {
            ReactiveChangeDetectionModule.a.tick();
        }, 1000 / 25);
    }

    public static tick() {
        requestAnimationFrame(() => {
            ReactiveChangeDetectionModule.throttled();
        });
    }
}
