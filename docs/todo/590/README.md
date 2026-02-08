# Issue #590: HTTP middleware ending response results in no log entry

## Problem

When middleware calls `response.end()` without calling `next()`, the HTTP request is not logged.

```typescript
export class AuthenticationMiddleware implements HttpMiddleware {
    async execute(request: HttpRequest, response: HttpResponse, next: (err?: unknown) => void) {
        response.statusCode = 403;
        response.end();  // No log entry created!
    }
}
```

## Root Cause

1. HTTP logging happens via `HttpLogger` which listens to `httpWorkflow.onResponse` event
2. When middleware sends response early, the workflow stayed at `route` state
3. The `onResponse` event was never dispatched because the workflow never reached `response` state
4. Result: no logging for requests handled by middleware

## Fix

Two changes:

1. **`packages/http/src/http.ts` (line 321)**: Added `response` as valid transition from `route` state
   - `route: ['auth', 'routeNotFound', 'response']`

2. **`packages/http/src/http.ts` (lines 622-626)**: After middleware execution, check if response was sent
   - If `event.sent` is true, transition directly to `response` state for logging/cleanup

## Test

Added test `middleware direct response triggers onResponse event for logging` in `packages/http/tests/middleware.spec.ts`
