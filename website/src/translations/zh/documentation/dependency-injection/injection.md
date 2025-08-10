# 注入

它被称为依赖注入（Dependency Injection），因为依赖被注入。注入可以由用户（手动）或由 DI 容器（自动）完成。

## 构造函数注入

在大多数情况下，使用构造函数注入。所有依赖都作为构造函数参数指定，并由 DI 容器自动注入。

```typescript
class MyService {
    constructor(protected database: Database) {
    }
}
```

可选依赖应标记为可选，否则在找不到提供者时可能会触发错误。

```typescript
class MyService {
    constructor(protected database?: Database) {
    }
}
```

## 属性注入

构造函数注入的替代方案是属性注入。这通常用于依赖是可选的，或构造函数已经过于臃肿的情况。实例创建后（因此构造函数已执行），这些属性会被自动赋值。

```typescript
import { Inject } from '@deepkit/core';

class MyService {
    // 必需
    protected database!: Inject<Database>;

    // 或可选
    protected database?: Inject<Database>;
}
```

## 参数注入

在多种场景中你可以定义回调函数，例如用于 HTTP 路由或 CLI 命令。在这种情况下，你可以将依赖定义为参数。
它们会由 DI 容器自动注入。

```typescript
import { Database } from './db';

app.get('/', (database: Database) => {
    //...
});
```

## 注入器上下文

若需要动态解析依赖，可以注入 `InjectorContext` 并使用它来获取依赖。

```typescript
import { InjectorContext } from '@deepkit/injector';

class MyService {
    constructor(protected context: InjectorContext) {
    }

    getDatabase(): Database {
        return this.context.get(Database);
    }
}
```

这在处理[依赖注入作用域](./scopes.md)时尤其有用。