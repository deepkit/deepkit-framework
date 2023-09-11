import { expect, test } from '@jest/globals';
import { HttpRequest } from '../src/lib/model.js';

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
