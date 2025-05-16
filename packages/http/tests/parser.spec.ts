import { expect, test } from "@jest/globals";
import { HttpConfig } from "../src/module.config";
import { createHttpKernel } from "./utils";
import { HttpRouterRegistry, UploadedFile } from "../src/router";
import { HttpBody, HttpRequest } from "../src/model";
import { json } from "stream/consumers";

test('multipart posts', async () => {
    const httpConfig = new HttpConfig();
    httpConfig.parser.multipartJsonKey = 'json';

    const httpKernel = createHttpKernel(
        (registry: HttpRouterRegistry) => {
            interface Input {
                file: UploadedFile;
                jsonA: string;
                jsonB: number;
                singleField: string;
                multiField: string[];
            }
            registry.post('/', (body: HttpBody<Input>) => body);
        },
        [],
        [],
        [],
        [],
        httpConfig
    );

    const response = await httpKernel.request(HttpRequest.POST('/').multiPart([
        { name: 'file', file: Buffer.from('the quick brown fox jumps over the lazy dog'), fileName: 'fox.txt' },
        {
            name: 'json',
            value: JSON.stringify({
                jsonA: 'someValue',
                jsonB: 42
            })
        },
        {
            name: 'singleField',
            value: 'singleValue',
        },
        {
            name: 'multiField',
            value: 'firstValue'
        },
        {
            name: 'multiField',
            value: 'secondValue'
        }
    ]));

    expect(response.json).toMatchObject({
        file: {
            name: 'fox.txt',
            size: 43,
            path: expect.any(String),
            type: 'application/octet-stream',
        },
        jsonA: 'someValue',
        jsonB: 42,
        singleField: 'singleValue',
        multiField: ['firstValue', 'secondValue']
    });
});
