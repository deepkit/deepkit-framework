/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */


export const nextTick = typeof requestAnimationFrame !== 'undefined'
    ? (cb: () => void) => requestAnimationFrame(cb) : (cb: () => void) => setTimeout(cb);

export const clearTick = typeof requestAnimationFrame !== 'undefined'
    ? (id: any) => cancelAnimationFrame(id) : (id: any) => clearTick(id);

/**
 * Wraps a function and calls it only `cps` times per frame.
 *
 * This is handy to throttle all kind of rapid calls, like mouse move events or other kind of events.
 *
 * @example
 * ```typescript
 * function expensiveFunction() {
 *     //...
 * }
 *
 * const throttled = throttleTime(expensiveFunction, 5); //5 calls per second max
 *
 * throttled();
 * throttled();
 * throttled();
 * //throttled will here only be called once
 * ```
 */
export function throttleTime(call: Function, cps = 5): (...args: any[]) => void {
    let last = Date.now();
    let dirty = false;
    let lastArgs: any[][] = [];
    let execution = false;

    function tick() {
        const now = Date.now();

        if (!execution && now - last > 1000 / cps) {
            execution = true;
            call(...lastArgs);
            dirty = false;
            last = Date.now();
            execution = false;
        }

        if (dirty) {
            nextTick(tick);
        }
    }

    return (...args) => {
        dirty = true;
        lastArgs = args;
        tick();
    };
}

/**
 * This functions returns a stack that is filled as long as the gate is not activated.
 * Once activated all recorded calls go to given callback and subsequent calls go directly to given callback.
 */
export function bufferedGate<T>(callback: (arg: T) => any) {
    const q: T[] = [];
    let activated = false;

    const throttled = throttleTime(async () => {
        if (q.length === 0) return;

        for (const t of q) {
            const result = callback(t);
            if (result instanceof Promise) {
                await result;
            }
        }
        //empty the queue
        q.splice(0, q.length);
    });

    return {
        activate: () => {
            activated = true;
            throttled();
        },
        call: (i: T) => {
            q.push(i);

            if (activated) {
                throttled();
            }
        }
    };
}
