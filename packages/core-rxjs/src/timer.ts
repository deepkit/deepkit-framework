/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Observer } from 'rxjs';

import { Timer } from '@deepkit/core';

import { watchClosed } from './utils.js';

/**
 * Allows to create Timer which is deactivated automatically
 * when the observer is stopped.
 */
export class ObserverTimer extends Timer {
    protected state = watchClosed(this.observer);

    constructor(protected observer: Observer<any>) {
        super();
    }

    setTimeout(cb: () => void, timeout: number): any {
        super.setTimeout(() => {
            if (!this.state.closed) {
                cb();
            }
        }, timeout);
    }
}
