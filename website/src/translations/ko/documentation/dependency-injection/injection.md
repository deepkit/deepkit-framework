# Injection

dependency가 주입되기 때문에 이를 Dependency Injection이라고 합니다. 주입은 사용자(수동) 또는 DI container(자동)에 의해 이루어집니다.

## Constructor Injection

대부분의 경우 constructor injection이 사용됩니다. 모든 dependency는 constructor arguments로 지정되며 DI container에 의해 자동으로 주입됩니다.

```typescript
class MyService {
    constructor(protected database: Database) {
    }
}
```

Optional한 dependency는 그렇게 표시해야 하며, 그렇지 않으면 provider를 찾을 수 없을 때 Error가 발생할 수 있습니다.

```typescript
class MyService {
    constructor(protected database?: Database) {
    }
}
```

## Property Injection

constructor injection의 대안으로 property injection이 있습니다. 이는 보통 dependency가 optional이거나 constructor가 너무 복잡할 때 사용됩니다. 인스턴스가 생성되면(즉, constructor가 실행되면) properties는 자동으로 할당됩니다.

```typescript
import { Inject } from '@deepkit/core';

class MyService {
    // 필수
    protected database!: Inject<Database>;

    // 또는 선택
    protected database?: Inject<Database>;
}
```

## Parameter Injection

여러 곳에서 callback function을 정의할 수 있습니다. 예를 들어 HTTP Routes나 CLI commands가 그렇습니다. 이 경우 dependencies를 parameters로 정의할 수 있습니다.
이는 DI container에 의해 자동으로 주입됩니다.

```typescript
import { Database } from './db';

app.get('/', (database: Database) => {
    //...
});
```

## Injector Context

dependency를 동적으로 resolve하고 싶다면 `InjectorContext`를 주입하고 이를 사용하여 dependencies를 가져올 수 있습니다.

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

이는 [Dependency Injection Scopes](./scopes.md)와 함께 작업할 때 특히 유용합니다.