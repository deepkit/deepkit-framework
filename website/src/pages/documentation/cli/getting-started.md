# Getting Started

Since CLI programs in Deepkit are based on Runtime Types, it is necessary to have Runtime Types already installed correctly. See [Runtime Type Installation](../runtime-types/getting-started.md).

If this is done successfully, `@deepkit/app` can be installed or the Deepkit framework which already uses the library under the hood.

```sh
npm install @deepkit/app
```

Note that @deepkit/app is partially based on TypeScript decorators and this feature should be enabled accordingly with `experimentalDecorators`.
If you use functions as controllers only, you do not need TypeScript decorators.

_File: tsconfig.json_

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "es6",
    "moduleResolution": "node",
    "experimentalDecorators": true
  },
  "reflection": true
}
```

Once the library is installed, the API of it can be used directly.

## Command

To create a command for your application, you need to create a CLI controller.
This is a simple class that has an `execute` method and or a simple function.

Functional controller:

```typescript
import { App, cli, Flag } from '@deepkit/app';

//functional controller
new App({
    providers: [MyService],
})
.command('test', (id: number, check: boolean & Flag = false) => {
    console.log('Hello World', id, check);
})
.run()
```


Class controllers:

```typescript
#!/usr/bin/env ts-node-script
import { App, cli, Flag } from '@deepkit/app';

//class controller
@cli.controller('test', {
    description: 'My first command'
})
class TestCommand {
    async execute(id: number, check: boolean & Flag = false) {
        console.log('Hello World', id, check);
    }
}

new App({
    controllers: [TestCommand]
}).run();
```

In the decorator `@cli.controller` the unique name of the CLI application is defined as the first argument. Further options like a description can be optionally added in the object at the second position.

This code is already a complete CLI application and can be started this way:

```sh
$ ts-node ./app.ts
VERSION
  Node

USAGE
  $ ts-node app.ts [COMMAND]

COMMANDS
  test
```

You can see that a "test" command is available. To execute this, the name must be passed as an argument:

```sh
$ ts-node ./app.ts test
Hello World
```

It is also possible to make the file executable using `chmod +x app.ts`, so that the command `./app.ts` is already sufficient to start it. Note that then a so-called Shebang is necessary. Shebang denotes the character combination `#!` at the beginning of a script program. In the example above this is already present: `#!/usr/bin/env ts-node-script` and uses the script mode of `ts-node`.

```sh
$ ./app.ts test
Hello World
```

In this way, any number of commands can be created and registered. The unique name should be well-chosen and allows grouping of commands with the `:` character (e.g. `user:create`, `user:remove`, etc).

```sh
$ ts-node app.ts
Error :(
$ echo $?
12
```
