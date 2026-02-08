# Framework Errors

## DK-F002: Invalid Join Field

**Message:** Join '{field}' does not exist

**Causes:**
- The join field name specified in the CRUD query does not exist on the entity schema
- Typo in the join field name
- The field exists but is not a reference or back-reference relation

**Solution:**
Verify the field name matches a property on your entity that has a relation defined. Use `@entity.reference()` or back-reference decorators to define relations.

---

## DK-F003: Missing Entity Name

**Message:** Class {className} needs an entity name via @entity.name()

**Causes:**
- Using AutoCrud with an entity class that has no entity name defined
- The `@entity.name()` decorator is missing from the class

**Solution:**
Add the `@entity.name()` decorator to your entity class:

```typescript
@entity.name('user')
class User {
    // ...
}
```

---

## DK-F004: Invalid Sort Field

**Message:** Can not order by '{field}' since it does not exist.

**Causes:**
- The sort/order field specified in a list query does not exist on the entity
- Attempting to sort by a field that is a reference or back-reference (not allowed by default)
- Typo in the field name

**Solution:**
Use only scalar fields that exist on the entity for sorting. If you need to allow specific fields, configure `sortFields` in your AutoCrud options.

---

## DK-F006: HTTP Worker Not Started

**Message:** HTTP worker not started

**Causes:**
- Calling `getHttpWorker()` before the ApplicationServer has started
- The server startup failed before the HTTP worker was initialized

**Solution:**
Ensure you call `await server.start()` before accessing the HTTP worker. Check for any startup errors that may have prevented the worker from initializing.

---

## DK-F007: Server Already Started

**Message:** ApplicationServer already started

**Causes:**
- Calling `start()` on an ApplicationServer instance that is already running
- Attempting to restart a server without properly stopping it first

**Solution:**
Only call `start()` once per ApplicationServer instance. If you need to restart, create a new ApplicationServer instance or ensure the previous one has fully stopped.

---

## DK-F008: WebWorker Not Registered

**Message:** No WebWorker registered yet. Did you start()?

**Causes:**
- Calling `getWorker()` before the server has started
- The start process has not completed yet

**Solution:**
Ensure you await the `start()` method before calling `getWorker()`:

```typescript
const server = new WebWorkerFactory(...);
await server.start();
const worker = server.getWorker();
```

---

## DK-F009: Duplicate RPC Controller

**Message:** Already an RPC controller with the name {path} registered.

**Causes:**
- Registering two RPC controllers with the same path
- Importing the same RPC controller module multiple times
- Conflicting RPC controller configurations across modules

**Solution:**
Ensure each RPC controller has a unique path. Check your module imports to ensure controllers are not registered multiple times. Use different paths for each controller.

---

## DK-F010: Database Not Found

**Message:** No database {dbName} found

**Causes:**
- Referencing a database name that was not registered with the application
- Typo in the database name
- The database module was not imported or configured

**Solution:**
Verify the database is properly registered in your application configuration. Check the database name matches exactly (case-sensitive). Ensure the database module is imported:

```typescript
new App({
    imports: [new DatabaseModule(database)]
})
```

---

## DK-F011: Entity Not Found

**Message:** No entity {entityName} in database {dbName}

**Causes:**
- The entity is not registered with the specified database
- Typo in the entity name
- The entity was registered with a different database

**Solution:**
Ensure the entity is added to the database's entity list:

```typescript
const database = new Database(adapter, [User, Post, Comment]);
```

Check that you are querying the correct database if you have multiple databases configured.
