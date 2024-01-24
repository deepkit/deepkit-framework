# Dependency Injection

All commands have full access to the Dependency Injection Container. You can define dependencies in the constructor of your
command or controller and the Dependency Injection Container tries to resolve it.

See the chapter [Dependency Injection](../dependency-injection.md) for more information.

```typescript
import { App, cli } from '@deepkit/app';
import { ConsoleTransport, Logger } from '@deepkit/logger';

new App({
  providers: [{ provide: Logger, useValue: new Logger([new ConsoleTransport()]) }],
}).command('test', (logger: Logger) => {
  logger.log('Hello World!');
});
```

```typescript
@cli.controller('test', {
    description: 'My super first command'
})
class TestCommand {
    constructor(protected logger: Logger) {
    }

    async execute() {
        this.logger.log('Hello World!');
    }
}

new App({
    providers: [{provide: Logger, useValue: new Logger([new ConsoleTransport]}],
    controllers: [TestCommand]
}).run();
```

You can define as many dependencies as you want. The Dependency Injection Container will resolve them automatically.
