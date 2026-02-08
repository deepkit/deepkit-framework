# App Errors

## DK-A001: Configuration Invalid

**Message:** Configuration for module {moduleName} is invalid. Make sure the module is correctly configured. Error: {validationErrors}

**Causes:**
- Required configuration options are missing
- Configuration values fail type validation
- Invalid value types (e.g., string where number expected)
- Values outside allowed ranges or patterns

**Solution:**
Review the module's configuration class and ensure all required properties are set with valid values. Check the validation error details for specific fields that failed validation. Use environment variables, `.env` files, or `configure()` to provide correct values.

---

## DK-A002: Config Option Not Found

**Message:** Config option {name} not found.

**Causes:**
- Requesting a configuration option that does not exist
- Typo in the configuration option name
- Option not set in environment or .env file

**Solution:**
Verify the configuration option name exists in your configuration class. Check that the option is set via `process.env`, manually via `set()`, or loaded from an `.env` file. Use `getKeys()` to list available options.

---

## DK-A003: CLI Value Required

**Message:** Value is required

**Causes:**
- A required CLI argument or flag was not provided
- Missing positional argument in command invocation
- Required flag omitted without default value

**Solution:**
Provide the required argument when invoking the CLI command. Check the command's help output for required parameters. If the parameter should be optional, mark it as optional in the command definition using TypeScript's optional syntax (`?`) or provide a default value.

---

## DK-A004: Invalid JSON Config

**Message:** Invalid JSON in env variable {variableName}. Parse error: {error}

**Causes:**
- Malformed JSON in the configuration environment variable
- Missing quotes around strings
- Trailing commas in JSON
- Unescaped special characters

**Solution:**
Validate your JSON configuration string. Ensure it is valid JSON format:
```bash
APP_CONFIG='{"databaseUrl": "mongodb://localhost/mydb", "debug": true}'
```
Use a JSON validator to check syntax before setting the environment variable.

---

## DK-A005: Duplicate CLI Parameter

**Message:** Duplicate CLI argument/flag name {name} in object literal. Try setting a prefix via {name}: {type} & Flag<{prefix: '{name}'}>

**Causes:**
- Multiple CLI parameters share the same name
- Object literal type has properties that conflict with other parameters
- Missing prefix on flag object types

**Solution:**
Add a prefix to the object literal flag using the `Flag` type annotation:
```typescript
execute(
    options: { verbose: boolean } & Flag<{ prefix: 'opt' }>
) { }
```
This creates flags like `--opt.verbose` instead of `--verbose`, avoiding conflicts.

---

## DK-A006: Workflow Not Found

**Message:** Workflow with name {name} does not exist

**Causes:**
- Requesting a workflow that was never registered
- Typo in workflow name
- Workflow not added to module's `workflows` array

**Solution:**
Ensure the workflow is registered in your module definition:
```typescript
new AppModule({
    workflows: [myWorkflow]
})
```
Verify the workflow name matches exactly when retrieving it from the registry.

---

## DK-A007: Module Not Loaded

**Message:** No module loaded from type {className}

**Causes:**
- Attempting to get an injector or module that was not imported
- Module class not found in the import hierarchy
- The module was not added to the `imports` array

**Solution:**
Ensure the module is imported in your app or parent module's `imports` array:

```typescript
new App({
    imports: [new MyModule()]
});
```

---

## DK-A008: Module Already Imported

**Message:** Module {className} (id={id}) was already imported. Can not re-use module instances.

**Causes:**
- Re-using a module instance that was already imported elsewhere
- The same module object reference was added to imports multiple times
- Module instance shared between different app configurations

**Solution:**
Create a new instance of the module instead of reusing one. Each module instance can only be imported once:

```typescript
// Wrong: reusing instance
const mod = new MyModule();
new App({ imports: [mod, mod] });

// Correct: new instances
new App({ imports: [new MyModule(), new MyModule()] });
```

---
