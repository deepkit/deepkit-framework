import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { http } from '../src/decorator';
import { createHttpKernel } from './utils';
import { httpMiddleware } from '../src/middleware';
import { HttpRequest, HttpResponse } from '../src/model';
import { AppModule } from '@deepkit/app';

class Controller {
    @http.GET('user/:name')
    hello(name: string) {
        return name;
    }
}

test('middleware empty', async () => {
    const httpKernel = createHttpKernel([Controller], [], [], [httpMiddleware.for((req, res, next) => {
        next();
    })]);

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);
    expect(response.bodyString).toEqual('"name1"');
    expect(response.getHeader('content-type')).toEqual('application/json; charset=utf-8');
});

test('middleware direct response', async () => {
    const httpKernel = createHttpKernel([Controller], [], [], [httpMiddleware.for((req, res, next) => {
        res.end('nope');
    })]);

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);
    expect(response.bodyString).toEqual('nope');
});

test('middleware for controller', async () => {
    class MyController {
        @http.GET('/another/:name')
        hello(name: string) {
            return name;
        }
    }

    const httpKernel = createHttpKernel([Controller, MyController], [], [], [httpMiddleware.for((req, res, next) => {
        res.setHeader('middleware', '1');
        next();
    }).forControllers(MyController)]);

    {
        const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware')).toEqual(undefined);
    }
    {
        const response = await httpKernel.request(HttpRequest.GET('/another/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware')).toEqual('1');
    }
});

test('middleware excludeControllers', async () => {
    class MyController {
        @http.GET('/another/:name')
        hello(name: string) {
            return name;
        }
    }

    const httpKernel = createHttpKernel([Controller, MyController], [], [], [httpMiddleware.for((req, res, next) => {
        res.setHeader('middleware', '1');
        next();
    }).excludeControllers(Controller)]);

    {
        const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware')).toEqual(undefined);
    }
    {
        const response = await httpKernel.request(HttpRequest.GET('/another/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware')).toEqual('1');
    }
});

test('middleware for names', async () => {
    class MyController {
        @http.GET('/another/:name').name('another')
        hello(name: string) {
            return name;
        }

        @http.GET('/api/user/:name').name('api_user')
        apiUser(name: string) {
            return name;
        }

        @http.GET('/api/group/:name').name('api_group')
        apiGroup(name: string) {
            return name;
        }
    }

    const httpKernel = createHttpKernel([MyController], [], [], [httpMiddleware.for((req, res, next) => {
        res.setHeader('middleware', '1');
        next();
    }).forRouteNames('api_*').excludeRouteNames('api_group')]);

    {
        const response = await httpKernel.request(HttpRequest.GET('/api/user/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware')).toEqual('1');
    }
    {
        const response = await httpKernel.request(HttpRequest.GET('/api/group/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware')).toEqual(undefined);
    }
    {
        const response = await httpKernel.request(HttpRequest.GET('/another/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware')).toEqual(undefined);
    }
});

test('middleware for routes', async () => {
    class MyController {
        @http.GET('/another/:name').group('another')
        hello(name: string) {
            return name;
        }

        @http.GET('/api/user/:name').group('api')
        apiUser(name: string) {
            return name;
        }

        @http.GET('/api/group/:name').group('api')
        apiGroup(name: string) {
            return name;
        }
    }

    const httpKernel = createHttpKernel([MyController], [], [], [
        httpMiddleware.for((req, res, next) => {
            res.setHeader('middleware_get', '1');
            next();
        }).forRoutes({ httpMethod: 'GET' }),
        httpMiddleware.for((req, res, next) => {
            res.setHeader('middleware_api_group', '1');
            next();
        }).forRoutes({ group: 'api' }),
        httpMiddleware.for((req, res, next) => {
            res.setHeader('middleware_api_path', '1');
            next();
        }).forRoutes({ path: '/api/*' }),
        httpMiddleware.for((req, res, next) => {
            res.setHeader('middleware_api_user', '1');
            next();
        }).forRoutes({ path: '/api/user/*' }),
        httpMiddleware.for((req, res, next) => {
            res.setHeader('middleware_another', '1');
            next();
        }).forRoutes({ group: 'another' })
    ]);

    {
        const response = await httpKernel.request(HttpRequest.GET('/another/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware_get')).toEqual('1');
        expect(response.getHeader('middleware_another')).toEqual('1');
        expect(response.getHeader('middleware_api_group')).toEqual(undefined);
        expect(response.getHeader('middleware_api_path')).toEqual(undefined);
    }

    {
        const response = await httpKernel.request(HttpRequest.GET('/api/group/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware_api_group')).toEqual('1');
        expect(response.getHeader('middleware_api_path')).toEqual('1');
        expect(response.getHeader('middleware_get')).toEqual('1');
        expect(response.getHeader('middleware_another')).toEqual(undefined);
    }

    {
        const response = await httpKernel.request(HttpRequest.GET('/api/user/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware_api_group')).toEqual('1');
        expect(response.getHeader('middleware_api_path')).toEqual('1');
        expect(response.getHeader('middleware_api_user')).toEqual('1');
        expect(response.getHeader('middleware_get')).toEqual('1');
        expect(response.getHeader('middleware_another')).toEqual(undefined);
    }
});

test('middleware timeout', async () => {
    const httpKernel = createHttpKernel([Controller], [], [], [httpMiddleware.for((req, res, next) => {
        //do nothing
    }).timeout(1000)]);

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);
    expect(response.bodyString).toEqual('"name1"');
});

test('middleware keep content type', async () => {
    const httpKernel = createHttpKernel([Controller], [], [], [httpMiddleware.for((req, res, next) => {
        res.setHeader('Content-Type', 'text/plain');
        next();
    })]);

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);
    expect(response.bodyString).toEqual('"name1"');
    expect(response.getHeader('content-type')).toEqual('text/plain');
});

test('middleware order natural', async () => {
    const order: number[] = [];
    const httpKernel = createHttpKernel([Controller], [], [], [
        httpMiddleware.for((req, res, next) => {
            order.push(1);
            next();
        }),
        httpMiddleware.for((req, res, next) => {
            order.push(2);
            next();
        }),
        httpMiddleware.for((req, res, next) => {
            order.push(3);
            next();
        })
    ]);

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);

    expect(order).toEqual([1, 2, 3]);
});

test('middleware order changed', async () => {
    const order: number[] = [];
    const httpKernel = createHttpKernel([Controller], [], [], [
        httpMiddleware.for((req, res, next) => {
            order.push(1);
            next();
        }),
        httpMiddleware.for((req, res, next) => {
            order.push(2);
            next();
        }),
        httpMiddleware.for((req, res, next) => {
            order.push(3);
            next();
        }).order(-1)
    ]);

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);

    expect(order).toEqual([3, 1, 2]);
});


test('middleware for module', async () => {
    const moduleA = new AppModule({}, 'a');
    const moduleB = new AppModule({}, 'b');

    class MyControllerA {
        @http.GET('/a/:name')
        hello(name: string) {
            return name;
        }
    }

    class MyControllerB {
        @http.GET('/b/:name')
        hello(name: string) {
            return name;
        }
    }

    const httpKernel = createHttpKernel([
        { module: moduleA, controller: MyControllerA },
        { module: moduleB, controller: MyControllerB },
    ], [], [], [
        httpMiddleware.for((req, res, next) => {
            res.setHeader('middleware', '1');
            next();
        }).forModules(moduleB),
    ]);

    {
        const response = await httpKernel.request(HttpRequest.GET('/a/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware')).toEqual(undefined);
    }

    {
        const response = await httpKernel.request(HttpRequest.GET('/b/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware')).toEqual('1');
    }
});


test('middleware self module', async () => {
    const moduleA = new AppModule({}, 'a');

    class MyControllerA {
        @http.GET('/a/:name')
        hello(name: string) {
            return name;
        }
    }

    const httpKernel = createHttpKernel([Controller, { controller: MyControllerA, module: moduleA }], [], [], [httpMiddleware.for((req, res, next) => {
        res.setHeader('middleware', '1');
        next();
    }).forSelfModules()]);

    {
        const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware')).toEqual('1');
    }

    {
        const response = await httpKernel.request(HttpRequest.GET('/a/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware')).toEqual(undefined);
    }
});

test('middleware class type', async () => {
    class MyMiddleware {
        execute(request: HttpRequest, response: HttpResponse, next: (error?: any) => void) {
            response.setHeader('middleware', '1');
            next();
        }
    }

    const httpKernel = createHttpKernel([Controller], [MyMiddleware], [], [httpMiddleware.for(MyMiddleware)]);

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);
    expect(response.getHeader('middleware')).toEqual('1');
});


test('middleware on http controller', async () => {
    class MyMiddleware {
        execute(request: HttpRequest, response: HttpResponse, next: (error?: any) => void) {
            response.setHeader('middleware_a', '1');
            next();
        }
    }

    @http.middleware(MyMiddleware)
    class MyControllerA {
        @http.GET('/a/:name')
        a(name: string) {
            return name;
        }

        @http.GET('/b/:name').middleware((req, res, next) => {
            res.setHeader('middleware_b', '1');
            next();
        })
        b(name: string) {
            return name;
        }
    }

    const httpKernel = createHttpKernel([MyControllerA], [MyMiddleware]);

    {
        const response = await httpKernel.request(HttpRequest.GET('/a/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware_a')).toEqual('1');
        expect(response.getHeader('middleware_b')).toEqual(undefined);
    }

    {
        const response = await httpKernel.request(HttpRequest.GET('/b/name1'));
        expect(response.statusCode).toEqual(200);
        expect(response.getHeader('middleware_a')).toEqual('1');
        expect(response.getHeader('middleware_b')).toEqual('1');
    }
});
