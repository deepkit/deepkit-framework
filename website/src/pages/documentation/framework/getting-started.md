# Getting Started

Deepkit Framework is a highly modular, scalable, and fast TypeScript framework for building web applications, APIs, and microservices. This guide will help you get started with the framework quickly.

## Installation

First, make sure you have [Deepkit App](../app.md) installed. Then install the framework package:

```bash
npm install @deepkit/framework
```

## Basic Application

Create a simple application with HTTP and RPC support:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http } from '@deepkit/http';
import { rpc } from '@deepkit/rpc';

class MyController {
    @http.GET('/')
    httpHello() {
        return 'Hello from HTTP!';
    }
}

@rpc.controller('main')
class MyRpcController {
    @rpc.action()
    rpcHello() {
        return 'Hello from RPC!';
    }
}

const app = new App({
    controllers: [MyController, MyRpcController],
    imports: [new FrameworkModule()]
});

app.run();
```

## Starting the Server

Run your application:

```bash
ts-node app.ts server:start
```

You'll see output like:

```
Start server ...
HTTP MyController
    GET / httpHello
RPC MyRpcController main
    rpcHello
HTTP listening at http://localhost:8080/
Server started.
```

Your HTTP endpoint is available at `http://localhost:8080/` and RPC is available via WebSocket.

## Framework Module Configuration

The `FrameworkModule` accepts many configuration options:

```typescript
new FrameworkModule({
    // Server configuration
    host: '0.0.0.0',
    port: 8080,
    
    // Enable debugging and profiling
    debug: true,
    profile: true,
    
    // SSL configuration
    ssl: false,
    selfSigned: false, // For development
    
    // Worker processes
    workers: 0, // 0 = single process
    
    // Public directory for static files
    publicDir: 'public',
    
    // Database migration
    migrateOnStartup: false,
    
    // Logging
    httpLog: true,
    logStartup: true
})
```

## Services and Dependency Injection

Create services that can be injected into controllers:

```typescript
class DatabaseService {
    async getUsers() {
        return [{ id: 1, name: 'John' }];
    }
}

class UserController {
    constructor(private db: DatabaseService) {}
    
    @http.GET('/users')
    async getUsers() {
        return await this.db.getUsers();
    }
}

const app = new App({
    providers: [DatabaseService],
    controllers: [UserController],
    imports: [new FrameworkModule()]
});
```

## Configuration Management

Use configuration classes for environment-specific settings:

```typescript
class AppConfig {
    host: string = 'localhost';
    port: number = 8080;
    databaseUrl: string = 'sqlite://app.db';
}

const app = new App({
    config: AppConfig,
    controllers: [UserController],
    imports: [new FrameworkModule()]
});

// Load from environment variables
app.loadConfigFromEnv({ prefix: 'APP_' });
app.run();
```

Set environment variables:

```bash
APP_HOST=0.0.0.0 APP_PORT=3000 ts-node app.ts server:start
```

## Available Commands

The framework provides several built-in commands:

```bash
# Start the server
ts-node app.ts server:start

# Show application configuration
ts-node app.ts app:config

# Database migrations
ts-node app.ts migration:create
ts-node app.ts migration:up
ts-node app.ts migration:down

# Show all available commands
ts-node app.ts
```

## Development Features

### Debug Mode

Enable debug mode to access the web-based debugger:

```typescript
new FrameworkModule({ debug: true })
```

Visit `http://localhost:8080/_debug` to access:
- Configuration viewer
- Database browser
- Profiler
- Route inspector

### Hot Reloading

Use `ts-node-dev` for automatic restarts during development:

```bash
npm install -D ts-node-dev
ts-node-dev app.ts server:start
```

## Next Steps

- [Configuration](./configuration.md) - Complete configuration reference
- [HTTP Controllers](../http.md) - Building REST APIs
- [RPC Controllers](./rpc.md) - Real-time communication
- [Database](./database.md) - Database integration with Deepkit ORM
- [Testing](./testing.md) - Testing your application
- [Deployment](./deployment.md) - Production deployment
