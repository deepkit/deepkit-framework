/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Timer } from '@deepkit/core';
import { Observer } from 'rxjs';

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
