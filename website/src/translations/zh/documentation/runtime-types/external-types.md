# 外部类型

## 外部类

由于 TypeScript 默认不包含类型信息，从其他包导入的类型/类（未使用 @deepkit/type-compiler 的）将无法获得类型信息。

要为外部类注解类型，请使用 `annotateClass`，并确保该函数在应用程序的引导阶段执行，在导入的类被用于其他地方之前。

```typescript
import { MyExternalClass } from 'external-package';
import { annotateClass } from '@deepkit/type';

interface AnnotatedClass {
    id: number;
    title: string;
}

annotateClass<AnnotatedClass>(MyExternalClass);

//现在所有对 MyExternalClass 的使用都会返回 AnnotatedClass 的类型
serialize<MyExternalClass>({...});

//MyExternalClass 现在也可以用于其他类型中
interface User {
    id: number;
    clazz: MyExternalClass;
}
```

现在可以在序列化函数和反射 API 中使用 `MyExternalClass`。

以下演示如何为泛型类添加注解：

```typescript
import { MyExternalClass } from 'external-package';
import { annotateClass } from '@deepkit/type';

class AnnotatedClass<T> {
    id!: T;
}

annotateClass(ExternalClass, AnnotatedClass);
```

## 导入类型

TypeScript 设计的 `import type` 语法可避免导入实际的 JavaScript 代码，仅用于类型检查。这在以下情况很有用：当你想使用一个仅在编译时可用、运行时不可用的包中的类型，或者你不想在运行时实际加载该包时。

Deepkit 遵循 `import type` 的理念，不会生成任何运行时代码。这意味着如果你使用 `import type`，在运行时将无法获得类型信息。