/*
 * Copyright (c) Marc J. Schmidt <marc@marcjschmidt.de>
 * This file is part of Deepkit and licensed under GNU GPL v3. See the LICENSE file for more information.
 */

import {AfterViewInit, ApplicationRef, NgModule, OnDestroy, Type} from "@angular/core";
import {ɵComponentDef as ComponentDef, ɵNG_COMP_DEF as NG_COMP_DEF, SimpleChanges} from '@angular/core';
import {Subscription} from "rxjs";
import {throttleTime, getClassName} from "@deepkit/core";

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
