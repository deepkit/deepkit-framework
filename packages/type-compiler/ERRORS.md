# Type Compiler Errors

## DK-TC001: No Active Co-routine

**Message:** No active co-routine found

**Causes:**
- Internal compiler state corruption during type compilation
- Mismatched pushCoRoutine/popCoRoutine calls in the type compilation pipeline
- A bug in custom type processing code

**Solution:**
This is an internal compiler error. If you encounter this:
1. Ensure you are using compatible versions of `@deepkit/type` and `@deepkit/type-compiler`
2. Try cleaning your build output and rebuilding: `npm run clean && npm run build`
3. Report the issue with a minimal reproduction if it persists

---

## DK-TC002: No Valid OP Added

**Message:** No valid OP added

**Causes:**
- Internal compiler error where a non-numeric value was passed as a reflection operation
- Corruption in the type compilation bytecode generation
- A bug in the type compiler's code generation

**Solution:**
This is an internal compiler error. If you encounter this:
1. Ensure you are using a supported TypeScript version
2. Clean and rebuild your project
3. Report the issue with sample code that triggers this error

---

## DK-TC003: Invalid TypeScript Library

**Message:** Invalid TypeScript library imported. SyntaxKind different {actual} !== {expected}.

**Causes:**
- Multiple versions of TypeScript are installed in the project
- The TypeScript version used by the type-compiler differs from the one used by your build tools
- Bundler or module resolution issues causing wrong TypeScript instance to be loaded

**Solution:**
1. Check for duplicate TypeScript installations: `npm ls typescript`
2. Ensure only one version of TypeScript is installed
3. If using a monorepo, ensure TypeScript is hoisted properly
4. The error message includes the TypeScript package path - verify it points to the expected location

---

## DK-TC004: Additional Import Exists

**Message:** Internal error: additional import already exists

**Causes:**
- Internal compiler state error during import declaration processing
- The same import declaration is being processed multiple times

**Solution:**
This is an internal compiler error indicating a bug in the type-compiler. If you encounter this:
1. Try simplifying the problematic file's imports
2. Clean and rebuild your project
3. Report the issue with a minimal reproduction

---

## DK-TC005: Could Not Find Infer Variable

**Message:** Could not find inserted infer variable

**Causes:**
- Internal error when processing conditional types with `infer` keywords
- The infer variable was not properly registered in the compilation frame

**Solution:**
This is an internal compiler error. If you encounter this while using conditional types with `infer`:
1. Simplify the conditional type if possible
2. Ensure the type is syntactically correct
3. Report the issue with the problematic type definition

---

## DK-TC006: No tsconfig Found

**Message:** No tsconfig found for {fileName}. Either provide a tsconfig or compilerOptions.configFilePath

**Causes:**
- Running the type-compiler without a tsconfig.json file
- The tsconfig.json is not in the expected location
- The `configFilePath` compiler option is not set when programmatically invoking the compiler

**Solution:**
1. Ensure a `tsconfig.json` exists in your project root or the directory being compiled
2. If using the compiler programmatically, provide `compilerOptions.configFilePath`:

```typescript
const compilerOptions = {
    configFilePath: '/path/to/tsconfig.json',
    // ... other options
};
```

3. When using build tools, ensure they are configured to find your tsconfig:

```json
{
    "compilerOptions": {
        "plugins": [{ "transform": "@deepkit/type-compiler" }]
    }
}
```
