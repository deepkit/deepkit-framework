import { inject, Injectable, PendingTasks } from '@angular/core';


@Injectable({ providedIn: 'root' })
export class BetterPendingTasks {
    constructor(private pendingTasks: PendingTasks) {
    }

    async run<T>(task: () => Promise<T>): Promise<T> {
        const done = this.pendingTasks.add();
        try {
            return await task();
        } finally {
            done();
        }
    }

    callback<T>(task: () => Promise<T>): () => Promise<T> {
        return async () => {
            const done = this.pendingTasks.add();
            try {
                return await task();
            } finally {
                done();
            }
        };
    }

    patchPrototype<T>(prototype: T, methods: (keyof T)[]) {
        for (const method of methods) {
            const original = prototype[method];
            if (typeof original !== 'function') continue;

            (prototype as any)[method] = (...args: any[]) => {
                return this.run(() => original.apply(prototype, args));
            };
        }
    }
}

export function injectPatchedPendingTasks<T>(prototype: T, methods: (keyof T)[]) {
    const pendingTasks = inject(BetterPendingTasks);
    pendingTasks.patchPrototype(prototype, methods);
}

/**
 * Signals Angular that SSR should wait for this task to complete before rendering.
 */
export function pendingTask<T>(task: () => Promise<T>): () => Promise<T> {
    const pendingTasks = inject(BetterPendingTasks);
    return pendingTasks.callback(task);
}
