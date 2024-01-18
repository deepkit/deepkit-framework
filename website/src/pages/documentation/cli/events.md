# Events

There are several events that are emitted when a CLI command is executed. These events can be used to extend the CLI with custom functionality.

- `onAppExecute`: When a CLI command is about to be executed, this event is emitted.
- `onAppExecuted`: When a CLI command is successfully executed, this event is emitted.
- `onAppError`: When a CLI command failed to execute, this event is emitted.
- `onAppShutdown`: When the application is about to shut down, this event is emitted.

Event listeners can be registered either via the `App` instance as callbacks:

```typescript
import { App, onAppExecute } from "@deepkit/app";

const app = new App();

app.command('foo', () => {
    console.log('foo');
});

app.listen(onAppExecute, (event) => {
    console.log('command is about to be executed', event);
});

app.run();
```

Or as event listener classes:

```typescript
import { App, onAppExecute } from "@deepkit/app";
import { eventDispatcher } from "@deepkit/event";

class Listener {
    @eventDispatcher.listen(onAppExecute)
    onAppExecute(event: typeof onAppExecute.event) {
        console.log('command is about to be executed', event);
    }
}

const app = new App({
    listeners: [Listener]
});

app.command('foo', () => {
    console.log('foo');
});

app.run();
```

Both variants support dependency injection. You can also define your own events and emit them in your code. 
See the chapter [Events](../events) for more information about the event system.
