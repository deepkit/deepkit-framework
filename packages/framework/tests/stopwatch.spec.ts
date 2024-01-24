import { expect, test } from '@jest/globals';

import { App } from '@deepkit/app';
import { decodeFrameData, deserializeFrameData, encodeFrameData } from '@deepkit/framework-debug-api';
import { FrameCategory, FrameCategoryData, Stopwatch, encodeCompoundKey } from '@deepkit/stopwatch';

import { FrameworkModule } from '../src/module.js';

test('encode/decode', async () => {
    const data = encodeFrameData([
        {
            cid: encodeCompoundKey(1, 1),
            category: FrameCategory.http,
            data: {
                method: 'GET',
                clientIp: '127.0.0.1',
            },
        },
    ]);

    decodeFrameData(data, data => {
        console.log('data', data);
        const http = deserializeFrameData(data) as FrameCategoryData[FrameCategory.http];
        console.log('http', http);
        expect(http).toEqual({ method: 'GET', clientIp: '127.0.0.1' });
    });
});

test('default disabled', () => {
    const app = new App({
        imports: [new FrameworkModule()],
    });

    expect(app.get(Stopwatch).active).toBe(false);
});

test('enabled with debug', () => {
    const app = new App({
        imports: [new FrameworkModule({ debug: true })],
    });

    expect(app.get(Stopwatch).active).toBe(true);
});

test('enabled with profile', () => {
    const app = new App({
        imports: [new FrameworkModule({ profile: true })],
    });

    expect(app.get(Stopwatch).active).toBe(true);
});
