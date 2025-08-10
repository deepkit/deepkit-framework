# 依存性注入

すべてのコマンドは依存性注入コンテナに完全にアクセスできます。コマンドやコントローラーのコンストラクターで依存関係を定義でき、依存性注入コンテナがそれを解決しようとします。

詳しくは [依存性注入](../dependency-injection.md) の章を参照してください。

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

必要なだけ多くの依存関係を定義できます。依存性注入コンテナがそれらを自動的に解決します。