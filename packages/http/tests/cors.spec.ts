import { test } from 'node:test';
import { expect } from '@deepkit/run/expect';

import { App, AppModule } from '@deepkit/app';

import { http } from '../src/decorator.js';
import { HttpKernel } from '../src/kernel.js';
import { HttpBody } from '../src/model.js';
import { HttpRequest } from '../src/model.js';
import { CorsOptions } from '../src/module.config.js';
import { HttpModule } from '../src/module.js';
import { createHttpKernel } from './utils.js';

/**
 * Helper to create an HTTP kernel with CORS configuration.
 * Uses setupConfig to set complex types (RegExp, functions) that can't go through
 * regular configure() serialization.
 */
function createCorsKernel(controllers: any[], corsConfig: CorsOptions) {
    const httpModule = new HttpModule().setupConfig((module, config) => {
        config.cors = corsConfig;
    });

    const appModule = new AppModule(
        {},
        {
            controllers,
            imports: [httpModule],
        },
    );

    const app = App.fromModule(appModule);
    return app.get(HttpKernel);
}

// ==============================================================================
// 1. CORS Disabled (default)
// ==============================================================================

test('CORS: disabled by default - no CORS headers added', async () => {
    class Controller {
        @http.GET('/test')
        test() {
            return 'ok';
        }
    }

    const kernel = createHttpKernel([Controller]);
    const response = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://example.com'));

    expect(response.statusCode).toBe(200);
    expect(response.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
    expect(response.getHeader('Access-Control-Allow-Credentials')).toBeUndefined();
    expect(response.getHeader('Vary')).toBeUndefined();
});

test('CORS: disabled - no headers even with Origin header in request', async () => {
    class Controller {
        @http.GET('/api/data')
        getData() {
            return { data: 'value' };
        }
    }

    const kernel = createHttpKernel([Controller]);
    const response = await kernel.request(HttpRequest.GET('/api/data').header('origin', 'https://attacker.com'));

    expect(response.statusCode).toBe(200);
    expect(response.json).toEqual({ data: 'value' });
    expect(response.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
});

// ==============================================================================
// 2. Basic Origin Validation
// ==============================================================================

test('CORS: allowOrigin true - reflects request origin', async () => {
    class Controller {
        @http.GET('/test')
        test() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });
    const response = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://example.com'));

    expect(response.statusCode).toBe(200);
    expect(response.getHeader('Access-Control-Allow-Origin')).toBe('https://example.com');
    expect(response.getHeader('Vary')).toBe('Origin');
});

test('CORS: allowOrigin true - reflects different origins', async () => {
    class Controller {
        @http.GET('/test')
        test() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });

    // First origin
    const response1 = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://site-a.com'));
    expect(response1.getHeader('Access-Control-Allow-Origin')).toBe('https://site-a.com');

    // Second origin
    const response2 = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://site-b.com'));
    expect(response2.getHeader('Access-Control-Allow-Origin')).toBe('https://site-b.com');
});

test('CORS: allowOrigin * - returns literal wildcard', async () => {
    class Controller {
        @http.GET('/test')
        test() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: '*' });
    const response = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://example.com'));

    expect(response.statusCode).toBe(200);
    expect(response.getHeader('Access-Control-Allow-Origin')).toBe('*');
});

test('CORS: allowOrigin exact string - matches exact origin', async () => {
    class Controller {
        @http.GET('/test')
        test() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: 'https://allowed.com' });

    // Matching origin
    const response1 = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://allowed.com'));
    expect(response1.getHeader('Access-Control-Allow-Origin')).toBe('https://allowed.com');

    // Non-matching origin - no CORS headers
    const response2 = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://denied.com'));
    expect(response2.statusCode).toBe(200);
    expect(response2.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
});

test('CORS: allowOrigin array - matches from list', async () => {
    class Controller {
        @http.GET('/test')
        test() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: ['https://site-a.com', 'https://site-b.com'] });

    // First allowed origin
    const response1 = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://site-a.com'));
    expect(response1.getHeader('Access-Control-Allow-Origin')).toBe('https://site-a.com');

    // Second allowed origin
    const response2 = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://site-b.com'));
    expect(response2.getHeader('Access-Control-Allow-Origin')).toBe('https://site-b.com');

    // Not in list - no CORS headers
    const response3 = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://site-c.com'));
    expect(response3.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
});

test('CORS: allowOrigin regex - matches pattern', async () => {
    class Controller {
        @http.GET('/test')
        test() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: /\.example\.com$/ });

    // Matches regex
    const response1 = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://api.example.com'));
    expect(response1.getHeader('Access-Control-Allow-Origin')).toBe('https://api.example.com');

    // Also matches
    const response2 = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://sub.domain.example.com'));
    expect(response2.getHeader('Access-Control-Allow-Origin')).toBe('https://sub.domain.example.com');

    // Does not match
    const response3 = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://example.org'));
    expect(response3.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
});

test('CORS: allowOrigin function returning boolean - custom validation', async () => {
    class Controller {
        @http.GET('/test')
        test() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], {
        allowOrigin: (origin: string) => origin.startsWith('https://trusted'),
    });

    // Function returns true
    const response1 = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://trusted.site.com'));
    expect(response1.getHeader('Access-Control-Allow-Origin')).toBe('https://trusted.site.com');

    // Function returns false
    const response2 = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://untrusted.com'));
    expect(response2.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
});

test('CORS: allowOrigin function returning string - custom origin', async () => {
    class Controller {
        @http.GET('/test')
        test() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], {
        allowOrigin: (origin: string) => {
            if (origin.includes('mobile')) {
                return 'https://mobile.example.com';
            }
            return false;
        },
    });

    // Function returns a custom string
    const response = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://mobile-app.com'));
    expect(response.getHeader('Access-Control-Allow-Origin')).toBe('https://mobile.example.com');
});

test('CORS: origin not in allowlist - no CORS headers (browser blocks)', async () => {
    class Controller {
        @http.GET('/test')
        test() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: 'https://allowed-only.com' });
    const response = await kernel.request(HttpRequest.GET('/test').header('origin', 'https://blocked.com'));

    // Response still succeeds (server doesn't block), but no CORS headers
    expect(response.statusCode).toBe(200);
    expect(response.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
    expect(response.getHeader('Vary')).toBeUndefined();
});

// ==============================================================================
// 3. Preflight Handling (OPTIONS)
// ==============================================================================

test('CORS: preflight OPTIONS with Origin - returns 204 with CORS headers', async () => {
    class Controller {
        @http.GET('/api/resource')
        getResource() {
            return { data: 'value' };
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });
    const response = await kernel.request(HttpRequest.OPTIONS('/api/resource').header('origin', 'https://example.com'));

    expect(response.statusCode).toBe(204);
    expect(response.getHeader('Access-Control-Allow-Origin')).toBe('https://example.com');
    expect(response.getHeader('Access-Control-Allow-Methods')).toBe('GET, HEAD, PUT, PATCH, POST, DELETE');
    expect(response.getHeader('Access-Control-Max-Age')).toBe('86400');
});

test('CORS: preflight with Access-Control-Request-Headers - reflects headers', async () => {
    class Controller {
        @http.POST('/api/data')
        postData() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });
    const response = await kernel.request(HttpRequest.OPTIONS('/api/data').header('origin', 'https://example.com').header('access-control-request-headers', 'Content-Type, Authorization'));

    expect(response.statusCode).toBe(204);
    expect(response.getHeader('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
});

test('CORS: preflight without Origin - handled as normal OPTIONS request', async () => {
    class Controller {
        @http.OPTIONS('/api/options')
        handleOptions() {
            return { supported: ['GET', 'POST'] };
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });
    const response = await kernel.request(HttpRequest.OPTIONS('/api/options'));

    // Without Origin header, it's not a CORS preflight - routes normally
    expect(response.statusCode).toBe(200);
    expect(response.json).toEqual({ supported: ['GET', 'POST'] });
    expect(response.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
});

test('CORS: preflight with allowed origin - sets Allow-Methods and Max-Age', async () => {
    class Controller {
        @http.PUT('/api/update')
        update() {
            return 'updated';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: ['https://trusted.com'] });
    const response = await kernel.request(HttpRequest.OPTIONS('/api/update').header('origin', 'https://trusted.com'));

    expect(response.statusCode).toBe(204);
    expect(response.getHeader('Access-Control-Allow-Methods')).toBe('GET, HEAD, PUT, PATCH, POST, DELETE');
    expect(response.getHeader('Access-Control-Max-Age')).toBe('86400');
});

test('CORS: preflight with disallowed origin - no CORS headers', async () => {
    class Controller {
        @http.POST('/api/create')
        create() {
            return 'created';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: 'https://allowed.com' });
    const response = await kernel.request(HttpRequest.OPTIONS('/api/create').header('origin', 'https://disallowed.com'));

    // The request continues without CORS headers when origin is not allowed
    expect(response.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
    expect(response.getHeader('Access-Control-Allow-Methods')).toBeUndefined();
});

// ==============================================================================
// 4. Credentials
// ==============================================================================

test('CORS: credentials true - sets Access-Control-Allow-Credentials', async () => {
    class Controller {
        @http.GET('/api/user')
        getUser() {
            return { name: 'John' };
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true, credentials: true });
    const response = await kernel.request(HttpRequest.GET('/api/user').header('origin', 'https://app.example.com'));

    expect(response.statusCode).toBe(200);
    expect(response.getHeader('Access-Control-Allow-Credentials')).toBe('true');
    expect(response.getHeader('Access-Control-Allow-Origin')).toBe('https://app.example.com');
});

test('CORS: credentials true with allowOrigin * - reflects origin (not literal *)', async () => {
    class Controller {
        @http.GET('/api/auth')
        auth() {
            return { authenticated: true };
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: '*', credentials: true });
    const response = await kernel.request(HttpRequest.GET('/api/auth').header('origin', 'https://secure.example.com'));

    expect(response.statusCode).toBe(200);
    // With credentials, '*' is not valid, so it reflects the origin
    expect(response.getHeader('Access-Control-Allow-Origin')).toBe('https://secure.example.com');
    expect(response.getHeader('Access-Control-Allow-Credentials')).toBe('true');
});

test('CORS: credentials false (default) - no credentials header', async () => {
    class Controller {
        @http.GET('/api/public')
        publicEndpoint() {
            return { public: true };
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true, credentials: false });
    const response = await kernel.request(HttpRequest.GET('/api/public').header('origin', 'https://example.com'));

    expect(response.statusCode).toBe(200);
    expect(response.getHeader('Access-Control-Allow-Credentials')).toBeUndefined();
});

// ==============================================================================
// 5. Headers Configuration
// ==============================================================================

test('CORS: allowHeaders true (default) - reflects Access-Control-Request-Headers', async () => {
    class Controller {
        @http.POST('/api/data')
        postData() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true, allowHeaders: true });
    const response = await kernel.request(HttpRequest.OPTIONS('/api/data').header('origin', 'https://example.com').header('access-control-request-headers', 'X-Custom-Header, Content-Type'));

    expect(response.statusCode).toBe(204);
    expect(response.getHeader('Access-Control-Allow-Headers')).toBe('X-Custom-Header, Content-Type');
});

test('CORS: allowHeaders explicit list - returns explicit list', async () => {
    class Controller {
        @http.POST('/api/submit')
        submit() {
            return 'submitted';
        }
    }

    const kernel = createCorsKernel([Controller], {
        allowOrigin: true,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
    });
    const response = await kernel.request(HttpRequest.OPTIONS('/api/submit').header('origin', 'https://example.com').header('access-control-request-headers', 'X-Custom'));

    expect(response.statusCode).toBe(204);
    expect(response.getHeader('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization, X-Api-Key');
});

test('CORS: exposeHeaders - sets Expose-Headers', async () => {
    class Controller {
        @http.GET('/api/response')
        getResponse() {
            return { data: 'value' };
        }
    }

    const kernel = createCorsKernel([Controller], {
        allowOrigin: true,
        exposeHeaders: ['X-Request-Id', 'X-Response-Time'],
    });
    const response = await kernel.request(HttpRequest.GET('/api/response').header('origin', 'https://example.com'));

    expect(response.statusCode).toBe(200);
    expect(response.getHeader('Access-Control-Expose-Headers')).toBe('X-Request-Id, X-Response-Time');
});

test('CORS: custom allowMethods - overrides defaults', async () => {
    class Controller {
        @http.GET('/api/readonly')
        read() {
            return 'data';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true, allowMethods: ['GET', 'HEAD'] });
    const response = await kernel.request(HttpRequest.OPTIONS('/api/readonly').header('origin', 'https://example.com'));

    expect(response.statusCode).toBe(204);
    expect(response.getHeader('Access-Control-Allow-Methods')).toBe('GET, HEAD');
});

test('CORS: custom maxAge - sets Max-Age header', async () => {
    class Controller {
        @http.GET('/api/cached')
        cached() {
            return 'cached data';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true, maxAge: 3600 });
    const response = await kernel.request(HttpRequest.OPTIONS('/api/cached').header('origin', 'https://example.com'));

    expect(response.statusCode).toBe(204);
    expect(response.getHeader('Access-Control-Max-Age')).toBe('3600');
});

// ==============================================================================
// 6. Per-Route Override (decorator testing)
// ==============================================================================

test('CORS: @http.cors stores config in action data', async () => {
    // This test verifies that the @http.cors decorator properly stores config
    // Note: The current implementation handles CORS at the request level (before routing),
    // so per-route CORS would need additional implementation to be fully functional.
    // This test verifies the decorator API works correctly.

    class Controller {
        @(http.GET('/public').cors({ allowOrigin: '*' }))
        publicRoute() {
            return 'public';
        }

        @(http.GET('/restricted').cors({ allowOrigin: 'https://specific.com' }))
        restrictedRoute() {
            return 'restricted';
        }

        @(http.GET('/nocors').cors(false))
        noCorsRoute() {
            return 'no cors';
        }
    }

    const { httpClass } = await import('../src/decorator.js');
    const data = httpClass._fetch(Controller);

    // Verify decorator stores config in action data
    const publicAction = data!.getAction('publicRoute');
    expect(publicAction.data.get('cors')).toEqual({ allowOrigin: '*' });

    const restrictedAction = data!.getAction('restrictedRoute');
    expect(restrictedAction.data.get('cors')).toEqual({ allowOrigin: 'https://specific.com' });

    const noCorsAction = data!.getAction('noCorsRoute');
    expect(noCorsAction.data.get('cors')).toBe(false);
});

// ==============================================================================
// 7. Edge Cases
// ==============================================================================

test('CORS: no Origin header - no CORS headers (same-origin request)', async () => {
    class Controller {
        @http.GET('/api/internal')
        internal() {
            return { internal: true };
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });
    const response = await kernel.request(HttpRequest.GET('/api/internal'));

    expect(response.statusCode).toBe(200);
    expect(response.json).toEqual({ internal: true });
    // No Origin header means same-origin request - no CORS headers needed
    expect(response.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
    expect(response.getHeader('Vary')).toBeUndefined();
});

test('CORS: multiple requests - headers set correctly each time', async () => {
    class Controller {
        @http.GET('/api/multi')
        multi() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: ['https://a.com', 'https://b.com'] });

    // First request from a.com
    const response1 = await kernel.request(HttpRequest.GET('/api/multi').header('origin', 'https://a.com'));
    expect(response1.getHeader('Access-Control-Allow-Origin')).toBe('https://a.com');

    // Second request from b.com
    const response2 = await kernel.request(HttpRequest.GET('/api/multi').header('origin', 'https://b.com'));
    expect(response2.getHeader('Access-Control-Allow-Origin')).toBe('https://b.com');

    // Third request from blocked origin
    const response3 = await kernel.request(HttpRequest.GET('/api/multi').header('origin', 'https://c.com'));
    expect(response3.getHeader('Access-Control-Allow-Origin')).toBeUndefined();

    // Back to first origin - still works
    const response4 = await kernel.request(HttpRequest.GET('/api/multi').header('origin', 'https://a.com'));
    expect(response4.getHeader('Access-Control-Allow-Origin')).toBe('https://a.com');
});

test('CORS: Vary header is set when origin is dynamic', async () => {
    class Controller {
        @http.GET('/api/vary')
        vary() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });
    const response = await kernel.request(HttpRequest.GET('/api/vary').header('origin', 'https://example.com'));

    expect(response.getHeader('Vary')).toBe('Origin');
});

test('CORS: empty exposeHeaders - no Expose-Headers header', async () => {
    class Controller {
        @http.GET('/api/noexpose')
        noExpose() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true, exposeHeaders: [] });
    const response = await kernel.request(HttpRequest.GET('/api/noexpose').header('origin', 'https://example.com'));

    expect(response.statusCode).toBe(200);
    expect(response.getHeader('Access-Control-Expose-Headers')).toBeUndefined();
});

test('CORS: preflight without Access-Control-Request-Headers - no Allow-Headers', async () => {
    class Controller {
        @http.POST('/api/simple')
        simple() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });
    const response = await kernel.request(HttpRequest.OPTIONS('/api/simple').header('origin', 'https://example.com'));

    expect(response.statusCode).toBe(204);
    // Without Access-Control-Request-Headers, Allow-Headers is not set
    expect(response.getHeader('Access-Control-Allow-Headers')).toBeUndefined();
});

test('CORS: all options combined', async () => {
    class Controller {
        @http.POST('/api/full')
        fullRoute() {
            return { success: true };
        }
    }

    const kernel = createCorsKernel([Controller], {
        allowOrigin: ['https://app.example.com'],
        allowMethods: ['GET', 'POST', 'PUT'],
        allowHeaders: ['Content-Type', 'Authorization'],
        exposeHeaders: ['X-Request-Id'],
        credentials: true,
        maxAge: 7200,
    });

    // Regular request
    const response1 = await kernel.request(HttpRequest.POST('/api/full').header('origin', 'https://app.example.com').json({ data: 'test' }));

    expect(response1.statusCode).toBe(200);
    expect(response1.getHeader('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(response1.getHeader('Access-Control-Allow-Credentials')).toBe('true');
    expect(response1.getHeader('Access-Control-Expose-Headers')).toBe('X-Request-Id');
    expect(response1.getHeader('Vary')).toBe('Origin');

    // Preflight request
    const response2 = await kernel.request(HttpRequest.OPTIONS('/api/full').header('origin', 'https://app.example.com').header('access-control-request-method', 'POST').header('access-control-request-headers', 'Content-Type'));

    expect(response2.statusCode).toBe(204);
    expect(response2.getHeader('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(response2.getHeader('Access-Control-Allow-Methods')).toBe('GET, POST, PUT');
    expect(response2.getHeader('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    expect(response2.getHeader('Access-Control-Max-Age')).toBe('7200');
    expect(response2.getHeader('Access-Control-Allow-Credentials')).toBe('true');
});

test('CORS: POST request with body and CORS', async () => {
    class Controller {
        @http.POST('/api/submit')
        submit(body: HttpBody<{ name: string; value: number }>) {
            return { received: body };
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });
    const response = await kernel.request(HttpRequest.POST('/api/submit').header('origin', 'https://example.com').json({ name: 'test', value: 42 }));

    expect(response.statusCode).toBe(200);
    expect(response.json).toEqual({ received: { name: 'test', value: 42 } });
    expect(response.getHeader('Access-Control-Allow-Origin')).toBe('https://example.com');
});

test('CORS: different HTTP methods work with CORS', async () => {
    class Controller {
        @http.GET('/resource')
        get() {
            return 'get';
        }

        @http.POST('/resource')
        post() {
            return 'post';
        }

        @http.PUT('/resource')
        put() {
            return 'put';
        }

        @http.PATCH('/resource')
        patch() {
            return 'patch';
        }

        @http.DELETE('/resource')
        delete() {
            return 'delete';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });
    const origin = 'https://example.com';

    const getResponse = await kernel.request(HttpRequest.GET('/resource').header('origin', origin));
    expect(getResponse.json).toBe('get');
    expect(getResponse.getHeader('Access-Control-Allow-Origin')).toBe(origin);

    const postResponse = await kernel.request(HttpRequest.POST('/resource').header('origin', origin));
    expect(postResponse.json).toBe('post');
    expect(postResponse.getHeader('Access-Control-Allow-Origin')).toBe(origin);

    const putResponse = await kernel.request(HttpRequest.PUT('/resource').header('origin', origin));
    expect(putResponse.json).toBe('put');
    expect(putResponse.getHeader('Access-Control-Allow-Origin')).toBe(origin);

    const patchResponse = await kernel.request(HttpRequest.PATCH('/resource').header('origin', origin));
    expect(patchResponse.json).toBe('patch');
    expect(patchResponse.getHeader('Access-Control-Allow-Origin')).toBe(origin);

    const deleteResponse = await kernel.request(HttpRequest.DELETE('/resource').header('origin', origin));
    expect(deleteResponse.json).toBe('delete');
    expect(deleteResponse.getHeader('Access-Control-Allow-Origin')).toBe(origin);
});

test('CORS: regex matching edge cases', async () => {
    class Controller {
        @http.GET('/test')
        test() {
            return 'ok';
        }
    }

    // Regex that matches subdomains of example.com
    const kernel = createCorsKernel([Controller], { allowOrigin: /^https:\/\/[\w-]+\.example\.com$/ });

    // Valid subdomain
    expect((await kernel.request(HttpRequest.GET('/test').header('origin', 'https://api.example.com'))).getHeader('Access-Control-Allow-Origin')).toBe('https://api.example.com');

    // Hyphenated subdomain
    expect((await kernel.request(HttpRequest.GET('/test').header('origin', 'https://my-app.example.com'))).getHeader('Access-Control-Allow-Origin')).toBe('https://my-app.example.com');

    // Root domain (doesn't match subdomain pattern)
    expect((await kernel.request(HttpRequest.GET('/test').header('origin', 'https://example.com'))).getHeader('Access-Control-Allow-Origin')).toBeUndefined();

    // Different TLD
    expect((await kernel.request(HttpRequest.GET('/test').header('origin', 'https://api.example.org'))).getHeader('Access-Control-Allow-Origin')).toBeUndefined();

    // HTTP instead of HTTPS
    expect((await kernel.request(HttpRequest.GET('/test').header('origin', 'http://api.example.com'))).getHeader('Access-Control-Allow-Origin')).toBeUndefined();
});

test('CORS: origin function with custom lookup', async () => {
    class Controller {
        @http.GET('/test')
        test() {
            return 'ok';
        }
    }

    const allowedOrigins = new Set(['https://app1.com', 'https://app2.com']);

    const kernel = createCorsKernel([Controller], {
        allowOrigin: (origin: string) => {
            // Simulate a lookup
            return allowedOrigins.has(origin);
        },
    });

    expect((await kernel.request(HttpRequest.GET('/test').header('origin', 'https://app1.com'))).getHeader('Access-Control-Allow-Origin')).toBe('https://app1.com');

    expect((await kernel.request(HttpRequest.GET('/test').header('origin', 'https://app2.com'))).getHeader('Access-Control-Allow-Origin')).toBe('https://app2.com');

    expect((await kernel.request(HttpRequest.GET('/test').header('origin', 'https://app3.com'))).getHeader('Access-Control-Allow-Origin')).toBeUndefined();
});

test('CORS: handles concurrent requests correctly', async () => {
    class Controller {
        @http.GET('/concurrent')
        concurrent() {
            return 'ok';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });

    const origins = ['https://origin1.com', 'https://origin2.com', 'https://origin3.com', 'https://origin4.com', 'https://origin5.com'];

    const requests = origins.map(origin =>
        kernel.request(HttpRequest.GET('/concurrent').header('origin', origin)).then(response => ({
            origin,
            receivedOrigin: response.getHeader('Access-Control-Allow-Origin'),
        })),
    );

    const results = await Promise.all(requests);

    for (const result of results) {
        expect(result.receivedOrigin).toBe(result.origin);
    }
});

// ==============================================================================
// 8. Controller-Level CORS
// ==============================================================================

test('CORS: controller-level cors applies to all routes', async () => {
    @(http.controller('/api').cors({ allowOrigin: 'https://controller.com', credentials: true }))
    class Controller {
        @http.GET('/route1')
        route1() {
            return 'route1';
        }

        @http.GET('/route2')
        route2() {
            return 'route2';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });

    // Route 1 uses controller CORS
    const response1 = await kernel.request(HttpRequest.GET('/api/route1').header('origin', 'https://controller.com'));
    expect(response1.statusCode).toBe(200);
    expect(response1.getHeader('Access-Control-Allow-Origin')).toBe('https://controller.com');
    expect(response1.getHeader('Access-Control-Allow-Credentials')).toBe('true');

    // Route 2 uses controller CORS
    const response2 = await kernel.request(HttpRequest.GET('/api/route2').header('origin', 'https://controller.com'));
    expect(response2.statusCode).toBe(200);
    expect(response2.getHeader('Access-Control-Allow-Origin')).toBe('https://controller.com');
    expect(response2.getHeader('Access-Control-Allow-Credentials')).toBe('true');

    // Origin not matching controller CORS - headers removed
    const response3 = await kernel.request(HttpRequest.GET('/api/route1').header('origin', 'https://other.com'));
    expect(response3.statusCode).toBe(200);
    expect(response3.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
});

test('CORS: action cors overrides controller cors', async () => {
    @(http.controller('/api').cors({ allowOrigin: 'https://controller.com' }))
    class Controller {
        @http.GET('/default')
        defaultRoute() {
            return 'default';
        }

        @(http.GET('/override').cors({ allowOrigin: 'https://action.com', exposeHeaders: ['X-Custom'] }))
        overrideRoute() {
            return 'override';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });

    // Default route uses controller CORS
    const response1 = await kernel.request(HttpRequest.GET('/api/default').header('origin', 'https://controller.com'));
    expect(response1.getHeader('Access-Control-Allow-Origin')).toBe('https://controller.com');

    // Override route uses action CORS (different origin)
    const response2 = await kernel.request(HttpRequest.GET('/api/override').header('origin', 'https://action.com'));
    expect(response2.getHeader('Access-Control-Allow-Origin')).toBe('https://action.com');
    expect(response2.getHeader('Access-Control-Expose-Headers')).toBe('X-Custom');

    // Override route rejects controller origin
    const response3 = await kernel.request(HttpRequest.GET('/api/override').header('origin', 'https://controller.com'));
    expect(response3.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
});

test('CORS: controller cors false disables for all routes', async () => {
    @(http.controller('/api').cors(false))
    class Controller {
        @http.GET('/route1')
        route1() {
            return 'route1';
        }

        @http.GET('/route2')
        route2() {
            return 'route2';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });

    // Global CORS is enabled, but controller disables it
    const response1 = await kernel.request(HttpRequest.GET('/api/route1').header('origin', 'https://example.com'));
    expect(response1.statusCode).toBe(200);
    expect(response1.getHeader('Access-Control-Allow-Origin')).toBeUndefined();

    const response2 = await kernel.request(HttpRequest.GET('/api/route2').header('origin', 'https://example.com'));
    expect(response2.statusCode).toBe(200);
    expect(response2.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
});

test('CORS: action cors can re-enable when controller disables', async () => {
    @(http.controller('/api').cors(false))
    class Controller {
        @http.GET('/disabled')
        disabled() {
            return 'disabled';
        }

        @(http.GET('/enabled').cors({ allowOrigin: true }))
        enabled() {
            return 'enabled';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });

    // Route inheriting controller cors: false
    const response1 = await kernel.request(HttpRequest.GET('/api/disabled').header('origin', 'https://example.com'));
    expect(response1.getHeader('Access-Control-Allow-Origin')).toBeUndefined();

    // Route with explicit cors config overrides controller's false
    const response2 = await kernel.request(HttpRequest.GET('/api/enabled').header('origin', 'https://example.com'));
    expect(response2.getHeader('Access-Control-Allow-Origin')).toBe('https://example.com');
});

test('CORS: action cors false overrides controller cors config', async () => {
    @(http.controller('/api').cors({ allowOrigin: true }))
    class Controller {
        @http.GET('/allowed')
        allowed() {
            return 'allowed';
        }

        @(http.GET('/denied').cors(false))
        denied() {
            return 'denied';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });

    // Route inheriting controller CORS
    const response1 = await kernel.request(HttpRequest.GET('/api/allowed').header('origin', 'https://example.com'));
    expect(response1.getHeader('Access-Control-Allow-Origin')).toBe('https://example.com');

    // Route explicitly disabling CORS
    const response2 = await kernel.request(HttpRequest.GET('/api/denied').header('origin', 'https://example.com'));
    expect(response2.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
});

test('CORS: action cors merges with controller cors at registration time', async () => {
    @(http.controller('/api').cors({ allowOrigin: 'https://merged.com', credentials: true }))
    class Controller {
        @(http.GET('/partial').cors({ exposeHeaders: ['X-Custom'] }))
        partialOverride() {
            return 'partial';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: true });

    // Regular request to verify merged config (preflights use global config)
    const response = await kernel.request(HttpRequest.GET('/api/partial').header('origin', 'https://merged.com'));

    expect(response.statusCode).toBe(200);
    // From controller
    expect(response.getHeader('Access-Control-Allow-Origin')).toBe('https://merged.com');
    expect(response.getHeader('Access-Control-Allow-Credentials')).toBe('true');
    // From action (merged)
    expect(response.getHeader('Access-Control-Expose-Headers')).toBe('X-Custom');
});

test('CORS: controller cors decorator stores config correctly', async () => {
    @(http.controller('/api').cors({ allowOrigin: ['https://a.com', 'https://b.com'], credentials: true }))
    class Controller {
        @http.GET('/test')
        test() {
            return 'test';
        }
    }

    const { httpClass } = await import('../src/decorator.js');
    const data = httpClass._fetch(Controller);

    expect(data!.cors).toEqual({ allowOrigin: ['https://a.com', 'https://b.com'], credentials: true });
});

test('CORS: controller without cors decorator uses global config', async () => {
    @http.controller('/api')
    class Controller {
        @http.GET('/test')
        test() {
            return 'test';
        }
    }

    const kernel = createCorsKernel([Controller], { allowOrigin: 'https://global.com' });

    const response = await kernel.request(HttpRequest.GET('/api/test').header('origin', 'https://global.com'));
    expect(response.getHeader('Access-Control-Allow-Origin')).toBe('https://global.com');
});

test('CORS: multiple controllers with different cors configs', async () => {
    @(http.controller('/public').cors({ allowOrigin: '*' }))
    class PublicController {
        @http.GET('/data')
        data() {
            return 'public';
        }
    }

    @(http.controller('/private').cors({ allowOrigin: 'https://internal.com', credentials: true }))
    class PrivateController {
        @http.GET('/data')
        data() {
            return 'private';
        }
    }

    const kernel = createCorsKernel([PublicController, PrivateController], { allowOrigin: true });

    // Public controller allows any origin
    const publicResponse = await kernel.request(HttpRequest.GET('/public/data').header('origin', 'https://any.com'));
    expect(publicResponse.getHeader('Access-Control-Allow-Origin')).toBe('*');

    // Private controller only allows specific origin
    const privateResponse1 = await kernel.request(HttpRequest.GET('/private/data').header('origin', 'https://internal.com'));
    expect(privateResponse1.getHeader('Access-Control-Allow-Origin')).toBe('https://internal.com');
    expect(privateResponse1.getHeader('Access-Control-Allow-Credentials')).toBe('true');

    // Private controller rejects other origins
    const privateResponse2 = await kernel.request(HttpRequest.GET('/private/data').header('origin', 'https://other.com'));
    expect(privateResponse2.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
});
