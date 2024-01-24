# RPC

RPC, which stands for Remote Procedure Call, allows functions on a remote server to be called as if they were local functions. Unlike HTTP client-server communication, which uses HTTP methods and a URL for mapping, RPC uses the function name for mapping. The data to be sent is passed as normal function arguments, and the result of the function call on the server is sent back to the client.

The advantage of RPC is that the client-server abstraction is lightweight because it does not work with headers, URLs, query strings, or similar. The disadvantage is that functions on a server via RPC cannot be easily called by a browser and often require a specific client.

One key feature of RPC is that the data between the client and server is automatically serialized and deserialized. Therefore, typesafe RPC clients are usually possible. Some RPC frameworks force users to provide types (parameter types and return types) in a specific format. This can be in the form of a DSL such as Protocol Buffers for gRPC and GraphQL or a JavaScript schema builder. Additional data validation can also be provided by the RPC framework but is not supported by all.

Deepkit RPC extracts types from the TypeScript code itself, so it is not necessary to use a code generator or define them manually. Deepkit supports automatic serialization and deserialization of parameters and results. Once additional restrictions are defined in Validation, they are automatically validated. This makes communication via RPC extremely typesafe and efficient. The support for streaming via `rxjs` in Deepkit RPC makes this RPC framework a suitable tool for real-time communication.

To illustrate the concept behind RPC, consider the following code:

```typescript
//server.ts
class Controller {
  hello(title: string): string {
    return 'Hello ' + title;
  }
}
```

A method like hello is implemented just like a normal function within a class on the server and can be called by a remote client.

```typescript
//client.ts
const client = new RpcClient('localhost');
const controller = client.controller<Controller>();

const result = await controller.hello('World'); // => 'Hello World';
```

Because RPC is fundamentally based on asynchronous communication, communication is usually over HTTP but can also be over TCP or WebSockets. This means that all function calls in TypeScript are converted to a `Promise` themselves. The result can be received asynchronously with a corresponding `await`.

## Isomorphic TypeScript

When a project uses TypeScript on both the client (usually frontend) and server (backend), it is called Isomorphic TypeScript. A typesafe RPC framework based on TypeScript's types is particularly beneficial for such a project because types can be shared between the client and server.

To take advantage of this, types that are used on both sides should be outsourced to their own file or package. Importing on the respective side then puts them back together.

```typescript
//shared.ts
export class User {
    id: number;
    username: string;
}

//server.ts
import { User } from './shared';

@rpc.controller('/user')
class UserController  {
    async getUser(id: number): Promise<User> {
        return await datbase.query(User).filter({id}).findOne();
    }
}

//client.ts
import { UserControllerApi } from './shared';
import type { UserController } from './server.ts'
const controller = client.controller<UserController>('/user');
const user = await controller.getUser(2); // => User
```

Backward compatibility can be implemented in the same way as with a normal local API: either new parameters are marked as optional or a new method is added.
