# Types and Annotations

## What are Type Annotations?

Type annotations in Deepkit are special TypeScript types that add metadata to your regular types. They provide additional information that can be used at runtime for validation, serialization, database operations, and more.

### How Type Annotations Work

Type annotations use TypeScript's intersection types (`&`) to attach metadata to base types:

```typescript
// Base type
type Username = string;

// With annotations
type Username = string & MinLength<3> & MaxLength<20>;

// Multiple annotations
type Price = number & Positive & Maximum<10000>;
```

### Why Use Type Annotations?

Type annotations enable:

- **Validation**: Automatic data validation based on type constraints
- **Serialization**: Custom serialization behavior for different targets
- **Database Mapping**: ORM field configuration and relationships
- **API Documentation**: Automatic schema generation
- **Code Generation**: Type-driven code generation

### Annotation Categories

Deepkit provides annotations in several categories:

| Category | Purpose | Examples |
|----------|---------|----------|
| **Validation** | Data validation constraints | `MinLength`, `Email`, `Positive` |
| **Serialization** | Control serialization behavior | `Group`, `Excluded`, `MapName` |
| **Database** | ORM field configuration | `PrimaryKey`, `Reference`, `Index` |
| **Numeric** | Specialized number types | `integer`, `float32`, `UUID` |
| **Custom** | User-defined metadata | `Data`, `Validate` |

## Basic Usage

### Adding Constraints

```typescript
import { MinLength, MaxLength, Email, Positive } from '@deepkit/type';

interface User {
    // String with length constraints
    username: string & MinLength<3> & MaxLength<20>;

    // Email validation
    email: string & Email;

    // Positive number
    age: number & Positive;

    // Optional field with constraints
    bio?: string & MaxLength<500>;
}
```

### Combining with Validation

```typescript
import { validate, cast } from '@deepkit/type';

const userData = {
    username: 'jo',              // Too short
    email: 'invalid-email',      // Invalid format
    age: -5                      // Negative number
};

const errors = validate<User>(userData);
console.log(errors);
// [
//   { path: 'username', code: 'minLength', message: 'Min length is 3' },
//   { path: 'email', code: 'pattern', message: 'Pattern ^\\S+@\\S+$ does not match' },
//   { path: 'age', code: 'positive', message: 'Number must be positive' }
// ]
```

## Supported TypeScript Features

Deepkit Runtime Types supports the complete TypeScript type system:

### Primitive Types
- `string`, `number`, `boolean`, `bigint`, `symbol`
- `null`, `undefined`, `void`, `never`, `any`, `unknown`

### Complex Types
- **Objects**: `{ name: string; age: number }`
- **Arrays**: `string[]`, `Array<number>`
- **Tuples**: `[string, number, boolean]`
- **Functions**: `(x: number) => string`
- **Classes**: Full class support with inheritance

### Advanced Types
- **Unions**: `string | number | boolean`
- **Intersections**: `A & B & C`
- **Generics**: `Array<T>`, `Promise<T>`, `Map<K, V>`
- **Conditional Types**: `T extends U ? X : Y`
- **Mapped Types**: `{ [K in keyof T]: T[K] }`
- **Template Literals**: `` `prefix-${string}` ``

### Example: Complex Type Structure

```typescript
interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    metadata: {
        timestamp: Date;
        version: string;
    };
}

type UserResponse = ApiResponse<User>;
type ProductListResponse = ApiResponse<Product[]>;

// All of these work with runtime validation
const userResponse = cast<UserResponse>(apiData);
const productList = cast<ProductListResponse>(productData);
```

## Numeric Type Annotations

### Integer Types

Deepkit provides specialized integer types that are validated at runtime and provide hints for serialization and database storage:

| Type | Range | Description |
|------|-------|-------------|
| `integer` | Unlimited | Any integer value |
| `int8` | -128 to 127 | 8-bit signed integer |
| `uint8` | 0 to 255 | 8-bit unsigned integer |
| `int16` | -32,768 to 32,767 | 16-bit signed integer |
| `uint16` | 0 to 65,535 | 16-bit unsigned integer |
| `int32` | -2,147,483,648 to 2,147,483,647 | 32-bit signed integer |
| `uint32` | 0 to 4,294,967,295 | 32-bit unsigned integer |

```typescript
import { integer, int8, uint16, is, cast } from '@deepkit/type';

interface Product {
    id: integer;           // Any integer
    categoryId: uint16;    // 0-65535
    stockLevel: int8;      // -128 to 127
}

// Validation examples
is<integer>(42);      // true
is<integer>(42.5);    // false - not an integer
is<int8>(100);        // true
is<int8>(200);        // false - outside range
is<uint16>(65000);    // true
is<uint16>(-1);       // false - negative not allowed

// Automatic conversion during casting
const product = cast<Product>({
    id: "123",         // String → integer
    categoryId: 42.7,  // Float → uint16 (rounded)
    stockLevel: "5"    // String → int8
});
```

### Float Types

Float types provide precision hints for databases and binary serializers:

| Type | Description |
|------|-------------|
| `float` | Generic floating-point number |
| `float32` | 32-bit floating-point (single precision) |
| `float64` | 64-bit floating-point (double precision) |

```typescript
import { float32, float64 } from '@deepkit/type';

interface Measurement {
    temperature: float32;  // Single precision
    precision: float64;    // Double precision
}
```

### Why Use Specialized Numeric Types?

1. **Validation**: Ensure values are within expected ranges
2. **Database Optimization**: Use appropriate column types
3. **Binary Serialization**: Optimize storage size
4. **API Documentation**: Clear type specifications

```typescript
interface GameScore {
    playerId: uint32;      // Player IDs are always positive
    score: integer;        // Scores can be negative
    level: uint8;          // Levels 1-255
    accuracy: float32;     // Percentage with single precision
}

// This will validate ranges automatically
const score = cast<GameScore>({
    playerId: 12345,
    score: -100,
    level: 5,
    accuracy: 95.7
});
```

## UUID

UUID v4 is usually stored as a binary in the database and as a string in JSON.

```typescript
import { is, UUID } from '@deepkit/type';

is<UUID>('f897399a-9f23-49ac-827d-c16f8e4810a0'); //true
is<UUID>('asd'); //false
```

## MongoID

Marks this field as ObjectId for MongoDB. Resolves as a string. Is stored in the MongoDB as binary.

```typescript
import { MongoId, serialize, is } from '@deepkit/type';

serialize<MongoId>('507f1f77bcf86cd799439011'); //507f1f77bcf86cd799439011
is<MongoId>('507f1f77bcf86cd799439011'); //true
is<MongoId>('507f1f77bcf86cd799439011'); //false

class User {
    id: MongoId = ''; //will automatically set in Deepkit ORM once user is inserted
}
```

## Bigint

Per default the normal bigint type serializes as number in JSON (and long in BSON). This has however limitation in what is possible to save since bigint in JavaScript has an unlimited potential size, where numbers in JavaScript and long in BSON are limited. To bypass this limitation the types `BinaryBigInt` and `SignedBinaryBigInt` are available.

`BinaryBigInt` is the same as bigint but serializes to unsigned binary with unlimited size (instead of 8 bytes in most databases) in databases and string in JSON. Negative values will be converted to positive (`abs(x)`).

```typescript
import { BinaryBigInt } from '@deepkit/type';

interface User {
    id: BinaryBigInt;
}

const user: User = { id: 24n };

serialize<User>({ id: 24n }); //{id: '24'}

serialize<BinaryBigInt>(24); //'24'
serialize<BinaryBigInt>(-24); //'0'
```

Deepkit ORM stores BinaryBigInt as a binary field.

`SignedBinaryBigInt` is the same as `BinaryBigInt` but is able to store negative values as well. Deepkit ORM stores `SignedBinaryBigInt` as binary. The binary has an additional leading sign byte and is represented as an uint: 255 for negative, 0 for zero, or 1 for positive.

```typescript
import { SignedBinaryBigInt } from '@deepkit/type';

interface User {
    id: SignedBinaryBigInt;
}
```

## MapName

To change the name of a property in the serialization.

```typescript
import { serialize, deserialize, MapName } from '@deepkit/type';

interface User {
    firstName: string & MapName<'first_name'>;
}

serialize<User>({ firstName: 'Peter' }) // {first_name: 'Peter'}
deserialize<User>({ first_name: 'Peter' }) // {firstName: 'Peter'}
```

## Group

Properties can be grouped together. For serialization you can for example exclude a group from serialization. See the chapter Serialization for more information.

```typescript
import { serialize } from '@deepkit/type';

interface Model {
    username: string;
    password: string & Group<'secret'>
}

serialize<Model>(
    { username: 'Peter', password: 'nope' },
    { groupsExclude: ['secret'] }
); //{username: 'Peter'}
```

## Data

Each property can add additional meta-data that can be read via the Reflection API. See [Runtime Types Reflection](runtime-types.md#runtime-types-reflection) for more information.

```typescript
import { ReflectionClass } from '@deepkit/type';

interface Model {
    username: string;
    title: string & Data<'key', 'value'>
}

const reflection = ReflectionClass.from<Model>();
reflection.getProperty('title').getData()['key']; //value;
```

## Excluded

Each property can be excluded from the serialization process for a specific target.

```typescript
import { serialize, deserialize, Excluded } from '@deepkit/type';

interface Auth {
    title: string;
    password: string & Excluded<'json'>
}

const item = deserialize<Auth>({ title: 'Peter', password: 'secret' });

item.password; //undefined, since deserialize's default serializer is called `json`

item.password = 'secret';

const json = serialize<Auth>(item);
json.password; //again undefined, since serialize's serializer is called `json`
```

## Embedded

Marks the field as an embedded type.

```typescript
import { PrimaryKey, Embedded, serialize, deserialize } from '@deepkit/type';

interface Address {
    street: string;
    postalCode: string;
    city: string;
    country: string;
}

interface User {
    id: number & PrimaryKey;
    address: Embedded<Address>;
}

const user: User
{
    id: 12,
        address
:
    {
        street: 'abc', postalCode
    :
        '1234', city
    :
        'Hamburg', country
    :
        'Germany'
    }
}
;

serialize<User>(user);
{
    id: 12,
        address_street
:
    'abc',
        address_postalCode
:
    '1234',
        address_city
:
    'Hamburg',
        address_country
:
    'Germany'
}

//for deserialize you have to provide the embedded structure
deserialize<User>({
    id: 12,
    address_street: 'abc',
    //...
});
```

It's possible to change the prefix (which is per default the property name).

```typescript
interface User {
    id: number & PrimaryKey;
    address: Embedded<Address, { prefix: 'addr_' }>;
}

serialize<User>(user);
{
    id: 12,
        addr_street
:
    'abc',
        addr_postalCode
:
    '1234',
}

//or remove it entirely
interface User {
    id: number & PrimaryKey;
    address: Embedded<Address, { prefix: '' }>;
}

serialize<User>(user);
{
    id: 12,
        street
:
    'abc',
        postalCode
:
    '1234',
}
```

## Entity

To annotate interfaces with entity information. Only used in the database context.

```typescript
import { Entity, PrimaryKey } from '@deepkit/type';

interface User extends Entity<{ name: 'user', collection: 'users'> {
    id: number & PrimaryKey;
    username: string;
}
```

## PrimaryKey

Marks the field as primary key. Only used in the database context.

```typescript
import { PrimaryKey } from '@deepkit/type';

interface User {
    id: number & PrimaryKey;
}
```

## AutoIncrement

Marks the field as auto increment. Only used in the database context.
Usually together with `PrimaryKey`.

```typescript
import { AutoIncrement } from '@deepkit/type';

interface User {
    id: number & PrimaryKey & AutoIncrement;
}
```

## Reference

Marks the field as reference (foreign key). Only used in the database context.

```typescript
import { Reference } from '@deepkit/type';

interface User {
    id: number & PrimaryKey;
    group: number & Reference<Group>;
}

interface Group {
    id: number & PrimaryKey;
}
```

In this example `User.group` is an owning reference also known as foreign key in SQL. This means that the `User` table has a column `group` that references the `Group` table. The `Group` table is the target table of the reference.

## BackReference

Marks the field as back reference. Only used in the database context.

```typescript

interface User {
    id: number & PrimaryKey;
    group: number & Reference<Group>;
}

interface Group {
    id: number & PrimaryKey;
    users: User[] & BackReference;
}
```

In this example `Group.users` is a back reference. This means that the `User` table has a column `group` that references the `Group` table.
The `Group` has a virtual property `users` that is automatically populated with all users that have the same `group` id as the `Group` id once a database query
with joins is executed. The property `users` is not stored in the database.

## Index

Marks the field as index. Only used in the database context.

```typescript
import { Index } from '@deepkit/type';

interface User {
    id: number & PrimaryKey;
    username: string & Index;
}
```

## Unique

Marks the field as unique. Only used in the database context.

```typescript
import { Unique } from '@deepkit/type';

interface User {
    id: number & PrimaryKey;
    username: string & Unique;
}
```

## DatabaseField

With `DatabaseField` you can define the database specific options like the real database column type, and the default value, etc.

```typescript
import { DatabaseField } from '@deepkit/type';

interface User {
    id: number & PrimaryKey;
    username: string & DatabaseField<{ type: 'varchar(255)' }>;
}
```

## Validation

TODO

See [Validation Constraint Types](validation.md#validation-constraint-types).

## InlineRuntimeType

To inline a runtime type. Only used in advanced cases.

```typescript
import { InlineRuntimeType, ReflectionKind, Type } from '@deepkit/type';

const type: Type = { kind: ReflectionKind.string };

type Query = {
    field: InlineRuntimeType<typeof type>;
}

const resolved = typeOf<Query>(); // { field: string }
```

In TypeScript the type `Query` is `{ field: any }`, but in runtime it's `{ field: string }`.

This is useful if you build a highly customizable system where you accept runtime types, and you reuse them in various other cases.

## ResetAnnotation

To reset all annotations of a property. Only used in advanced cases.

```typescript
import { ResetAnnotation } from '@deepkit/type';

interface User {
    id: number & PrimaryKey;
}

interface UserCreationPayload {
    id: User['id'] & ResetAnnotation<'primaryKey'>;
}
```

### Custom Type Annotations

You can define your own type annotations.

```typescript
type MyAnnotation = { __meta?: ['myAnnotation'] };
```

By convention, a type annotation is defined to be an object literal with a single optional property `__meta` that has a tuple as its type. The first entry in this tuple is its unique name and all subsequent tuple entries are arbitrary options. This allows a type annotation to be equipped with additional options.

```typescript
type AnnotationOption<T extends { title: string }> = { __meta?: ['myAnnotation', T] };
```

The type annotation is used with the intersection operator `&`. Any number of type annotations can be used on one type.

```typescript
type Username = string & MyAnnotation;
type Title = string & MyAnnotation & AnnotationOption<{ title: 'Hello' }>;
```

The type annotations can be read out via the type objects of `typeOf<T>()` and `typeAnnotation`:

```typescript
import { typeOf, typeAnnotation } from '@deepkit/type';

const type = typeOf<Username>();
const annotation = typeAnnotation.getForName(type, 'myAnnotation'); //[]
```

The result in `annotation` is either an array with options if the type annotation `myAnnotation` was used or `undefined` if not. If the type annotation has additional options as seen in `AnnotationOption`, the passed values can be found in the array.
Already supplied type annotations like `MapName`, `Group`, `Data`, etc have their own annotation object:

```typescript
import { typeOf, Group, groupAnnotation } from '@deepkit/type';

type Username = string & Group<'a'> & Group<'b'>;

const type = typeOf<Username>();
groupAnnotation.getAnnotations(type); //['a', 'b']
```

See [Runtime Types Reflection](./reflection.md) to learn more.

## Advanced Type Annotations

### Database Annotations

These annotations are primarily used by Deepkit ORM but can be useful for documentation and tooling:

```typescript
import { PrimaryKey, AutoIncrement, Unique, Index, Reference } from '@deepkit/type';

class User {
    id!: number & PrimaryKey & AutoIncrement;
    username!: string & Unique;
    email!: string & Unique & Index;
    profileId?: number & Reference<Profile>;
}

class Profile {
    id!: number & PrimaryKey & AutoIncrement;
    firstName!: string & Index;
    lastName!: string & Index;
    bio?: string;
}
```

### Validation Annotations

Comprehensive validation constraints for different data types:

```typescript
import {
    MinLength, MaxLength, Pattern, Email,
    Minimum, Maximum, Positive, Negative,
    MinItems, MaxItems, Validate
} from '@deepkit/type';

interface UserProfile {
    // String constraints
    username: string & MinLength<3> & MaxLength<20> & Pattern<'^[a-zA-Z0-9_]+$'>;
    email: string & Email;

    // Number constraints
    age: number & Minimum<0> & Maximum<150>;
    score: number & Positive;

    // Array constraints
    tags: string[] & MinItems<1> & MaxItems<10>;

    // Custom validation
    password: string & Validate<typeof validatePassword>;
}

function validatePassword(value: any): ValidatorError | void {
    if (typeof value !== 'string') return new ValidatorError('type', 'Must be string');
    if (value.length < 8) return new ValidatorError('minLength', 'Min 8 characters');
    if (!/[A-Z]/.test(value)) return new ValidatorError('uppercase', 'Must contain uppercase');
    if (!/[0-9]/.test(value)) return new ValidatorError('number', 'Must contain number');
}
```

### Serialization Annotations

Control how types are serialized and deserialized:

```typescript
import { Excluded, Group, MapName, Embedded } from '@deepkit/type';

class User {
    id!: number;

    @MapName('user_name')
    username!: string;

    password!: string & Excluded; // Never serialized

    internalNotes!: string & Group<'internal'>; // Only in internal group

    profile!: Profile & Embedded; // Embedded in parent object
}

class Profile {
    firstName!: string;
    lastName!: string;
    avatar?: string;
}

// Serialization with groups
const publicUser = serialize<User>(user, { groupsExclude: ['internal'] });
// { id: 1, user_name: 'john', profile: { firstName: 'John', lastName: 'Doe' } }

const internalUser = serialize<User>(user, { groups: ['internal'] });
// { internalNotes: 'Some notes' }
```

### Type Branding and Nominal Types

Create distinct types that are structurally identical but semantically different:

```typescript
import { Brand } from '@deepkit/type';

type UserId = number & Brand<'UserId'>;
type ProductId = number & Brand<'ProductId'>;
type Email = string & Brand<'Email'>;

// These are different types even though they're all numbers/strings
function getUser(id: UserId): User { /* ... */ }
function getProduct(id: ProductId): Product { /* ... */ }

const userId: UserId = 123 as UserId;
const productId: ProductId = 456 as ProductId;

getUser(userId); // ✓ Correct
getUser(productId); // ✗ TypeScript error - wrong brand

// Email branding with validation
function createEmail(value: string): Email {
    if (!value.includes('@')) {
        throw new Error('Invalid email format');
    }
    return value as Email;
}
```

### Complex Type Combinations

Combine multiple annotations for sophisticated type definitions:

```typescript
import {
    PrimaryKey, AutoIncrement, MinLength, MaxLength,
    Email, Group, Excluded, Optional, Index
} from '@deepkit/type';

class BlogPost {
    id!: number & PrimaryKey & AutoIncrement;

    title!: string & MinLength<5> & MaxLength<200> & Index;

    slug!: string & MinLength<5> & MaxLength<200> & Unique & Index;

    content!: string & MinLength<10>;

    authorEmail!: string & Email & Index;

    publishedAt?: Date & Group<'published'>;

    draft!: boolean & Group<'internal'>;

    internalNotes?: string & Group<'internal'> & Excluded;

    tags!: string[] & MinItems<1> & MaxItems<20>;

    metadata?: Record<string, any> & Group<'admin'>;
}

// Usage with different serialization contexts
const publicPost = serialize<BlogPost>(post, {
    groupsExclude: ['internal', 'admin']
});

const adminPost = serialize<BlogPost>(post, {
    groups: ['published', 'internal', 'admin']
});
```

### Runtime Type Inspection

Access type annotations at runtime for dynamic behavior:

```typescript
import { ReflectionClass, groupAnnotation, excludedAnnotation } from '@deepkit/type';

class DataProcessor {
    static processEntity<T>(entityClass: ClassType<T>, data: any) {
        const reflection = ReflectionClass.from(entityClass);

        // Get all non-excluded properties
        const serializableProps = reflection.getProperties().filter(prop =>
            !excludedAnnotation.getFirst(prop.type)
        );

        // Process by groups
        const publicProps = reflection.getPropertiesInGroup('public');
        const internalProps = reflection.getPropertiesInGroup('internal');

        console.log('Serializable properties:', serializableProps.map(p => p.name));
        console.log('Public properties:', publicProps.map(p => p.name));
        console.log('Internal properties:', internalProps.map(p => p.name));

        return {
            public: serialize(data, { groups: ['public'] }),
            internal: serialize(data, { groups: ['internal'] }),
            full: serialize(data, { groupsExclude: [] })
        };
    }
}
```
