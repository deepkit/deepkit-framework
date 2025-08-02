# Troubleshooting

This guide covers common issues and their solutions when working with Deepkit's runtime type system.

## Installation Issues

### Type Compiler Not Working

**Problem**: Runtime type information is not available, getting errors like "No type received" or types are not being reflected properly.

**Solutions**:

1. **Check tsconfig.json configuration**:
   ```json
   {
     "compilerOptions": {
       "experimentalDecorators": true
     },
     "reflection": true
   }
   ```

2. **Verify type compiler installation**:
   ```bash
   # Check if type compiler is installed
   npm list @deepkit/type-compiler
   
   # Reinstall if necessary
   npm install --save-dev @deepkit/type-compiler
   
   # Manually install the compiler
   node_modules/.bin/deepkit-type-install
   ```

3. **Check TypeScript version compatibility**:
   ```bash
   # The type compiler needs to match your TypeScript version
   npm install --save-dev typescript@latest @deepkit/type-compiler@latest
   ```

### Build Tool Integration Issues

**Problem**: Type compiler doesn't work with your build tool (Webpack, Vite, etc.).

**Solutions**:

1. **For Webpack with ts-loader**:
   ```javascript
   const typeCompiler = require('@deepkit/type-compiler');
   
   module.exports = {
     module: {
       rules: [{
         test: /\.tsx?$/,
         use: {
           loader: 'ts-loader',
           options: {
             getCustomTransformers: (program, getProgram) => ({
               before: [typeCompiler.transformer],
               afterDeclarations: [typeCompiler.declarationTransformer],
             }),
           }
         }
       }]
     }
   };
   ```

2. **For Vite**:
   ```typescript
   import { defineConfig } from 'vite';
   import { deepkitType } from '@deepkit/vite';
   
   export default defineConfig({
     plugins: [deepkitType()]
   });
   ```

## Runtime Errors

### ValidationError: No type received

**Problem**: Getting "No type received" error when calling validation functions.

**Cause**: The type compiler is not generating runtime type information.

**Solutions**:

1. **Ensure proper import**:
   ```typescript
   // Correct
   import { validate } from '@deepkit/type';
   validate<MyType>(data);
   
   // Incorrect - missing type argument
   validate(data);
   ```

2. **Check if type is properly defined**:
   ```typescript
   // Make sure the type is exported and accessible
   export interface MyType {
     id: number;
     name: string;
   }
   ```

3. **Verify compilation**:
   ```bash
   # Compile with tsc to check for errors
   npx tsc --noEmit
   ```

### Circular Reference Errors

**Problem**: Getting circular reference errors when working with self-referencing types.

**Example**:
```typescript
interface User {
  id: number;
  name: string;
  supervisor?: User; // Circular reference
}
```

**Solutions**:

1. **Use proper type definitions**:
   ```typescript
   import { typeOf } from '@deepkit/type';
   
   interface User {
     id: number;
     name: string;
     supervisor?: User;
   }
   
   // This works correctly with circular references
   const userType = typeOf<User>();
   ```

2. **For complex circular references, use forward declarations**:
   ```typescript
   interface Department {
     id: number;
     name: string;
     head: User;
     employees: User[];
   }
   
   interface User {
     id: number;
     name: string;
     department: Department;
   }
   ```

## Performance Issues

### Slow Validation/Serialization

**Problem**: Type validation or serialization is slower than expected.

**Solutions**:

1. **Cache type information**:
   ```typescript
   import { typeOf, ReflectionClass } from '@deepkit/type';
   
   // Cache frequently used types
   const userType = typeOf<User>();
   const userReflection = ReflectionClass.from<User>();
   
   // Reuse cached types
   function validateUser(data: unknown) {
     return validate(data, userType);
   }
   ```

2. **Use type guards for simple checks**:
   ```typescript
   import { is } from '@deepkit/type';
   
   // Faster for simple type checks
   if (is<string>(value)) {
     // Handle string
   }
   
   // Instead of full validation for simple cases
   const errors = validate<string>(value);
   ```

3. **Optimize complex types**:
   ```typescript
   // Instead of validating entire complex objects
   interface ComplexUser {
     // ... many properties
   }
   
   // Validate only what you need
   type UserBasics = Pick<ComplexUser, 'id' | 'name' | 'email'>;
   const errors = validate<UserBasics>(data);
   ```

## Type Definition Issues

### Generic Type Problems

**Problem**: Generic types are not working as expected.

**Solutions**:

1. **Ensure proper generic constraints**:
   ```typescript
   // Correct
   interface Repository<T extends { id: string }> {
     items: T[];
     find(id: string): T | undefined;
   }
   
   // Usage
   const userRepo = cast<Repository<User>>(data);
   ```

2. **Use explicit type parameters**:
   ```typescript
   function processItems<T>(items: T[]): T[] {
     return items.filter(item => item !== null);
   }
   
   // Explicit type parameter
   const result = processItems<User>(users);
   ```

### Union Type Issues

**Problem**: Union types are not being validated correctly.

**Solutions**:

1. **Use discriminated unions**:
   ```typescript
   // Good - discriminated union
   type ApiResponse = 
     | { success: true; data: any }
     | { success: false; error: string };
   
   // Instead of
   type BadApiResponse = {
     success: boolean;
     data?: any;
     error?: string;
   };
   ```

2. **Ensure all union members are distinct**:
   ```typescript
   type Status = 'pending' | 'approved' | 'rejected';
   
   // This works well with validation
   const status = cast<Status>('pending');
   ```

## Common Validation Errors

### Custom Validator Issues

**Problem**: Custom validators are not working or throwing unexpected errors.

**Solutions**:

1. **Proper validator function signature**:
   ```typescript
   import { ValidatorError } from '@deepkit/type';
   
   // Correct signature
   function customValidator(value: any, type: any, ...args: any[]) {
     if (/* validation logic */) {
       return undefined; // Valid
     }
     return new ValidatorError('code', 'Error message');
   }
   ```

2. **Handle edge cases**:
   ```typescript
   function emailValidator(value: any) {
     // Always check type first
     if (typeof value !== 'string') {
       return new ValidatorError('type', 'Expected string');
     }
     
     if (!value.includes('@')) {
       return new ValidatorError('email', 'Invalid email format');
     }
     
     return undefined;
   }
   ```

### Constraint Validation Problems

**Problem**: Built-in constraints like MinLength, MaxLength are not working.

**Solutions**:

1. **Correct constraint usage**:
   ```typescript
   import { MinLength, MaxLength } from '@deepkit/type';
   
   // Correct
   type Username = string & MinLength<3> & MaxLength<20>;
   
   // Incorrect
   type BadUsername = string | MinLength<3>; // Should use &, not |
   ```

2. **Check constraint compatibility**:
   ```typescript
   import { Positive, integer } from '@deepkit/type';
   
   // Correct - constraints that make sense together
   type UserId = number & integer & Positive;
   
   // Incorrect - conflicting constraints
   type BadId = string & Positive; // Positive only works with numbers
   ```

## Debugging Tips

### Enable Debug Logging

```typescript
// Set environment variable for debug output
process.env.DEBUG = 'deepkit:type';

// Or use console logging in custom validators
function debugValidator(value: any, type: any) {
  console.log('Validating:', value, 'against type:', type);
  // ... validation logic
}
```

### Inspect Type Information

```typescript
import { typeOf, stringifyType } from '@deepkit/type';

// Debug type information
const type = typeOf<MyComplexType>();
console.log('Type structure:', JSON.stringify(type, null, 2));
console.log('Type string:', stringifyType(type));
```

### Test Type Definitions

```typescript
import { validate, is } from '@deepkit/type';

// Create test cases for your types
function testUserType() {
  const validUser = { id: 1, name: 'John', email: 'john@example.com' };
  const invalidUser = { id: 'invalid', name: '', email: 'not-email' };
  
  console.log('Valid user errors:', validate<User>(validUser));
  console.log('Invalid user errors:', validate<User>(invalidUser));
  
  console.log('Is valid user?', is<User>(validUser));
  console.log('Is invalid user?', is<User>(invalidUser));
}

testUserType();
```

## Getting Help

If you're still experiencing issues:

1. **Check the GitHub issues**: [Deepkit Framework Issues](https://github.com/deepkit/deepkit-framework/issues)
2. **Join the Discord community**: [Deepkit Discord](https://discord.gg/U24mryk7Wq)
3. **Review the test files**: The test files in the repository contain many examples of correct usage
4. **Create a minimal reproduction**: When reporting issues, create a minimal example that demonstrates the problem
