/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
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
