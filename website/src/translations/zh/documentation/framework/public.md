# 公共目录

`FrameworkModule` 提供了一种通过 HTTP 提供静态文件（如图片、PDF、二进制文件等）的方法。`publicDir` 配置选项允许你指定用于处理未通往 HTTP 控制器路由的请求的默认入口点的文件夹。默认情况下，此行为是禁用的（空值）。

要启用公共文件的提供功能，请将 `publicDir` 设置为你选择的文件夹。通常你会选择像 `publicDir` 这样的名称以便一目了然。

```
.
├── app.ts
└── publicDir
    └── logo.jpg
```

要更改 `publicDir` 选项，你可以修改 `FrameworkModule` 的第一个参数。

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// 在此处添加你的配置和 HTTP 控制器

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

现在，该配置的文件夹中的所有文件都可以通过 HTTP 访问。例如，如果你打开 `http:localhost:8080/logo.jpg`，你将看到位于 `publicDir` 目录中的图片 `logo.jpg`。