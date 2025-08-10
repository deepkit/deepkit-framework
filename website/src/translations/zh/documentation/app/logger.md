# Logger

Deepkit Logger 是一个独立的库，提供一个主要的 Logger 类用于记录日志信息。该类会自动在 Deepkit 应用的依赖注入容器中可用。

`Logger` 类提供了多个方法，它们的行为与 `console.log` 一致。

| 名称             | 日志级别             | 级别 ID |
|------------------|----------------------|---------|
| logger.error()   | 错误                 | 1       |
| logger.warning() | 警告                 | 2       |
| logger.log()     | 默认日志             | 3       |
| logger.info()    | 特殊信息             | 4       |
| logger.debug()   | 调试信息             | 5       |


默认情况下，logger 的级别是 `info`，也就是说它只处理 info 以及更高（即 log、warning、error，但不包括 debug）的消息。要更改日志级别，例如调用 `logger.level = 5`。

## 在应用中使用

要在 Deepkit 应用中使用 logger，只需将 `Logger` 注入到你的服务或控制器中。

```typescript
import { Logger } from '@deepkit/logger';
import { App } from '@deepkit/app';

const app = new App();
app.command('test', (logger: Logger) => {
    logger.log('This is a <yellow>log message</yellow>');
});

app.run();
```

## 颜色

logger 支持彩色日志消息。你可以通过使用包裹目标文本的 XML 标签来提供颜色。

```typescript
const username = 'Peter';
logger.log(`Hi <green>${username}</green>`);
```

对于不支持颜色的传输器，会自动移除颜色信息。在默认传输器（`ConsoleTransport`）中会显示颜色。可用的颜色包括：`black`、`red`、`green`、`blue`、`cyan`、`magenta`、`white` 和 `grey`/`gray`。

## 传输器

你可以配置单个传输器或多个传输器。在 Deepkit 应用中，会自动配置 `ConsoleTransport` 传输器。要配置额外的传输器，可以使用[设置调用](dependency-injection.md#di-setup-calls)：

```typescript
import { Logger, LoggerTransport } from '@deepkit/logger';

export class MyTransport implements LoggerTransport {
    write(message: string, level: LoggerLevel, rawMessage: string) {
        process.stdout.write(JSON.stringify({message: rawMessage, level, time: new Date}) + '\n');
    }

    supportsColor() {
        return false;
    }
}

new App()
    .setup((module, config) => {
        module.configureProvider<Logger>(v => v.addTransport(new MyTransport));
    })
    .run();
```

要用一组新的传输器替换所有传输器，请使用 `setTransport`：

```typescript
import { Logger } from '@deepkit/logger';

new App()
.setup((module, config) => {
    module.configureProvider<Logger>(v => v.setTransport([new MyTransport]));
})
.run();
```

```typescript
import { Logger, JSONTransport } from '@deepkit/logger';

new App()
    .setup((module, config) => {
        module.configureProvider<Logger>(v => v.setTransport([new JSONTransport]));
    })
    .run();
```

## 作用域 Logger

作用域 logger 会为每条日志添加任意的区域名称，这有助于判断日志来自应用的哪个子区域。

```typescript
const scopedLogger = logger.scoped('database');
scopedLogger.log('Query', query);
```

还提供了 `ScopedLogger` 类型，你可以将其注入到服务中来获取带作用域的 logger。

```typescript
import { ScopedLogger } from '@deepkit/logger';

class MyService {
    constructor(protected logger: ScopedLogger) {}
    doSomething() {
        this.logger.log('This is wild');
    }
}
```

现在，来自作用域 logger 的所有消息都会带有 `MyService` 作用域名称前缀。

## 格式化器

通过格式化器，你可以更改消息格式，例如添加时间戳。当应用通过 `server:start` 启动时，如果没有其他可用的格式化器，会自动添加 `DefaultFormatter`（它会添加时间戳、范围和日志级别）。

## 上下文数据

要向日志条目添加上下文数据，只需将一个简单的对象字面量作为最后一个参数添加。只有至少两个参数的日志调用才可以包含上下文数据。

```typescript
const query = 'SELECT *';
const user = new User;
logger.log('Query', {query, user}); //最后一个参数是上下文数据
logger.log('Another', 'wild log entry', query, {user}); //最后一个参数是上下文数据

logger.log({query, user}); //这不会被当作上下文数据处理。
```