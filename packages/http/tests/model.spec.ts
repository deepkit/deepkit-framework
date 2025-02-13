import { expect, test } from '@jest/globals';
import { HttpRequest, HttpResponse, incomingMessageToHttpRequest, serverResponseToHttpResponse } from '../src/model.js';
import { ServerResponse } from 'http';

test('request model json', async () => {
    const request = HttpRequest.POST('/').json({ hello: 'world' }).build();
    const buffers = [];

    for await (const chunk of request) {
        buffers.push(chunk);
    }

    const bodyBuffer = Buffer.concat(buffers).toString();
    expect(bodyBuffer).toBe('{"hello":"world"}');
});

test('request model body', async () => {
    const request = HttpRequest.POST('/').body("hello").build();
    const buffers = [];

    for await (const chunk of request) {
        buffers.push(chunk);
    }

    const bodyBuffer = Buffer.concat(buffers).toString();
    expect(bodyBuffer).toBe('hello');
});

test('incomingMessageToHttpRequest', () => {
    const incomingMessage = {
        url: '/',
        method: 'GET',
        headers: {
            'content-type': 'application/json',
        },
        socket: {
            remoteAddress: '127.0.0.1',
        },
    };

    const request = incomingMessageToHttpRequest(incomingMessage as any);
    expect(request).toBeInstanceOf(HttpRequest);
    expect(request.getUrl()).toBe('/');
    expect(request.getMethod()).toBe('GET');
    expect(request.headers['content-type']).toBe('application/json');
    expect(request.getRemoteAddress()).toBe('127.0.0.1');
});

test('serverResponseToHttpResponse', () => {
    const serverResponse = new ServerResponse({} as any);
    const httpResponse = serverResponseToHttpResponse(serverResponse as any);
    expect(httpResponse).toBeInstanceOf(HttpResponse);
    httpResponse.status(200);
    expect(serverResponse.statusCode).toBe(200);
});
