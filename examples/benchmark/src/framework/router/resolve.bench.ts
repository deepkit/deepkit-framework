/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { http, Router } from '@deepkit/http';
import { BenchSuite } from '../../bench.js';

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

    await bench.runAsync();
}
