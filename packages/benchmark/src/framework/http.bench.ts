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

import {EventDispatcher, http, HttpControllers, HttpKernel, HttpListener, InjectorContext, Logger, Router} from '@deepkit/framework';
import {BenchSuite} from '../bench';
import {IncomingMessage, ServerResponse} from 'http';
import {Socket} from 'net';

export async function main() {
    const bench = new BenchSuite('http');
    let called = 0;

    class Controller {
        @http.GET()
        get() {
            called++;
            return 'hi';
        }
    }
    const logger = new Logger();

    const router = new Router(new HttpControllers([Controller]), logger);

    const context = InjectorContext.forProviders([
        {provide: Controller, scope: 'http'},
        HttpListener,
        {provide: Router, useValue: router},
        {provide: Logger, useValue: logger},
    ]);
    const dispatcher = new EventDispatcher(context);
    dispatcher.registerListener(HttpListener);
    const httpKernel = new HttpKernel(router, dispatcher, context, logger);

    const request = new (class extends IncomingMessage {
        url = '/';
        method = 'GET';
    })(new Socket());

    bench.addAsync('http', (): Promise<any> => {
        const res = new ServerResponse(request);
        return httpKernel.handleRequest(request, res);
    });

    await bench.runAsync();
    console.log('called', called);
}
