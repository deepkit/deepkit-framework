# Public Directory

The `FrameworkModule` provides a way to serve static files such as images, PDFs, binaries, etc. over HTTP. The `publicDir` configuration option lets you specify which folder to use as the default entry point for requests that do not lead to an HTTP controller route. By default, this behavior is disabled (empty value).

To enable the provision of public files, set `publicDir` to a folder of your choice. Normally you would choose a name like `publicDir` to make things obvious.

```
.
├── app.ts
└── publicDir
    └── logo.jpg
```

To change the `publicDir` option, you can change the first argument of `FrameworkModule`.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// your config and http controller here

new App({
  config: config,
  controllers: [MyWebsite],
  imports: [
    new FrameworkModule({
      publicDir: 'publicDir',
    }),
  ],
}).run();
```

All files within this configured folder are now accessible via HTTP. For example, if you open `http:localhost:8080/logo.jpg`, you will see the image `logo.jpg` in the `publicDir` directory.
