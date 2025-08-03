# Getting Started

Welcome to Deepkit Runtime Types! This guide will walk you through setting up and using runtime type information in your TypeScript project.

## What You'll Learn

By the end of this guide, you'll understand:
- How to install and configure Deepkit Runtime Types
- The difference between compile-time and runtime types
- How to validate, cast, and serialize data using TypeScript types
- How to use type reflection for dynamic programming

## Prerequisites

- **Node.js** 16 or higher
- **TypeScript** 4.7 or higher
- Basic understanding of TypeScript types and interfaces

## Installation

Deepkit Runtime Types consists of two packages:

1. **`@deepkit/type`**: The runtime library with validation, serialization, and reflection APIs
2. **`@deepkit/type-compiler`**: The TypeScript transformer that generates runtime type information

Install both packages:

```bash
npm install --save @deepkit/type
npm install --save-dev @deepkit/type-compiler typescript ts-node
```

### Why Two Packages?

- **`@deepkit/type`** contains the runtime code that your application uses
- **`@deepkit/type-compiler`** is a build-time tool that transforms your TypeScript code to include type information

## Configuration

### Enable Type Reflection

Add `"reflection": true` to your `tsconfig.json` to enable runtime type generation:

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "es6",
    "moduleResolution": "node",
    "experimentalDecorators": true
  },
  "reflection": true
}
```

### Configuration Options Explained

- **`"reflection": true`**: **Required** - Enables runtime type information generation
- **`"experimentalDecorators": true`**: **Recommended** - Enables decorator support for advanced features and other Deepkit libraries

### Verify Installation

The type compiler automatically installs itself into your local TypeScript installation. You can verify this worked by running:

```bash
node_modules/.bin/deepkit-type-install
```

This command should complete without errors. If you see issues, see the [Troubleshooting](#troubleshooting) section below.

## Your First Runtime Types

Let's start with a simple example to see runtime types in action.

### Understanding the Problem

In regular TypeScript, types disappear at runtime:

```typescript
interface User {
    username: string;
    email: string;
}

function processUser(data: any) {
    // ❌ No way to check if data is actually a User at runtime
    // ❌ TypeScript types don't exist here
    return data.username.toUpperCase(); // Might crash!
}
```

### The Deepkit Solution

With Deepkit Runtime Types, your TypeScript types become available at runtime:

```typescript
import { is, cast, validate } from '@deepkit/type';

interface User {
    username: string;
    email: string;
}

function processUser(data: any) {
    // ✅ Check if data matches User interface
    if (is<User>(data)) {
        // TypeScript knows data is User here
        return data.username.toUpperCase(); // Safe!
    }
    throw new Error('Invalid user data');
}
```

### Basic Example: User Validation

Create a file `app.ts` and try this example:

```typescript
import { cast, validate, is, MinLength, Email } from '@deepkit/type';

// Define a User interface with validation constraints
interface User {
    username: string & MinLength<3>;
    email: string & Email;
    birthDate?: Date;
}

// Example 1: Type Guards - Safe runtime checking
function checkUserType(data: unknown) {
    if (is<User>(data)) {
        console.log('✅ Valid user:', data.username);
        return true;
    }
    console.log('❌ Not a valid user');
    return false;
}

// Example 2: Validation - Get detailed error information
function validateUser(data: unknown) {
    const errors = validate<User>(data);
    if (errors.length === 0) {
        console.log('✅ User is valid!');
    } else {
        console.log('❌ Validation errors:');
        errors.forEach(error => {
            console.log(`  - ${error.path}: ${error.message}`);
        });
    }
    return errors;
}

// Example 3: Casting - Convert and validate data
function createUser(data: unknown) {
    try {
        const user = cast<User>(data);
        console.log('✅ User created:', user);
        console.log('Birth date type:', typeof user.birthDate); // 'object' (Date)
        return user;
    } catch (error) {
        console.log('❌ Failed to create user:', error.message);
        return null;
    }
}

// Test the functions
console.log('=== Testing Type Guards ===');
checkUserType({ username: 'john', email: 'john@example.com' });
checkUserType({ username: 'jo' }); // Too short

console.log('\n=== Testing Validation ===');
validateUser({ username: 'john', email: 'john@example.com' });
validateUser({ username: 'jo', email: 'invalid-email' });

console.log('\n=== Testing Casting ===');
createUser({
    username: 'peter',
    email: 'peter@example.com',
    birthDate: '2010-10-10T00:00:00Z' // String → Date conversion
});
```

### Run Your Example

Execute your code with `ts-node`:

```bash
./node_modules/.bin/ts-node app.ts
```

You should see output showing successful validation, type conversion, and error reporting.

### What Just Happened?

Let's break down what Deepkit Runtime Types did:

1. **Type Guards (`is<User>`)**: Checked if data matches the User interface structure at runtime
2. **Validation (`validate<User>`)**: Provided detailed error messages for invalid data
3. **Casting (`cast<User>`)**: Converted string dates to Date objects and validated constraints
4. **Constraint Validation**: Enforced `MinLength<3>` and `Email` constraints automatically

## Core Concepts

### 1. Type Guards vs Validation

**Type Guards** (`is<T>`) return a boolean and narrow TypeScript types:
```typescript
if (is<User>(data)) {
    // TypeScript knows data is User here
    data.username; // ✅ Type-safe access
}
```

**Validation** (`validate<T>`) returns detailed error information:
```typescript
const errors = validate<User>(data);
errors.forEach(error => {
    console.log(`${error.path}: ${error.message}`);
});
```

### 2. Casting vs Deserialization

**Casting** (`cast<T>`) validates AND converts data:
```typescript
const user = cast<User>({
    username: 'john',
    birthDate: '2023-01-01' // String → Date
});
```

**Deserialization** (`deserialize<T>`) converts without validation:
```typescript
const user = deserialize<User>(jsonData); // Faster, no validation
```

### 3. Type Annotations

Add validation constraints directly to your types:
```typescript
interface User {
    username: string & MinLength<3> & MaxLength<20>;
    email: string & Email;
    age: number & Positive & Maximum<120>;
}
```

Available constraints include:
- `MinLength<n>`, `MaxLength<n>` - String/array length
- `Email` - Email format validation
- `Positive`, `Negative` - Number constraints
- `Pattern<regex>` - Custom regex validation
- `Validate<fn>` - Custom validation functions

## Advanced Example: E-commerce Order

Here's a more complex example showing nested objects, arrays, and multiple constraints:

```typescript
import { cast, validate, Email, MaxLength, Positive, MinLength } from '@deepkit/type';

interface Product {
    id: number & Positive;
    name: string & MinLength<1> & MaxLength<100>;
    price: number & Positive;
    tags: string[];
    metadata?: Record<string, any>;
}

interface Order {
    id: number & Positive;
    customerEmail: string & Email;
    products: Product[];
    total: number & Positive;
    createdAt: Date;
}

// Raw data from API/form
const orderData = {
    id: 1,
    customerEmail: 'customer@example.com',
    products: [
        {
            id: 1,
            name: 'Gaming Laptop',
            price: 1299.99,
            tags: ['electronics', 'computers', 'gaming'],
            metadata: { brand: 'TechCorp', warranty: '2 years' }
        },
        {
            id: 2,
            name: 'Wireless Mouse',
            price: 49.99,
            tags: ['electronics', 'accessories']
        }
    ],
    total: 1349.98,
    createdAt: '2023-01-01T10:00:00Z' // String will be converted to Date
};

try {
    // Cast and validate the entire order structure
    const order = cast<Order>(orderData);

    console.log('✅ Order processed successfully!');
    console.log('Order ID:', order.id);
    console.log('Customer:', order.customerEmail);
    console.log('Products:', order.products.length);
    console.log('Created:', order.createdAt instanceof Date); // true
    console.log('Total: $', order.total);

} catch (error) {
    console.log('❌ Order validation failed:', error.message);
}
```

This example demonstrates:
- **Nested object validation** (Order contains Products)
- **Array validation** (products array, tags array)
- **Multiple constraints** (Positive numbers, string lengths, email format)
- **Automatic type conversion** (string → Date)
- **Optional properties** (metadata?)

## Interactive Example

<codebox src="https://codesandbox.io/p/sandbox/deepkit-runtime-types-fjmc2f?file=index.ts"></codebox>

## How the Type Compiler Works

### Automatic Installation

The Deepkit type compiler automatically integrates with your TypeScript installation:

1. **NPM Install Hooks**: When you install `@deepkit/type-compiler`, it automatically patches your local TypeScript installation
2. **Universal Compatibility**: Works with `tsc`, `ts-node`, webpack, Angular, and other TypeScript tools
3. **Zero Configuration**: No additional build setup required

### Manual Installation

If automatic installation fails (e.g., NPM hooks disabled), install manually:

```bash
node_modules/.bin/deepkit-type-install
```

**When to run manually:**
- NPM install hooks are disabled in your environment
- After updating TypeScript version
- If you see "Type compiler not installed" errors

### Troubleshooting

**Problem**: "Type information not available" errors
**Solution**: Ensure `"reflection": true` is in your `tsconfig.json`

**Problem**: Type compiler not working with build tools
**Solution**: Run `node_modules/.bin/deepkit-type-install` manually

**Problem**: Types not updating after changes
**Solution**: Restart your TypeScript compiler/dev server

## Build Tool Integration

### Webpack Configuration

For webpack projects, configure the type compiler with `ts-loader`:

```javascript
// webpack.config.js
const typeCompiler = require('@deepkit/type-compiler');

module.exports = {
  entry: './app.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            // Enable Deepkit type compiler
            getCustomTransformers: (program, getProgram) => ({
              before: [typeCompiler.transformer],
              afterDeclarations: [typeCompiler.declarationTransformer],
            }),
          }
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
};
```

### Other Build Tools

The type compiler works automatically with:
- **tsc** (TypeScript compiler)
- **ts-node** (Node.js TypeScript execution)
- **Angular CLI** (via TypeScript integration)
- **Vite** (with TypeScript plugin)
- **esbuild** (with TypeScript plugin)

## Next Steps

Now that you have runtime types working, explore these key features:

### 🔍 **[Validation](./validation.md)**
Learn comprehensive data validation with detailed error reporting:
- Built-in constraints (email, length, numeric ranges)
- Custom validators
- Nested object validation
- Error handling patterns

### 🔄 **[Serialization](./serialization.md)**
Master data conversion between formats:
- JSON serialization/deserialization
- Type-safe casting
- Custom serializers
- Performance optimization

### 🪞 **[Reflection](./reflection.md)**
Discover dynamic programming with type introspection:
- Inspect class properties and methods
- Build generic utilities
- Runtime type analysis
- Meta-programming patterns

### 🛡️ **[Type Guards](./type-guards.md)**
Implement safe runtime type checking:
- Custom type guard functions
- Union type discrimination
- Type narrowing patterns
- Integration with control flow

### 📚 **[Types Reference](./types.md)**
Explore all supported TypeScript features:
- Primitive types and literals
- Complex types (unions, intersections, generics)
- Type annotations and constraints
- Advanced type patterns

## Common Patterns

### API Data Validation
```typescript
// Validate incoming API data
app.post('/users', (req, res) => {
    try {
        const user = cast<User>(req.body);
        // user is guaranteed to be valid
        await saveUser(user);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});
```

### Configuration Loading
```typescript
// Validate configuration files
interface Config {
    port: number & Positive;
    database: {
        host: string;
        port: number & Positive;
    };
}

const config = cast<Config>(JSON.parse(configFile));
```

### Form Data Processing
```typescript
// Process form submissions
interface ContactForm {
    name: string & MinLength<2>;
    email: string & Email;
    message: string & MinLength<10>;
}

const formData = cast<ContactForm>(formInput);
```

You're now ready to use Deepkit Runtime Types in your projects! Start with validation and casting, then explore the advanced features as your needs grow.
