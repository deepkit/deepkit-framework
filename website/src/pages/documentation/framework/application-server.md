# Application Server

The `ApplicationServer` is the core component that manages HTTP and RPC servers, worker processes, and the application lifecycle. This chapter covers how to work with the application server and its lifecycle events.

## Basic Usage

The application server is automatically created when you import the `FrameworkModule`:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    imports: [new FrameworkModule()]
});

// Start the server
app.run(['server:start']);
```

## Accessing the Application Server

You can inject the `ApplicationServer` into your services:

```typescript
import { ApplicationServer } from '@deepkit/framework';

class MyService {
    constructor(private server: ApplicationServer) {}
    
    getServerInfo() {
        return {
            host: this.server.getHttpHost(),
            started: this.server.started
        };
    }
}
```

## Server Lifecycle Events

The application server emits various lifecycle events that you can listen to:

### Bootstrap Events

```typescript
import { 
    onServerBootstrap, 
    onServerBootstrapDone,
    onServerMainBootstrap,
    onServerMainBootstrapDone,
    onServerWorkerBootstrap,
    onServerWorkerBootstrapDone
} from '@deepkit/framework';

class MyListener {
    @eventDispatcher.listen(onServerBootstrap)
    onBootstrap() {
        console.log('Server is bootstrapping...');
    }
    
    @eventDispatcher.listen(onServerBootstrapDone)
    onBootstrapDone() {
        console.log('Server bootstrap completed');
    }
    
    @eventDispatcher.listen(onServerMainBootstrap)
    onMainBootstrap() {
        console.log('Main process bootstrapping...');
    }
    
    @eventDispatcher.listen(onServerWorkerBootstrap)
    onWorkerBootstrap() {
        console.log('Worker process bootstrapping...');
    }
}
```

### Shutdown Events

```typescript
import { onServerShutdown, onServerMainShutdown } from '@deepkit/framework';

class ShutdownListener {
    @eventDispatcher.listen(onServerShutdown)
    onShutdown() {
        console.log('Server is shutting down...');
        // Cleanup resources
    }
    
    @eventDispatcher.listen(onServerMainShutdown)
    onMainShutdown() {
        console.log('Main process shutting down...');
        // Main process cleanup
    }
}
```

## Manual Server Control

For testing or custom scenarios, you can manually control the server:

```typescript
import { ApplicationServer } from '@deepkit/framework';

class ServerManager {
    constructor(private server: ApplicationServer) {}
    
    async startServer() {
        await this.server.start();
        console.log('Server started manually');
    }
    
    async stopServer() {
        await this.server.close(true); // graceful shutdown
        console.log('Server stopped');
    }
}
```

## Worker Processes

The application server supports multi-process architecture:

```typescript
new FrameworkModule({
    workers: 4  // Use 4 worker processes
})
```

### Worker Lifecycle

- **Master Process**: Manages workers, handles process coordination
- **Worker Processes**: Handle HTTP/RPC requests

```typescript
import cluster from 'cluster';

class WorkerAwareService {
    getProcessInfo() {
        return {
            isMaster: cluster.isMaster,
            isWorker: cluster.isWorker,
            workerId: cluster.worker?.id,
            pid: process.pid
        };
    }
}
```

## HTTP Worker

Access the HTTP worker for advanced scenarios:

```typescript
import { ApplicationServer } from '@deepkit/framework';

class HttpService {
    constructor(private server: ApplicationServer) {}
    
    getHttpWorker() {
        return this.server.getHttpWorker();
    }
    
    async handleCustomRequest(request: any, response: any) {
        const worker = this.server.getHttpWorker();
        await worker.handleRequest(request, response);
    }
}
```

## RPC Client Creation

Create RPC clients for inter-service communication:

```typescript
import { ApplicationServer } from '@deepkit/framework';

class RpcService {
    constructor(private server: ApplicationServer) {}
    
    createClient() {
        return this.server.createClient();
    }
    
    async callRemoteService() {
        const client = this.createClient();
        const controller = client.controller('remote-service');
        return await controller.someMethod();
    }
}
```

## Server Configuration

Configure server behavior through the framework module:

```typescript
new FrameworkModule({
    // Basic server settings
    host: '0.0.0.0',
    port: 8080,
    
    // Worker configuration
    workers: 0,  // Single process
    
    // Shutdown behavior
    gracefulShutdownTimeout: 10,
    
    // SSL configuration
    ssl: false,
    selfSigned: false,
    
    // Logging
    logStartup: true
})
```

## Graceful Shutdown

The server supports graceful shutdown with configurable timeout:

```typescript
// Configure graceful shutdown timeout
new FrameworkModule({
    gracefulShutdownTimeout: 30  // 30 seconds
})

// Manual graceful shutdown
class ShutdownService {
    constructor(private server: ApplicationServer) {}
    
    async gracefulShutdown() {
        await this.server.close(true);  // graceful = true
    }
}
```

## Server Information

Get runtime information about the server:

```typescript
class ServerInfoService {
    constructor(private server: ApplicationServer) {}
    
    getInfo() {
        return {
            httpHost: this.server.getHttpHost(),
            hasHttpWorker: !!this.server.getHttpWorker(),
            // Add custom server information
        };
    }
}
```

## Custom Server Instance

Use a custom HTTP/HTTPS server:

```typescript
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';

// Custom HTTP server
const httpServer = createServer();

new FrameworkModule({
    server: httpServer
})

// Custom HTTPS server
const httpsServer = createHttpsServer({
    key: fs.readFileSync('private-key.pem'),
    cert: fs.readFileSync('certificate.pem')
});

new FrameworkModule({
    server: httpsServer,
    ssl: true
})
```

## Error Handling

Handle server errors and failures:

```typescript
class ErrorHandler {
    @eventDispatcher.listen(onServerBootstrap)
    async onBootstrap() {
        try {
            // Server initialization logic
        } catch (error) {
            console.error('Server bootstrap failed:', error);
            process.exit(1);
        }
    }
}
```

## Testing with Application Server

For integration testing, use the testing utilities:

```typescript
import { createTestingApp } from '@deepkit/framework';

test('server lifecycle', async () => {
    const testing = createTestingApp({
        controllers: [MyController]
    });
    
    // Start server
    await testing.startServer();
    
    // Test server functionality
    const response = await testing.request(HttpRequest.GET('/'));
    expect(response.statusCode).toBe(200);
    
    // Stop server
    await testing.stopServer();
});
```

## Best Practices

1. **Use lifecycle events** for initialization and cleanup
2. **Configure workers** based on your server capacity
3. **Implement graceful shutdown** for production deployments
4. **Monitor server health** through custom services
5. **Handle errors properly** during bootstrap and runtime
6. **Use testing utilities** for integration tests

## Next Steps

- [Workers](./workers.md) - Multi-process configuration
- [Events](./events.md) - Event system and lifecycle hooks
- [Testing](./testing.md) - Testing server functionality
- [Deployment](./deployment.md) - Production deployment strategies
