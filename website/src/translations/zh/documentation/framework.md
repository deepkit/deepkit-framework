# Deepkit 框架

Deepkit 框架基于 `@deepkit/app` 中的 [Deepkit App](./app.md)，并在 `@deepkit/framework` 中提供 `FrameworkModule` 模块，可在你的应用中导入。

`App` 抽象提供：

- CLI 命令
- 配置加载（环境变量、点文件（dotfiles）、自定义）
- 模块系统
- 强大的服务容器
- 用于控制器、提供者、监听器等的注册表和钩子

`FrameworkModule` 模块带来额外特性：

- 应用服务器
    - HTTP 服务器
    - RPC 服务器
    - 多进程负载均衡
    - SSL
- 调试用 CLI 命令
- 数据库迁移配置/命令
- 通过 `{debug: true}` 选项提供调试/分析器 GUI
- 交互式 API 文档（类似 Swagger）
- DatabaseRegistry、ProcessLocking、Broker、Sessions 的提供者
- 集成测试 API

你可以使用或不使用 `FrameworkModule` 来编写应用。

## 安装

Deepkit 框架基于 [Deepkit App](./app.md)。请确保你已遵循其安装说明。
之后你可以安装 Deepkit 框架并在你的 `App` 中导入 `FrameworkModule`。

```sh
npm install @deepkit/framework
```

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    imports: [new FrameworkModule({ debug: true })]
});

app.command('test', (logger: Logger) => {
    logger.log('Hello World!');
});

app.run();
```

由于应用现在导入了 `FrameworkModule`，你会看到有更多按主题分组的可用命令。

其中之一是 `server:start`，它会启动 HTTP 服务器。要使用它，我们需要至少注册一个 HTTP 路由。

```typescript
import { App } from '@deepkit/app';
import { HttpRouterRegistry } from '@deepkit/http';

const app = new App({
    imports: [new FrameworkModule({ debug: true })]
});

app.command('test', (logger: Logger) => {
    logger.log('Hello World!');
});


const router = app.get(HttpRouterRegistry);

router.get('/', () => {
    return 'Hello World';
})

app.run();
```

当你再次执行 `server:start` 命令时，你会看到 HTTP 服务器已经启动，并且路由 `/` 可用。

```sh
$ ./node_modules/.bin/ts-node ./app.ts server:start
```

```sh
$ curl http://localhost:8080/
Hello World
```

要处理请求，请阅读 [HTTP](http.md) 或 [RPC](rpc.md) 章节。在 [App](app.md) 章节中你可以进一步了解 CLI 命令。

## App

`App` 类是你的应用的主要入口。它负责加载所有模块、配置，并启动应用。
它还负责加载并执行所有 CLI 命令。像 FrameworkModule 这样的模块会提供额外的命令、注册事件监听器、为 HTTP/RPC 提供控制器、服务提供者等。

该 `app` 对象也可在不运行 CLI 控制器的情况下用于访问依赖注入容器。

```typescript
const app = new App({
    imports: [new FrameworkModule]
});

// 访问所有已注册的服务
const eventDispatcher = app.get(EventDispatcher);
```

你可以获取到 `EventDispatcher`，因为 `FrameworkModule` 将其与许多其他服务（Logger、ApplicationServer，以及[更多](https://github.com/deepkit/deepkit-framework/blob/master/packages/framework/src/module.ts)）一起注册为服务提供者。

你也可以注册你自己的服务。

```typescript

class MyService {
    constructor(private logger: Logger) {
    }

    helloWorld() {
        this.logger.log('Hello World');
    }
}

const app = new App({
    providers: [MyService],
    imports: [new FrameworkModule]
});

const service = app.get(MyService);

service.helloWorld();
```

### 调试器

你的应用及所有模块的配置值可以在调试器中显示。启用 `FrameworkModule` 的 debug 选项，并打开 `http://localhost:8080/_debug/configuration`。

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

new App({
    config: Config,
    controllers: [MyWebsite],
    imports: [
        new FrameworkModule({
            debug: true,
        })
    ]
}).run();
```

![调试器配置](/assets/documentation/framework/debugger-configuration.png)

你也可以使用 `ts-node app.ts app:config` 来显示所有可用的配置选项、当前值、默认值、描述和数据类型。

```sh
$ ts-node app.ts app:config
Application config
┌─────────┬───────────────┬────────────────────────┬────────────────────────┬─────────────┬───────────┐
│ (index) │     name      │         value          │      defaultValue      │ description │   type    │
├─────────┼───────────────┼────────────────────────┼────────────────────────┼─────────────┼───────────┤
│    0    │  'pageTitle'  │     'Other title'      │      'Cool site'       │     ''      │ 'string'  │
│    1    │   'domain'    │     'example.com'      │     'example.com'      │     ''      │ 'string'  │
│    2    │    'port'     │          8080          │          8080          │     ''      │ 'number'  │
│    3    │ 'databaseUrl' │ 'mongodb://localhost/' │ 'mongodb://localhost/' │     ''      │ 'string'  │
│    4    │    'email'    │         false          │         false          │     ''      │ 'boolean' │
│    5    │ 'emailSender' │       undefined        │       undefined        │     ''      │ 'string?' │
└─────────┴───────────────┴────────────────────────┴────────────────────────┴─────────────┴───────────┘
Modules config
┌─────────┬──────────────────────────────┬─────────────────┬─────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────┐
│ (index) │           name               │      value      │  defaultValue   │                                            description                                             │    type    │
├─────────┼──────────────────────────────┼─────────────────┼─────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────┤
│    0    │       'framework.host'       │   'localhost'   │   'localhost'   │                                                 ''                                                 │  'string'  │
│    1    │       'framework.port'       │      8080       │      8080       │                                                 ''                                                 │  'number'  │
│    2    │    'framework.httpsPort'     │    undefined    │    undefined    │ 'If httpsPort and ssl is defined, then the https server is started additional to the http-server.' │ 'number?'  │
│    3    │    'framework.selfSigned'    │    undefined    │    undefined    │           'If for ssl: true the certificate and key should be automatically generated.'            │ 'boolean?' │
│    4    │ 'framework.keepAliveTimeout' │    undefined    │    undefined    │                                                 ''                                                 │ 'number?'  │
│    5    │       'framework.path'       │       '/'       │       '/'       │                                                 ''                                                 │  'string'  │
│    6    │     'framework.workers'      │        1        │        1        │                                                 ''                                                 │  'number'  │
│    7    │       'framework.ssl'        │      false      │      false      │                                       'Enables HTTPS server'                                       │ 'boolean'  │
│    8    │    'framework.sslOptions'    │    undefined    │    undefined    │                   'Same interface as tls.SecureContextOptions & tls.TlsOptions.'                   │   'any'    │
...
```

## 应用服务器

## 文件结构

## 自动 CRUD

## 事件

Deepkit 框架带有多种事件令牌，可以在其上注册事件监听器。

参见 [事件](./app/events.md) 章节以了解事件的工作方式。

### 派发事件

事件通过 `EventDispatcher` 类发送。在 Deepkit 应用中，这可以通过依赖注入提供。

```typescript
import { cli, Command } from '@deepkit/app';
import { EventDispatcher } from '@deepkit/event';

@cli.controller('test')
export class TestCommand implements Command {
    constructor(protected eventDispatcher: EventDispatcher) {
    }

    async execute() {
        this.eventDispatcher.dispatch(UserAdded, new UserEvent({ username: 'Peter' }));
    }
}
```