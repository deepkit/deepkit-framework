# HTTP

Processing HTTP requests is one of the most well-known tasks for a server. It converts an input (HTTP request) into an output (HTTP response) and performs a specific task. A client can send data to the server via an HTTP request in a variety of ways, which must be read and handled correctly. In addition to the HTTP body, HTTP query or HTTP header values are also possible. How data is actually processed depends on the server. It is the server that defines where and how the values are to be sent by the client.

The top priority here is not only to correctly execute what the user expects, but to correctly convert (deserialize) and validate any input from the HTTP request.

The pipeline through which an HTTP request passes on the server can be varied and complex. Many simple HTTP libraries pass only the HTTP request and the HTTP response for a given route, and expect the developer to process the HTTP response directly. A middleware API allows the pipeline to be extended as needed.

_Express Example_

```typescript
const http = express();
http.get('/user/:id', (request, response) => {
    response.send({id: request.params.id, username: 'Peter' );
});
```

This is very well tailored for simple use cases, but quickly becomes confusing as the application grows, since all inputs and outputs must be manually serialized or deserialized and validated. Also, consideration must be given to how objects and services such as a database abstraction can be obtained from the application itself. It forces the developer to put an architecture on top of it that maps these mandatory functionalities.

Deepkit's HTTP Library instead leverages the power of TypeScript and Dependency Injection. Serialization/Deserialization and validation of any values happen automatically based on the defined types. It also allows defining routes either via a functional API as in the example above or via controller classes to cover the different needs of an architecture.

It can be used either with an existing HTTP server like Node's `http` module or with the Deepkit framework. Both API variants have access to the dependency injection container and can thus conveniently retrieve objects such as a database abstraction and configurations from the application.

## Example Functional API

```typescript
import { FrameworkModule } from '@deepkit/framework';
import { HttpRouterRegistry, http } from '@deepkit/http';
import { Positive } from '@deepkit/type';

//Functional API
const app = new App({
  imports: [new FrameworkModule()],
});
const router = app.get(HttpRouterRegistry);

router.get('/user/:id', (id: number & Positive, database: Database) => {
  //id is guaranteed to be a number and positive.
  //database is injected by the DI Container.
  return database.query(User).filter({ id }).findOne();
});

app.run();
```

## Class Controller API

```typescript
import { User } from 'discord.js';

import { FrameworkModule } from '@deepkit/framework';
import { HttpRouterRegistry, http } from '@deepkit/http';
import { Positive } from '@deepkit/type';

//Controller API
class UserController {
  constructor(private database: Database) {}

  @http.GET('/user/:id')
  user(id: number & Positive) {
    return this.database.query(User).filter({ id }).findOne();
  }
}

const app = new App({
  controllers: [UserController],
  imports: [new FrameworkModule()],
});
```
