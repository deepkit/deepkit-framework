# 公開ディレクトリ

`FrameworkModule` は、画像、PDF、バイナリなどの静的ファイルを HTTP 経由で配信する方法を提供します。`publicDir` 設定オプションにより、HTTP コントローラーのルートに至らないリクエストに対するデフォルトのエントリーポイントとして使用するフォルダーを指定できます。デフォルトでは、この動作は無効（空の値）になっています。

公開ファイルの提供を有効にするには、`publicDir` を任意のフォルダーに設定します。通常は、分かりやすいように `publicDir` のような名前を選びます。

```
.
├── app.ts
└── publicDir
    └── logo.jpg
```

`publicDir` オプションを変更するには、`FrameworkModule` の最初の引数を変更します。

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// your config and http controller here

new App({
    config: config,
    controllers: [MyWebsite],
    imports: [
        new FrameworkModule({
            publicDir: 'publicDir'
        })
    ]
})
    .run();
```

これで、この設定済みフォルダー内のすべてのファイルに HTTP 経由でアクセスできるようになります。たとえば、`http:localhost:8080/logo.jpg` を開くと、`publicDir` ディレクトリ内の `logo.jpg` という画像が表示されます。