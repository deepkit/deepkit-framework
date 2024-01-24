# Logger

Deepkit Logger is a standalone library with a primary Logger class that you can use to log information. This class is automatically available in the Dependency Injection container of your Deepkit application.

The `Logger` class has several methods, each of which behaves like `console.log`.

| Name             | Log Level           | Level id |
| ---------------- | ------------------- | -------- |
| logger.error()   | Error               | 1        |
| logger.warning() | Warning             | 2        |
| logger.log()     | Default log         | 3        |
| logger.info()    | Special information | 4        |
| logger.debug()   | Debug information   | 5        |

By default, a logger has `info` level, i.e. it processes only info messages and more (i.e. log, warning, error, but not debug). To change the log level call for example `logger.level = 5`.

## Use in the application

To use the logger in your Deepkit application, you can simply inject `Logger` into your services or controllers.

```typescript
import { App } from '@deepkit/app';
import { Logger } from '@deepkit/logger';

const app = new App();
app.command('test', (logger: Logger) => {
  logger.log('This is a <yellow>log message</yellow>');
});

app.run();
```

## Colors

The logger supports colored log messages. You can provide colors by using XML tags that surround the text you want to appear in color.

```typescript
const username = 'Peter';
logger.log(`Hi <green>${username}</green>`);
```

For transporters that do not support colors, the color information is automatically removed. In the default transporter (`ConsoleTransport`) the color is displayed. The following colors are available: `black`, `red`, `green`, `blue`, `cyan`, `magenta`, `white` and `grey`/`gray`.

## Transporter

You can configure a single transporter or multiple transporters. In a Deepkit application, the `ConsoleTransport` transporter is configured automatically. To configure additional transporters, you can use [Setup Calls](dependency-injection.md#di-setup-calls):

```typescript
import { Logger, LoggerTransport } from '@deepkit/logger';

export class MyTransport implements LoggerTransport {
  write(message: string, level: LoggerLevel, rawMessage: string) {
    process.stdout.write(JSON.stringify({ message: rawMessage, level, time: new Date() }) + '\n');
  }

  supportsColor() {
    return false;
  }
}

new App()
  .setup((module, config) => {
    module.setupProvider(Logger).addTransport(new MyTransport());
  })
  .run();
```

To replace all transporters with a new set of transporters, use `setTransport`:

```typescript
import { Logger } from '@deepkit/logger';

new App()
  .setup((module, config) => {
    module.setupProvider(Logger).setTransport([new MyTransport()]);
  })
  .run();
```

```typescript
import { JSONTransport, Logger } from '@deepkit/logger';

new App()
  .setup((module, config) => {
    module.setupProvider(Logger).setTransport([new JSONTransport()]);
  })
  .run();
```

## Scoped Logger

Scoped loggers add an arbitrary area name to each log entry, which can be helpful in determining which subarea of your application the log entry originated from.

```typescript
const scopedLogger = logger.scoped('database');
scopedLogger.log('Query', query);
```

There is also a `ScopedLogger` type that you can use to inject scoped loggers into your services.

```typescript
import { ScopedLogger } from '@deepkit/logger';

class MyService {
  constructor(protected logger: ScopedLogger) {}
  doSomething() {
    this.logger.log('This is wild');
  }
}
```

All messages from a scoped logger are prefixed with the `MyService` scope name now.

## Formatter

With formatters, you can change the message format, e.g. add the timestamp. When an application is started via `server:start`, a `DefaultFormatter` is automatically added (which adds timestamp, range and log level) if no other formatter is available.

## JSON Transporter

To change the output to JSON protocols, you can use the supplied `JSONTransport`.

## Context Data

To add contextual data to a log entry, add a simple object literal as the last argument. Only log calls with at least two arguments can contain contextual data.

```typescript
const query = 'SELECT *';
const user = new User();
logger.log('Query', { query, user }); //last argument is context data
logger.log('Another', 'wild log entry', query, { user }); //last argument is context data

logger.log({ query, user }); //this is not handled as context data.
```
