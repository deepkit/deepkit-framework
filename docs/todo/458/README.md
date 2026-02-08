# Issue #458: Cannot have body parameter in controller defined in separate file

**Status:** Already Fixed
**Package:** @deepkit/http
**Type:** Bug (resolved)

## Summary

The reported issue was that controllers with `HttpBody<any>` parameters defined in separate files would fail with `_context` being empty.

Investigation and reproduction tests show this issue has been fixed. All variations of `HttpBody<T>` work correctly when the controller is in a separate file:
- `HttpBody<any>`
- `HttpBody<interface>`
- `HttpBody<class>`
- `HttpBody<inline type>`

## Changes

Added regression tests to prevent future regressions:
1. `packages/http/tests/fixtures/body-controller.ts` - controller in separate file
2. `packages/http/tests/separate-file-controller.spec.ts` - 5 regression tests

## Testing

- All 120 HTTP package tests pass
- New regression tests verify separate-file controllers work
