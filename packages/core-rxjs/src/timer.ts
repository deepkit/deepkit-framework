import {Timer} from '@super-hornet/core';
import {Observer} from 'rxjs';

/**
 * Allows to create Timer which get deactivated automatically
 * when the observer is stopped.
 */
export class ObserverTimer extends Timer {
    constructor(protected observer: Observer<any>) {
        super();
    }

    setTimeout(cb: () => void, timeout: number): any {
        super.setTimeout(() => {
            if (!this.observer.closed) {
                cb();
            }
        }, timeout);
    }
}
