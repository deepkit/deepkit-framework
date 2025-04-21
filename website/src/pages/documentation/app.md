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

See the chapter [Arguments & Flags](./app/arguments.md) for more information.


## Dependency Injection

Deepkit App sets up a service container and for each imported module its own Dependency Injection container that inherits from its parents. 
It brings out of the box following providers you can automatically inject into your services, controllers, and event listeners:

- `Logger` for logging
- `EventDispatcher` for event handling
- `CliControllerRegistry` for registered CLI commands
- `MiddlewareRegistry` for registered middleware
- `InjectorContext` for the current injector context

As soon as you import Deepkit Framework you get additional providers. See [Deepkit Framework](./framework.md) for more details.


## Exit code

The exit code is 0 by default, which means that the command was executed successfully. To change the exit code, a number other than 0 should be returned in the exucute method.

```typescript
@cli.controller('test')
export class TestCommand {
    async execute() {
        console.error('Error :(');
        return 12;
    }
}
```
