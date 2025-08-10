# 외부 Type

## 외부 Class

TypeScript는 기본적으로 Type 정보를 포함하지 않으므로, 다른 패키지에서 import된 Type/Class(@deepkit/type-compiler를 사용하지 않은 경우)는 런타임에 사용할 수 있는 Type 정보가 제공되지 않습니다.

외부 Class에 대한 Type을 annotate하려면 `annotateClass`를 사용하고, import된 Class가 다른 곳에서 사용되기 전에 이 Function이 애플리케이션의 bootstrap 단계에서 실행되도록 하세요.

```typescript
import { MyExternalClass } from 'external-package';
import { annotateClass } from '@deepkit/type';

interface AnnotatedClass {
    id: number;
    title: string;
}

annotateClass<AnnotatedClass>(MyExternalClass);

//이제 MyExternalClass의 모든 사용은 AnnotatedClass의 Type을 반환합니다
serialize<MyExternalClass>({...});

//이제 MyExternalClass는 다른 Type에서도 사용할 수 있습니다
interface User {
    id: number;
    clazz: MyExternalClass;
}
```

이제 `MyExternalClass`는 serialization Function과 reflection API에서 사용할 수 있습니다.

다음은 generic Class를 annotate하는 방법을 보여줍니다:

```typescript
import { MyExternalClass } from 'external-package';
import { annotateClass } from '@deepkit/type';

class AnnotatedClass<T> {
    id!: T;
}

annotateClass(ExternalClass, AnnotatedClass);
```

## Import Type

`import type` 구문은 실제 JavaScript 코드를 import하지 않고 type-checking에만 사용하도록 TypeScript에서 설계되었습니다. 이는 예를 들어 런타임에는 존재하지 않고 컴파일 타임에만 존재하는 패키지의 Type을 사용하고 싶거나, 런타임에 해당 패키지를 실제로 로드하고 싶지 않을 때 유용합니다.

Deepkit은 `import type`의 취지를 따르며 어떤 런타임 코드도 생성하지 않습니다. 즉, `import type`을 사용하면 런타임에는 어떠한 Type 정보도 제공되지 않습니다.