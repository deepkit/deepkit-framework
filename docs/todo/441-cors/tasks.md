# Implementation Tasks for #441 CORS Support

## Phase 1: Configuration

### Task 1.1: Add CorsOptions interface
**File:** `packages/http/src/module.config.ts`

```typescript
// Add after HttpParserOptions interface (~line 91)

export interface CorsOptions {
    allowOrigin: boolean | '*' | string | string[] | RegExp | ((origin: string) => boolean | string);
    allowMethods?: string[];
    allowHeaders?: string[] | true;
    exposeHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
}
```

### Task 1.2: Add cors field to HttpConfig
**File:** `packages/http/src/module.config.ts`

```typescript
// Add to HttpConfig class (~line 168)
cors?: CorsOptions;
```

## Phase 2: Core Listener Implementation

### Task 2.1: Create CorsListener class
**File:** `packages/http/src/cors.ts` (NEW)

Key implementation points:
1. Inject `HttpConfig` and `LoggerInterface` in constructor (singleton, cached)
2. Cache `corsConfig` and `debug` flag as instance properties
3. Listen on `httpWorkflow.onRequest` with priority **50** (before HttpListener at 100)
4. Fast early-exit paths for:
   - No cors config
   - No origin header
   - Origin not allowed (log if debug enabled, then return without setting headers)
5. Set headers via `response.setHeader()` (persists through workflow)
6. For OPTIONS preflight: `response.writeHead(204); response.end();` and return (no `event.next()`)

### Task 2.2: Origin resolution logic
**File:** `packages/http/src/cors.ts`

```typescript
private resolveOrigin(origin: string): string | false {
    const opt = this.corsConfig!.allowOrigin;

    // Fast paths first
    if (opt === true) return origin;  // Reflect
    if (opt === '*') {
        // Cannot use '*' with credentials
        return this.corsConfig!.credentials ? origin : '*';
    }
    if (typeof opt === 'string') return opt === origin ? origin : false;
    if (Array.isArray(opt)) return opt.includes(origin) ? origin : false;
    if (opt instanceof RegExp) return opt.test(origin) ? origin : false;
    if (typeof opt === 'function') {
        const result = opt(origin);
        if (typeof result === 'string') return result;
        return result ? origin : false;
    }
    return false;
}
```

## Phase 3: Per-Route Decorator

### Task 3.1: Add cors() method to HttpActionDecorator
**File:** `packages/http/src/decorator.ts`

```typescript
// Add to HttpActionDecorator class (after line ~284)
cors(config: Partial<CorsOptions> | false) {
    this.t.data.set('cors', config);
}
```

### Task 3.2: Handle per-route CORS in listener
**File:** `packages/http/src/cors.ts`

Add second listener for route-level overrides:

```typescript
@eventDispatcher.listen(httpWorkflow.onRoute, 50)
onRoute(event: typeof httpWorkflow.onRoute.event): void {
    if (!event.route) return;

    const routeCors = event.route.data.get('cors');

    // Route explicitly disabled CORS
    if (routeCors === false) {
        // Remove headers set in onRequest
        event.response.removeHeader('Access-Control-Allow-Origin');
        event.response.removeHeader('Access-Control-Allow-Credentials');
        event.response.removeHeader('Access-Control-Expose-Headers');
        event.response.removeHeader('Vary');
        return;
    }

    // Route has custom config - merge with global
    if (routeCors && typeof routeCors === 'object') {
        const origin = event.request.headers.origin;
        if (!origin) return;

        const merged = { ...this.corsConfig, ...routeCors };
        const allowedOrigin = this.resolveOriginWithConfig(origin, merged);
        if (allowedOrigin) {
            this.setCorsHeadersWithConfig(event.response, allowedOrigin, merged);
        }
    }
}
```

## Phase 4: Module Registration

### Task 4.1: Register CorsListener conditionally
**File:** `packages/http/src/module.ts`

```typescript
// In process() method
process() {
    this.addProvider({ provide: HttpControllers, useValue: this.httpControllers });

    // Register CORS listener if configured
    if (this.config.cors) {
        this.addListener(CorsListener);
    }
}
```

### Task 4.2: Add imports
**File:** `packages/http/src/module.ts`

```typescript
import { CorsListener } from './cors.js';
```

## Phase 5: Exports

### Task 5.1: Export from index
**File:** `packages/http/src/index.ts`

```typescript
export { CorsOptions } from './module.config.js';
export { CorsListener } from './cors.js';
```

## Phase 6: Tests

### Task 6.1: Create test file
**File:** `packages/http/tests/cors.spec.ts` (NEW)

Test categories:
1. **Disabled CORS** - no config, no headers
2. **Origin validation** - string, array, regex, function
3. **Preflight handling** - OPTIONS returns 204
4. **Header setting** - all CORS headers correct
5. **Credentials** - correct behavior with credentials
6. **Per-route** - decorator overrides work
7. **Performance** - early exit is fast

### Task 6.2: Test utilities
Use existing test helpers from `packages/http/tests/utils.ts`:

```typescript
import { createHttpKernel } from './utils.js';

const kernel = createHttpKernel([Controller], [], [], [], []);
const response = await kernel.request(HttpRequest.GET('/path').header('origin', 'http://example.com'));
```

## Phase 7: Verification

### Task 7.1: Type check
```bash
npm run tsc
```

### Task 7.2: Run HTTP tests
```bash
npm run test packages/http/
```

### Task 7.3: Run specific CORS tests
```bash
node --expose-gc --max_old_space_size=3048 node_modules/jest/bin/jest.js packages/http/tests/cors.spec.ts
```

## Implementation Order

1. [ ] Task 1.1 - CorsOptions interface
2. [ ] Task 1.2 - HttpConfig.cors field
3. [ ] Task 2.1 - CorsListener class (basic)
4. [ ] Task 2.2 - Origin resolution
5. [ ] Task 4.1 - Module registration
6. [ ] Task 4.2 - Imports
7. [ ] Task 5.1 - Exports
8. [ ] Task 6.1 - Basic tests (verify it works)
9. [ ] Task 3.1 - Per-route decorator
10. [ ] Task 3.2 - Route-level handling
11. [ ] Task 6.2 - Full test suite
12. [ ] Task 7.x - Verification

## Performance Checklist

- [ ] No allocations in early-exit path
- [ ] Config cached in constructor (not per-request lookup)
- [ ] String comparisons use `===` not `.includes()` for single origin
- [ ] Regex compiled once (in config), not per-request
- [ ] Headers set via `setHeader()` not `writeHead()` until final response

## Edge Cases to Handle

1. **No Origin header** → Same-origin request, skip CORS entirely
2. **Origin not allowed** → Don't set any CORS headers, log if debug enabled (browser will block based on missing header)
3. **OPTIONS without Origin header** → Not a CORS preflight, route normally to user handler or 404
4. **Credentials + wildcard** → Reflect origin instead of '*' (spec requirement)
5. **Multiple Vary headers** → Append 'Origin', don't replace existing Vary
6. **Route disables CORS** → Remove headers set in onRequest
7. **Preflight with disallowed origin** → Return early without headers, let normal routing handle OPTIONS
