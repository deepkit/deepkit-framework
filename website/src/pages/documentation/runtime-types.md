# Runtime Types

## What are Runtime Types?

Runtime type information in TypeScript unlocks powerful workflows that were previously impossible or required complex workarounds. Traditionally, TypeScript types exist only during compilation and are completely erased at runtime. This means that while you can write `function process(user: User)`, your code has no way to know what `User` looks like when the function actually runs.

Deepkit Runtime Types changes this by preserving TypeScript type information at runtime, enabling your code to:

- **Validate data** against TypeScript types automatically
- **Serialize and deserialize** complex objects with type safety
- **Reflect on types** to build dynamic functionality
- **Cast and transform** data between different formats
- **Generate schemas** from TypeScript types

## Why Runtime Types Matter

### The Traditional Problem

Modern development relies heavily on type definitions for various tools:

- **APIs**: GraphQL schemas, OpenAPI specifications
- **Validation**: JSON Schema, Zod, Joi
- **Databases**: ORM entity definitions
- **Serialization**: ProtoBuf definitions, custom encoders

Each of these tools typically requires you to:
1. Learn their specific schema language
2. Maintain separate type definitions
3. Keep TypeScript types and schemas in sync manually
4. Write boilerplate code for conversions

### The Deepkit Solution

With Deepkit Runtime Types, your TypeScript types become the single source of truth:

```typescript
// Define once in TypeScript
interface User {
    id: number;
    email: string & Email;
    name: string & MinLength<2>;
    createdAt: Date;
}

// Use everywhere automatically
const isValid = is<User>(data);           // Validation
const user = cast<User>(jsonData);        // Deserialization
const json = serialize<User>(user);       // Serialization
const schema = typeOf<User>();            // Reflection
```

## How It Works

Deepkit uses a custom TypeScript transformer that:

1. **Analyzes your TypeScript code** during compilation
2. **Generates efficient bytecode** representing your types
3. **Embeds this bytecode** into your JavaScript output
4. **Provides a runtime VM** to execute type operations

This approach is:
- **Zero-overhead**: Types are compiled to efficient bytecode
- **Complete**: Supports all TypeScript features including generics, unions, mapped types
- **Automatic**: No manual schema definitions required
- **Type-safe**: Full TypeScript integration and inference

## Core Capabilities

### 🔍 Type Validation
Validate any data against TypeScript types with detailed error reporting:

```typescript
const errors = validate<User>(userData);
if (errors.length === 0) {
    // userData is guaranteed to be a valid User
}
```

### 🔄 Serialization & Casting
Convert between different data formats while preserving type information:

```typescript
// JSON string → TypeScript object with proper types
const user = cast<User>({
    id: "123",           // → number
    createdAt: "2023-01-01"  // → Date object
});
```

### 🪞 Type Reflection
Inspect and manipulate types programmatically:

```typescript
const reflection = ReflectionClass.from<User>();
const properties = reflection.getProperties();
const emailProp = reflection.getProperty('email');
```

### 🛡️ Type Guards & Assertions
Safe runtime type checking with TypeScript integration:

```typescript
if (is<User>(data)) {
    // TypeScript knows data is User here
    console.log(data.email); // ✅ Type-safe access
}
```

## Key Benefits

- **Single Source of Truth**: Define types once in TypeScript, use everywhere
- **Zero Boilerplate**: No manual schema definitions or converters
- **Full TypeScript Support**: Works with interfaces, classes, generics, unions, and more
- **High Performance**: Compiled bytecode executes faster than reflection-based solutions
- **Developer Experience**: Full IDE support with autocomplete and type checking
- **Ecosystem Integration**: Powers Deepkit's HTTP, RPC, ORM, and validation systems

## Getting Started

Ready to add runtime type capabilities to your TypeScript project? Start with our [Getting Started Guide](./getting-started.md) to learn installation and basic usage.

## Learn More

- **[Getting Started](./getting-started.md)**: Installation and first steps
- **[Validation](./validation.md)**: Validate data against TypeScript types
- **[Serialization](./serialization.md)**: Convert between data formats
- **[Reflection](./reflection.md)**: Inspect and manipulate types at runtime
- **[Type Guards](./type-guards.md)**: Safe runtime type checking
- **[Types](./types.md)**: Supported TypeScript features and annotations
