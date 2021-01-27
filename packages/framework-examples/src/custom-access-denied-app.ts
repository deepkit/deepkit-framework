#!/usr/bin/env ts-node
import {
    Application,
    eventDispatcher,
    HtmlResponse, http,
    HttpAccessDeniedError, httpWorkflow
} from '@deepkit/framework';
import 'reflect-metadata';

/*

This example demonstrates how to overwrite the AccessDenied event and print your own response.

*/

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

Application.create({
    listeners: [
        AuthListener
    ],
    controllers: [ApiController]
}).run();
