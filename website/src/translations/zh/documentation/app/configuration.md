# 配置

在 Deepkit 应用中，模块和你的应用本身都可以拥有配置选项。
例如，配置可以包含数据库 URL、密码、IP 等。服务、HTTP/RPC/CLI 控制器以及模板函数可以通过依赖注入读取这些配置选项。

可以通过定义带有属性的类来定义配置。这是一种为整个应用定义配置的类型安全方式，其值会自动序列化并验证。

## 示例

```typescript
import { MinLength } from '@deepkit/type';
import { App } from '@deepkit/app';

class Config {
    pageTitle: string & MinLength<2> = 'Cool site';
    domain: string = 'example.com';
    debug: boolean = false;
}

const app = new App({
    config: Config
});


app.command('print-config', (config: Config) => {
    console.log('config', config);
})

app.run();
```

```sh
$ curl http://localhost:8080/
Hello from Cool site via example.com
```

当未使用任何配置加载器时，将使用默认值。要更改配置，你可以使用 `app.configure({domain: 'localhost'})` 方法，或使用环境配置加载器。

## 设置配置值

默认情况下，不会覆盖任何值，因此会使用默认值。设置配置值有多种方式。

* 通过 `app.configure({})`
* 为每个选项使用环境变量
* 通过 JSON 的环境变量
* dotenv 文件

你可以同时使用多种方法来加载配置。它们被调用的顺序很重要。

### 环境变量

要允许通过各自的环境变量设置每个配置选项，请使用 `loadConfigFromEnv`。默认前缀为 `APP_`，你可以更改它。它还会自动加载 `.env` 文件。默认使用大写命名策略，你也可以更改。

对于像上面的 `pageTitle` 这样的配置选项，你可以使用 `APP_PAGE_TITLE="Other Title"` 来更改其值。

```typescript
new App({
    config: config,
    controllers: [MyWebsite],
})
    .loadConfigFromEnv({prefix: 'APP_'})
    .run();
```

```sh
APP_PAGE_TITLE="Other title" ts-node app.ts server:start
```

### JSON 环境变量

要通过单个环境变量更改多个配置选项，请使用 `loadConfigFromEnvVariable`。第一个参数是环境变量的名称。

```typescript
new App({
    config: config,
    controllers: [MyWebsite],
})
    .loadConfigFromEnvVariable('APP_CONFIG')
    .run();
```

```sh
APP_CONFIG='{"pageTitle": "Other title"}' ts-node app.ts server:start
```

### DotEnv 文件

要通过 dotenv 文件更改多个配置选项，请使用 `loadConfigFromEnv`。第一个参数可以是一个 dotenv 文件的路径（相对于 `cwd`），也可以是多个路径。如果是数组，将按顺序尝试每个路径，直到找到存在的文件为止。

```typescript
new App({
    config: config,
    controllers: [MyWebsite],
})
    .loadConfigFromEnv({envFilePath: ['production.dotenv', 'dotenv']})
    .run();
```

```sh
$ cat dotenv
APP_PAGE_TITLE=Other title
$ ts-node app.ts server:start
```

### 模块配置

每个被导入的模块都可以有一个模块名。该名称用于上面提到的配置路径。

例如，对于环境变量配置，`FrameworkModule` 的端口选项对应的路径是 `FRAMEWORK_PORT`。默认情况下，所有名称都写成大写。如果使用了 `APP_` 前缀，则可以通过如下方式更改端口：

```sh
$ APP_FRAMEWORK_PORT=9999 ts-node app.ts server:start
2021-06-12T18:59:26.363Z [LOG] Start HTTP server, using 1 workers.
2021-06-12T18:59:26.365Z [LOG] HTTP MyWebsite
2021-06-12T18:59:26.366Z [LOG]     GET / helloWorld
2021-06-12T18:59:26.366Z [LOG] HTTP listening at http://localhost:9999/
```

在 dotenv 文件中也同样写作 `APP_FRAMEWORK_PORT=9999`。

而在通过 `loadConfigFromEnvVariable('APP_CONFIG')` 的 JSON 环境变量中，使用的是实际配置类的结构。`framework` 变成一个对象。

```sh
$ APP_CONFIG='{"framework": {"port": 9999}}' ts-node app.ts server:start
```

这对所有模块都同样适用。对于你的应用自身的配置选项（`new App`）不需要模块前缀。


## 配置类

```typescript
import { MinLength } from '@deepkit/type';

export class Config {
    title!: string & MinLength<2>; //这使其成为必填项，必须提供
    host?: string;

    debug: boolean = false; //也支持默认值
}
```

```typescript
import { createModuleClass } from '@deepkit/app';
import { Config } from './module.config.ts';

export class MyModule extends createModuleClass({
  config: Config
}) {
}
```

配置选项的值可以在模块的构造函数中提供，使用 `.configure()` 方法提供，或通过配置加载器提供（例如环境变量加载器）。

```typescript
import { MyModule } from './module.ts';

new App({
   imports: [new MyModule({title: 'Hello World'})],
}).run();
```

要动态更改已导入模块的配置选项，可以使用 `process` 钩子。这是一个很好的位置，用于重定向配置选项，或根据当前模块配置或其他模块实例信息来设置已导入模块。

```typescript
import { MyModule } from './module.ts';

export class MainModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}
```

在应用层级，这稍有不同：

```typescript
new App({
    imports: [new MyModule({title: 'Hello World'}],
})
    .setup((module, config) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    })
    .run();
```

当根应用模块由常规模块创建时，其工作方式与常规模块类似。

```typescript
class AppModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

App.fromModule(new AppModule()).run();
```

## 读取配置值

在服务中使用配置选项时，你可以使用常规的依赖注入。可以注入整个配置对象、单个值或配置的一部分。

### 部分

若只注入配置值的子集，请使用 `Pick` 类型。

```typescript
import { Config } from './module.config';

export class MyService {
     constructor(private config: Pick<Config, 'title' | 'host'}) {
     }

     getTitle() {
         return this.config.title;
     }
}


//在单元测试中，可以通过以下方式实例化
new MyService({title: 'Hello', host: '0.0.0.0'});

//或者你可以使用类型别名
type MyServiceConfig = Pick<Config, 'title' | 'host'};
export class MyService {
     constructor(private config: MyServiceConfig) {
     }
}
```

### 单个值

若只注入单个值，请使用索引访问操作符。

```typescript
import { Config } from './module.config';

export class MyService {
     constructor(private title: Config['title']) {
     }

     getTitle() {
         return this.title;
     }
}
```

### 全部

若要注入所有配置值，请使用该类作为依赖。

```typescript
import { Config } from './module.config';

export class MyService {
     constructor(private config: Config) {
     }

     getTitle() {
         return this.config.title;
     }
}
```