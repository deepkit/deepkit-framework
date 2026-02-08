# Issue #395: Custom identifier in CRUD routes

**GitHub**: https://github.com/deepkit/deepkit-framework/issues/395
**Package**: @deepkit/framework
**Created**: 2023-04-13
**Status**: In Progress

## Problem

When using `createCrudRoutes()` with a custom identifier field (e.g., `identifier: 'username'`), the API routes fail with:

```
[ERROR] Controller parameter resolving error: Error: Invalid get<T> argument given undefined
```

- `GET /entity/user` works (lists all users)
- `GET /entity/user/test2` fails with 500 error (query by custom identifier)

## Root Cause

In `/packages/framework/src/crud.ts`:

1. Route paths are correctly dynamic: `@http.GET(':' + identifier.name)` → `:username`
2. **BUT** method parameters are hardcoded as `id`:
   ```typescript
   async read(id: IdentifierType, ...) {
       // Route expects 'username' param, method has 'id' param
   }
   ```

The HTTP framework can't match the path parameter `:username` to method parameter `id`.

## Fix Strategy

Use `HttpPathParameter<IdentifierType>` with the dynamic identifier name to properly bind the path parameter to the method parameter, regardless of what the parameter is named in the route path.

## Files to Modify

- `/packages/framework/src/crud.ts` - Lines 245, 259, 278 (read, update, delete methods)

## Testing

- Test with default identifier (primary key) - must not regress
- Test with custom string identifier
- Test with custom numeric identifier
