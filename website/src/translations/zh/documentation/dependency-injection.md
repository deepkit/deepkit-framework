# 依赖注入

依赖注入（DI）是一种设计模式，其中类和函数接收它们的依赖。它遵循控制反转（IoC）原则，有助于更好地分离复杂代码，从而显著提升可测试性、模块化以及清晰度。尽管还有其他用于应用 IoC 原则的设计模式，例如服务定位器模式，但 DI 已经确立为主导模式，尤其是在企业软件中。

为说明 IoC 原则，下面是一个示例：

```typescript
import { HttpClient } from 'http-library';

class UserRepository {
    async getUsers(): Promise<Users> {
        const client = new HttpClient();
        return await client.get('/users');
    }
}
```

UserRepository 类将 HttpClient 作为其依赖。本身这个依赖并不值得大书特书，但问题在于 `UserRepository` 自己创建了 HttpClient。
看起来将 HttpClient 的创建封装进 UserRepository 是个好主意，但事实并非如此。如果我们想替换 HttpClient 怎么办？如果我们想在单元测试中测试 UserRepository，而又不允许真实的 HTTP 请求发出，该怎么办？我们如何得知该类甚至使用了一个 HttpClient？

## 控制反转

按照控制反转（IoC）的思路，下面是一个替代方案：在构造函数中将 HttpClient 作为显式依赖（也称构造函数注入）。

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

现在，创建 HttpClient 的责任不再在 UserRepository，而在于 UserRepository 的使用者。这就是控制反转（IoC）。控制被反转或颠倒。更具体地说，这段代码应用了依赖注入，因为依赖是被接收（注入）的，而不再由自身创建或请求。依赖注入只是 IoC 的一种变体。

## 服务定位器

除了 DI，服务定位器（SL）也是应用 IoC 原则的一种方式。它通常被认为是依赖注入的对立面，因为它是请求依赖，而不是接收依赖。如果在上述代码中像下面这样请求 HttpClient，这就被称为服务定位器模式。

```typescript
class UserRepository {
    async getUsers(): Promise<Users> {
        const client = locator.getHttpClient();
        return await client.get('/users');
    }
}
```

函数 `locator.getHttpClient` 可以取任意名称。替代方案可能是像 `useContext(HttpClient)`、`getHttpClient()`、`await import("client")` 这样的函数调用，或像 `container.get(HttpClient)`、`container.http` 这样的容器查询。导入一个全局则是服务定位器的一个稍有不同的变体，使用模块系统本身作为定位器：

```typescript
import { httpClient } from 'clients'

class UserRepository {
    async getUsers(): Promise<Users> {
        return await httpClient.get('/users');
    }
}
```

这些变体的共同点在于它们显式地请求 HttpClient 依赖，并且代码知道存在一个服务容器。它将你的代码与框架紧密耦合，这是你希望避免的，以保持代码整洁。

服务请求不仅可能出现在属性的默认值上，还可能在代码中部的某个地方发生。由于发生在代码中部意味着它不是类型接口的一部分，HttpClient 的使用被隐藏起来。根据请求 HttpClient 的变体不同，有时用另一个实现替换它会非常困难，甚至完全不可能。尤其在单元测试领域以及出于清晰性的考虑，这里可能会出现困难，因此在某些情况下，服务定位器现在被归类为反模式。

## 依赖注入

使用依赖注入，不再去请求依赖，而是由使用者显式提供，或由代码接收依赖。使用者无法访问任何服务容器，也不知道 `HttpClient` 是如何被创建或获取的。本质上，它使你的代码能够与 IoC 框架解耦，从而更干净。

它只声明自己需要一个 `HttpClient` 类型。依赖注入相对服务定位器的一个关键差异和优势在于：使用依赖注入的代码即便没有任何服务容器和服务标识系统也能很好地工作（你不需要给你的服务起一个名字）。它只是一个类型声明，即使脱离 IoC 框架上下文也同样适用。

正如先前的示例所示，依赖注入模式已经在那里应用了。具体地说，可以看到构造函数注入，因为依赖是在构造函数中声明的。因此，UserRepository 现在必须如下实例化。

```typescript
const users = new UserRepository(new HttpClient());
```

想要使用 UserRepository 的代码也必须提供（注入）它的所有依赖。HttpClient 是每次都创建还是每次都使用同一个，现在由类的使用者决定，而不再由类本身决定。它不再像服务定位器那样被请求，或者像最初的示例那样由自身完全创建。这种流程的反转带来了多种优势：

* 代码更易于理解，因为所有依赖都是显式可见的。
* 代码更易于测试，因为所有依赖都是唯一的，并且在需要时可以轻松修改。
* 代码更加模块化，因为依赖可以轻松替换。
* 它促进关注点分离原则，因为 UserRepository 不再需要自己负责创建非常复杂的依赖。

但一个明显的缺点也可以直接看出来：我真的需要自己创建或管理像 HttpClient 这样的所有依赖吗？是，也不是。是，因为在许多情况下，自己管理依赖完全是合理的。一个良好 API 的标志是依赖不会失控，即便如此仍然令人愉快地使用。对于许多应用或复杂库，这很可能就是事实。为了以简化的方式向用户提供一个拥有众多依赖的非常复杂的底层 API，外观模式非常合适。

## 依赖注入容器

然而，对于更复杂的应用，没有必要自己管理所有依赖，因为这正是所谓依赖注入容器的用途。它不仅会自动创建所有对象，还会自动“注入”依赖，因此不再需要手动的 “new” 调用。注入有多种类型，例如构造函数注入、方法注入或属性注入。这样，即便是拥有许多依赖的复杂架构也可以轻松管理。

Deepkit 提供了依赖注入容器（也称 DI 容器或 IoC 容器），位于 `@deepkit/injector`，或通过 Deepkit Framework 中的 App 模块已集成就绪。使用 `@deepkit/injector` 包的低层 API，上面的代码将如下所示。

```typescript
import { InjectorContext } from '@deepkit/injector';

const injector = InjectorContext.forProviders(
    [UserRepository, HttpClient]
);

const userRepo = injector.get(UserRepository);

const users = await userRepo.getUsers();
```

在这个例子中，`injector` 对象就是依赖注入容器。容器使用 `get(UserRepository)` 返回一个 UserRepository 实例，而不是使用 “new UserRepository”。为了静态初始化容器，会将提供者列表传递给 `InjectorContext.forProviders` 函数（在本例中就是这些类）。
由于 DI 的核心是提供依赖，因此要将依赖提供给容器，这也就是“provider（提供者）”这一术语的由来。

提供者有多种类型：ClassProvider、ValueProvider、ExistingProvider、FactoryProvider。它们结合起来，使得可以用 DI 容器映射出非常灵活的架构。

提供者之间的所有依赖都会被自动解析，一旦发生 `injector.get()` 调用，对象和依赖就会被创建、缓存，并被正确地作为构造函数参数传递（称为构造函数注入）、设置为属性（称为属性注入），或传递给方法调用（称为方法注入）。

现在要将 HttpClient 替换为另一个实现，可以为 HttpClient 定义另一个提供者（此处是 ValueProvider）：

```typescript
const injector = InjectorContext.forProviders([
    UserRepository,
    {provide: HttpClient, useValue: new AnotherHttpClient()},
]);
```

一旦通过 `injector.get(UserRepository)` 请求 UserRepository，它就会接收到 AnotherHttpClient 对象。或者，也可以很好地使用 ClassProvider，这样 AnotherHttpClient 的所有依赖也由 DI 容器管理。

```typescript
const injector = InjectorContext.forProviders([
    UserRepository,
    {provide: HttpClient, useClass: AnotherHttpClient},
]);
```

所有类型的提供者都在[依赖注入提供者](./dependency-injection/providers.md)一节中列出并解释。

需要在此提及的是，Deepkit 的 DI 容器仅与 Deepkit 的运行时类型一起工作。这意味着，任何包含类、类型、接口和函数的代码都必须由 Deepkit Type Compiler 编译，以便在运行时拥有类型信息。参见章节[运行时类型](./runtime-types.md)。

## 依赖反转

前面的 UserRepository 示例显示，UserRepository 依赖于更低层的 HTTP 库。此外，声明为依赖的是具体实现（类），而不是抽象（接口）。乍一看，这似乎符合面向对象范式，但在复杂和大型架构中可能会导致问题。

另一种做法是将 HttpClient 依赖转换为抽象（接口），从而不再将 HTTP 库的代码导入到 UserRepository 中。

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

这被称为依赖反转原则。UserRepository 不再直接依赖 HTTP 库，而是基于抽象（接口）。它因此解决了该原则中的两个基本目标：

* 高层模块不应从低层模块导入任何东西。
* 实现应当基于抽象（接口）。

现在可以通过 DI 容器将这两个实现（带有 HTTP 库的 UserRepository）合并在一起。

```typescript
import { InjectorContext } from '@deepkit/injector';
import { HttpClient } from './http-client';
import { UserRepository } from './user-repository';

const injector = InjectorContext.forProviders([
    UserRepository,
    HttpClient,
]);
```

由于 Deepkit 的 DI 容器能够解析抽象依赖（接口），例如这里的 HttpClientInterface，UserRepository 会自动获得 HttpClient 的实现，因为 HttpClient 实现了接口 HttpClientInterface。

这可以通过 HttpClient 明确实现 HttpClientInterface（`class HttpClient implements HttpClientInterface`），或者 HttpClient 的 API 仅仅与 HttpClientInterface 兼容来实现。

一旦 HttpClient 修改了它的 API（例如移除了 `get` 方法），从而不再与 HttpClientInterface 兼容，DI 容器将抛出一个错误（"the HttpClientInterface dependency was not provided"）。此时，想要将这两个实现组合起来的使用者有义务找到解决方案。举例来说，可以在这里注册一个适配器类，该类实现 HttpClientInterface，并将方法调用正确地转发到 HttpClient。

作为替代方案，也可以直接为 HttpClientInterface 提供一个具体实现。

```typescript
import { InjectorContext, provide } from '@deepkit/injector';
import { HttpClient } from './http-client';
import { UserRepository, HttpClientInterface } from './user-repository';

const injector = InjectorContext.forProviders([
    UserRepository,
    provide<HttpClientInterface>({useClass: HttpClient}),
]);
```

需要注意的是，尽管理论上依赖反转原则具有其优势，但在实践中也有显著的劣势。它不仅会导致更多代码（因为必须编写更多接口），还会带来更多复杂性（因为每个实现现在对每个依赖都有一个接口）。只有当应用达到一定规模并需要这种灵活性时，这种代价才值得付出。与任何设计模式和原则一样，这一原则也有其成本-收益权衡，在应用之前应当深思熟虑。

设计模式不应被盲目且一刀切地用于最简单的代码。然而，当具备复杂架构、大型应用或团队扩张等前提条件时，依赖反转和其他设计模式才能真正发挥其力量。