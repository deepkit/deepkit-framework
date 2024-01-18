---
title: Deepkit App
package: "@deepkit/app"
doc: app
api: app
category: app
---

<p class="introduction">
    Command line interface (CLI) framework for TypeScript with service container, module system, hooks, and easy to define commands.
</p>

## Features

<div class="app-boxes-small">
    <box title="Commands">Easy to define commands with arguments and flags based on runtime types.</box>
    <box title="Service Container">Full fledged dependency injection for classes and even functions.</box>
    <box title="Event System">Powerful event system with hooks for your application.</box>
    <box title="Modules">Highly customizable module system with hooks and inheritance.</box>
    <box title="Configuration">Configuration loader (env, dotenv, json) and option injection.</box>
    <box title="Logger">Logger with support for colors and multiple transports.</box>
</div>

<feature class="center">

## Commands

Write CLI commands with class methods or simple async functions.

All CLI arguments and flags are extracted out of the function signature and are automatically deserialized and validated based on its types.

```typescript title=class-command.ts
import { App } from '@deepkit/app';

class MyCommand {
    async execute(name: string = 'body') {
        console.log('Hello', name);
    }
}

const app = new App({
    controllers: [MyCommand],
});
app.run();
```

```typescript title=functional-command.sh
import { App } from '@deepkit/app';

const app = new App();

app.command('test', async (name: string = 'body') => {
    console.log('Hello', name);
});

app.run();
```

</feature>

<feature>

## Arguments and Flags

Arguments and flags are automatically deserialized based on its types, validated and can be provided with additional constraints.


```typescript
import { Flag, App } from '@deepkit/app';

const app = new App();

app.command('user:find', async (
    name: string & Flag = '',
    age: number & Flag = '',
    active: boolean & Flag = false,
) => {
    // name is a string, age a number, active a boolean
});

// ts-node app.ts user:find --name Peter --age 20 --active
```

</feature>

<feature class="right">

## Dependency Injection

The service container allows you to inject dependencies into your commands, controllers, and hooks,
without any boilerplate code.

```typescript
import { App } from '@deepkit/app';

class MyDatabase extends Database {} //your database class

const app = new App({
    providers: [MyDatabase],
});

app.command('user:find', async (
    name: string & Flag = '',
    db: MyDatabase, // automatically injected
) => {
    const users = await db.query(User).filter({name}).find();
    console.log(users);
});

app.run();
```

</feature>

<feature>

## Configuration

Define your configuration as class including validation constraint and load it automatically from environment variables, dotfiles, or JSON files.

Configuration options can be injected into your commands, controllers, and hooks.

```typescript
import { App } from '@deepkit/app';

class Config {
    domain: string = 'localhost';
}

const app = new App({
    config: Config,
    providers: [MyDatabase],
});

app.command('url', async (
    name: string & Flag = '',
    db: MyDatabase, // automatically injected
    domain: Config['domain'], // automatically injected
) => {
    const user = await db.query(User).filter({ name }).findOne();
    console.log('url', `https://${domain}/user/${user.username}`);
});

app.run();
```

</feature>


<feature class="right">

## Modules

Powerful module system with hooks and inheritance that allows to easily extend your application.

Modules can bring their own providers, controllers, event listeners, and configuration.

```typescript
import { App, AppModule } from '@deepkit/app';

export function myModule(options: {}) {
    return (module: AppModule) => {
        module.addProvider(MyDatabase);
        module.addController(MyController);
        module.addListener();

        //make MyDatabase available for parent modules
        module.addExport(MyDatabase);
    };
}

const app = new App({
    config: Config,
    imports: [
        myModule({}),
    ]
});

app.command('url', async (
    name: string & Flag = '',
    db: MyDatabase, // automatically injected from module
) => {
    //...
});

app.run();
```

</feature>


<feature>

## Event System

The event system allows you to hook into the application lifecycle and react to events.

All listeners have full access to the service container and can receive dependencies
allowing to write nicely decoupled code.

```typescript
import { App, onAppExecute } from '@deepkit/app';

const app = new App();

app.listen(onAppExecute, async (event, logger: Logger) => {
    logger.log('app started');
});

app.run();
```

</feature>
