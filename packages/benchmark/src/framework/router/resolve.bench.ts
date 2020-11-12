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
import 'reflect-metadata';
import {Router, http} from '@deepkit/framework';
import {BenchSuite} from '../../bench';

export async function main() {

    class Controller {
        @http.GET()
        helloWorld() {
        }

        @http.GET(':name')
        hello(name: string) {
        }

        @http.GET('/user/:id')
        userStatic(id: string) {
        }

        @http.GET('/user/:id/article/:id2')
        user2Static3(id: string, id2: string) {
        }
    }

    const router = Router.forControllers([Controller]);

    const bench = new BenchSuite('router-resolve');

    bench.addAsync('root', async () => {
        await router.resolve('GET', '/');
    });

    bench.addAsync('static', async () => {
        await router.resolve('GET', '/peter');
    });

    bench.addAsync('one_parameter', async () => {
        await router.resolve('GET', '/user/21313');
    });

    bench.addAsync('two_parameter', async () => {
        await router.resolve('GET', '/user/21313/article/2');
    });

    bench.addAsync('not_found', async () => {
        await router.resolve('GET', '/not-available');
    });

    bench.run();
}
