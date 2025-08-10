# 依赖注入

所有命令都可以完全访问依赖注入容器。你可以在命令或控制器的构造函数中定义依赖项，
并且依赖注入容器会尝试解析它们。

更多信息请参阅[依赖注入](../dependency-injection.md)一章。

```typescript
import { App, cli } from '@deepkit/app';
import { Logger, ConsoleTransport } from '@deepkit/logger';

new App({
    providers: [{provide: Logger, useValue: new Logger([new ConsoleTransport])}],
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

你可以根据需要定义任意多的依赖项。依赖注入容器会自动解析它们。