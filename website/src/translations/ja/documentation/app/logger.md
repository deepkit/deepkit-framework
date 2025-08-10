# ロガー

Deepkit Logger は、情報のログ出力に使用できる主要な Logger クラスを備えたスタンドアロンのライブラリです。このクラスは、Deepkit アプリケーションの依存性注入コンテナで自動的に利用可能です。

`Logger` クラスにはいくつかのメソッドがあり、それぞれが `console.log` のように動作します。

| 名前             | ログレベル            | レベル ID |
|------------------|-----------------------|-----------|
| logger.error()   | エラー                | 1         |
| logger.warning() | 警告                  | 2         |
| logger.log()     | デフォルトのログ      | 3         |
| logger.info()    | 特別な情報            | 4         |
| logger.debug()   | デバッグ情報          | 5         |


既定では、ロガーのレベルは `info` で、info 以上のメッセージ（log、warning、error。ただし debug は含まない）のみを処理します。ログレベルを変更するには、例えば `logger.level = 5` を設定します。

## アプリケーションでの使用

Deepkit アプリケーションでロガーを使用するには、サービスやコントローラーに `Logger` をそのまま注入できます。

```typescript
import { Logger } from '@deepkit/logger';
import { App } from '@deepkit/app';

const app = new App();
app.command('test', (logger: Logger) => {
    logger.log('This is a <yellow>log message</yellow>');
});

app.run();
```

## カラー

ロガーはカラー付きのログメッセージをサポートします。色を付けたいテキストを囲む XML タグを使用してカラーを指定できます。

```typescript
const username = 'Peter';
logger.log(`Hi <green>${username}</green>`);
```

カラーをサポートしないトランスポーターでは、色情報は自動的に取り除かれます。デフォルトのトランスポーター（`ConsoleTransport`）では色が表示されます。利用可能な色は次のとおりです: `black`, `red`, `green`, `blue`, `cyan`, `magenta`, `white`, `grey`/`gray`.

## トランスポーター

トランスポーターは 1 つでも複数でも設定できます。Deepkit アプリケーションでは、`ConsoleTransport` トランスポーターが自動的に設定されます。追加のトランスポーターを設定するには、[セットアップ呼び出し](dependency-injection.md#di-setup-calls)を使用します:

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

すべてのトランスポーターを新しいセットに置き換えるには、`setTransport` を使用します:

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

## スコープ付きロガー

スコープ付きロガーは各ログエントリに任意の領域名を追加します。これにより、アプリケーション内のどのサブ領域からログエントリが発生したかを判断するのに役立ちます。

```typescript
const scopedLogger = logger.scoped('database');
scopedLogger.log('Query', query);
```

サービスにスコープ付きロガーを注入するために使用できる `ScopedLogger` 型もあります。

```typescript
import { ScopedLogger } from '@deepkit/logger';

class MyService {
    constructor(protected logger: ScopedLogger) {}
    doSomething() {
        this.logger.log('This is wild');
    }
}
```

これで、スコープ付きロガーからのすべてのメッセージには `MyService` というスコープ名が前置されます。

## フォーマッター

フォーマッターを使うと、メッセージ形式を変更できます。例えば、タイムスタンプを追加できます。アプリケーションが `server:start` で起動された場合、他にフォーマッターがないときは自動的に `DefaultFormatter` が追加されます（タイムスタンプ、範囲、ログレベルを追加します）。

## コンテキストデータ

ログエントリにコンテキストデータを追加するには、最後の引数としてシンプルなオブジェクトリテラルを渡します。少なくとも 2 つの引数を持つログ呼び出しだけがコンテキストデータを含めることができます。

```typescript
const query = 'SELECT *';
const user = new User;
logger.log('Query', {query, user}); // 最後の引数がコンテキストデータ
logger.log('Another', 'wild log entry', query, {user}); // 最後の引数がコンテキストデータ

logger.log({query, user}); // これはコンテキストデータとしては扱われません。
```