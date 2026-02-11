import { test } from 'node:test';
import { expect } from '@deepkit/run/expect';
import { ServerResponse } from 'http';

import { HttpRequest, HttpResponse, incomingMessageToHttpRequest, serverResponseToHttpResponse } from '../src/model.js';

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
    const request = HttpRequest.POST('/').body('hello').build();
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

test('HttpRequest.get() Express-compatible header access (#285)', () => {
    const request = HttpRequest.GET('/').header('Content-Type', 'application/json').header('X-Custom-Header', 'custom-value').header('Referer', 'https://example.com').build();

    // Basic header access (case-insensitive)
    expect(request.get('Content-Type')).toBe('application/json');
    expect(request.get('content-type')).toBe('application/json');
    expect(request.get('CONTENT-TYPE')).toBe('application/json');

    // Custom header
    expect(request.get('X-Custom-Header')).toBe('custom-value');
    expect(request.get('x-custom-header')).toBe('custom-value');

    // Referer/Referrer special handling
    expect(request.get('Referer')).toBe('https://example.com');
    expect(request.get('Referrer')).toBe('https://example.com');

    // Non-existent header
    expect(request.get('X-Not-Exists')).toBeUndefined();

    // header() is alias for get()
    expect(request.header('Content-Type')).toBe('application/json');
});

test('HttpRequest.get() handles array headers', () => {
    const incomingMessage = {
        url: '/',
        method: 'GET',
        headers: {
            'set-cookie': ['cookie1=value1', 'cookie2=value2'],
            accept: 'text/html',
        },
        socket: { remoteAddress: '127.0.0.1' },
    };

    const request = incomingMessageToHttpRequest(incomingMessage as any);

    // Array headers should be joined with ', '
    expect(request.get('set-cookie')).toBe('cookie1=value1, cookie2=value2');

    // Single value headers work normally
    expect(request.get('accept')).toBe('text/html');
});
