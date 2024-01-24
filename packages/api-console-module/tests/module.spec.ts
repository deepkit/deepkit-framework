import { expect, test } from '@jest/globals';

import { ApiEntryPoints } from '@deepkit/api-console-gui/src/api';
import { App } from '@deepkit/app';
import { serializeBSON } from '@deepkit/bson';
import { HttpKernel, HttpModule, HttpRequest } from '@deepkit/http';
import { ReflectionKind, TypeObjectLiteral, reflect } from '@deepkit/type';

import { ApiConsoleModule } from '../src/module.js';

test('type api', () => {
    const type = reflect(ApiEntryPoints);
    // const serialized = serializeType(type);

    const v: TypeObjectLiteral = {
        kind: ReflectionKind.objectLiteral,
        types: [
            {
                kind: ReflectionKind.propertySignature,
                name: 'v',
                type: type,
                parent: Object as any,
            },
        ],
    };

    //todo: this hangs. investigate why
    serializeBSON(
        {
            v: {
                httpRoutes: [],
                rpcActions: [],
            },
        },
        undefined,
        v,
    );
});

test('module basic functionality', async () => {
    const app = new App({
        imports: [new ApiConsoleModule({ path: '/my-api' }), new HttpModule()],
    });

    const http = app.get(HttpKernel);

    {
        const response = await http.request(HttpRequest.GET('/my-api'));
        expect(response.statusCode).toBe(200);
        expect(response.bodyString).toContain('/my-api');
    }
});
