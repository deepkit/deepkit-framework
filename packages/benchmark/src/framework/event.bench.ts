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

import { BaseEvent, eventDispatcher, EventDispatcher, EventToken, InjectorContext } from '@deepkit/framework';
import { BenchSuite } from '../bench';

export async function main() {
    const bench = new BenchSuite('event');

    const eventToken = new EventToken('test', BaseEvent);
    let called = 0;
    class Listener {
        @eventDispatcher.listen(eventToken)
        listen() {
            called++;
        }
    }

    const dispatcher = new EventDispatcher(InjectorContext.forProviders([Listener]));
    dispatcher.registerCallback(eventToken, () => {
        const a = 'd';
    });

    dispatcher.registerListener(Listener);

    function test() {
        return Promise.resolve(21);
    }

    bench.addAsync('base', (): Promise<any> => {
        return test();
    });

    bench.addAsync('dispatch', (): Promise<any> => {
        return dispatcher.dispatch(eventToken, new BaseEvent);
    });

    await bench.runAsync();

    console.log('called', called);
}
