import { ExperimentalPendingTasks, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

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
    const taskService = inject(ExperimentalPendingTasks);
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
