# Deepkit App

Command-line Interface (CLI) programs are programs that interact via the terminal in the form of text input and text output. The advantage of interacting with the application in this variant is that only a terminal must exist either locally or via an SSH connection.

Deepkit App in `@deepkit/app` is a framework for building command line applications and is the base for Deepkit Framework. It uses Deepkit's dependency injection container, event system, logger, and other features to provide a solid foundation for your application.

It provides:

- Module System
- Service container with inheritance
- Dependency Injection
- Event System
- Command Line Interface
- Logger
- Configuration loader (env, dotenv, json)

A CLI application in Deepkit has full access to the DI container and can thus access all providers and configuration options.  The arguments and options of the CLI commands are controlled by method parameters via TypeScript types and are automatically serialized and validated.

[Deepkit Framework](./framework.md) with `@deepkit/framework` extends this further with an application server for HTTP/RPC, a debugger/profiler, and much more.

## Installation Easy

The easiest way to get started is to use NPM init to create a new Deepkit project.

```shell
npm init @deepkit/app@latest my-deepkit-app
````

This will create a new folder `my-deepkit-app` with all the dependencies and a basic `app.ts` file.

```sh
cd my-deepkit-app
npm run app
````

This will run the `app.ts` file with `ts-node` and show you the available commands. You can start from here and add your own commands, controllers, and so on.

## Installation Manually

Deepkit App is based on [Deepkit Runtime Types](./runtime-types.md), so let's install all dependencies:

```bash
mkdir my-project && cd my-project

npm install typescript ts-node 
npm install @deepkit/app @deepkit/type @deepkit/type-compiler
```

Next, we make sure Deepkit's type compiler is installed into the installed TypeScript package at `node_modules/typescript` by running the following command:

```sh
./node_modules/.bin/deepkit-type-install
```

Make sure that all peer dependencies are installed. By default, NPM 7+ installs them automatically.

To compile your application, we need the TypeScript compiler and recommend `ts-node` to easily run the app.

An alternative to using `ts-node` is to compile the source code with the TypeScript compiler and execute the JavaScript source code directly. This has the advantage of dramatically increasing execution speed for short commands. However, it also creates additional workflow overhead by either manually running the compiler or setting up a watcher. For this reason, `ts-node` is used in all examples in this documentation.



## First application

Since the Deepkit framework does not use configuration files or a special folder structure, you can structure your project however you want. The only two files you need to get started are the TypeScript app.ts file and the TypeScript configuration tsconfig.json.

Our goal is to have the following files in our project folder:

```
.
├── app.ts
├── node_modules
├── package-lock.json
└── tsconfig.json
```

We set up a basic tsconfig file and enable Deepkit's type compiler by setting `reflection` to `true`. 
This is required to use the dependency injection container and other features.

```json title=tsconfig.json
{
    "compilerOptions": {
        "outDir": "./dist",
        "experimentalDecorators": true,
        "strict": true,
        "esModuleInterop": true,
        "target": "es2020",
        "module": "CommonJS",
        "moduleResolution": "node"
    },
    "reflection": true,
    "files": [
        "app.ts"
    ]
}
```

```typescript title=app.ts
import {App} from '@deepkit/app';
import {Logger} from '@deepkit/logger';

const app = new App();

app.command('test', (logger: Logger) => {
    logger.log('Hello World!');
});

app.run();
```

In this code, you can see that we have defined a test command and created a new app that we run directly using `run()`. By running this script, we start the app.

and then run it directly.

```sh
$ ./node_modules/.bin/ts-node app.ts
VERSION
  Node

USAGE
  $ ts-node app.ts [COMMAND]

TOPICS
  debug
  migration  Executes pending migration files. Use migration:pending to see which are pending.
  server     Starts the HTTP server

COMMANDS
  test
```

Now, to execute our test command, we run the following command.

```sh
$ ./node_modules/.bin/ts-node app.ts test
Hello World
```

In Deepkit everything is now done via this `app.ts`. You can rename the file as you like or create more. Custom CLI commands, HTTP/RPC server, migration commands, and so on are all started from this entry point.













## Arguments & Flags

Deepkit App automatically converts function parameters into CLI arguments and flags. The order of the parameters dictates the order of the CLI arguments

Parameters can be any TypeScript type and are automatically validated and deserialized.

```typescript
// Simple arguments
app.command('greet', (name: string, age?: number) => {
    console.log(`Hello ${name}${age ? `, you are ${age}` : ''}`);
});

// Flags with validation
import { Flag, Email, Positive } from '@deepkit/app';

app.command('create-user', (
    email: string & Email & Flag,
    age: number & Positive & Flag,
    admin: boolean & Flag = false
) => {
    console.log(`Creating user: ${email}, age: ${age}, admin: ${admin}`);
});
```

See the chapter [Arguments & Flags](./app/arguments.md) for comprehensive examples and advanced usage.

## Services & Dependency Injection

Deepkit App provides a powerful dependency injection system that automatically resolves and injects dependencies:

```typescript
class UserService {
    users: string[] = [];

    addUser(name: string) {
        this.users.push(name);
        return `User ${name} added`;
    }
}

class EmailService {
    sendEmail(to: string, subject: string) {
        console.log(`Sending email to ${to}: ${subject}`);
    }
}

const app = new App({
    providers: [UserService, EmailService]
});

// Functional command with DI
app.command('add-user', (name: string, userService: UserService, emailService: EmailService) => {
    const result = userService.addUser(name);
    emailService.sendEmail(`${name}@example.com`, 'Welcome!');
    console.log(result);
});
```

Built-in providers available out of the box:

- `Logger` for logging
- `EventDispatcher` for event handling
- `CliControllerRegistry` for registered CLI commands
- `MiddlewareRegistry` for registered middleware
- `InjectorContext` for the current injector context

See the chapters [Services](./app/services.md) and [Dependency Injection](./app/dependency-injection.md) for more details.

## Configuration

Type-safe configuration with automatic environment variable loading:

```typescript
import { MinLength } from '@deepkit/type';

class AppConfig {
    appName: string & MinLength<3> = 'MyApp';
    port: number = 3000;
    debug: boolean = false;
    databaseUrl!: string; // Required
}

const app = new App({
    config: AppConfig
})
.loadConfigFromEnv() // Loads APP_* environment variables
.configure({ debug: true }); // Override programmatically

app.command('show-config', (config: AppConfig) => {
    console.log('App configuration:', config);
});
```

See the chapter [Configuration](./app/configuration.md) for advanced configuration patterns.

## Modules

Organize your application into reusable modules:

```typescript
import { createModuleClass } from '@deepkit/app';

export class DatabaseModule extends createModuleClass({
    providers: [DatabaseService],
    exports: [DatabaseService]
}) {}

export class UserModule extends createModuleClass({
    imports: [new DatabaseModule()],
    providers: [UserService],
    controllers: [UserController]
}) {}

const app = new App({
    imports: [new UserModule()]
});
```

See the chapter [Modules](./app/modules.md) for module patterns and best practices.

## Event System

Handle application events and create custom event-driven architectures:

```typescript
import { EventToken, onAppExecute } from '@deepkit/app';

const UserCreated = new EventToken('user.created');

app.listen(onAppExecute, (event) => {
    console.log('Command starting:', event.command);
});

app.listen(UserCreated, (event, logger: Logger) => {
    logger.log('User created:', event.data);
});

app.command('create-user', async (name: string, eventDispatcher: EventDispatcher) => {
    // Create user logic...
    await eventDispatcher.dispatch(UserCreated, { name });
});
```

See the chapter [Events](./app/events.md) for comprehensive event handling.

## Testing

Deepkit App provides excellent testing support:

```typescript
import { createTestingApp } from '@deepkit/framework';

test('user creation command', async () => {
    const testing = createTestingApp({
        providers: [UserService],
        controllers: [CreateUserCommand]
    });

    const exitCode = await testing.app.execute(['create-user', 'John']);
    expect(exitCode).toBe(0);

    const userService = testing.app.get(UserService);
    expect(userService.users).toContain('John');
});
```

See the chapter [Testing](./app/testing.md) for comprehensive testing strategies.

## Exit Codes

Control command exit codes for proper CLI behavior:

```typescript
@cli.controller('deploy')
export class DeployCommand {
    async execute(environment: string): Promise<number> {
        try {
            await this.deployToEnvironment(environment);
            console.log('Deployment successful');
            return 0; // Success
        } catch (error) {
            console.error('Deployment failed:', error.message);
            return 1; // Error
        }
    }
}
```

## Advanced Topics

- **[Application Lifecycle](./app/lifecycle.md)**: Understanding startup, shutdown, and lifecycle events
- **[Best Practices](./app/best-practices.md)**: Patterns and recommendations for robust applications
- **[Troubleshooting](./app/troubleshooting.md)**: Common issues and debugging techniques
