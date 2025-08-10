# 部署

在本章中，你将学习如何将应用编译为 JavaScript，为生产环境进行配置，并使用 Docker 进行部署。

## 编译 TypeScript

假设你在 `app.ts` 文件中有如下应用：

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

如果你使用 `ts-node app.ts server:start`，你会发现一切正常工作。在生产环境中，你通常不会使用 `ts-node` 启动服务器。你会先将其编译为 JavaScript，然后使用 Node 运行它。为此，你必须有一个正确的 `tsconfig.json` 并设置正确的配置选项。在“第一个应用”一节中，你的 `tsconfig.json` 被配置为将 JavaScript 输出到 `.dist` 文件夹。我们假定你也做了相同的配置。

如果所有编译器设置都正确，并且你的 `outDir` 指向类似 `dist` 的文件夹，那么一旦在项目中运行 `tsc` 命令，`tsconfig.json` 中列出的所有文件都会被编译为 JavaScript。只需在该列表中指定你的入口文件即可。所有被导入的文件也会被自动编译，不需要显式添加到 `tsconfig.json` 中。`tsc` 是安装 `npm install typescript` 时 TypeScript 的一部分。

```sh
$ ./node_modules/.bin/tsc
```

如果成功，TypeScript 编译器不会输出任何内容。你现在可以检查 `dist` 的输出。

```sh
$ tree dist
dist
└── app.js
```

你可以看到只有一个文件。你可以通过 `node distapp.js` 运行它，并获得与 `ts-node app.ts` 相同的功能。

对于部署，关键是 TypeScript 文件被正确编译，并且一切都能直接通过 Node 正常运行。你现在可以直接移动 `dist` 文件夹以及其中的 `node_modules`，然后运行 `node distapp.js server:start`，你的应用就成功部署了。不过，你更可能使用 Docker 之类的其他方案来正确打包你的应用。

## 配置

在生产环境中，你通常不会将服务器绑定到 `localhost`，而是更可能通过 `0.0.0.0` 绑定到所有设备。如果你不在反向代理之后，你还会将端口设置为 80。要配置这两个设置，你需要自定义 `FrameworkModule`。我们关注的两个选项是 `host` 和 `port`。为了让它们可以通过环境变量或 .dotenv 文件在外部进行配置，我们必须先允许这样做。幸运的是，上面的代码已经通过 `loadConfigFromEnv()` 方法完成了这一步。

请参考[配置](../app/configuration.md)章节，了解更多关于如何设置应用配置选项的信息。

要查看可用的配置选项以及它们的值，你可以使用 `ts-node app.ts app:config` 命令。你也可以在框架调试器（Framework Debugger）中查看它们。

### SSL

建议（有时是必须）使用启用 SSL 的 HTTPS 来运行你的应用。配置 SSL 有多种选项。要启用 SSL，请使用
`framework.ssl`，并通过以下选项配置其参数。

|===
|名称|类型|描述

|framework.ssl|boolean|为 true 时启用 HTTPS 服务器
|framework.httpsPort|number?|如果同时定义了 httpsPort 和 ssl，则会在 http 服务器之外额外启动 https 服务器。
|framework.sslKey|string?|用于 https 的 SSL key 文件路径
|framework.sslCertificate|string?|用于 https 的证书文件路径
|framework.sslCa|string?|用于 https 的 CA 文件路径
|framework.sslCrl|string?|用于 https 的 CRL 文件路径
|framework.sslOptions|object?|与 tls.SecureContextOptions 和 tls.TlsOptions 相同的接口。
|===

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// 在此处编写你的配置和 HTTP 控制器

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

### 本地 SSL

在本地开发环境中，可通过 `framework.selfSigned` 选项启用自签名 HTTPS。

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// 在此处编写你的配置和 HTTP 控制器

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

如果你现在启动这个服务器，你的 HTTP 服务器将通过 `https:localhost:8080` 以 HTTPS 访问。在 Chrome 中，当你打开该 URL 时会看到错误信息“NET::ERR_CERT_INVALID”，因为自签名证书被视为安全风险：`chrome:flagsallow-insecure-localhost`。