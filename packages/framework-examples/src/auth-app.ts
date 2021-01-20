#!/usr/bin/env node --no-warnings --experimental-specifier-resolution=node --loader @deepkit/framework/loader
import 'reflect-metadata';
import {
    Application,
    http,
    Logger,
    RouteParameterResolverContext,
    RouteParameterResolverTag,
    eventDispatcher,
    httpWorkflow,
    JSONResponse,
    HttpAction,
    injectable
} from '@deepkit/framework';

/*

This example demonstrates a manual build authentication layer using httpWorklow.onAuth event listener.

You can run this application using `./examples/auth-app.ts server:listen` and query its HTTP API:

//should print "Hello Foo"
$ curl -H "Authorization: foo" http://localhost:8080

//should print "Hello Bar"
$ curl -H "Authorization: bar" http://localhost:8080

//should print "Access Denied"
$ curl http://localhost:8080

*/

class User {
    constructor(
        public username: string,
        public apiKey: string = '',
    ) { }
}

const users: User[] = [
    new User('Foo', 'foo'),
    new User('Bar', 'bar'),
];

function authGroup(group: 'api' | 'frontend') {
    return (action: HttpAction) => {
        action.data.set('authGroup', group);
    }
}

@http.controller()
class ApiController {
    @http.GET().use(authGroup('api'))
    api(user: User) {
        return new JSONResponse('hi ' + user.username);
    }
}

@injectable()
class AuthListener {
    constructor(protected logger: Logger) {}

    @eventDispatcher.listen(httpWorkflow.onAuth)
    async onAuthForApi(event: typeof httpWorkflow.onAuth.event) {
        if (event.route.data.get('authGroup') !== 'api') return;

        const apiKey = event.request.headers['authorization'];

        // you can replace that code with a database query
        const user = users.find(v => v.apiKey === apiKey);
        if (!user) {
            return event.accessDenied();
        }

        // success, make sure all routes have the `User` object if they want
        // via MyRouteParameterResolver
        event.request.store.user = user;
        this.logger.info('Secure API requested by', user.username);
    }
}

class MyRouteParameterResolver {
    resolve(context: RouteParameterResolverContext): any | Promise<any> {
        if (!context.request.store.user) throw new Error('No user loaded');
        return context.request.store.user;
    }
}

Application.create({
    providers: [
        RouteParameterResolverTag.provide(MyRouteParameterResolver).forClassType(User),
    ],
    listeners: [
        AuthListener
    ],
    controllers: [ApiController]
}).run();
