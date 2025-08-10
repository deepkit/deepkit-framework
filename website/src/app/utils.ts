import { DestroyRef, inject, PendingTasks, PLATFORM_ID, signal, Signal, WritableSignal } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { injectLocalStorage, LocalStorageOptionsWithDefaultValue } from 'ngxtension/inject-local-storage';

export class PlatformHelper {
    platformId = inject(PLATFORM_ID);

    isBrowser() {
        return isPlatformBrowser(this.platformId);
    }

    isServer() {
        return isPlatformServer(this.platformId);
    }
}

// given a class instance, extract all method names
type ExtractMethodsNames<T> = {
    [K in keyof T]: K
}[keyof T];

/**
 * Wait for a component to finish initializing and blocks stabilization until done.
 * This is required for SSR to work correctly.
 *
 * @example
 * ```typescript
 * import { waitForInit } from './utils';
 *
 * @Component({
 * })
 * class MyComponent implements OnInit {
 *    constructor() {
 *      waitForInit(this);
 *    }
 *
 *    // whatever is done in ngOnInit will be waited for
 *    async ngOnInit() {
 *    }
 * }
 *```
 */
export function waitForInit<T>(component: T, ref?: ExtractMethodsNames<T>) {
    const fn = ref || 'ngOnInit';
    const taskService = inject(PendingTasks);
    const done = taskService.add();
    const ori = (component as any)[fn] as Function;

    (component as any)[fn] = async function(...args: any[]) {
        try {
            if (ori) await ori.apply(this, args);
        } finally {
            done();
            // (component as any)[fn] = ori;
        }
    };
}

export function injectLocalStorageNumber(key: string, options?: Partial<LocalStorageOptionsWithDefaultValue<number>>): WritableSignal<number> {
    return injectLocalStorage(key, {
        defaultValue: 1,
        parse: (value) => Number(value),
        ...options,
    }) as WritableSignal<number>;
}

export function injectLocalStorageString(key: string, options?: Partial<LocalStorageOptionsWithDefaultValue<string>>): WritableSignal<string> {
    return injectLocalStorage(key, {
        defaultValue: '',
        ...options,
    }) as WritableSignal<string>;
}

/**
 * A signal that tracks the media query for e.g. device size.
 *
 * ```typescript
 * class Component {
 *    breakpoint = mediaWatch('(max-width: 600px)');
 * }
 * ```
 */
export function mediaWatch(expr: string): Signal<boolean> {
    const platform = inject(PlatformHelper);
    if (platform.isServer()) {
        return signal(false);
    }
    const destroy = inject(DestroyRef);

    const mediaQuery = window.matchMedia(expr);
    const result = signal(mediaQuery.matches);

    function fn(e: MediaQueryListEventMap['change']) {
        result.set(e.matches);
    }

    mediaQuery.addEventListener('change', fn);
    destroy.onDestroy(() => {
        mediaQuery.removeEventListener('change', fn);
    });

    return result;
}
