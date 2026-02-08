# Issue #441: CORS Support

**Status:** ✅ Complete - Implementation merged
**Package:** @deepkit/http
**Priority:** Enhancement
**Created:** 2023-04-15
**GitHub:** https://github.com/deepkit/deepkit-framework/issues/441

## Summary

Add built-in CORS (Cross-Origin Resource Sharing) support to `@deepkit/http` via configuration and per-route decorators, using the event listener system (not middleware).

## Requirements

From issue and maintainer feedback:
1. Configuration-driven via `HttpConfig.cors`
2. Per-route overrides via `@http.cors()` decorator
3. Must be **extremely fast** with zero overhead for non-CORS requests
4. Use event listeners, NOT middleware (middleware is being deprecated)
5. CORS must run BEFORE authentication

## Architecture Decision

### Why Event Listeners (Not Middleware)

1. **Middleware is being deprecated** - hacky/slow implementation
2. **JIT-compiled workflow** - listeners are compiled into a single function
3. **Priority ordering** - clean control over execution order
4. **Early exit** - `return` from listener costs ~5ns, no callback chains
5. **Native integration** - follows existing `HttpListener` patterns

### Performance Analysis

From sub-agent analysis of the workflow system:

| Scenario | Overhead |
|----------|----------|
| Non-CORS request (early return) | ~5 nanoseconds |
| CORS preflight (OPTIONS) | ~1-10 microseconds |
| Normal request with Origin header | ~100 nanoseconds |

**Why so fast:**
- Workflow is JIT-compiled via `CompilerContext`
- Listeners are inlined into a single async function
- No function call overhead after compilation
- Early return = single branch instruction

## Design

### 1. Configuration Interface

```typescript
// packages/http/src/module.config.ts

export interface CorsOptions {
    /**
     * Allowed origins. Can be:
     * - true: reflect request Origin (echo back)
     * - '*': literal wildcard (cannot use with credentials)
     * - string: exact origin match
     * - string[]: list of allowed origins
     * - RegExp: pattern match against origin
     * - (origin: string) => boolean | string: custom function
     *
     * @default false (CORS disabled)
     */
    allowOrigin: boolean | '*' | string | string[] | RegExp | ((origin: string) => boolean | string);

    /**
     * Allowed HTTP methods for preflight.
     * @default ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']
     */
    allowMethods?: string[];

    /**
     * Allowed headers.
     * - true: reflect Access-Control-Request-Headers
     * - string[]: explicit list
     * @default true
     */
    allowHeaders?: string[] | true;

    /**
     * Headers exposed to the browser.
     */
    exposeHeaders?: string[];

    /**
     * Allow credentials (cookies, auth headers).
     * Cannot be used with allowOrigin: '*'
     * @default false
     */
    credentials?: boolean;

    /**
     * Preflight cache duration in seconds.
     * @default 86400 (24 hours)
     */
    maxAge?: number;
}

export class HttpConfig {
    // ... existing fields ...

    /**
     * CORS configuration. Disabled by default.
     * Set to enable cross-origin requests.
     */
    cors?: CorsOptions;
}
```

### 2. Event Listener Implementation

```typescript
// packages/http/src/cors.ts

export class CorsListener {
    // Cached config - injected once at startup, zero per-request overhead
    private readonly corsConfig?: CorsOptions;
    private readonly debug: boolean;

    constructor(
        private config: HttpConfig,
        private logger: LoggerInterface,
    ) {
        this.corsConfig = config.cors;
        this.debug = config.debug;
    }

    /**
     * Priority 50: runs BEFORE HttpListener (100) and auth
     * This ensures CORS headers are set before any other processing
     */
    @eventDispatcher.listen(httpWorkflow.onRequest, 50)
    onRequest(event: typeof httpWorkflow.onRequest.event): void {
        // Fast path: no CORS config = immediate return (~1ns)
        if (!this.corsConfig) return;

        // Fast path: no Origin header = same-origin request (~2ns)
        const origin = event.request.headers.origin;
        if (!origin) return;

        const allowedOrigin = this.resolveOrigin(origin);
        if (!allowedOrigin) {
            // Origin not allowed - don't set any CORS headers
            // Browser will block based on missing Access-Control-Allow-Origin
            if (this.debug) {
                this.logger.debug(`CORS: Origin "${origin}" not in allowed list`);
            }
            return;
        }

        // Set CORS headers on response
        this.setCorsHeaders(event.response, allowedOrigin);

        // Handle preflight (OPTIONS)
        if (event.request.method === 'OPTIONS') {
            this.handlePreflight(event);
        }
    }

    private resolveOrigin(origin: string): string | false {
        // ... origin resolution logic
    }

    private setCorsHeaders(response: HttpResponse, origin: string): void {
        response.setHeader('Access-Control-Allow-Origin', origin);
        if (this.corsConfig!.credentials) {
            response.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        if (origin !== '*') {
            response.setHeader('Vary', 'Origin');
        }
        if (this.corsConfig!.exposeHeaders?.length) {
            response.setHeader('Access-Control-Expose-Headers',
                this.corsConfig!.exposeHeaders.join(', '));
        }
    }

    private handlePreflight(event: typeof httpWorkflow.onRequest.event): void {
        const response = event.response;
        const cors = this.corsConfig!;

        // Set preflight headers
        response.setHeader('Access-Control-Allow-Methods',
            (cors.allowMethods ?? ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']).join(', '));

        const requestHeaders = event.request.headers['access-control-request-headers'];
        const allowHeaders = cors.allowHeaders === true
            ? requestHeaders || ''
            : (cors.allowHeaders ?? []).join(', ');
        if (allowHeaders) {
            response.setHeader('Access-Control-Allow-Headers', allowHeaders);
        }

        response.setHeader('Access-Control-Max-Age', String(cors.maxAge ?? 86400));

        // Send 204 No Content - workflow stops here
        response.writeHead(204);
        response.end();
        // Note: NO event.next() - workflow exits after this listener
    }
}
```

### 3. Per-Route Decorator

```typescript
// packages/http/src/decorator.ts

// In HttpActionDecorator class:
cors(config: Partial<CorsOptions> | false) {
    this.t.data.set('cors', config);
}

// Usage:
class Controller {
    @http.GET('/public').cors({ allowOrigin: '*' })
    publicEndpoint() {}

    @http.GET('/private').cors(false)  // Disable CORS for this route
    privateEndpoint() {}
}
```

### 4. Route-Level CORS Resolution

The listener needs to check for per-route overrides. This happens in `onRoute` (after routing):

```typescript
@eventDispatcher.listen(httpWorkflow.onRoute, 50)
onRoute(event: typeof httpWorkflow.onRoute.event): void {
    if (!event.route) return;

    const routeCors = event.route.data.get('cors');
    if (routeCors === false) {
        // Route explicitly disabled CORS - remove headers if set
        // (headers set in onRequest)
        return;
    }

    if (routeCors) {
        // Route has custom CORS config - override global
        // Re-apply headers with route-specific config
    }
}
```

### 5. Module Registration

```typescript
// packages/http/src/module.ts

export class HttpModule extends createModuleClass({
    config: HttpConfig,
    providers: [/* ... */],
    listeners: [HttpListener],  // CorsListener added conditionally
    // ...
}) {
    process() {
        this.addProvider({ provide: HttpControllers, useValue: this.httpControllers });

        // Only register CorsListener if CORS is configured
        if (this.config.cors) {
            this.addListener(CorsListener);
        }
    }
}
```

## Execution Flow

### Non-CORS Request (Happy Path)
```
Request arrives
  ↓
httpWorkflow.onRequest (priority 50) - CorsListener
  ├─ Check: this.corsConfig? → yes
  ├─ Check: origin header? → NO
  └─ return (cost: ~5ns)
  ↓
httpWorkflow.onRequest (priority 100) - HttpListener
  └─ event.next('route', ...)
  ↓
Normal request processing...
```

### CORS Preflight Request
```
OPTIONS /api/users (with Origin header)
  ↓
httpWorkflow.onRequest (priority 50) - CorsListener
  ├─ Check: this.corsConfig? → yes
  ├─ Check: origin header? → yes
  ├─ resolveOrigin() → allowed
  ├─ setCorsHeaders()
  ├─ Check: method === 'OPTIONS'? → yes
  ├─ handlePreflight()
  │   ├─ Set preflight headers
  │   ├─ response.writeHead(204)
  │   └─ response.end()
  └─ return (NO event.next())
  ↓
Workflow exits - no routing, no auth, no controller
```

### Normal CORS Request
```
GET /api/users (with Origin header)
  ↓
httpWorkflow.onRequest (priority 50) - CorsListener
  ├─ Check: origin header? → yes
  ├─ resolveOrigin() → allowed
  ├─ setCorsHeaders() → headers queued
  └─ return (NOT a preflight)
  ↓
httpWorkflow.onRequest (priority 100) - HttpListener
  └─ event.next('route', ...)
  ↓
Normal processing with CORS headers already set
```

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/http/src/cors.ts` | **Create** | CorsListener class |
| `packages/http/src/module.config.ts` | **Modify** | Add CorsOptions interface, cors field |
| `packages/http/src/module.ts` | **Modify** | Conditional CorsListener registration |
| `packages/http/src/decorator.ts` | **Modify** | Add .cors() method to HttpActionDecorator |
| `packages/http/src/index.ts` | **Modify** | Export CorsOptions, CorsListener |
| `packages/http/tests/cors.spec.ts` | **Create** | Comprehensive tests |

## Test Plan

### Unit Tests
- [ ] No CORS config → no headers added
- [ ] CORS disabled globally → no headers
- [ ] Origin not in allowlist → no headers
- [ ] Origin matches string → headers added
- [ ] Origin matches array → headers added
- [ ] Origin matches regex → headers added
- [ ] Origin matches function → headers added
- [ ] `allowOrigin: true` → reflects origin
- [ ] `allowOrigin: '*'` → literal asterisk
- [ ] `credentials: true` → adds credential header
- [ ] `credentials: true` with `'*'` → reflects origin (not asterisk)
- [ ] `exposeHeaders` → added to response
- [ ] Preflight OPTIONS → 204 with all headers
- [ ] Preflight caching → Max-Age header
- [ ] `allowHeaders: true` → reflects request headers
- [ ] `allowHeaders: ['X-Custom']` → explicit list

### Per-Route Tests
- [ ] `@http.cors({...})` overrides global
- [ ] `@http.cors(false)` disables for route
- [ ] Route without decorator uses global

### Integration Tests
- [ ] Full request cycle with CORS
- [ ] Preflight + actual request sequence
- [ ] Multiple origins in array
- [ ] Regex origin matching

### Performance Tests
- [ ] Non-CORS request overhead < 100ns
- [ ] Preflight response < 1ms

## Security Considerations

1. **Credentials + Wildcard**: Cannot use `Access-Control-Allow-Origin: *` with credentials - must reflect origin
2. **Origin Validation**: Always validate origin before reflecting to prevent header injection
3. **Default Secure**: CORS disabled by default
4. **Preflight Caching**: Default 24h is reasonable, configurable

## Usage Examples

### Development (Permissive)
```typescript
new FrameworkModule({
    http: {
        cors: { allowOrigin: true }  // Reflect any origin
    }
})
```

### Production (Specific Origins)
```typescript
http: {
    cors: {
        allowOrigin: ['https://app.example.com', 'https://admin.example.com'],
        credentials: true,
        exposeHeaders: ['X-Request-Id'],
        maxAge: 3600
    }
}
```

### Pattern Matching
```typescript
http: {
    cors: {
        allowOrigin: /\.example\.com$/,
        allowMethods: ['GET', 'POST'],
        credentials: true
    }
}
```

### Per-Route Override
```typescript
class ApiController {
    @http.GET('/public')
    @http.cors({ allowOrigin: '*' })
    publicData() { return { status: 'ok' }; }

    @http.GET('/internal')
    @http.cors(false)
    internalOnly() { return { secret: '...' }; }
}
```

## Resolved Questions

1. ~~Should CORS run before or after auth?~~ **BEFORE** (confirmed)
2. ~~Middleware or event listener?~~ **Event listener** (confirmed)
3. ~~Config property name?~~ **`cors`** (confirmed)
4. ~~Should we add a `CorsError` for debugging rejected origins?~~ **No** - use existing `HttpConfig.debug` flag with logger
5. ~~Should preflight failures (origin not allowed) return 204 or 403?~~ **Neither** - simply don't set CORS headers, let request proceed normally. Browser blocks based on missing headers (this is the standard behavior).

## References

- [MDN CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Fetch Spec - CORS Protocol](https://fetch.spec.whatwg.org/#cors-protocol)
- [W3C CORS Recommendation](https://www.w3.org/TR/cors/)
