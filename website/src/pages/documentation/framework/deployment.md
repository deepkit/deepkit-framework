# Deployment

In this chapter, you will learn how to compile your application in JavaScript, configure it for your production environment, and deploy it using Docker.

## Compile TypeScript

Suppose you have an application like this in an `app.ts` file:

```typescript
#!/usr/bin/env ts-node-script
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http } from '@deepkit/http';

class Config {
  title: string = 'DEV my Page';
}

class MyWebsite {
  constructor(protected title: Config['title']) {}

  @http.GET()
  helloWorld() {
    return 'Hello from ' + this.title;
  }
}

new App({
  config: Config,
  controllers: [MyWebsite],
  imports: [new FrameworkModule()],
})
  .loadConfigFromEnv()
  .run();
```

If you use `ts-node app.ts server:start`, you will see that everything works correctly. In a production environment, you would not typically start the server with `ts-node`. You would compile it into JavaScript and then use the node. To do this, you must have a correct `tsconfig.json` with the correct configuration options. In the "First Application" section, your `tsconfig.json` is configured to output JavaScript to the `.dist` folder. We assume that you have configured it that way as well.

If all compiler settings are correct and your `outDir` points to a folder like `dist`, then as soon as you run the `tsc` command in your project, all your linked files in the files in the `tsconfig.json` will be compiled to JavaScript. It is enough to specify your entry files in this list. All imported files are also compiled automatically and do not need to be explicitly added to `tsconfig.json`. `tsc` is part of Typescript when you install `npm install typescript`.

```sh
$ ./node_modules/.bin/tsc
```

The TypeScript compiler does not output anything if it was successful. You can now check the output of `dist`.

```sh
$ tree dist
dist
└── app.js
```

You can see that there is only one file. You can run it via `node distapp.js` and get the same functionality as with `ts-node app.ts`.

For a deployment, it is important that the TypeScript files are compiled correctly and everything works directly through Node. You could now simply move your `dist` folder including your `node_modules` and run `node distapp.js server:start` and your app is successfully deployed. However, you would use other solutions like Docker to package your app correctly.

## Configuration

In a production environment, you would not bind the server to `localhost`, but most likely to all devices via `0.0.0.0`. If you are not behind a reverse proxy, you would also set the port to 80. To configure these two settings, you need to customize the `FrameworkModule`. The two options we are interested in are `host` and `port`. In order for them to be configured externally via environment variables or via .dotenv files, we must first allow this. Fortunately, our code above has already done this with the `loadConfigFromEnv()` method.

Please refer to the [Configuration](../app/configuration.md) chapter to learn more about how to set the application configuration options.

To see what configuration options are available and what value they have, you can use the `ts-node app.ts app:config` command. You can also see them in the Framework Debugger.

### SSL

It is recommended (and sometimes required) to run your application over HTTPS with SSL. There are several options for configuring SSL. To enable SSL, use
`framework.ssl` and configure its parameters with the following options.

|===
|Name|Type|Description

|framework.ssl|boolean|Enables HTTPS server when true
|framework.httpsPort|number?|If httpsPort and ssl is defined, then the https server is started additional to the http server.
|framework.sslKey|string?|A file path to a ssl key file for https
|framework.sslCertificate|string?|A file path to a certificate file for https
|framework.sslCa|string?|A file path to a ca file for https
|framework.sslCrl|string?|A file path to a crl file for https
|framework.sslOptions|object?|Same interface as tls.SecureContextOptions & tls.TlsOptions.
|===

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// your config and http controller here

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
    }),
  ],
}).run();
```

### Local SSL

In the local development environment, you can enable self-signed HTTPs with the `framework.selfSigned` option.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// your config and http controller here

new App({
  config: config,
  controllers: [MyWebsite],
  imports: [
    new FrameworkModule({
      ssl: true,
      selfSigned: true,
    }),
  ],
}).run();
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

If you start this server now, your HTTP server is available as HTTPS at `https:localhost:8080`. In Chrome, you now get the error message "NET::ERR_CERT_INVALID" when you open this URL because self-signed certificates are considered a security risk: `chrome:flagsallow-insecure-localhost`.
