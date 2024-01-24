#!/usr/bin/env ts-node

/*

This example demonstrates a manual build authentication layer using httpWorklow.onAuth event listener.

You can run this application using `./examples/auth-app.ts server:start` and query its HTTP API:

//should print "Hello Foo"
$ curl -H "Authorization: foo" http://localhost:8080

//should print "Hello Bar"
$ curl -H "Authorization: bar" http://localhost:8080

//should print "Access Denied"
$ curl http://localhost:8080

*/
import { App } from '@deepkit/app';
import { eventDispatcher } from '@deepkit/event';
import { FrameworkModule } from '@deepkit/framework';
import { HttpAction, JSONResponse, RouteParameterResolverContext, http, httpWorkflow } from '@deepkit/http';
import { Logger } from '@deepkit/logger';

class User {
    constructor(
        public username: string,
        public apiKey: string = '',
    ) {}
}

const users: User[] = [new User('Foo', 'foo'), new User('Bar', 'bar')];

function authGroup(group: 'api' | 'frontend') {
    return (action: HttpAction) => {
        action.data.set('authGroup', group);
    };
}

class MyRouteParameterResolver {
    resolve(context: RouteParameterResolverContext): any | Promise<any> {
        if (!context.request.store.user) throw new Error('No user loaded');
        return context.request.store.user;
    }
}

@http.controller().resolveParameter(User, MyRouteParameterResolver)
class ApiController {
    @http.GET().use(authGroup('api'))
    api(user: User) {
        return new JSONResponse('hi ' + user.username);
    }
}

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

new App({
    controllers: [ApiController],
    providers: [MyRouteParameterResolver],
    listeners: [AuthListener],
    imports: [new FrameworkModule()],
}).run();
