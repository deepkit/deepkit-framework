/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { OnDestroy, ɵComponentDef as ComponentDef, ɵNG_COMP_DEF as NG_COMP_DEF } from '@angular/core';
import { getClassName } from '@deepkit/core';

const lazyValuesStore = new WeakMap<any, object>();
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
