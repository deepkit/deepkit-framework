# Abhängigkeitsinjektion

Alle Befehle haben vollen Zugriff auf den Dependency-Injection-Container. Sie können Abhängigkeiten im Konstruktor Ihres Befehls oder Controllers definieren, und der Dependency-Injection-Container versucht, diese aufzulösen. 

Siehe das Kapitel [Abhängigkeitsinjektion](../dependency-injection.md) für weitere Informationen.

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

Sie können beliebig viele Abhängigkeiten definieren. Der Dependency-Injection-Container wird sie automatisch auflösen.