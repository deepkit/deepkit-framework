/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { performance } from 'perf_hooks';

export class Stopwatch {
    public times: { [name: string]: { stack: number[], time: number } } = {};

    public start(name: string) {
        if (this.times[name]) {
            this.times[name].stack.push(performance.now());
        }
        this.times[name] = { stack: [performance.now()], time: 0 };
    }

    public end(name: string) {
        if (!this.times[name]) throw new Error(`Stopwatch item ${name} not started`);

        const last = this.times[name].stack.pop();
        if (last === undefined) return;
        const diff = performance.now() - last;
        this.times[name].time += diff;
    }

    getTimes(): { [name: string]: number } {
        const result: { [name: string]: number } = {};
        for (const [name, time] of Object.entries(this.times)) {
            result[name] = time.time;
        }

        return result;
    }
}
