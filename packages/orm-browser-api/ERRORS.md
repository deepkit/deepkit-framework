# ORM Browser API Errors

## DK-OBA001: Entity type not found

**Message:** No type for {name} found

**Causes:**
- Requesting an entity by name that is not registered with any database in the ORM browser
- Typo in the entity name when querying through the ORM browser interface
- The entity class exists but was not included in the database schema configuration
- The database containing the entity was not added to the ORM browser module

**Solution:**
1. Verify the entity name matches exactly (case-sensitive) what was defined in your entity class
2. Ensure the entity is decorated with `@entity.name('your-entity-name')` or has a class name that matches
3. Check that the database containing this entity is registered with `DatabaseRegistry`
4. Confirm the database is included in the ORM browser module configuration:

```typescript
new App({
    imports: [
        new OrmBrowserModule({
            databases: [MyDatabase]
        })
    ]
})
```

---
