# Issue #653: HttpHeader case-insensitive in TestingFacade

## Problem

HTTP headers should be case-insensitive per RFC 7230, but `HttpHeader<T>` parameter extraction was case-sensitive when using `TestingFacade`.

```typescript
@http.POST('/test')
async test(authorization: HttpHeader<string>) {
    return authorization;
}

// This worked:
HttpRequest.POST('/test').header('authorization', 'token')

// This didn't work:
HttpRequest.POST('/test').header('Authorization', 'token')  // returned undefined
```

## Root Cause

1. Node.js's `IncomingMessage` automatically lowercases all header names
2. `RequestBuilder.header()` stored headers exactly as provided (no lowercasing)
3. The request-parser looked up headers using lowercase parameter names
4. Test requests and real HTTP requests behaved differently

## Fix

Two changes were made:

1. **`packages/http/src/model.ts`**: `RequestBuilder.header()` and `RequestBuilder.headers()` now lowercase header names to match Node.js behavior

2. **`packages/http/src/request-parser.ts`**: Custom header name lookups (via `{ name: 'X-Custom-Header' }`) are also lowercased

## Test

Added regression test `parameter from header is case-insensitive` in `packages/http/tests/router.spec.ts`
