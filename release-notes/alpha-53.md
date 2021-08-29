## Version alpha-53+

This version introduces a rather big refactor of the module system: New features and a few breaking changes were added.

What has changed?

Previously a lot of the module dependency injection behaviour was in deepkit/app’s `ServiceContainer`. 
It handled the export and import of modules for example. This was moved to deepkit/injector. 
The injector library does now statically analyse the dependencies and throw early more meaningful 
error messages. It can now also be used much better standalone. This change separated the code better
and allowed to gain a performance boost.


### Changes

Modules are now regular classes, its module definition has changed to use a different API and can no longer import other
modules in the module definition object.

Old API:

```typescript
export const myModule = new AppModule({
    providers: [MyService],
    imports: [otherModule],
    exports: [MyService]
});
```

New API:

```typescript
export class MyModule extends createModule({
    providers: [MyService],
    exports: [MyService],
}) {
    imports = [new OtherModule()];
}

//imported as. The app can still use `imports: []`.
new App({
    imports: [new MyModule()]
})
```

`Module.setup` has been moved to `process`. In the `process` hook you can now dynamically change the
module depending on runtime or configuration information.

```typescript
const config = createModuleconfig({
    enabled: t.boolean.default(false),
})

export class MyModule extends createModule({
    config,
    providers: [MyService],
    exports: [MyService],
}) {
    process() {
        if (this.config.enabled) {
            this.addController();
            this.addImport();
            this.addProvider();
            this.addExport();
        }
    }
}


//imported as 
new Application({
    imports: [new MyModule({enabled: true})]
})
```

Please note: while regular modules can not import other modules in the module definition object anymore 
(as it would become a global instance in a deeper nested import tree), a `new Application({imports: []})` or `new App({imports: []})`,
can still do that (as it would not become a global instance).

Modules are now stateful, which means they need to be instantiated when importing.
Its configuration options can be changed via the first argument.

```typescript
new Application({
    Imports: [
        new MyModule({configValue: true})
    ]
}).run();
```

`@injectable()` has been changed from a decorator factory to a regular decorator.

```typescript
@injectable
class MyService {}
```


The module system has now new hooks `process`, `processController`, `processProvider`, and `postProcess`.
More explained in the new docs. https://deepkit.io/documentation/framework/modules

Previously, `deepkit/framework` had a `KernelModule` and the `Application` class had overwritten how the ServiceContainer works 
to allow reading controllers and more. The `KernelModule` has been changed to `FrameworkModule`.

Since the ServiceContainer has now hooks for that, the `deepkit/framework` is now just a regular module without any additional magic.
That means that `Application` is not needed anymore. All modules like HttpModule, BrokerModule, and FrameworkModule can just be imported
in a `deepkit/app` `App` instances. This allows to write also apps that do not depend on the framework and thus have 
much fewer dependencies involved.

Previously
```typescript
import { Application, KernelModule } from '@deepkit/framework';
new Application({
    imports: [
        KernelModule.configure({port: 9090})
    ]
}).run();
```

Now:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

new App({
    imports: [
        new FrameworkBundle({port: 9090})
    ]
}).run();
```

FrameworkBundle configuration options can still be overwritten via environment variables, but the module name has changed 
from `kernel` to `framework`. The new method name is `loadConfigFromEnv`:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
new App({imports: [new FrameworkModule]}).loadConfigFromEnv().run();
```

`loadConfigFromEnv`: prefix is per default now APP_, and naming strategy is per default `upper`. 
An example environment variable looks like that:

```bash
APP_FRAMEWORK_PORT=8080 ts-node app.ts
```

If you for example only have http controllers, and don't need anything from the feature-rich framework bundle, you can just

```
const app = new App({
    controllers: [MyController]
    imports: [new HttpModule]
});
```

Since HttpModule does not come with its own application/http server, you can use your own in this framework-less setup:

```typescript
import { App } from '@deepkit/app';
import { http, HttpKernel, HttpModule, HttpRequest, HttpResponse } from '@deepkit/http';
import { Server } from 'http';

class MyController {
    @http.GET()
    hello() {
        return 'hello world';
    }
}

const app = new App({
    controllers: [MyController],
    imports: [new HttpModule]
});

const httpKernel = app.get(HttpKernel);

new Server(
    { IncomingMessage: HttpRequest, ServerResponse: HttpResponse, },
    (req, res) => {
        httpKernel.handleRequest(req as HttpRequest, res as HttpResponse);
    }
).listen(8080, () => {
    console.log('listen at 8080');
});
```

However, such a setup would be rather rare. Since the FrameworkModule provides a ApplicationServer with http server, 
most people would still use the FrameworkModule with its `server:start` command.
