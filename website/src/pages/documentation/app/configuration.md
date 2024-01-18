# Configuration

In Deepkit applications, modules and your application can have configuration options. 
For example, a configuration can consist of database URLs, passwords, IPs, and so on. Services, HTTP/RPC/CLI controllers, and template functions can read these configuration options via dependency injection.

A configuration can be defined by defining a class with properties. This is a typesafe way to define a configuration for your entire application, and its values are automatically serialized and validated.

## Example

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

When no configuration loader is used, the default values will be used. To change the configuration, you can either use the `app.configure({domain: 'localhost'})` method or use an environment configuration loader.

## Set configuration values

By default, no values are overwritten, so default values are used. There are several ways to set configuration values.

* Via `app.configure({})`
* Environment variables for each option
* Environment variable via JSON
* dotenv-Files

You can use several methods to load the configuration at the same time. The order in which they are called is important.

### Environment variables

To allow setting each configuration option via its own environment variable, use `loadConfigFromEnv`. The default prefix is `APP_`, but you can change it. It also automatically loads `.env` files. By default, it uses an uppercase naming strategy, but you can change that too.

For configuration options like `pageTitle` above, you can use `APP_PAGE_TITLE="Other Title"` to change the value.

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

### JSON environment variable

To change multiple configuration options via a single environment variable, use `loadConfigFromEnvVariable`. The first argument is the name of the environment variable.

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

### DotEnv Files

To change multiple configuration options via a dotenv file, use `loadConfigFromEnv`. The first argument is either a path to a dotenv (relative to `cwd`) or multiple paths. If it is an array, each path is tried until an existing file is found.

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

### Module Configuration

Each imported module can have a module name. This name is used for the configuration paths used above.

For example, for configuring environment variables, the path for the `FrameworkModule` option port is `FRAMEWORK_PORT`. All names are written in uppercase by default. If a prefix of `APP_` is used, the port can be changed via the following:

```sh
$ APP_FRAMEWORK_PORT=9999 ts-node app.ts server:start
2021-06-12T18:59:26.363Z [LOG] Start HTTP server, using 1 workers.
2021-06-12T18:59:26.365Z [LOG] HTTP MyWebsite
2021-06-12T18:59:26.366Z [LOG]     GET / helloWorld
2021-06-12T18:59:26.366Z [LOG] HTTP listening at http://localhost:9999/
```

In dotenv files it would also be `APP_FRAMEWORK_PORT=9999`.

In JSON environment variables via `loadConfigFromEnvVariable('APP_CONFIG')` on the other hand, it is the structure of the actual configuration class. `framework` becomes an object.

```sh
$ APP_CONFIG='{"framework": {"port": 9999}}' ts-node app.ts server:start
```

This works the same for all modules. No module prefix is required for your application configuration option (`new App`).


## Configuration class

```typescript
import { MinLength } from '@deepkit/type';

export class Config {
    title!: string & MinLength<2>; //this makes it required and needs to be provided
    host?: string;

    debug: boolean = false; //default values are supported as well
}
```

```typescript
import { createModule } from '@deepkit/app';
import { Config } from './module.config.ts';

export class MyModule extends createModule({
   config: Config
}) {}
```

The values for the configuration options can be provided either in the constructor of the module, with the `.configure()` method, or via configuration loaders (e.g. environment variable loader).

```typescript
import { MyModule } from './module.ts';

new App({
   imports: [new MyModule({title: 'Hello World'})],
}).run();
```

To dynamically change the configuration options of an imported module, you can use the `process` hook. This is a good place to either redirect configuration options or set up an imported module depending on the current module configuration or other module instance information.

```typescript
import { MyModule } from './module.ts';

export class MainModule extends createModule({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}
```

At the application level, it works a little differently:

```typescript
new App({
    imports: [new MyModule({title: 'Hello World'}],
})
    .setup((module, config) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    })
    .run();
```

When the root application module is created from a regular module, it works similarly to regular modules.

```typescript
class AppModule extends createModule({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

App.fromModule(new AppModule()).run();
```

## Read configuration values

To use a configuration option in a service, you can use normal dependency injection. It is possible to inject either the entire configuration object, a single value, or a portion of the configuration.

### Partial

To inject only a subset of the configuration values, use the `Pick` type.

```typescript
import { Config } from './module.config';

export class MyService {
     constructor(private config: Pick<Config, 'title' | 'host'}) {
     }

     getTitle() {
         return this.config.title;
     }
}


//In unit tests, it can be instantiated via
new MyService({title: 'Hello', host: '0.0.0.0'});

//or you can use type aliases
type MyServiceConfig = Pick<Config, 'title' | 'host'};
export class MyService {
     constructor(private config: MyServiceConfig) {
     }
}
```

### Single value

To inject only a single value, use the index access operator.

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

### All

To inject all config values, use the class as dependency.

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
