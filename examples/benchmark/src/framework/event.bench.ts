/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BaseEvent, eventDispatcher, EventDispatcher, EventToken, InjectorContext } from '@deepkit/framework';
import { BenchSuite } from '../bench.js';

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
