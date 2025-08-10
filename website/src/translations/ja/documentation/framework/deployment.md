# デプロイ

この章では、アプリケーションを JavaScript にコンパイルし、本番環境向けに設定し、Docker を使用してデプロイする方法を学びます。

## TypeScript をコンパイルする

`app.ts` ファイルに次のようなアプリケーションがあるとします:

```typescript
#!/usr/bin/env ts-node-script
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http } from '@deepkit/http';

class Config {
    title: string = 'DEV my Page';
}

class MyWebsite {
    constructor(protected title: Config['title']) {
    }

    @http.GET()
    helloWorld() {
        return 'Hello from ' + this.title;
    }
}

new App({
    config: Config,
    controllers: [MyWebsite],
    imports: [new FrameworkModule]
})
    .loadConfigFromEnv()
    .run();
```

`ts-node app.ts server:start` を使用すると、すべてが正しく動作することがわかります。本番環境では通常、`ts-node` でサーバーを起動しません。JavaScript にコンパイルしてから Node で実行します。そのためには、適切な設定オプションを備えた正しい `tsconfig.json` が必要です。「First Application」セクションでは、`tsconfig.json` は JavaScript を `.dist` フォルダーに出力するように設定されています。あなたも同様に設定しているものとします。

コンパイラ設定がすべて正しく、`outDir` が `dist` などのフォルダーを指していれば、プロジェクトで `tsc` コマンドを実行した瞬間に、`tsconfig.json` にリンクされたファイルはすべて JavaScript にコンパイルされます。このリストにはエントリーファイルを指定するだけで十分です。インポートされるファイルも自動的にコンパイルされるため、`tsconfig.json` に明示的に追加する必要はありません。`tsc` は `npm install typescript` をインストールすると含まれる TypeScript の一部です。

```sh
$ ./node_modules/.bin/tsc
```

TypeScript コンパイラは成功した場合、何も出力しません。`dist` の出力を確認できます。

```sh
$ tree dist
dist
└── app.js
```

ファイルが 1 つだけであることがわかります。`node distapp.js` で実行すれば、`ts-node app.ts` と同じ機能が得られます。

デプロイでは、TypeScript ファイルが正しくコンパイルされ、Node から直接すべてが動作することが重要です。`node_modules` を含む `dist` フォルダーをそのまま移動し、`node distapp.js server:start` を実行すれば、アプリは正常にデプロイされます。しかし、アプリを正しくパッケージ化するために Docker のような他のソリューションを使用するのが一般的です。

## 設定

本番環境では、サーバーを `localhost` にバインドするのではなく、通常は `0.0.0.0` で全デバイスにバインドします。リバースプロキシの背後にいない場合は、ポートを 80 に設定するでしょう。これら 2 つの設定を構成するには、`FrameworkModule` をカスタマイズする必要があります。対象となる 2 つのオプションは `host` と `port` です。それらを環境変数や .dotenv ファイル経由で外部から設定できるようにするには、まずそれを許可する必要があります。幸い、上記のコードは `loadConfigFromEnv()` メソッドで既にそれを行っています。

アプリケーションの設定オプションの設定方法について詳しくは、[設定](../app/configuration.md) の章を参照してください。

利用可能な設定オプションとその値を確認するには、`ts-node app.ts app:config` コマンドを使用できます。Framework Debugger でも確認できます。

### SSL

アプリケーションを SSL を用いた HTTPS で実行することが推奨され（場合によっては必須）です。SSL を構成するためのオプションがいくつかあります。SSL を有効にするには
`framework.ssl` を使用し、次のオプションでそのパラメータを設定します。

|===
|名前|Type|説明

|framework.ssl|boolean|true の場合、HTTPS サーバーを有効にします
|framework.httpsPort|number?|httpsPort と ssl が定義されている場合、http サーバーに加えて https サーバーも起動されます。
|framework.sslKey|string?|https 用の SSL キーファイルへのファイルパス
|framework.sslCertificate|string?|https 用の証明書ファイルへのファイルパス
|framework.sslCa|string?|https 用の CA ファイルへのファイルパス
|framework.sslCrl|string?|https 用の CRL ファイルへのファイルパス
|framework.sslOptions|object?|tls.SecureContextOptions および tls.TlsOptions と同じ Interface。
|===

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// ここに config と HTTP コントローラーを記述

new App({
    config: Config,
    controllers: [MyWebsite],
    imports: [
        new FrameworkModule({
            ssl: true,
            selfSigned: true,
            sslKey: __dirname + 'path/ssl.key',
            sslCertificate: __dirname + 'path/ssl.cert',
            sslCA: __dirname + 'path/ssl.ca',
        })
    ]
})
    .run();
```

### ローカル SSL

ローカル開発環境では、`framework.selfSigned` オプションで自己署名の HTTPS を有効にできます。

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// ここに config と HTTP コントローラーを記述

new App({
    config: config,
    controllers: [MyWebsite],
    imports: [
        new FrameworkModule({
            ssl: true,
            selfSigned: true,
        })
    ]
})
    .run();
```

```sh
$ ts-node app.ts server:start
2021-06-13T18:04:01.563Z [LOG] Start HTTP server, using 1 workers.
2021-06-13T18:04:01.598Z [LOG] Self signed certificate for localhost created at var/self-signed-localhost.cert
2021-06-13T18:04:01.598Z [LOG] Tip: If you want to open this server via chrome for localhost, use chrome://flags/#allow-insecure-localhost
2021-06-13T18:04:01.606Z [LOG] HTTP MyWebsite
2021-06-13T18:04:01.606Z [LOG]     GET / helloWorld
2021-06-13T18:04:01.606Z [LOG] HTTPS listening at https://localhost:8080/
```

このサーバーを今起動すると、HTTP サーバーは `https:localhost:8080` で HTTPS として利用可能になります。自己署名証明書はセキュリティリスクとみなされるため、この URL を Chrome で開くとエラーメッセージ「NET::ERR_CERT_INVALID」が表示されます: `chrome:flagsallow-insecure-localhost`。