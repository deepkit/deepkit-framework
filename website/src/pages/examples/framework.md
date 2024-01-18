title: First Application using Deepkit Framework

The framework package of Deepkit at `@deepkit/framework` is a module you can import that provides features like application server (http/rpc),
debugger and profiler GUI, and other. It is not required to run a simple Deepkit App.

```typescript title=app.ts
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    imports: [new FrameworkModule({debug: true})],
});

app.command('hello', () => {
    console.log('Hello World!');
});

app.run();
```

Then you see all available commands from the framework module:

```bash
ts-node app.ts
```


##-------------------------------------------------##
