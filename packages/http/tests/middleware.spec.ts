import { expect, test } from '@jest/globals';

import { AppModule } from '@deepkit/app';
import { sleep } from '@deepkit/core';
import { InjectorContext } from '@deepkit/injector';

import { http } from '../src/decorator.js';
import { HttpAccessDeniedError, HttpUnauthorizedError } from '../src/http.js';
import { HttpMiddleware, httpMiddleware } from '../src/middleware.js';
import { HttpRequest, HttpResponse } from '../src/model.js';
import { createHttpKernel } from './utils.js';

class Controller {
    @http.GET('user/:name')
    hello(name: string) {
        return name;
    }
}

test('middleware empty', async () => {
    const httpKernel = createHttpKernel(
        [Controller],
        [],
        [],
        [
            httpMiddleware.for((req, res, next) => {
                next();
            }),
        ],
    );

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);
    expect(response.bodyString).toEqual('"name1"');
    expect(response.getHeader('Content-Type')).toEqual('application/json; charset=utf-8');
});

test('middleware async success', async () => {
    const httpKernel = createHttpKernel(
        [Controller],
        [],
        [],
        [
            httpMiddleware.for(async (req, res, next) => {
                await sleep(0.1);
                res.end('nope');
            }),
        ],
    );

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);
    expect(response.bodyString).toEqual('nope');
});

test('middleware async failed', async () => {
    const httpKernel = createHttpKernel(
        [Controller],
        [],
        [],
        [
            httpMiddleware.for(async (req, res, next) => {
                await sleep(0.1);
                throw new Error('nope');
            }),
        ],
    );

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(500);
    expect(response.bodyString).toEqual('Internal error');
});

test('middleware throwing HttpError returns correct status code', async () => {
    const httpKernel = createHttpKernel(
        [Controller],
        [],
        [],
        [
            httpMiddleware.for((req, res, next) => {
                throw new HttpAccessDeniedError('Access denied for this resource');
            }),
        ],
    );

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(403);
    expect(response.json).toEqual({ message: 'Access denied for this resource' });
});

test('middleware async throwing HttpError returns correct status code', async () => {
    const httpKernel = createHttpKernel(
        [Controller],
        [],
        [],
        [
            httpMiddleware.for(async (req, res, next) => {
                await sleep(0.1);
                throw new HttpUnauthorizedError('Invalid token');
            }),
        ],
    );

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(401);
    expect(response.json).toEqual({ message: 'Invalid token' });
});

test('middleware class async success', async () => {
    class MyMiddleware implements HttpMiddleware {
        async execute(req: HttpRequest, res: HttpResponse, next: (err?: any) => void): Promise<void> {
            await sleep(0.1);
            res.end('nope');
        }
    }

    const httpKernel = createHttpKernel([Controller], [MyMiddleware], [], [httpMiddleware.for(MyMiddleware)]);

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);
    expect(response.bodyString).toEqual('nope');
});

test('middleware class async failed', async () => {
    class MyMiddleware implements HttpMiddleware {
        async execute(req: HttpRequest, res: HttpResponse, next: (err?: any) => void): Promise<void> {
            await sleep(0.1);
            throw new Error('nope');
        }
    }

    const httpKernel = createHttpKernel([Controller], [MyMiddleware], [], [httpMiddleware.for(MyMiddleware)]);

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(500);
    expect(response.bodyString).toEqual('Internal error');
});

test('middleware direct response', async () => {
    const httpKernel = createHttpKernel(
        [Controller],
        [],
        [],
        [
            httpMiddleware.for((req, res, next) => {
                res.end('nope');
            }),
        ],
    );

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);
    expect(response.bodyString).toEqual('nope');
});

test('middleware direct response triggers onResponse event for logging', async () => {
    const { httpWorkflow } = await import('../src/http.js');
    let onResponseCalled = false;
    let responseStatus: number | undefined;

    const httpKernel = createHttpKernel(
        [Controller],
        [],
        [
            httpWorkflow.onResponse.listen(event => {
                onResponseCalled = true;
                responseStatus = event.response.statusCode;
            }),
        ],
        [
            httpMiddleware.for((req, res, next) => {
                res.statusCode = 403;
                res.end('Forbidden');
            }),
        ],
    );

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(403);
    expect(response.bodyString).toEqual('Forbidden');
    expect(onResponseCalled).toBe(true);
    expect(responseStatus).toBe(403);
});

test('middleware for controller', async () => {
    class MyController {
        @http.GET('/another/:name')
        hello(name: string) {
            return name;
        }
    }

    const httpKernel = createHttpKernel(
        [Controller, MyController],
        [],
        [],
        [
            httpMiddleware
                .for((req, res, next) => {
                    res.setHeader('middleware', '1');
                    next();
                })
                .forControllers(MyController),
        ],
    );

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

    const httpKernel = createHttpKernel(
        [Controller, MyController],
        [],
        [],
        [
            httpMiddleware
                .for((req, res, next) => {
                    res.setHeader('middleware', '1');
                    next();
                })
                .excludeControllers(Controller),
        ],
    );

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
        @(http.GET('/another/:name').name('another'))
        hello(name: string) {
            return name;
        }

        @(http.GET('/api/user/:name').name('api_user'))
        apiUser(name: string) {
            return name;
        }

        @(http.GET('/api/group/:name').name('api_group'))
        apiGroup(name: string) {
            return name;
        }
    }

    const httpKernel = createHttpKernel(
        [MyController],
        [],
        [],
        [
            httpMiddleware
                .for((req, res, next) => {
                    res.setHeader('middleware', '1');
                    next();
                })
                .forRouteNames('api_*')
                .excludeRouteNames('api_group'),
        ],
    );

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
        @(http.GET('/another/:name').group('another'))
        hello(name: string) {
            return name;
        }

        @(http.GET('/api/user/:name').group('api'))
        apiUser(name: string) {
            return name;
        }

        @(http.GET('/api/group/:name').group('api'))
        apiGroup(name: string) {
            return name;
        }
    }

    const httpKernel = createHttpKernel(
        [MyController],
        [],
        [],
        [
            httpMiddleware
                .for((req, res, next) => {
                    res.setHeader('middleware_get', '1');
                    next();
                })
                .forRoutes({ httpMethod: 'GET' }),
            httpMiddleware
                .for((req, res, next) => {
                    res.setHeader('middleware_api_group', '1');
                    next();
                })
                .forRoutes({ group: 'api' }),
            httpMiddleware
                .for((req, res, next) => {
                    res.setHeader('middleware_api_path', '1');
                    next();
                })
                .forRoutes({ path: '/api/*' }),
            httpMiddleware
                .for((req, res, next) => {
                    res.setHeader('middleware_api_user', '1');
                    next();
                })
                .forRoutes({ path: '/api/user/*' }),
            httpMiddleware
                .for((req, res, next) => {
                    res.setHeader('middleware_another', '1');
                    next();
                })
                .forRoutes({ group: 'another' }),
        ],
    );

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

test('middleware keep content type', async () => {
    const httpKernel = createHttpKernel(
        [Controller],
        [],
        [],
        [
            httpMiddleware.for((req, res, next) => {
                res.setHeader('Content-Type', 'text/plain');
                next();
            }),
        ],
    );

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);
    expect(response.bodyString).toEqual('"name1"');
    expect(response.getHeader('Content-Type')).toEqual('text/plain');
});

test('middleware order natural', async () => {
    const order: number[] = [];
    const httpKernel = createHttpKernel(
        [Controller],
        [],
        [],
        [
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
            }),
        ],
    );

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);

    expect(order).toEqual([1, 2, 3]);
});

test('middleware order changed', async () => {
    const order: number[] = [];
    const httpKernel = createHttpKernel(
        [Controller],
        [],
        [],
        [
            httpMiddleware.for((req, res, next) => {
                order.push(1);
                next();
            }),
            httpMiddleware.for((req, res, next) => {
                order.push(2);
                next();
            }),
            httpMiddleware
                .for((req, res, next) => {
                    order.push(3);
                    next();
                })
                .order(-1),
        ],
    );

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);

    expect(order).toEqual([3, 1, 2]);
});

test('middleware for module', async () => {
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
    const moduleA = new AppModule({}, { controllers: [MyControllerA], providers: [MyControllerA] });
    const moduleB = new AppModule({}, { controllers: [MyControllerB], providers: [MyControllerB] });

    const httpKernel = createHttpKernel(
        [],
        [],
        [],
        [
            httpMiddleware
                .for((req, res, next) => {
                    res.setHeader('middleware', '1');
                    next();
                })
                .forModules(moduleB),
        ],
        [moduleA, moduleB],
    );

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
    class MyControllerA {
        @http.GET('/a/:name')
        hello(name: string) {
            return name;
        }
    }
    const moduleA = new AppModule({}, { controllers: [MyControllerA] });

    const httpKernel = createHttpKernel(
        [Controller],
        [],
        [],
        [
            httpMiddleware
                .for((req, res, next) => {
                    res.setHeader('middleware', '1');
                    next();
                })
                .forSelfModules(),
        ],
        [moduleA],
    );

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

        @(http.GET('/b/:name').middleware((req, res, next) => {
            res.setHeader('middleware_b', '1');
            next();
        }))
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

test('singleton middleware is reused across requests', async () => {
    let instanceCount = 0;

    class SingletonMiddleware implements HttpMiddleware {
        id: number;
        constructor() {
            instanceCount++;
            this.id = instanceCount;
        }
        execute(req: HttpRequest, res: HttpResponse, next: (err?: any) => void): void {
            res.setHeader('middleware-instance', String(this.id));
            next();
        }
    }

    const httpKernel = createHttpKernel(
        [Controller],
        [SingletonMiddleware], // Singleton by default
        [],
        [httpMiddleware.for(SingletonMiddleware)],
    );

    // Make multiple requests
    const response1 = await httpKernel.request(HttpRequest.GET('/user/name1'));
    const response2 = await httpKernel.request(HttpRequest.GET('/user/name2'));
    const response3 = await httpKernel.request(HttpRequest.GET('/user/name3'));

    // All responses should be from the same singleton instance
    expect(response1.statusCode).toEqual(200);
    expect(response2.statusCode).toEqual(200);
    expect(response3.statusCode).toEqual(200);

    expect(response1.getHeader('middleware-instance')).toEqual('1');
    expect(response2.getHeader('middleware-instance')).toEqual('1');
    expect(response3.getHeader('middleware-instance')).toEqual('1');

    // Only one instance should have been created
    expect(instanceCount).toEqual(1);
});

test('request-scoped middleware creates new instance per request', async () => {
    let instanceCount = 0;

    class RequestScopedMiddleware implements HttpMiddleware {
        id: number;
        constructor() {
            instanceCount++;
            this.id = instanceCount;
        }
        execute(req: HttpRequest, res: HttpResponse, next: (err?: any) => void): void {
            res.setHeader('middleware-instance', String(this.id));
            next();
        }
    }

    const httpKernel = createHttpKernel(
        [Controller],
        [{ provide: RequestScopedMiddleware, scope: 'http' }], // Request-scoped
        [],
        [httpMiddleware.for(RequestScopedMiddleware)],
    );

    // Make multiple requests
    const response1 = await httpKernel.request(HttpRequest.GET('/user/name1'));
    const response2 = await httpKernel.request(HttpRequest.GET('/user/name2'));
    const response3 = await httpKernel.request(HttpRequest.GET('/user/name3'));

    // All responses should be from different instances
    expect(response1.statusCode).toEqual(200);
    expect(response2.statusCode).toEqual(200);
    expect(response3.statusCode).toEqual(200);

    expect(response1.getHeader('middleware-instance')).toEqual('1');
    expect(response2.getHeader('middleware-instance')).toEqual('2');
    expect(response3.getHeader('middleware-instance')).toEqual('3');

    // Three instances should have been created
    expect(instanceCount).toEqual(3);
});

test('middleware with injected dependencies', async () => {
    class Logger {
        log(msg: string) {
            return msg;
        }
    }

    class LoggingMiddleware implements HttpMiddleware {
        constructor(private logger: Logger) {}

        execute(req: HttpRequest, res: HttpResponse, next: (err?: any) => void): void {
            res.setHeader('logged', this.logger.log('request logged'));
            next();
        }
    }

    const httpKernel = createHttpKernel([Controller], [Logger, LoggingMiddleware], [], [httpMiddleware.for(LoggingMiddleware)]);

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);
    expect(response.getHeader('logged')).toEqual('request logged');
});

test('request-scoped middleware can access http-scoped services', async () => {
    class RequestScopedMiddleware implements HttpMiddleware {
        constructor(private injectorContext: InjectorContext) {}

        execute(req: HttpRequest, res: HttpResponse, next: (err?: any) => void): void {
            // Can access the request-scoped injector context
            res.setHeader('has-injector', this.injectorContext ? 'yes' : 'no');
            next();
        }
    }

    const httpKernel = createHttpKernel([Controller], [{ provide: RequestScopedMiddleware, scope: 'http' }], [], [httpMiddleware.for(RequestScopedMiddleware)]);

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);
    expect(response.getHeader('has-injector')).toEqual('yes');
});

test('mixed singleton and function middlewares', async () => {
    let callOrder: string[] = [];

    class SingletonMiddleware implements HttpMiddleware {
        execute(req: HttpRequest, res: HttpResponse, next: (err?: any) => void): void {
            callOrder.push('singleton');
            next();
        }
    }

    const httpKernel = createHttpKernel(
        [Controller],
        [SingletonMiddleware],
        [],
        [
            httpMiddleware.for((req, res, next) => {
                callOrder.push('fn1');
                next();
            }),
            httpMiddleware.for(SingletonMiddleware),
            httpMiddleware.for((req, res, next) => {
                callOrder.push('fn2');
                next();
            }),
        ],
    );

    const response = await httpKernel.request(HttpRequest.GET('/user/name1'));
    expect(response.statusCode).toEqual(200);
    expect(callOrder).toEqual(['fn1', 'singleton', 'fn2']);

    // Reset for second request
    callOrder = [];
    await httpKernel.request(HttpRequest.GET('/user/name2'));
    expect(callOrder).toEqual(['fn1', 'singleton', 'fn2']);
});
