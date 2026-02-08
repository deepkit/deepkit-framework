# Investigation Notes - Issue #395

## 2026-01-19: Initial Investigation

### Findings

1. The `createCrudRoutes()` function creates dynamic route paths using the identifier name
2. Three methods affected: `read`, `update`, `delete` (lines 245, 259, 278)
3. The filter logic correctly uses `identifier.name` but the parameter binding fails

### Code Analysis

```typescript
// Line 148 - correctly gets identifier
const identifier = options.identifier ? schema.getProperty(options.identifier) : schema.getPrimary();

// Line 259 - route path is correct
@http.GET(':' + identifier.name)  // becomes :username

// BUT method parameter is hardcoded as 'id'
async read(id: IdentifierType, ...) {
    // HTTP framework can't map :username -> id
}
```

### Solution Options

**Option A**: Use HttpPathParameter decorator to explicitly bind the parameter
- Add `HttpPathParameter<IdentifierType, identifier.name>` to bind dynamically

**Option B**: Generate methods with correct parameter names dynamically
- More complex, TypeScript doesn't support dynamic parameter names

**Chosen**: Option A - cleaner and maintains type safety
