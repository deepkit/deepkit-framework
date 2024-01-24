import { Subscription } from 'rxjs';

import { isFunction } from '@deepkit/core';

export function trackByIndex(index: number) {
    return index;
}

export class Lifecycle {
    public callbackDestroyer: (() => any)[] = [];

    add(callback: Subscription | (() => any)) {
        if (isFunction(callback)) {
            this.callbackDestroyer.push(callback);
        } else {
            this.callbackDestroyer.push(() => callback.unsubscribe());
        }
    }

    destroy() {
        for (const i of this.callbackDestroyer) i();
        this.callbackDestroyer = [];
    }
}
