#!/usr/bin/env ts-node

/*

This example demonstrates how to overwrite the AccessDenied event and print your own response.

*/
import { App } from '@deepkit/app';
import { eventDispatcher } from '@deepkit/event';
import { FrameworkModule } from '@deepkit/framework';
import { HtmlResponse, HttpAccessDeniedError, http, httpWorkflow } from '@deepkit/http';

@http.controller()
class ApiController {
    @http.GET()
    startPage() {
        throw new HttpAccessDeniedError();
    }
}

class AuthListener {
    @eventDispatcher.listen(httpWorkflow.onAccessDenied)
    async onAccessDenied(event: typeof httpWorkflow.onAccessDenied.event) {
        event.send(new HtmlResponse('Please login first.', 403));
    }
}

new App({
    listeners: [AuthListener],
    controllers: [ApiController],
    imports: [new FrameworkModule()],
}).run();
