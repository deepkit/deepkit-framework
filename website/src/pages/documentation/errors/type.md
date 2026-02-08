# Type Errors (DK-T)

This page documents all error codes for the `@deepkit/type` package.

## Error Categories

- **001-099**: Runtime type resolution errors
- **100-199**: Reflection errors
- **200-299**: Serialization errors
- **300-399**: Decorator errors

---

## Runtime Type Resolution Errors

### DK-T001: NoRuntimeType {#DK-T001}

**No valid runtime type information available**

This error occurs when Deepkit cannot find runtime type information for a value or type.

#### Common Causes

1. `@deepkit/type-compiler` is not installed or not configured correctly
2. TypeScript's `reflection` option is not enabled in `tsconfig.json`
3. Circular imports preventing type resolution
4. Type imported from a file/package without type compilation
5. Using a type declared with the `declare` keyword

#### How to Fix

1. **Install the type compiler:**
   ```bash
   npm install @deepkit/type-compiler
   ```

2. **Patch TypeScript for reflection:**
   ```bash
   npx deepkit-type-install
   ```

3. **Enable reflection in tsconfig.json:**
   ```json
   {
     "compilerOptions": {
       "reflection": true
     }
   }
   ```

4. **If using a bundler (Vite, webpack, etc.)**, ensure the transformer is configured. See the [bundler integration guide](../runtime-types/getting-started).

5. **Check for circular imports** between files that might prevent type resolution.

#### Related Errors

- [DK-T002](#DK-T002) - NoTypeReceived
- [DK-T003](#DK-T003) - NoTypeReturned

---

### DK-T002: NoTypeReceived {#DK-T002}

**Type parameter not provided to a function expecting type information**

This error occurs when a generic function expecting type information is called without it.

#### Common Causes

1. `@deepkit/type-compiler` is not installed or configured
2. Calling a generic function without type arguments
3. Type reference returned `undefined`

#### How to Fix

1. **Ensure type-compiler is properly installed** (see [DK-T001](#DK-T001))

2. **Pass explicit type arguments to generic functions:**
   ```typescript
   // Instead of:
   const type = resolveReceiveType();

   // Use:
   const type = resolveReceiveType<MyType>();
   ```

3. **Check for circular imports** that might prevent type resolution

---

### DK-T003: NoTypeReturned {#DK-T003}

**Type program returned no type**

This is an internal error indicating the type bytecode program executed but produced no result.

#### Common Causes

1. Corrupted or incomplete type bytecode
2. Type compiler version mismatch
3. Internal error in type resolution

#### How to Fix

1. **Rebuild your project:**
   ```bash
   npm run build
   ```

2. **Ensure type-compiler version matches:**
   ```bash
   npm ls @deepkit/type @deepkit/type-compiler
   ```

3. **Re-run the type compiler patch:**
   ```bash
   npx deepkit-type-install
   ```

---

## Reflection Errors

### DK-T100: NoPrimaryKey {#DK-T100}

**Entity class has no primary key defined**

A primary key is required for database entities and certain ORM operations.

#### Common Causes

1. Forgot to add `PrimaryKey` type annotation
2. Using a plain class without entity configuration
3. Primary key defined in wrong location (e.g., in a method instead of property)

#### How to Fix

Add a primary key to your class using the `PrimaryKey` type annotation:

```typescript
import { PrimaryKey, AutoIncrement } from '@deepkit/type';

class User {
    // Simple primary key
    id: number & PrimaryKey = 0;

    // Or with auto-increment
    id: number & PrimaryKey & AutoIncrement = 0;

    // Or with UUID
    id: string & PrimaryKey = '';
}
```

#### Related Errors

- [DK-T105](#DK-T105) - ReferenceNotFound (when referencing entities without primary keys)

---

### DK-T101: InvalidTypeKind {#DK-T101}

**Expected a specific type kind but received a different one**

This error occurs when a type operation receives an incompatible type kind.

#### Common Causes

1. Passing a primitive type where a class/interface was expected
2. Using `ReflectionClass.from()` with a non-class type
3. Type mismatch in generic constraints

#### How to Fix

Ensure you're passing the correct type:

```typescript
import { ReflectionClass } from '@deepkit/type';

// Correct - passing a class
const reflection = ReflectionClass.from<User>();

// Incorrect - passing a primitive
// const reflection = ReflectionClass.from<string>(); // Error!
```

---

### DK-T102: MemberNotFound {#DK-T102}

**Property or method not found on a class**

The requested property or method does not exist on the class.

#### Common Causes

1. Typo in the property/method name
2. Property not defined in the class
3. Property defined in a parent class but not inherited correctly

#### How to Fix

1. **Check the spelling** of the property/method name
2. **Verify the property exists** in the class definition:
   ```typescript
   class User {
       id: number = 0;
       name: string = '';
   }

   const reflection = ReflectionClass.from<User>();
   reflection.getProperty('name');     // OK
   reflection.getProperty('username'); // Error: not found
   ```

3. **If using inheritance**, ensure the property is properly defined in the parent class

---

### DK-T103: NoTypeGiven {#DK-T103}

**No type was provided to an operation requiring one**

Similar to [DK-T002](#DK-T002), but occurs in different contexts.

#### How to Fix

Ensure you provide a type argument:

```typescript
// Instead of:
ReflectionClass.from(); // Error

// Use:
ReflectionClass.from<User>(); // OK
```

---

### DK-T104: CannotResolveClass {#DK-T104}

**Cannot resolve ReflectionClass from the given type**

The type provided cannot be converted to a `ReflectionClass`.

#### Common Causes

1. Passing a non-class type (primitive, union, etc.)
2. Type has no reflection information

#### How to Fix

Ensure you're using a class or interface type:

```typescript
// Correct
ReflectionClass.from<User>();
ReflectionClass.from<{ id: number }>();

// Incorrect
ReflectionClass.from<string>();        // primitives not allowed
ReflectionClass.from<User | Admin>();  // unions not allowed
```

---

### DK-T105: ReferenceNotFound {#DK-T105}

**Class has no reference to the target class defined**

When using relations, the target class reference was not found.

#### How to Fix

Ensure your relations are properly defined:

```typescript
import { Reference, BackReference, PrimaryKey } from '@deepkit/type';

class User {
    id: number & PrimaryKey = 0;
    posts: Post[] & BackReference = [];
}

class Post {
    id: number & PrimaryKey = 0;
    author: User & Reference = new User();
}
```

---

## Serialization Errors

### DK-T200: CircularJit {#DK-T200}

**Circular JIT building detected**

The serializer encountered a type that references itself in a way that causes infinite recursion during JIT compilation.

#### Common Causes

1. Directly recursive type without proper handling
2. Complex circular references between types
3. Missing lazy loading for related types

#### How to Fix

1. **Use `Reference<T>` for lazy loading:**
   ```typescript
   class Node {
       id: number & PrimaryKey = 0;
       // Instead of direct reference:
       // parent: Node;
       // Use Reference for lazy loading:
       parent?: Node & Reference;
       children: Node[] & BackReference = [];
   }
   ```

2. **Break the cycle with explicit type annotations**

3. **Consider restructuring your types** to avoid deep circular dependencies

---

### DK-T201: NoTemplateFound {#DK-T201}

**No serialization template found for the type kind**

The serializer doesn't know how to handle a specific type.

#### Common Causes

1. Using a custom type without a serializer
2. Missing type information

#### How to Fix

Register a custom serializer for your type, or ensure the type has proper runtime information.

---

## Decorator Errors

### DK-T300: InvalidDecoratorTarget {#DK-T300}

**Decorator used on invalid target**

A decorator was applied to an incompatible target (class, property, method, etc.).

#### How to Fix

Check the decorator documentation and ensure you're applying it to the correct target:

```typescript
// Property decorator - use on properties
class User {
    @MyPropertyDecorator
    name: string = '';
}

// Class decorator - use on classes
@MyClassDecorator
class User {}
```
