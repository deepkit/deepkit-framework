import { expect, test } from '@jest/globals';
import { decodeFrameData, deserializeFrameData, encodeFrameData } from '@deepkit/framework-debug-api';
import { encodeCompoundKey, FrameCategory, FrameCategoryData } from '@deepkit/stopwatch';


test('encode/decode', async () => {
    const data = encodeFrameData([{
        cid: encodeCompoundKey(1, 1), category: FrameCategory.http, data: {
            method: 'GET',
            clientIp: '127.0.0.1'
        }
    }]);

    decodeFrameData(data, (data) => {
        console.log('data', data);
        const http = deserializeFrameData(data) as FrameCategoryData[FrameCategory.http];
        console.log('http', http);
        expect(http).toEqual({ method: 'GET', clientIp: '127.0.0.1' });
    });
});
