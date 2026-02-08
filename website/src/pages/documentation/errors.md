# Error Codes

Deepkit uses a structured error code system to help you quickly identify and resolve issues. Each error has a unique code that links to detailed documentation.

## Error Code Format

Error codes follow the pattern `DK-X###` where:
- `DK` - Deepkit prefix
- `X` - Package identifier (one or more letters)
- `###` - Three-digit error number

| Prefix | Package | Description |
|--------|---------|-------------|
| `DK-T` | @deepkit/type | Runtime types, serialization, validation |
| `DK-O` | @deepkit/orm | Database ORM errors |
| `DK-I` | @deepkit/injector | Dependency injection errors |
| `DK-H` | @deepkit/http | HTTP server errors |
| `DK-R` | @deepkit/rpc | RPC errors |
| `DK-B` | @deepkit/bson | BSON encoding/decoding errors |
| `DK-TC` | @deepkit/type-compiler | Type compiler errors |
| `DK-A` | @deepkit/app | Application framework errors |
| `DK-BR` | @deepkit/broker | Message broker errors |
| `DK-F` | @deepkit/framework | Framework integration errors |

## How to Use Error Codes

When you encounter a Deepkit error, the message includes:

```
DeepkitError: No primary key defined for User class

Error code: DK-T100
More info: https://deepkit.io/documentation/errors/type#DK-T100
```

Click the link or search this documentation for the error code to find:
- What the error means
- Common causes
- How to fix it
- Related errors

## Quick Reference

### Type Errors (DK-T)

| Code | Error | Description |
|------|-------|-------------|
| [DK-T001](./errors/type#DK-T001) | NoRuntimeType | No runtime type information available |
| [DK-T002](./errors/type#DK-T002) | NoTypeReceived | Type parameter not provided |
| [DK-T003](./errors/type#DK-T003) | NoTypeReturned | Type program returned no type |
| [DK-T100](./errors/type#DK-T100) | NoPrimaryKey | Entity missing primary key |
| [DK-T101](./errors/type#DK-T101) | InvalidTypeKind | Wrong type kind for operation |
| [DK-T102](./errors/type#DK-T102) | MemberNotFound | Property/method not found |
| [DK-T200](./errors/type#DK-T200) | CircularJit | Circular reference in JIT compilation |

## Programmatic Access

Error codes are available programmatically for error handling:

```typescript
import { TypeErrorCodes } from '@deepkit/type';

try {
    // ... code that might throw
} catch (error) {
    if (error instanceof DeepkitError) {
        if (error.code === TypeErrorCodes.NO_PRIMARY_KEY) {
            // Handle missing primary key
        }
    }
}
```

## Contributing

If you encounter an error that isn't documented, or if the documentation could be improved, please [open an issue](https://github.com/deepkit/deepkit-framework/issues) on GitHub.
