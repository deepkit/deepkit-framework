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
import { createModuleClass } from '@deepkit/app';
import { Config } from './module.config.ts';

export class MyModule extends createModuleClass({
  config: Config
}) {
}
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

export class MainModule extends createModuleClass({
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
class AppModule extends createModuleClass({
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
type MyServiceConfig = Pick<Config, 'title' | 'host'>;
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

## Advanced Configuration Patterns

### Conditional Configuration

Configure services based on configuration values:

```typescript
class AppConfig {
    environment: 'development' | 'production' = 'development';
    enableCache: boolean = false;
    logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
}

const app = new App({
    config: AppConfig
})
.setup((module, config) => {
    // Add development-only services
    if (config.environment === 'development') {
        module.addProvider(DevToolsService);
    }

    // Configure logger based on log level
    module.configureProvider<Logger>(logger => {
        logger.level = config.logLevel === 'debug' ? 5 : 3;
    });

    // Conditionally add cache service
    if (config.enableCache) {
        module.addProvider(CacheService);
    }
});
```

### Nested Configuration

Organize complex configuration with nested objects:

```typescript
class DatabaseConfig {
    host: string = 'localhost';
    port: number = 5432;
    username: string = 'user';
    password!: string;
    ssl: {
        enabled: boolean;
        cert?: string;
        key?: string;
    } = { enabled: false };
}

class AppConfig {
    database: DatabaseConfig = new DatabaseConfig();
    redis: {
        host: string;
        port: number;
    } = {
        host: 'localhost',
        port: 6379
    };
}
```

Environment variables for nested configuration:
```bash
# Nested object properties
APP_DATABASE_HOST=db.example.com
APP_DATABASE_PORT=5432
APP_DATABASE_SSL_ENABLED=true
APP_REDIS_HOST=cache.example.com
```

### Configuration Validation

Add custom validation to configuration:

```typescript
import { MinLength, Minimum, Maximum, Email } from '@deepkit/type';

class AppConfig {
    // String validation
    appName: string & MinLength<3> = 'MyApp';

    // Number validation
    port: number & Minimum<1000> & Maximum<65535> = 3000;

    // Email validation
    adminEmail?: string & Email;

    // Custom validation in process hook
    databaseUrl!: string;
}

class AppModule extends createModuleClass({
    config: AppConfig
}) {
    process() {
        // Custom validation logic
        if (!this.config.databaseUrl.startsWith('postgresql://')) {
            throw new Error('Database URL must be a PostgreSQL connection string');
        }

        if (this.config.port === 3000 && this.config.appName === 'MyApp') {
            console.warn('Using default configuration values in production');
        }
    }
}
```

## Configuration Loading Priority

Configuration is loaded in the following order (later sources override earlier ones):

1. Default values in configuration class
2. Module constructor parameters
3. Configuration loaders (in order they were added)
4. `app.configure()` calls

```typescript
class Config {
    port: number = 3000; // 1. Default value
}

const app = new App({
    config: Config
})
.loadConfigFromEnv() // 3. Environment variables
.configure({ port: 8080 }); // 4. Programmatic override

// Final port value: 8080 (from configure call)
```

## Environment-Specific Configuration

### Multiple Environment Files

Load different configuration files based on environment:

```typescript
const environment = process.env.NODE_ENV || 'development';

const app = new App({
    config: AppConfig
})
.loadConfigFromEnv({
    envFilePath: [
        `.env.${environment}.local`,
        `.env.${environment}`,
        '.env.local',
        '.env'
    ]
});
```

### Environment Variable Naming

Customize environment variable naming:

```typescript
app.loadConfigFromEnv({
    prefix: 'MYAPP_',
    namingStrategy: (name: string) => {
        // Custom naming strategy
        return name.toUpperCase().replace(/([A-Z])/g, '_$1');
    }
});
```

## Troubleshooting Configuration

### Common Issues

**Problem**: Configuration not loading from environment variables

**Solution**: Check naming convention and prefix:
```bash
# Wrong
export PORT=3000

# Correct (with default APP_ prefix)
export APP_PORT=3000
```

**Problem**: Type validation errors

**Solution**: Ensure environment values can be converted:
```bash
# Wrong - cannot convert to number
export APP_PORT=abc

# Correct
export APP_PORT=3000
```

**Problem**: Required fields not provided

**Solution**: Provide all required configuration:
```typescript
class Config {
    databaseUrl!: string; // Required
}

// Must provide via environment or configure()
export APP_DATABASE_URL="postgresql://localhost/mydb"
```

### Debug Configuration Loading

Enable debug logging to see configuration loading:

```typescript
import { Logger, ConsoleTransport } from '@deepkit/logger';

const app = new App({
    config: AppConfig,
    providers: [
        { provide: Logger, useValue: new Logger([new ConsoleTransport()], 5) }
    ]
})
.loadConfigFromEnv();

// Check final configuration
app.command('debug-config', (config: AppConfig, logger: Logger) => {
    logger.log('Final configuration:', config);
});
```
