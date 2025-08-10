# 提供者

在依赖注入（DI）容器中有多种方式提供依赖。最简单的方式是直接指定一个类。这也称为简写的 ClassProvider。

```typescript
new App({
    providers: [UserRepository]
});
```

这是一种特殊的提供者，因为只需要指定类。其他所有提供者都必须以对象字面量的形式指定。

默认情况下，所有提供者都被标记为单例（singleton），因此任意时刻只会存在一个实例。若要在每次部署提供者时都创建一个新实例，可以使用 `transient` 选项。这将导致每次都重新创建类或每次都执行工厂函数。

```typescript
new App({
    providers: [{ provide: UserRepository, transient: true }]
});
```

## 类提供者（ClassProvider）

除了简写的 ClassProvider 之外，还有常规的 ClassProvider，它用对象字面量而不是类来表示。

```typescript
new App({
    providers: [{ provide: UserRepository, useClass: UserRepository }]
});
```

这等价于以下两种写法：

```typescript
new App({
    providers: [{ provide: UserRepository }]
});

new App({
    providers: [UserRepository]
});
```

它可用于将某个提供者替换为另一个类。

```typescript
new App({
    providers: [{ provide: UserRepository, useClass: OtherUserRepository }]
});
```

在这个示例中，`OtherUserRepository` 类也会被 DI 容器管理，并且其所有依赖会被自动解析。

## 值提供者（ValueProvider）

可以使用该提供者提供静态值。

```typescript
new App({
    providers: [{ provide: OtherUserRepository, useValue: new OtherUserRepository() }]
});
```

由于不仅类实例可以作为依赖提供，任何值都可以作为 `useValue` 指定。符号或原始类型（string、number、boolean）也可以用作提供者令牌。

```typescript
new App({
    providers: [{ provide: 'domain', useValue: 'localhost' }]
});
```

原始类型的提供者令牌必须使用 Inject 类型声明为依赖。

```typescript
import { Inject } from '@deepkit/core';

class EmailService {
    constructor(public domain: Inject<string, 'domain'>) {}
}
```

注入别名与原始类型提供者令牌的组合也可用于为不包含运行时类型信息的包提供依赖。

```typescript
import { Inject } from '@deepkit/core';
import { Stripe } from 'stripe';

export type StripeService = Inject<Stripe, '_stripe'>;

new App({
    providers: [{ provide: '_stripe', useValue: new Stripe }]
});
```

然后在使用方按如下方式声明：

```typescript
class PaymentService {
    constructor(public stripe: StripeService) {}
}
```

## 现有提供者（ExistingProvider）

可以定义转发到已定义的提供者。

```typescript
new App({
    providers: [
        {provide: OtherUserRepository, useValue: new OtherUserRepository()},
        {provide: UserRepository, useExisting: OtherUserRepository}
    ]
});
```

## 工厂提供者（FactoryProvider）

可以使用函数为提供者提供一个值。该函数还可以包含参数，而这些参数将由 DI 容器提供。因此，可以访问其他依赖或配置选项。

```typescript
new App({
    providers: [
        {provide: OtherUserRepository, useFactory: () => {
            return new OtherUserRepository()
        }},
    ]
});

new App({
    providers: [
        {provide: OtherUserRepository, useFactory: (domain: RootConfiguration['domain']) => {
            return new OtherUserRepository(domain);
        }},
    ]
});

new App({
    providers: [
        Database,
        {provide: OtherUserRepository, useFactory: (database: Database) => {
            return new OtherUserRepository(database);
        }},
    ]
});
```

## 接口提供者（InterfaceProvider）

除了类和原始类型外，还可以提供抽象（接口）。这是通过 `provide` 函数完成的，尤其在要提供的值不包含任何类型信息时非常有用。

```typescript
import { provide } from '@deepkit/injector';

interface Connection {
    write(data: Uint16Array): void;
}

class Server {
   constructor (public connection: Connection) {}
}

class MyConnection {
    write(data: Uint16Array): void {}
}

new App({
    providers: [
        Server,
        provide<Connection>(MyConnection)
    ]
});
```

如果有多个提供者实现了 Connection 接口，将使用最后一个提供者。

作为 provide() 的参数，其他所有类型的提供者都可以使用。

```typescript
const myConnection = {write: (data: any) => undefined};

new App({
    providers: [
        provide<Connection>({ useValue: myConnection })
    ]
});

new App({
    providers: [
        provide<Connection>({ useFactory: () => myConnection })
    ]
});
```

## 异步提供者

`@deepkit/injector` 的设计不支持与异步依赖注入容器一起使用异步提供者。这是因为请求提供者也需要是异步的，从而要求整个应用在最高层级以异步方式运行。

要进行异步初始化，应将该初始化移动到应用服务器的引导流程，因为那里事件可以是异步的。或者，也可以手动触发初始化。

## 配置提供者

配置回调允许对提供者的结果进行操作。例如，这对于使用另一种依赖注入方式（方法注入）非常有用。

它们只能与模块 API 或应用 API 一起使用，并在模块上注册。

```typescript
class UserRepository  {
    private db?: Database;
    setDatabase(db: Database) {
       this.db = db;
    }
}

const rootModule = new InjectorModule([UserRepository])
     .addImport(lowLevelModule);

rootModule.configureProvider<UserRepository>(v => {
  v.setDatabase(db);
});
```

`configureProvider` 在回调中将 `v` 作为第一个参数传入，即 UserRepository 实例，可以在其上调用方法。

除了调用方法，还可以设置属性。

```typescript
class UserRepository  {
    db?: Database;
}

const rootModule = new InjectorModule([UserRepository])
     .addImport(lowLevelModule);

rootModule.configureProvider<UserRepository>(v => {
  v.db = new Database();
});
```

所有回调都会被放入队列，并按定义顺序执行。

一旦提供者被创建，队列中的调用就会在提供者的实际结果上执行。也就是说，对于 ClassProvider，这些调用会在类实例创建后应用到该实例上；对于 FactoryProvider，则应用到工厂的返回结果上；对于 ValueProvider，则应用到该值上。

为了引用不仅是静态值，还包括其他提供者，可以通过在回调参数中声明它们，将任意依赖注入到回调中。请确保这些依赖在提供者的作用域中是已知的。

```typescript
class Database {}

class UserRepository  {
    db?: Database;
}

const rootModule = new InjectorModule([UserRepository, Database])
rootModule.configureProvider<UserRepository>((v, db: Database) => {
  v.db = db;
});
```

## 名义类型

请注意，传递给 `configureProvider` 的类型（例如上一个示例中的 `UserRepository`）不是通过结构类型检查解析的，而是通过名义类型解析的。这意味着具有相同结构但身份不同的两个类/接口不兼容。对于 `get<T>` 调用或解析依赖时也是如此。

这与 TypeScript 基于结构类型检查的工作方式不同。做出这种设计决策是为了避免意外的错误配置（例如请求一个空类，它在结构上与任何类都兼容），并使代码更加健壮。

在以下示例中，`User1` 和 `User2` 类在结构上兼容，但在名义上不兼容。这意味着请求 `User1` 时不会解析为 `User2`，反之亦然。

```typescript

class User1 {
    name: string = '';
}

class User2 {
    name: string = '';
}

new App({
    providers: [User1, User2]
});
```

通过继承类和实现接口可以建立名义关系。

```typescript
class UserBase {
    name: string = '';
}

class User extends UserBase {
}

const app = new App({
    providers: [User2]
});

app.get(UserBase); // 返回 User
```

```typescript
interface UserInterface {
    name: string;
}

class User implements UserInterface {
    name: string = '';
}

const app = new App({
    providers: [User]
});

app.get<UserInterface>(); // 返回 User
```