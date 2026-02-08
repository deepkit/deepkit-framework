# External Types

## External Classes

Since TypeScript does not include type information per default, imported types/classes from other packages (that did not use @deepkit/type-compiler) will not have type information available.

To annotate types for an external class, use `annotateClass` and make sure this function is executed in the bootstrap phase of your application before the imported class is used somewhere else.

```typescript
import { MyExternalClass } from 'external-package';
import { annotateClass } from '@deepkit/type';

interface AnnotatedClass {
    id: number;
    title: string;
}

annotateClass<AnnotatedClass>(MyExternalClass);

//all uses of MyExternalClass return now the type of AnnotatedClass
serialize<MyExternalClass>({...});

//MyExternalClass can now also be used in other types
interface User {
    id: number;
    clazz: MyExternalClass;
}
```

`MyExternalClass` can now be used in serialization functions and in the reflection API.

To following shows how to annotate generic classes:

```typescript
import { MyExternalClass } from 'external-package';

import { annotateClass } from '@deepkit/type';

class AnnotatedClass<T> {
  id!: T;
}

annotateClass(ExternalClass, AnnotatedClass);
```

## Import Type

The `import type` syntax is designed by TypeScript to avoid importing actual JavaScript code and use it only for type-checking. This is useful for example when you want to use a type from a package that is not available at runtime, but only at compile-time or if you don't want to actually load that package at runtime.

Deepkit supports the reasoning of `import type` and will not generate any runtime code. This means if you use `import type`, no type information will be available at runtime.
