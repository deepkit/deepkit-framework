---
title: Deepkit RPC
package: "@deepkit/rpc"
doc: rpc/getting-started
api: rpc
category: rpc
---

<p class="introduction">
The fastest way to connect your frontend with your backend or interconnect your microservices with automatic serialization, validation, error forwarding, fully typesafe interface, and streaming capabilities using RxJS — without code generation or config files, all TypeScript.
</p>


## Features

<div class="app-boxes-small">
    <box title="Runtime Types">Use just regular TypeScript for RPC functions definition.</box>
    <box title="Validation">Built-In validation for parameters using just TypeScript types.</box>
    <box title="Streaming">RxJS Observable, Subject, and BehaviorSubject natively supported.</box>
    <box title="Error Forwarding">Thrown errors are serialized and forwarded to the client.</box>
    <box title="Progress Tracking">Built-in upload/download progress tracking.</box>
    <box title="Peer to Peer">Peer to peer communication using Deepkit Broker.</box>
    <box title="Dependency Injection">All controller with access to the dependency injection container.</box>
    <box title="Transport Agnostic">Fast binary protocol with WebSocket, TCP and in-memory for SSR out of the box.</box>
    <box title="Classes">Full support of classes including constructor.</box>
</div>

<feature class="center">

## How it works

You write your controller interface (actions) and models (parameter and return types) in a shared library/package 
that can be imported by client and server. 

The server implements actions using the `@rpc` decorator. The client imports the type only and can call all the actions as if they were local functions.

```typescript title=client.ts
import { DeepkitClient } from '@deepkit/rpc';
import type { MyController } from './server.ts';
import { User } from './shared/models';

//connect via WebSockets/TCP, or in-memory for SSR
const client = new DeepkitClient('localhost');
const main = client.controller<MyController>('/main');

const user = await main.getUser(42);
console.log(user.username);
console.log(user instanceof User); //true
```

```typescript title=server.ts
import { rpc } from '@deepkit/rpc';
import { User } from './shared/models';

@rpc.controller('/main')
class MyController  {

    @rpc.action()
    async getUser(id: number): Promise<User> {
        return new User(id);
    }
}
```


</feature>

<feature>

## Class Controllers

RPC actions are simple class methods, decorated with `@rpc.action()`. Parameter and return type are automatically serialized and validated
thanks to Deepkit Runtime Types.

You can even share your database models from Deepkit ORM and return them directly in your RPC action.

```typescript
import { Positive } from '@deepkit/type';
import { rpc } from '@deepkit/rpc';
import { User } from './shared/models';

@rpc.controller('/main')
class MyController  {
    @rpc.action()
    async getUser(id: number & Positive): Promise<User> {
        return new User(id);
    }

    @rpc.action()
    async labelUser(
        id: number, labels: string[]
    ): Promise<{[name: string]: number}> {
        return labels.map(v => {
            return {v: 1};
        });
    }
}
```

</feature>

<feature class="right">

## Type Serialization

Data types of action parameters and its return type like String, Number, Boolean, Date, arrays, typed arrays, objects, classes, and custom entities are serialized automatically back and forth using a flexible and fast binary protocol.

Nominal class supports is fully supported, so you can use the same class name in different contexts.

```typescript
@rpc.controller('/main')
class MyController {
    @rpc.action()
    async getUser(id: number): Promise<User> {
        return new User(id);
    }

    @rpc.action()
    hello(name: string): string {
        return 'Hello ' + name;
    }

    @rpc.action()
    async uploadFile(data: Uint8Array): Promise<boolean> {
        return true;
    }
}

```

</feature>

<feature>

## Parameter validation

All parameters are automatically validated on the server side to make sure invalid requests won't go through.

Use all available validators from Deepkit Type, or write your own validation functions.

When invalid parameters are sent a ValidationError object is thrown with detailed error code and message for each parameter, that can be nicely shown in the user interface.

```typescript
import { Positive, Maximum, 
    Exclude, MaxLength } from "@deepkit/type";

@rpc.controller('/main')
class MyController {
    @rpc.action()
    async getUser(
        id: number & Positive & Maximum<10_000>
    ): Promise<User> {
        return new User(id);
    }

    @rpc.action()
    hello(name: string & Exclude<' '>): string {
        return 'Hello ' + name;
    }

    @rpc.action()
    async uploadFile(
        data: Uint8Array & MaxLength<1_048_000>
    ): Promise<boolean> {
        return true;
    }
}

```
</feature>

<feature class="center">

## Streaming

Streaming data to the client shouldn't be hard. That's why Deepkit RPC supports RxJS Observable, Subject, and BehaviorSubject natively. Just return an Observable in an action and the client receives an observable as well, that forwards all emitted values — of course automatically serialized.

As soon as the client unsubscribes the Observable the same Observable is completed on the server side as well and triggers the unsubscribe callback.

All Observables and subscriptions are automatically closed when the client disconnects.


```typescript title=client.ts
import { DeepkitClient } from '@deepkit/rpc';
import type { MyController } from './server.ts';

const client = new DeepkitClient('localhost');
const main = client.controller<Controller>('/main');

const sensorData = await main.sensorData();
const sub = sensorData.subscribe((next) => {
    console.log('sensor says', next);
});

//when done watching for data, but keeps Subject
//on server alive, for other subscribers.
sub.unsubscribe();

const chat = await main.getChatChannel('general');
const sub = chat.subscribe((next) => {
    console.log('message', next);
});

//completes the whole Subject, triggering its TearDown
sub.unsubscribe();
```

```typescript title=server.ts
import { Observable } from "rxjs";

@rpc.controller('/main')
class MyController {
    protected sensorData = new Subject<number>();

    @rpc.action()
    sensorData(): Subject<number> {
        // return already existing subjects
        return sensorData;
    }

    @rpc.action()
    getChatChannel(
        name: string
    ): Observable<{ user: string, message: string }> {
        return new Observable((observer) => {
           const id = setInterval(() => {
              observer.next({user: 'Peter', message: 'Hello'});
          }, 1000);
           
           return {unsubscribe() {
               clearInterval(id);
           }};
        });
    }
}
```
</feature>

<feature class="right">

## Error Forwarding

If an error is throwing in an action on the server, it is automatically serialized and forwarded to the client
including the stack trace.

Custom error classes can also be used the same as with custom entity classes.

A security layer allows to rewrite errors (e.g. to remove the error stack trace or hide sensitive messages).

```typescript title=client.ts
import { MyCustomError } from "@deepkit/type";

const client = new DeepkitClient('localhost');
const ctrl = client.controlle<Controller>('/main');

try {
    const sensorData = await ctrl.sensorData('a');
} catch (error) {
    error.message === 'No sensor a';
}

try {
    await ctrl.customError();
} catch (error) {
    error instanceof MyCustomError; //true
}
```

```typescript title=shared.ts
@entity.name('@error/my-custom')
class MyCustomError extends Error {
    codes: string[] = [];
}
```

```typescript title=server.ts
@rpc.controller('/main')
class MyController {
    @rpc.action()
    getSensorData(name: string): Subject<number> {
        if (name === 'temp') return this.tempSensor;
        throw new Error(`No sensor ${name}`);
    }

    @rpc.action()
    customError(): string {
        const error = new MyCustomError();
        error.codes = ['a', 'b'];
        throw error;
    }
}
```
</feature>

<feature>

## Progress Tracking

Bigger messages are chunked automatically and allow you to monitor the upload and download progress.

Multiple uploads and downloads can be tracked at the same time.

```typescript title=client.ts
const client = new DeepkitClient('localhost');
const main = client.controller<Controller>('/main');

const progress = ClientProgress.track();
progress.upload.subscribe(progress => {
    console.log('upload progress',
        progress.upload.total, progress.current,);
});
await main.uploadFile(new Uint8Array(1024*1024));

const progress2 = ClientProgress.track();
progress2.download.subscribe(progress => {
    console.log('download progress',
        progress2.download.total, progress2.download.current,
    );
});
const zip = await main.downloadFile('file.zip');
```
</feature>
