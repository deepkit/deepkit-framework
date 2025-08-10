# 의존성 주입

모든 커맨드는 의존성 주입 컨테이너에 완전하게 접근할 수 있습니다. 커맨드나 컨트롤러의 생성자에서 의존성을 정의하면 의존성 주입 컨테이너가 이를 해결하려고 시도합니다.

자세한 내용은 [의존성 주입](../dependency-injection.md) 장을 참조하세요.

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

원하는 만큼의 의존성을 정의할 수 있습니다. 의존성 주입 컨테이너가 이를 자동으로 해결합니다.