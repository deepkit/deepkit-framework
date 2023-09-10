/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

export class Timer {
    protected timeoutTimers: any[] = []; //any necessary to be compatible with NodeJS/Browser env

    public setTimeout(cb: () => void, timeout: number): any {
        const timer = setTimeout(cb, timeout);
        this.timeoutTimers.push(timer);
        return timer;
    }

    /**
     * Clears all timers at once.
     */
    public clear() {
        for (const timeout of this.timeoutTimers) {
            clearTimeout(timeout);
        }
    }
}
