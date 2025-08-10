# 설정

DI container는 설정 옵션의 주입도 허용합니다. 이러한 설정 주입은 constructor injection 또는 property injection을 통해 받을 수 있습니다.

Module API는 configuration definition을 지원하며, 이는 일반적인 Class입니다. 이러한 Class에 Property를 제공하면 각 Property가 설정 옵션으로 동작합니다. TypeScript에서 Class를 정의하는 방식 덕분에, 각 Property마다 Type과 기본값을 정의할 수 있습니다.

```typescript
class RootConfiguration {
    domain: string = 'localhost';
    debug: boolean = false;
}

const rootModule = new InjectorModule([UserRepository])
     .setConfigDefinition(RootConfiguration)
     .addImport(lowLevelModule);
```

이제 `domain`과 `debug` 설정 옵션을 providers에서 type-safe하게 편리하게 사용할 수 있습니다.

```typescript
class UserRepository {
    constructor(private debug: RootConfiguration['debug']) {}

    getUsers() {
        if (this.debug) console.debug('fetching users ...');
    }
}
```

옵션 값은 `configure()`를 통해 설정할 수 있습니다.

```typescript
	rootModule.configure({debug: true});
```

기본값이 없지만 여전히 필요한 옵션은 `!`를 사용해 표시할 수 있습니다. 이는 모듈 사용자에게 값을 제공하도록 강제하며, 그렇지 않으면 Error가 발생합니다.

```typescript
class RootConfiguration {
    domain!: string;
}
```

## 검증

또한 이전 장들인 [검증](../runtime-types/validation.md)과 [직렬화](../runtime-types/serialization.md)에 나온 모든 serialization 및 validation Type들을 사용하여, 옵션이 가져야 하는 Type과 내용 제약을 매우 상세하게 지정할 수 있습니다.

```typescript
class RootConfiguration {
    domain!: string & MinLength<4>;
}
```

## 주입

설정 옵션은 다른 의존성과 마찬가지로 앞서 본 것처럼 DI container를 통해 안전하고 쉽게 주입할 수 있습니다. 가장 간단한 방법은 index access operator를 사용해 단일 옵션을 참조하는 것입니다:

```typescript
class WebsiteController {
    constructor(private debug: RootConfiguration['debug']) {}

    home() {
        if (this.debug) console.debug('visit home page');
    }
}
```

설정 옵션은 개별적으로뿐만 아니라 그룹으로도 참조할 수 있습니다. 이를 위해 TypeScript utility Type `Partial`을 사용할 수 있습니다:

```typescript
class WebsiteController {
    constructor(private options: Partial<RootConfiguration, 'debug' | 'domain'>) {}

    home() {
        if (this.options.debug) console.debug('visit home page');
    }
}
```

모든 설정 옵션을 얻기 위해 configuration Class 자체를 직접 참조할 수도 있습니다:

```typescript
class WebsiteController {
    constructor(private options: RootConfiguration) {}

    home() {
        if (this.options.debug) console.debug('visit home page');
    }
}
```

다만 실제로 사용하는 설정 옵션만 참조하는 것을 권장합니다. 이는 단위 테스트를 단순화할 뿐만 아니라, 코드에서 실제로 무엇이 필요한지 파악하기도 쉬워집니다.