# 의존성 주입 (Dependency Injection)

Dependency Injection (DI)는 Class와 Function이 자신의 의존성을 전달받아(receive) 사용하는 디자인 패턴입니다. 이는 Inversion of Control (IoC) 원칙을 따르며, 복잡한 코드를 더 잘 분리해 테스트 용이성, 모듈성, 명확성을 크게 향상시킵니다. Service Locator 패턴처럼 IoC 원칙을 적용하는 다른 디자인 패턴들도 있지만, 특히 엔터프라이즈 소프트웨어에서 DI가 지배적인 패턴으로 자리 잡았습니다.

IoC 원칙을 설명하기 위해 다음 예시를 보겠습니다:

```typescript
import { HttpClient } from 'http-library';

class UserRepository {
    async getUsers(): Promise<Users> {
        const client = new HttpClient();
        return await client.get('/users');
    }
}
```

UserRepository Class는 HttpClient를 의존성으로 갖습니다. 이 의존성 자체는 특별할 것이 없지만, `UserRepository`가 HttpClient를 스스로 생성한다는 점이 문제입니다.
HttpClient의 생성을 UserRepository 안에 캡슐화하는 것이 좋아 보일 수 있지만, 실제로는 그렇지 않습니다. 만약 HttpClient를 교체하고 싶다면 어떻게 할까요? 실제 HTTP 요청이 나가지 않도록 하면서 UserRepository를 단위 테스트하고 싶다면 어떻게 할까요? 이 Class가 HttpClient를 사용한다는 사실은 어떻게 알 수 있을까요?

## 제어의 역전 (Inversion of Control)

Inversion of Control (IoC)의 관점에서는 다음과 같이 HttpClient를 생성자가 가진 명시적 의존성으로 설정하는 대안(일명 constructor injection)을 사용합니다.

```typescript
class UserRepository {
    constructor(
        private http: HttpClient
    ) {}

    async getUsers(): Promise<Users> {
        return await this.http.get('/users');
    }
}
```

이제 UserRepository는 더 이상 HttpClient를 생성하지 않고, UserRepository의 사용자가 생성합니다. 이것이 Inversion of Control (IoC)입니다. 제어가 반전(inverted)되거나 역전되었습니다. 구체적으로 이 코드는 의존성을 생성하거나 요청하지 않고 전달받아(injected) 사용하므로 Dependency Injection을 적용합니다. Dependency Injection은 IoC의 여러 변형 중 하나입니다.

## Service Locator

DI 외에도 Service Locator (SL)는 IoC 원칙을 적용하는 또 다른 방법입니다. 이는 의존성을 전달받는 것이 아니라 요청한다는 점에서 Dependency Injection의 상대 개념으로 흔히 간주됩니다. 위 코드에서 HttpClient를 다음과 같이 요청한다면 Service Locator 패턴이라고 합니다.

```typescript
class UserRepository {
    async getUsers(): Promise<Users> {
        const client = locator.getHttpClient();
        return await client.get('/users');
    }
}
```

`locator.getHttpClient`라는 Function 이름은 무엇이든 될 수 있습니다. 대안으로는 `useContext(HttpClient)`, `getHttpClient()`, `await import("client")`와 같은 Function 호출이나 `container.get(HttpClient)` 또는 `container.http` 같은 컨테이너 쿼리가 있을 수 있습니다. 전역을 import하는 것은 약간 다른 형태의 service locator로, 모듈 시스템 자체를 locator로 사용합니다:

```typescript
import { httpClient } from 'clients'

class UserRepository {
    async getUsers(): Promise<Users> {
        return await httpClient.get('/users');
    }
}
```

이 모든 변형의 공통점은 HttpClient 의존성을 명시적으로 요청하며, 코드가 service container의 존재를 인지한다는 것입니다. 이는 코드를 프레임워크에 강하게 결합시키며, 코드를 깔끔하게 유지하려면 피하고자 하는 요소입니다. 

서비스 요청은 기본값으로 Property에만 일어나는 것이 아니라, 코드 중간에서도 발생할 수 있습니다. 코드 중간이라는 것은 type interface의 일부가 아니라는 뜻이므로, HttpClient의 사용이 숨겨집니다. HttpClient가 요청되는 방식에 따라, 다른 구현으로 교체하는 것이 때로는 매우 어렵거나 완전히 불가능할 수 있습니다. 특히 단위 테스트 영역과 명확성 측면에서 어려움이 발생하기 쉽기 때문에, service locator는 특정 상황에서 anti-pattern으로 분류되기도 합니다.

## Dependency Injection

Dependency Injection에서는 아무것도 요청하지 않고, 사용자에 의해 명시적으로 제공되거나 코드가 전달받습니다. Consumer는 어떤 service container에도 접근하지 않으며, `HttpClient`가 어떻게 생성되거나 가져와지는지 알지 못합니다. 핵심적으로 IoC 프레임워크로부터 코드가 decoupled되어 더 깔끔해집니다. 

필요한 것이 `HttpClient`라는 type임을 선언할 뿐입니다. Service Locator 대비 Dependency Injection의 핵심 차이점이자 장점은, Dependency Injection을 사용하는 코드는 어떠한 service container나 서비스 식별 시스템(서비스에 이름을 줄 필요가 없음) 없이도 완전히 잘 동작한다는 점입니다. IoC 프레임워크 컨텍스트 밖에서도 통용되는 단순한 type 선언일 뿐입니다.

앞선 예시에서 보았듯이, 이미 dependency injection 패턴이 적용되어 있습니다. 구체적으로 constructor injection이 보이며, 의존성이 constructor에 선언되어 있습니다. 따라서 UserRepository는 이제 다음과 같이 인스턴스화해야 합니다.

```typescript
const users = new UserRepository(new HttpClient());
```

UserRepository를 사용하려는 코드는 모든 의존성을 제공(주입)해야 합니다. 매번 HttpClient를 새로 생성할지, 동일한 것을 매번 사용할지는 이제 Class의 사용자가 결정하며, 더 이상 Class 자체가 결정하지 않습니다. 이는 service locator의 경우처럼 요청하는 것도 아니고, 초기 예제처럼 스스로 완전히 생성하는 것도 아닙니다. 이러한 흐름의 역전은 다양한 장점이 있습니다:

* 모든 의존성이 명시적으로 보이므로 코드를 이해하기가 더 쉽습니다.
* 모든 의존성이 독립적이어서, 필요 시 쉽게 대체할 수 있으므로 테스트가 더 쉽습니다.
* 의존성을 손쉽게 교체할 수 있으므로 코드가 더 모듈화됩니다.
* UserRepository가 더 이상 매우 복잡한 의존성을 스스로 생성할 책임을 지지 않으므로, Separation of Concern 원칙을 촉진합니다.

하지만 명백한 단점도 바로 보입니다: 정말로 HttpClient 같은 모든 의존성을 내가 직접 생성하거나 관리해야 하나요? 예도 있고 아니오도 있습니다. 예, 스스로 의존성을 관리해도 전혀 문제가 없는 경우가 많습니다. 좋은 API의 특징은 의존성이 통제 불능 상태가 되지 않으며, 그럼에도 여전히 사용하기 편하다는 점입니다. 많은 애플리케이션이나 복잡한 라이브러리에서 충분히 그럴 수 있습니다. 많은 의존성을 가진 매우 복잡한 low-level API를 사용자에게 단순화하여 제공하기 위해서는 facade 패턴이 훌륭하게 적합합니다.

## Dependency Injection 컨테이너

더 복잡한 애플리케이션에서는 모든 의존성을 직접 관리할 필요가 없습니다. 이를 위해 바로 dependency injection 컨테이너가 존재합니다. 이는 모든 객체를 자동으로 생성할 뿐만 아니라 의존성도 자동으로 "주입"하므로 수동으로 "new"를 호출할 필요가 없어집니다. constructor injection, method injection, property injection 등 여러 형태의 injection이 있습니다. 이를 통해 많은 의존성이 있는 복잡한 아키텍처도 쉽게 관리할 수 있습니다.

dependency injection 컨테이너(DI 컨테이너 또는 IoC 컨테이너라고도 함)는 Deepkit에서 `@deepkit/injector`로 제공되며, Deepkit Framework에서는 App modules를 통해 이미 통합되어 있습니다. 위의 코드는 `@deepkit/injector` 패키지의 low-level API를 사용하면 다음과 같이 보입니다.

```typescript
import { InjectorContext } from '@deepkit/injector';

const injector = InjectorContext.forProviders(
    [UserRepository, HttpClient]
);

const userRepo = injector.get(UserRepository);

const users = await userRepo.getUsers();
```

이 경우 `injector` 객체가 dependency injection 컨테이너입니다. "new UserRepository"를 사용하는 대신, 컨테이너는 `get(UserRepository)`를 사용해 UserRepository 인스턴스를 반환합니다. 컨테이너를 정적으로 초기화하기 위해 provider 목록을 `InjectorContext.forProviders` Function에 전달합니다(이 경우 단순히 Class들).
DI는 의존성을 제공하는 것에 관한 것이므로, 컨테이너에 의존성을 제공하며, 이 때문에 "provider"라는 기술 용어가 사용됩니다. 

Provider에는 여러 유형이 있습니다: ClassProvider, ValueProvider, ExistingProvider, FactoryProvider. 이들을 통해 DI 컨테이너로 매우 유연한 아키텍처를 구성할 수 있습니다.

Provider 간의 모든 의존성은 자동으로 해석되며, `injector.get()` 호출이 발생하는 즉시 객체와 의존성이 생성되고 캐시되며, constructor argument(이는 constructor injection이라고 함)로 전달되거나, property로 설정(property injection이라고 함)되거나, method 호출에 전달(method injection이라고 함)됩니다.

이제 HttpClient를 다른 것으로 교체하려면, HttpClient에 대해 다른 provider(여기서는 ValueProvider)를 정의할 수 있습니다:

```typescript
const injector = InjectorContext.forProviders([
    UserRepository,
    {provide: HttpClient, useValue: new AnotherHttpClient()},
]);
```

`injector.get(UserRepository)`를 통해 UserRepository가 요청되는 즉시, AnotherHttpClient 객체를 받게 됩니다. 대안으로 여기서 ClassProvider를 사용하면, AnotherHttpClient의 모든 의존성도 DI 컨테이너에 의해 함께 관리할 수 있습니다.

```typescript
const injector = InjectorContext.forProviders([
    UserRepository,
    {provide: HttpClient, useClass: AnotherHttpClient},
]);
```

모든 유형의 provider는 [의존성 주입 프로바이더](./dependency-injection/providers.md) 섹션에서 나열되고 설명되어 있습니다.

여기서 주목할 점은 Deepkit의 DI 컨테이너는 Deepkit의 runtime types에서만 동작한다는 것입니다. 즉, Class, Type, Interface, Function을 포함하는 모든 코드는 런타임에서 type 정보를 사용할 수 있도록 Deepkit Type Compiler로 컴파일되어야 합니다. [런타임 타입](./runtime-types.md) 챕터를 참고하세요.

## 의존성 역전 (Dependency Inversion)

앞서의 UserRepository 예시는 UserRepository가 더 낮은 수준의 HTTP 라이브러리에 의존한다는 것을 보여줍니다. 또한 추상화(Interface) 대신 구체 구현(Class)을 의존성으로 선언하고 있습니다. 언뜻 보기에 객체지향 패러다임에 부합하는 것처럼 보이지만, 특히 복잡하고 큰 아키텍처에서는 문제를 야기할 수 있습니다.

대안으로는 HttpClient 의존성을 추상화(Interface)로 전환하여, HTTP 라이브러리의 코드를 UserRepository로 import하지 않도록 하는 방법이 있습니다.

```typescript
interface HttpClientInterface {
   get(path: string): Promise<any>;
}

class UserRepository {
    concstructor(
        private http: HttpClientInterface
    ) {}

    async getUsers(): Promise<Users> {
        return await this.http.get('/users');
    }
}
```

이를 의존성 역전 원칙이라고 합니다. UserRepository는 더 이상 HTTP 라이브러리 자체에 직접 의존하지 않고, 대신 추상화(Interface)에 기반합니다. 이로써 이 원칙의 두 가지 근본적인 목표를 달성합니다:

* 상위 수준 모듈은 하위 수준 모듈에서 어떤 것도 import하지 않아야 합니다.
* 구현은 추상화(Interface)에 기반해야 합니다.

두 구현(UserRepository와 HTTP 라이브러리)을 결합하는 작업은 이제 DI 컨테이너를 통해 수행할 수 있습니다.

```typescript
import { InjectorContext } from '@deepkit/injector';
import { HttpClient } from './http-client';
import { UserRepository } from './user-repository';

const injector = InjectorContext.forProviders([
    UserRepository,
    HttpClient,
]);
```

Deepkit의 DI 컨테이너는 HttpClientInterface 같은 추상 의존성(Interface)을 해석할 수 있으므로, HttpClient가 HttpClientInterface를 구현했다면 UserRepository는 자동으로 HttpClient의 구현을 얻게 됩니다. 

이는 HttpClient가 명시적으로 HttpClientInterface를 구현(`class HttpClient implements HttpClientInterface`)하거나, HttpClient의 API가 단순히 HttpClientInterface와 호환되는 경우에 이루어집니다.


HttpClient가 API를 수정하여(예: `get` Method를 제거) 더 이상 HttpClientInterface와 호환되지 않으면, DI 컨테이너는 에러를 던집니다("the HttpClientInterface dependency was not provided"). 여기서 두 구현을 결합하려는 사용자는 해결책을 찾아야 합니다. 예를 들어, HttpClientInterface를 구현하고 Method 호출을 HttpClient로 올바르게 포워딩하는 adapter Class를 등록할 수 있습니다.

대안으로, HttpClientInterface를 구체 구현으로 직접 제공할 수도 있습니다.

```typescript
import { InjectorContext, provide } from '@deepkit/injector';
import { HttpClient } from './http-client';
import { UserRepository, HttpClientInterface } from './user-repository';

const injector = InjectorContext.forProviders([
    UserRepository,
    provide<HttpClientInterface>({useClass: HttpClient}),
]);
```

이론적으로 의존성 역전 원칙에는 장점이 있지만, 실무에서는 상당한 단점이 있음을 유의해야 합니다. 더 많은 Interface를 작성해야 하므로 코드가 늘어날 뿐만 아니라, 각 구현마다 각 의존성에 대한 Interface가 생기므로 복잡성도 증가합니다. 이 비용을 지불할 가치는 애플리케이션이 일정 규모에 도달하고 이러한 유연성이 필요할 때에만 충분합니다. 다른 모든 디자인 패턴 및 원칙과 마찬가지로, 이를 적용하기 전에 비용-효용을 충분히 고려해야 합니다.

디자인 패턴은 가장 단순한 코드에까지 맹목적으로 일괄 적용해서는 안 됩니다. 그러나 복잡한 아키텍처, 대규모 애플리케이션, 또는 확장 중인 팀 등과 같은 전제가 갖춰진다면, 의존성 역전과 기타 디자인 패턴들이 비로소 진정한 힘을 발휘합니다.