# HTTP Package Errors

## DK-H001: HTTP Error (Base)

**Message:** Custom message provided by subclass

**Causes:**
- This is the base error class for all HTTP-related errors
- Thrown when a custom HTTP error needs to be created with a specific status code

**Solution:**
Use one of the predefined HTTP error classes (e.g., `HttpNotFoundError`, `HttpBadRequestError`) or create a custom error extending `HttpError` with an appropriate status code.

**Note:** HTTP status code errors (400, 401, 403, 404, 500, etc.) use the standard HTTP status codes directly via the `httpCode` property. No separate Deepkit error codes are needed since HTTP status codes are universally understood.

---

## DK-H002: Async HttpBody Not Supported

**Message:** Listener {listenerName} requires async HttpBody. This is not yet supported. You have to parse the request manually by injecting HttpRequest.

**Causes:**
- An event listener parameter uses `HttpBody` type annotation which requires async parsing
- The DI container for listeners is synchronous and cannot handle async body parsing

**Solution:**
Instead of using `HttpBody` in your listener, inject `HttpRequest` directly and parse the body manually:

```typescript
@eventDispatcher.listen(HttpWorkflowEvent)
onRequest(event: HttpWorkflowEvent, request: HttpRequest) {
    // Parse body manually from request
    const body = await parseBody(request);
}
```

---

## DK-H003: Action Not Found

**Message:** No action with methodName {methodName} found

**Causes:**
- Calling `getAction()` on an `HttpController` with a method name that does not exist
- The method was not decorated with an HTTP method decorator (`@http.GET()`, `@http.POST()`, etc.)

**Solution:**
Ensure the method exists on the controller and is decorated with an HTTP method decorator:

```typescript
class MyController {
    @http.GET('/path')
    myAction() { /* ... */ }
}
```

---

## DK-H004: Route Parameter Not Defined

**Message:** No route parameter with name {name} defined.

**Causes:**
- Requesting a route parameter by name that does not exist in the route path
- Mismatch between the path parameters and controller method parameters

**Solution:**
Ensure the parameter name in your route path matches the parameter you are trying to access:

```typescript
@http.GET('/users/:userId')
getUser(userId: string) { /* ... */ }
```

---

## DK-H005: No HttpAction Available

**Message:** No HttpAction available

**Causes:**
- Using `router.add()` with a decorator that does not produce an `HttpAction`
- The decorator passed to `router.add()` is invalid or improperly configured

**Solution:**
Ensure you are using a valid HTTP decorator when calling `router.add()`:

```typescript
router.add(http.GET('/path'), (request) => {
    return 'response';
});
```

---

## DK-H006: Missing @http.controller Decorator

**Message:** Http controller class {className} has no @http.controller decorator.

**Causes:**
- Registering a controller class that lacks the `@http.controller()` decorator
- Forgetting to add the decorator when creating a new controller

**Solution:**
Add the `@http.controller()` decorator to your controller class:

```typescript
@http.controller('/api')
class MyController {
    @http.GET('/users')
    getUsers() { /* ... */ }
}
```

---

## DK-H007: Route Not Found by Name

**Message:** No route for name {name} found

**Causes:**
- Calling `router.resolveUrl()` with a route name that does not exist
- The route was not given a name, or the name was misspelled

**Solution:**
Ensure the route has a name defined and use that exact name:

```typescript
@http.GET('/users/:id').name('user.get')
getUser(id: string) { /* ... */ }

// Later:
const url = router.resolveUrl('user.get', { id: '123' });
```

---

## DK-H008: Invalid Multipart Item

**Message:** Invalid multiPart item

**Causes:**
- Providing an invalid item when building a multipart request
- The multipart item is neither a file nor a valid form field

**Solution:**
Ensure multipart items are properly structured with either file data or string values for form fields.

---

## DK-H009: JSON Parse Error

**Message:** Could not parse JSON: {errorMessage}, body: {body}

**Causes:**
- The request body contains invalid JSON syntax
- The body is empty when JSON was expected
- Character encoding issues in the request body

**Solution:**
- Verify the request body contains valid JSON
- Check the `Content-Type` header is set to `application/json`
- Ensure the client is sending properly formatted JSON

---

## DK-H010: No Property Value at Type

**Message:** No property value found at {type}

**Causes:**
- Using body validation with a type that lacks a `value` property
- The validation wrapper class is incorrectly defined

**Solution:**
When using body validation, ensure your type has a `value` property:

```typescript
class BodyValidation<T> {
    value!: T;
}
```

---

## DK-H011: Parameter Has No Runtime Type

**Message:** Parameter {routeLabel}{parameterName} has no runtime type. Runtime types disabled or circular dependencies?

**Causes:**
- The parameter type has no runtime type information available
- Runtime type reflection is disabled for this file/class
- Circular dependencies prevent type compilation
- The type-compiler was not run or failed for this file

**Solution:**
- Ensure `@deepkit/type-compiler` is properly configured and running
- Check for circular dependencies between modules
- Verify the file does not have `/** @reflection never */` annotation
- Run `npm run postinstall` to rebuild type metadata
