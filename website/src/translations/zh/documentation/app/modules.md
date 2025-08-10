# 模块

Deepkit 高度模块化，允许你将应用拆分为多个实用的模块。每个模块都有自己的依赖注入子容器（继承所有父级提供者）、配置、命令等更多内容。
在[入门](../framework.md)一章中，你已经创建了一个模块——根模块。`new App` 接受的参数与模块几乎相同，因为它会在后台为你自动创建根模块。

如果你不打算将应用拆分为子模块，或者不打算将模块作为包提供给他人，可以跳过本章。

模块可以定义为类模块或函数式模块。

```typescript title=类模块
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  //与 new App({}) 的选项相同
  providers: [MyService]
}) {
}
```

```typescript title=函数式模块
import { AppModule } from '@deepkit/app';

export function myModule(options: {} = {}) {
    return (module: AppModule) => {
        module.addProvider(MyService);
    };
}
```

然后可以在你的应用或其他模块中导入该模块。

```typescript
import { MyModule, myModule } from './module.ts'

new App({
    imports: [
        new MyModule(), //导入类模块
        myModule(), //导入函数式模块
    ]
}).run();
```

现在你可以像使用 `App` 一样为该模块添加功能。`createModule` 的参数是相同的，除了在模块定义中不可用 imports。
对于函数式模块，你可以使用 `AppModule` 的方法来基于你自己的选项进行动态配置。

添加 HTTP/RPC/CLI 控制器、服务、配置、事件监听器，以及各种模块钩子，使模块更加动态。

## 控制器

模块可以定义由其他模块处理的控制器。举例来说，如果你添加了使用 `@deepkit/http` 包中的装饰器的控制器，其 `HttpModule` 将会拾取这些控制器并在其路由器中注册找到的路由。一个控制器可能包含多个这样的装饰器。如何处理这些控制器取决于为你提供这些装饰器的模块作者。

在 Deepkit 中，有三个处理此类控制器的包：HTTP、RPC 和 CLI。参阅它们各自的章节以了解更多。下面是一个 HTTP 控制器示例：

```typescript
import { createModuleClass } from '@deepkit/app';
import { http } from '@deepkit/http';
import { injectable } from '@deepkit/injector';

class MyHttpController {
  @http.GET('/hello)
  hello() {
    return 'Hello world!';
  }
}

export class MyModule extends createModuleClass({
  controllers: [MyHttpController]
}) {
}


//同样也可以用于 App
new App({
  controllers: [MyHttpController]
}).run();
```

## 提供者

当你在应用的 `providers` 部分定义提供者时，它在整个应用中都可访问。而对于模块，这些提供者会自动封装在该模块的依赖注入子容器中。你必须手动导出每个提供者，才能使其对其他模块或你的应用可用。

要了解提供者如何工作，请参阅[依赖注入](../dependency-injection.md)一章。

```typescript
import { createModuleClass } from '@deepkit/app';
import { http } from '@deepkit/http';
import { injectable } from '@deepkit/injector';

export class HelloWorldService {
  helloWorld() {
    return 'Hello there!';
  }
}

class MyHttpController {
  constructor(private helloService: HelloWorldService) {
  }

  @http.GET('/hello)
  hello() {
    return this.helloService.helloWorld();
  }
}

export class MyModule extends createModuleClass({
  controllers: [MyHttpController],
  providers: [HelloWorldService],
}) {
}

export function myModule(options: {} = {}) {
  return (module: AppModule) => {
    module.addController(MyHttpController);
    module.addProvider(HelloWorldService);
  };
}

//同样也可以用于 App
new App({
  controllers: [MyHttpController],
  providers: [HelloWorldService],
}).run();
```

当用户导入该模块时，他无法访问 `HelloWorldService`，因为它被封装在 `MyModule` 的子依赖注入容器中。

## 导出

为了让提供者在导入方模块中可用，你可以将提供者的令牌包含在 `exports` 中。这实际上是将提供者上移一级到父模块（导入者）的依赖注入容器中。

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  exports: [HelloWorldService],
}) {
}

export function myModule(options: {} = {}) {
  return (module: AppModule) => {
    module.addExport(HelloWorldService);
  };
}
```

如果你有其他提供者，如 `FactoryProvider`、`UseClassProvider` 等，你仍然只应在导出中使用类类型。

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  controllers: [MyHttpController]
  providers: [
    { provide: HelloWorldService, useValue: new HelloWorldService }
  ],
  exports: [HelloWorldService],
}) {
}
```

现在我们可以导入该模块并在我们的应用代码中使用其导出的服务。

```typescript
import { App } from '@deepkit/app';
import { cli, Command } from '@deepkit/app';
import { HelloWorldService, MyModule } from './my-module';

@cli.controller('test')
export class TestCommand implements Command {
    constructor(protected helloWorld: HelloWorldService) {
    }

    async execute() {
        this.helloWorld.helloWorld();
    }
}

new App({
    controllers: [TestCommand],
    imports: [
        new MyModule(),
    ]
}).run();
```

阅读[依赖注入](../dependency-injection.md)一章了解更多信息。


### 配置模式

模块可以拥有类型安全的配置选项。可以使用简单的类引用或类型函数（如 `Partial<Config, 'url'>`）将这些选项的值部分或全部注入到该模块的服务中。要定义配置模式，请编写一个带有属性的类。

```typescript
export class Config {
    title!: string; //必填，必须提供
    host?: string; //可选

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

export function myModule(options: Partial<Config> = {}) {
  return (module: AppModule) => {
    module.setConfigDefinition(Config).configure(options);
  };
}
```

配置选项的值可以通过模块的构造函数、`.configure()` 方法或通过配置加载器（例如环境变量加载器）提供。

```typescript
import { MyModule } from './module.ts';

new App({
   imports: [
       new MyModule({title: 'Hello World'}),
       myModule({title: 'Hello World'}),
   ],
}).run();
```

要动态更改已导入模块的配置选项，可以使用 `process` 模块钩子。这是一个很好的位置，可以重定向配置选项，或根据当前模块配置或其他模块实例信息来设置已导入的模块。

```typescript
import { MyModule } from './module.ts';

export class MainModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

export function myModule(options: Partial<Config> = {}) {
    return (module: AppModule) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    };
}
```

在应用层级，工作方式略有不同：

```typescript
new App({
    imports: [new MyModule({title: 'Hello World'}],
})
    .setup((module, config) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    })
    .run();
```

如果根应用模块是由常规模块创建的，其工作方式与常规模块类似。

```typescript
class AppModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

App.fromModule(new AppModule()).run();
```

## 模块名称

所有配置选项也可以通过环境变量进行更改。这仅在模块已分配名称时有效。模块名称可以通过 `createModule` 定义，并可在实例创建时动态更改。后一种模式在你两次导入相同模块并希望通过设置新名称来区分它们时非常有用。

```typescript
export class MyModule extends createModuleClass({
  name: 'my'
}) {
}

export function myModule(options: Partial<Config> = {}) {
    return (module: AppModule) => {
        module.name = 'my';
    };
}
```

```typescript
import { MyModule } from './module';

new App({
    imports: [
        new MyModule(), //'my' 是默认名称
        new MyModule().rename('my2'), //'my2' 现在是新名称
    ]
}).run();
```

有关如何从环境变量或 .env 文件加载配置选项的更多信息，请参阅[配置](./configuration.md)一章。

## 导入

模块可以导入其他模块以扩展其功能。在 `App` 中，你可以通过模块定义对象中的 `imports: []` 导入其他模块：

```typescript
new App({
    imports: [new Module]
}).run();
```

在常规模块中，这不可行，因为对象定义中的模块实例将变成全局的，这通常不是你想要的。相反，可以在模块自身中通过 `imports` 属性实例化模块，这样每个导入的模块都会针对你的模块的每个新实例创建一个实例。

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  imports = [new OtherModule()];
}

export function myModule() {
  return (module: AppModule) => {
    module.addImport(new OtherModule());
  };
}
```

你还可以使用 `process` 钩子，基于配置动态导入模块。

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  process() {
    if (this.config.xEnabled) {
      this.addImport(new OtherModule({ option: 'value' });
    }
  }
}

export function myModule(option: { xEnabled?: boolean } = {}) {
  return (module: AppModule) => {
    if (option.xEnabled) {
      module.addImport(new OtherModule());
    }
  };
}
```

## 钩子

服务容器按照模块被导入的顺序加载所有模块，从根/应用模块开始。

在此过程中，服务容器还会执行所有已注册的配置加载器，调用 `setupConfig` 回调，然后验证每个模块的配置对象。

加载服务容器的整个流程如下：

1. 对于每个模块 `T`（从根开始）
    1. 执行配置加载器 `ConfigLoader.load(T)`。
    2. 调用 `T.setupConfig()`。
    3. 验证 `T` 的配置。如无效则中止。
    4. 调用 `T.process()`。  
       此处模块可以基于已验证的配置选项修改自身。添加新的导入、提供者等。
    5. 对 `T` 的每个已导入模块重复 1。
3. 查找所有已注册的模块。
4. 处理找到的每个模块 `T`。
    1. 注册 `T` 的中间件。
    2. 在事件分发器中注册 `T` 的监听器。
    3. 对步骤 2 中找到的所有模块调用 `Module.processController(T, controller)`。
    4. 对步骤 2 中找到的所有模块调用 `Module.processProvider(T, token, provider)`。
    5. 对 `T` 的每个已导入模块重复 3。
5. 在所有模块上运行 `T.postProcess()`。
6. 在所有模块上实例化引导类。
7. 依赖注入容器现已构建完成。

要使用钩子，你可以在模块类中注册 `process`、`processProvider`、`postProcess` 方法。

```typescript
import { createModuleClass, AppModule } from '@deepkit/app';
import { isClass } from '@deepkit/core';
import { ProviderWithScope, Token } from '@deepkit/injector';

export class MyModule extends createModuleClass({}) {
  imports = [new FrameworkModule()];

  //最先执行
  process() {
    //this.config 包含已完全验证的配置对象。
    if (this.config.environment === 'development') {
      this.getImportedModuleByClass(FrameworkModule).configure({ debug: true });
    }
    this.addModule(new AnotherModule);
    this.addProvider(Service);

    //调用额外的设置方法。
    //在本例中，当依赖注入容器实例化 Service 时，
    //以给定参数调用 'method1'。
    this.configureProvider<Service>(v => v.method1(this.config.value));
  }

  //为所有模块中找到的每个控制器执行
  processController(module: AppModule<any>, controller: ClassType) {
    //例如 HttpModule 会检查每个控制器是否使用了 @http 装饰器，
    //如果使用了，则提取所有路由信息并将其放入路由器。
  }

  //为所有模块中找到的每个提供者执行
  processProvider(module: AppModule<any>, token: Token, provider: ProviderWithScope) {
    //例如 FrameworkModule 会查找扩展自 deepkit/orm Database 的提供令牌，
    //并自动将它们注册到 DatabaseRegistry 中，以便它们可以用于迁移 CLI 命令
    //和 Framework 调试器。
  }

  //当所有模块都已处理完毕时执行。
  //基于在 process/processProvider 中处理的信息，最后一次通过 module.configureProvider 设置提供者的机会。
  postProcess() {

  }
}
```

## 有状态模块

由于每个模块都是通过 `new Module` 显式实例化的，该模块可以拥有状态。此状态可以被注入到依赖注入容器中，从而供服务使用。

例如，考虑 HttpModule 的用例。它检查整个应用中每个已注册的控制器是否具有某些 @http 装饰器，如果有，则将该控制器放入注册表。该注册表被注入到 Router 中，Router 在实例化后会提取这些控制器的所有路由信息并将它们注册。

```typescript
class Registry {
    protected controllers: { module: AppModule<any>, classType: ClassType }[] = [];
        
    register(module: AppModule<any>, controller: ClassType) {
        this.controllers.push({ module, classType: controller });
    }
        
    get(classType: ClassType) {
        const controller = this.controllers.find(v => v.classType === classType);
        if (!controller) throw new Error('Controller unknown');
        return controller;
    }
}
        
class Router {
    constructor(
        protected injectorContext: InjectorContext,
        protected registry: Registry
    ) {
    }
        
    getController(classType: ClassType) {
        //为给定的控制器 classType 查找 classType 和 module
        const controller = this.registry.get(classType);
        
        //此处将实例化控制器。如果它已被实例化，并且提供者不是 transient: true，
        //则会返回旧的实例
        return injector.get(controller.classType, controller.module);
    }
}
        
class HttpModule extends createModuleClass({
    providers: [Router],
    exports: [Router],
}) {
    protected registry = new Registry;
        
    process() {
        this.addProvider({ provide: Registry, useValue: this.registry });
    }
        
    processController(module: AppModule<any>, controller: ClassType) {
        //控制器需要由控制器消费者放入模块的 providers 中
        if (!module.isProvided(controller)) module.addProvider(controller);
        this.registry.register(module, controller);
    }
}
        
class MyController {}
        
const app = new App({
    controllers: [MyController],
    imports: [new HttpModule()]
});
        
const myController = app.get(Router).getController(MyController);
```

## 关于 root

`root` 属性允许你将模块的依赖注入容器移动到根应用的容器中。这样，模块中的每个服务都会自动在根应用中可用。它基本上将每个提供者（控制器、事件监听器、提供者）移动到根容器。这可能导致依赖冲突，因此仅应在模块确实只有全局内容时使用。相反，你应该更倾向于手动导出每个提供者。

如果你构建的是能被许多模块使用的库，你应避免使用 `root`，因为它可能与其他库的提供者令牌发生冲突。比如，如果该库模块导入了定义某个服务的 `foo` 模块，并且你按需重新配置了一些服务，而用户的应用也导入了相同的 `foo` 模块，那么用户将会接收到你重新配置过的服务。不过对于许多更简单的用例，这也许是可以接受的。

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  root = true;
}
```

你也可以通过使用 `forRoot()` 更改第三方模块的 `root` 属性。

```typescript
new App({
    imports: [new ThirdPartyModule().forRoot()],
}).run();
```

## 注入器上下文

InjectorContext 是依赖注入容器。它允许你从你自己的模块或其他模块请求/实例化服务。例如，如果你在 `processControllers` 中存储了一个控制器，并希望正确地实例化它们，那么这是必要的。