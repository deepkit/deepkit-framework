import {BenchSuite} from '@super-hornet/core';
import {Router, http} from '@super-hornet/framework';

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

    bench.add('root', () => {
        router.resolve('GET', '/');
    });

    bench.add('static', () => {
        router.resolve('GET', '/peter');
    });

    bench.add('one_parameter', () => {
        router.resolve('GET', '/user/21313');
    });

    bench.add('two_parameter', () => {
        router.resolve('GET', '/user/21313/article/2');
    });

    bench.add('not_found', () => {
        router.resolve('GET', '/not-available');
    });

    bench.run();
}