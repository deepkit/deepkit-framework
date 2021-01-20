/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { getClassName } from './core';
import { toFastProperties } from './perf';

/**
 * Logs every call to this method on stdout.
 *
 * @public
 */
export function log() {
    return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        const orig = descriptor.value;
        descriptor.value = function (...args: any[]) {
            const a = args.map(v => typeof v).join(',');
            console.info(getClassName(target) + '::' + String(propertyKey) + '(' + a + ')');
            return orig.apply(this, args);
        };

        return descriptor;
    };
}

/**
 * Makes sure that calls to this async method are stacked up and are called one after another and not parallel.
 *
 * @public
 */
export function stack() {
    return function (target: object, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>) {
        const orig = descriptor.value;

        // console.log('sync patch', propertyKey, constructor.prototype[propertyKey]);
        descriptor.value = async function (...args: any[]) {
            const name = '__c_' + propertyKey;

            if ((this as any)[name] === undefined) {
                (this as any)[name] = null;
                toFastProperties(this);
            }

            while ((this as any)[name]) {
                await (this as any)[name];
            }

            (this as any)[name] = (orig as any).apply(this, args);

            try {
                return await (this as any)[name];
            } finally {
                (this as any)[name] = null;
            }
        };
    };
}

/**
 * Makes sure that this async method is only running once at a time. When this method is running and it is tried
 * to call it another times, that call is "dropped" and it returns simply the result of the previous running call (waiting for it to complete first).
 *
 * @public
 */
export function singleStack() {
    return function (target: object, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>) {
        const orig = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const name = '__sc_' + propertyKey;

            if ((this as any)[name] === undefined) {
                (this as any)[name] = null;
                toFastProperties(this);
            }

            if ((this as any)[name]) {
                return await (this as any)[name];
            }

            (this as any)[name] = (orig as any).apply(this, args);

            try {
                return await (this as any)[name];
            } finally {
                (this as any)[name] = null;
            }
        };
    };
}
