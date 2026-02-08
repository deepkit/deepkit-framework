# @deepkit/type Errors

Error codes for the `@deepkit/type` package follow the format `DK-T###`.

## DK-T001: No Runtime Type for Value

**Message:** No valid runtime type for [value] given.

**Causes:**
- The class or type was marked with `@reflection never`
- The `@deepkit/type-compiler` is not installed or configured
- TypeScript's reflection option is not enabled in tsconfig.json
- The type was imported from a file or package without type compilation
- The type was declared with the `declare` keyword

**Solution:**
1. Ensure `@deepkit/type-compiler` is installed
2. Run `npx deepkit-type-install` to patch TypeScript for reflection
3. Add `{ "compilerOptions": { "reflection": true } }` to tsconfig.json
4. If using a bundler, ensure the transformer is configured
5. Remove `@reflection never` if it was unintentionally added

---

## DK-T002: No Type Received

**Message:** No type information received.

**Causes:**
- Calling a generic function without providing the type parameter
- Circular imports preventing type resolution
- The `@deepkit/type-compiler` transformer is not running
- TypeScript compilation is not using the Deepkit transformer

**Solution:**
1. Ensure the type parameter is explicitly provided or can be inferred
2. Check for circular imports between files and refactor if needed
3. Verify the type compiler is correctly configured in your build setup
4. For functions using `ReceiveType<T>`, ensure the type argument is passed

Example:
```typescript
// Correct usage
function validate<T>(data: unknown, type?: ReceiveType<T>): boolean {
    const resolved = resolveReceiveType(type);
    // ...
}
validate<User>(data);  // Type is captured
```

---

## DK-T003: No Type Returned from Program

**Message:** No type returned from runtime type program.

**Causes:**
- Internal error in the type reflection processor
- Malformed or corrupted type bytecode
- Incompatible version of type-compiler and runtime

**Solution:**
1. Ensure `@deepkit/type` and `@deepkit/type-compiler` versions are compatible
2. Clean your build output and rebuild: `npm run clean && npm run build`
3. Run `npm run postinstall` to rebuild the type compiler
4. If the issue persists, report it as a bug with a minimal reproduction

---

## DK-T100: No Primary Key Defined

**Message:** Class [ClassName] has no primary key.

**Causes:**
- Attempting to use ORM operations on a class without a primary key
- Missing `PrimaryKey` type annotation on the identifier field
- The primary key field is defined in a parent class but not inherited properly

**Solution:**
Add a primary key annotation to your entity:

```typescript
import { PrimaryKey, AutoIncrement } from '@deepkit/type';

class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    name: string = '';
}
```

---

## DK-T102: Property Not Found

**Message:** No property '[name]' found in [ClassName].

**Causes:**
- Attempting to access a property that does not exist on the type
- Typo in the property name
- Property exists on a subclass but being accessed on the parent type

**Solution:**
1. Verify the property name is spelled correctly
2. Check that the property is defined in the class schema
3. Use `ReflectionClass.from(Type).getProperties()` to list available properties

---

## DK-T103: Method Not Found

**Message:** No method '[name]' found in [ClassName].

**Causes:**
- Attempting to access a method that does not exist on the type
- Typo in the method name
- Method exists on a subclass but being accessed on the parent type

**Solution:**
1. Verify the method name is spelled correctly
2. Check that the method is defined in the class
3. Use `ReflectionClass.from(Type).getMethods()` to list available methods

---

## DK-T104: Invalid Type Kind

**Message:** TypeClass or TypeObjectLiteral expected, not [kind].

**Causes:**
- Passing a non-class type to `ReflectionClass.from()`
- Using a primitive type, union, or other type where a class is expected
- Type resolution resulted in an unexpected type kind

**Solution:**
1. Ensure you're passing a class type or object literal to reflection APIs
2. Check that the type is correctly defined as a class
3. Verify type-compiler is processing your types correctly

---

## DK-T105: No Single-Table Inheritance Discriminant

**Message:** Sub classes of [ClassName] single-table inheritance have no common discriminant or common literal.

**Causes:**
- Using single-table inheritance without a discriminator property
- Sub classes don't share a common literal property to distinguish them
- Missing type annotation for inheritance discriminator

**Solution:**
Define a common discriminant property in your subclasses:

```typescript
class Base {
    kind: string = '';
}

class Child1 extends Base {
    kind: 'child1' = 'child1';
}

class Child2 extends Base {
    kind: 'child2' = 'child2';
}
```

---

## DK-T106: No Reference Defined

**Message:** Class [ClassName] has no reference to class [TargetClass] defined.

**Causes:**
- Attempting to resolve a back reference that doesn't exist
- Missing `Reference` or `BackReference` annotation
- Reference points to a different class than expected

**Solution:**
Define the reference relationship properly:

```typescript
class User {
    id: number & PrimaryKey = 0;
    posts: Post[] & BackReference = [];
}

class Post {
    id: number & PrimaryKey = 0;
    author: User & Reference = undefined!;
}
```

---

## DK-T107: Ambiguous Back Reference

**Message:** Class [ClassName] has multiple potential reverse references for [field] to class [TargetClass]. Use 'mappedBy' to disambiguate.

**Causes:**
- Multiple properties could serve as the back reference
- Ambiguous relationship between entities
- Missing `mappedBy` option to specify which property to use

**Solution:**
Use the `mappedBy` option to explicitly specify the back reference:

```typescript
class User {
    posts: Post[] & BackReference<{ mappedBy: 'author' }> = [];
}

class Post {
    author: User & Reference = undefined!;
}
```

---

## DK-T200: Serialization Error / Circular JIT

**Message:** Circular JIT building detected: [type] / Serialization failed.

**Causes:**
- Circular reference in type definitions during JIT compilation
- Self-referencing types without proper handling
- Attempting to serialize a value that doesn't match the expected type
- Invalid data format for the target type

**Solution:**
For circular JIT errors:
1. Use forward references with `() => Type` syntax for circular dependencies
2. Consider restructuring types to avoid deep circular references

For serialization errors:
1. Ensure the input data matches the expected type structure
2. Use `validate()` before serialization to identify mismatches
3. Check that all required fields are present in the input

Example of forward reference:
```typescript
class Parent {
    children: Child[] = [];
}

class Child {
    parent?: () => Parent;  // Forward reference
}
```

---

## DK-T210: Invalid SuperClass Type

**Message:** Cannot deserialize class '[ClassName]': superClass must be a class type, got [kind]

**Causes:**
- Serialized type data contains a malformed superClass reference
- The superClass was serialized incorrectly (e.g., as a method signature instead of a class)
- Corrupted or manually constructed serialized type data

**Solution:**
1. This is typically an internal error - if you encounter it, ensure you're using compatible versions of `@deepkit/type`
2. If manually constructing serialized types, ensure superClass references point to class types (kind 20)
3. Report as a bug if this occurs during normal framework usage

---

## DK-T211: SuperClass Missing ClassType

**Message:** Cannot deserialize class '[ClassName]': superClass has no classType

**Causes:**
- The serialized superClass type is missing its classType property
- Internal error during type serialization/deserialization

**Solution:**
1. Ensure you're using compatible versions of `@deepkit/type`
2. Report as a bug if this occurs during normal framework usage

---

## DK-T300: Validation Error

**Message:** Validation error for type [Type]: [details]

**Causes:**
- Input data does not conform to the type constraints
- Missing required fields
- Fields with wrong types
- Constraint violations (MinLength, Maximum, Pattern, etc.)

**Solution:**
1. Check the error details for specific field violations
2. Ensure all required fields are provided
3. Verify field values meet type constraints

Example:
```typescript
import { validate, MinLength, Email } from '@deepkit/type';

class User {
    name: string & MinLength<2> = '';
    email: string & Email = '';
}

const errors = validate<User>({ name: 'A', email: 'invalid' });
// errors[0]: name(minLength): Must have at least 2 characters
// errors[1]: email(pattern): Pattern does not match
```

---
