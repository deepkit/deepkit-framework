import { expect, test } from '@jest/globals';

import { HttpRequest } from '../src/model.js';
import { SeparateFileController } from './fixtures/body-controller.js';
import { createHttpKernel } from './utils.js';

/**
 * Test suite for issue #458: "Cannot have body parameter in controller defined in separate file"
 *
 * These tests verify that HttpBody parameters work correctly when the controller
 * is imported from a separate file (as opposed to being defined in the same file as the test).
 */

test('HttpBody<any> works in controller from separate file (#458)', async () => {
    const httpKernel = createHttpKernel([SeparateFileController]);

    const response = await httpKernel.request(HttpRequest.PUT('/test-body-any').json({ test: 'value' }));

    expect(response.statusCode).toBe(200);
    expect(response.json).toMatchObject({ received: { test: 'value' } });
});

test('HttpBody<interface> works in controller from separate file (#458)', async () => {
    const httpKernel = createHttpKernel([SeparateFileController]);

    const response = await httpKernel.request(HttpRequest.POST('/test-body-interface').json({ username: 'john', email: 'john@example.com' }));

    expect(response.statusCode).toBe(200);
    expect(response.json).toMatchObject({ username: 'john', email: 'john@example.com' });
});

test('HttpBody<class> works in controller from separate file (#458)', async () => {
    const httpKernel = createHttpKernel([SeparateFileController]);

    const response = await httpKernel.request(HttpRequest.POST('/test-body-class').json({ title: 'My Post', content: 'Hello World' }));

    expect(response.statusCode).toBe(200);
    expect(response.json).toMatchObject({ title: 'My Post', content: 'Hello World', isClass: true });
});

test('HttpBody<inline type> works in controller from separate file (#458)', async () => {
    const httpKernel = createHttpKernel([SeparateFileController]);

    const response = await httpKernel.request(HttpRequest.POST('/test-body-inline').json({ name: 'Alice', age: 30 }));

    expect(response.statusCode).toBe(200);
    expect(response.json).toMatchObject({ name: 'Alice', age: 30 });
});

test('HttpBody validation works in controller from separate file (#458)', async () => {
    const httpKernel = createHttpKernel([SeparateFileController]);

    // Send invalid data (missing required field 'email')
    const response = await httpKernel.request(HttpRequest.POST('/test-body-interface').json({ username: 'john' }));

    // Should return validation error
    expect(response.statusCode).toBe(400);
    expect(response.json.message).toContain('email');
});
