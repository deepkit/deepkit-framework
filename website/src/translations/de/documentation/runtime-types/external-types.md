# Externe Types

## Externe Classes

Da TypeScript standardmäßig keine Type-Informationen enthält, haben importierte Types/Classes aus anderen Paketen (die @deepkit/type-compiler nicht verwendet haben) keine Type-Informationen verfügbar.

Um Types für eine externe Class zu annotieren, verwende `annotateClass` und stelle sicher, dass diese Function in der Bootstrap-Phase deiner Anwendung ausgeführt wird, bevor die importierte Class anderswo verwendet wird.

```typescript
import { MyExternalClass } from 'external-package';
import { annotateClass } from '@deepkit/type';

interface AnnotatedClass {
    id: number;
    title: string;
}

annotateClass<AnnotatedClass>(MyExternalClass);

//alle Verwendungen von MyExternalClass liefern nun den Type von AnnotatedClass zurück
serialize<MyExternalClass>({...});

//MyExternalClass kann nun auch in anderen Types verwendet werden
interface User {
    id: number;
    clazz: MyExternalClass;
}
```

`MyExternalClass` kann nun in Serialisierungsfunktionen und in der Reflection-API verwendet werden.

Das Folgende zeigt, wie man generische Classes annotiert:

```typescript
import { MyExternalClass } from 'external-package';
import { annotateClass } from '@deepkit/type';

class AnnotatedClass<T> {
    id!: T;
}

annotateClass(ExternalClass, AnnotatedClass);
```

## Import Type

Die Syntax `import type` wurde von TypeScript entwickelt, um zu vermeiden, dass tatsächlicher JavaScript-Code importiert wird, und ihn nur für Type-Checking zu verwenden. Das ist z. B. dann nützlich, wenn du einen Type aus einem Package verwenden möchtest, der zur Runtime nicht verfügbar ist, sondern nur zur Compile-Time, oder wenn du dieses Package zur Runtime nicht wirklich laden möchtest.

Deepkit unterstützt das Konzept von `import type` und generiert keinen Runtime-Code. Das bedeutet, wenn du `import type` verwendest, sind zur Runtime keine Type-Informationen verfügbar.