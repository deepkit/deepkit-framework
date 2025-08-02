# Workers and Multi-Process Architecture

Deepkit Framework supports multi-process architecture using worker processes to handle increased load and improve application performance. This chapter covers how to configure and work with workers.

## Overview

The framework can run in two modes:

1. **Single Process**: All requests handled by the main process (default)
2. **Multi-Process**: Main process manages worker processes that handle requests

## Basic Worker Configuration

Configure workers in the FrameworkModule:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    imports: [
        new FrameworkModule({
            workers: 4  // Use 4 worker processes
        })
    ]
});
```

## How Workers Work

### Master Process
- Manages worker processes
- Handles process coordination
- Distributes incoming connections
- Monitors worker health
- Restarts failed workers

### Worker Processes
- Handle HTTP/RPC requests
- Execute application logic
- Process database operations
- Run background tasks

## Worker Lifecycle

### Starting Workers

When you start the server with workers configured:

```bash
ts-node app.ts server:start
```

The framework will:
1. Start the master process
2. Fork the specified number of worker processes
3. Set up load balancing between workers
4. Begin accepting connections

### Worker Management

Workers are automatically managed:

```typescript
// Workers are automatically restarted if they crash
// Load is automatically distributed among healthy workers
// Graceful shutdown waits for all workers to finish
```

## Detecting Process Type

Determine if code is running in master or worker:

```typescript
import cluster from 'cluster';

class ProcessAwareService {
    getProcessInfo() {
        return {
            isMaster: cluster.isMaster,
            isWorker: cluster.isWorker,
            workerId: cluster.worker?.id,
            pid: process.pid
        };
    }
    
    async initialize() {
        if (cluster.isMaster) {
            console.log('Initializing master process');
            // Master-only initialization
        } else {
            console.log(`Initializing worker ${cluster.worker.id}`);
            // Worker-only initialization
        }
    }
}
```

## Worker-Specific Logic

Run different logic in master vs worker processes:

```typescript
import { onServerMainBootstrap, onServerWorkerBootstrap } from '@deepkit/framework';

class WorkerCoordinator {
    @eventDispatcher.listen(onServerMainBootstrap)
    onMasterBootstrap() {
        console.log('Master process starting...');
        // Set up master-only services
        this.setupMasterServices();
    }
    
    @eventDispatcher.listen(onServerWorkerBootstrap)
    onWorkerBootstrap() {
        console.log(`Worker ${cluster.worker.id} starting...`);
        // Set up worker-only services
        this.setupWorkerServices();
    }
    
    private setupMasterServices() {
        // Services that should only run in master
        // - Scheduled tasks
        // - Monitoring
        // - Admin interfaces
    }
    
    private setupWorkerServices() {
        // Services that run in each worker
        // - Request handlers
        // - Business logic
        // - Database connections
    }
}
```

## Inter-Process Communication

Use the broker for communication between processes:

```typescript
import { BrokerBus } from '@deepkit/broker';

class TaskCoordinator {
    constructor(private bus: BrokerBus) {}
    
    async distributeWork() {
        if (cluster.isMaster) {
            // Master distributes work
            await this.bus.publish('work.available', {
                taskId: 'task-123',
                data: { /* task data */ }
            });
        }
    }
    
    async setupWorkerListener() {
        if (cluster.isWorker) {
            // Workers listen for work
            const subscription = await this.bus.subscribe('work.available');
            subscription.subscribe(async (message) => {
                await this.processTask(message.data);
                
                // Report completion
                await this.bus.publish('work.completed', {
                    taskId: message.taskId,
                    workerId: cluster.worker.id
                });
            });
        }
    }
}
```

## Shared State Management

### Using Broker for Shared State

```typescript
import { BrokerCache, BrokerKeyValue } from '@deepkit/broker';

class SharedStateService {
    constructor(
        private cache: BrokerCache,
        private kv: BrokerKeyValue
    ) {}
    
    async incrementCounter(key: string): Promise<number> {
        const current = await this.kv.get(key) || 0;
        const newValue = current + 1;
        await this.kv.set(key, newValue);
        return newValue;
    }
    
    async cacheUserSession(userId: string, session: any) {
        await this.cache.set(`session:${userId}`, session, 3600);
    }
    
    async getUserSession(userId: string) {
        return await this.cache.get(`session:${userId}`);
    }
}
```

### Database Connections

Each worker maintains its own database connections:

```typescript
class DatabaseService {
    constructor(private database: Database) {}
    
    async getConnection() {
        // Each worker has its own connection pool
        return this.database.getConnection();
    }
}
```

## Worker Configuration

### Optimal Worker Count

```typescript
import os from 'os';

const cpuCount = os.cpus().length;

new FrameworkModule({
    // Common configurations:
    workers: cpuCount,           // One worker per CPU core
    workers: cpuCount - 1,       // Leave one core for master
    workers: Math.max(2, cpuCount / 2)  // Half the cores
})
```

### Environment-Based Configuration

```typescript
class AppConfig {
    framework = {
        workers: parseInt(process.env.WORKERS || '0')
    };
}

// Set via environment:
// WORKERS=4 ts-node app.ts server:start
```

## Graceful Shutdown

Workers support graceful shutdown:

```typescript
new FrameworkModule({
    workers: 4,
    gracefulShutdownTimeout: 30  // 30 seconds for graceful shutdown
})
```

### Handling Shutdown in Workers

```typescript
import { onServerShutdown } from '@deepkit/framework';

class GracefulShutdownHandler {
    @eventDispatcher.listen(onServerShutdown)
    async onShutdown() {
        console.log(`Worker ${cluster.worker?.id} shutting down...`);
        
        // Clean up resources
        await this.closeConnections();
        await this.finishPendingTasks();
    }
    
    private async closeConnections() {
        // Close database connections, file handles, etc.
    }
    
    private async finishPendingTasks() {
        // Complete ongoing operations
    }
}
```

## Load Balancing

The framework automatically load balances requests across workers:

```typescript
// Requests are automatically distributed using round-robin
// No additional configuration needed
```

## Monitoring Workers

Monitor worker health and performance:

```typescript
class WorkerMonitor {
    @eventDispatcher.listen(onServerMainBootstrap)
    setupMonitoring() {
        if (cluster.isMaster) {
            cluster.on('online', (worker) => {
                console.log(`Worker ${worker.id} is online`);
            });
            
            cluster.on('exit', (worker, code, signal) => {
                console.log(`Worker ${worker.id} died with code ${code}`);
                // Worker is automatically restarted
            });
            
            // Monitor worker memory usage
            setInterval(() => {
                for (const worker of Object.values(cluster.workers || {})) {
                    if (worker) {
                        worker.send('memory-check');
                    }
                }
            }, 60000); // Every minute
        }
    }
}
```

## Testing with Workers

Test worker functionality:

```typescript
import { createTestingApp } from '@deepkit/framework';

test('single process testing', async () => {
    // Testing app always runs in single process mode
    const testing = createTestingApp({
        imports: [new FrameworkModule({ workers: 0 })]
    });
    
    // Test your application logic
});

test('worker configuration', () => {
    const app = new App({
        imports: [new FrameworkModule({ workers: 4 })]
    });
    
    // Test configuration is applied correctly
});
```

## Best Practices

1. **Start with single process** and add workers when needed
2. **Use one worker per CPU core** as a starting point
3. **Monitor worker memory usage** to prevent leaks
4. **Use broker for inter-process communication**
5. **Handle graceful shutdown** properly
6. **Test with single process** for easier debugging
7. **Configure workers via environment** for flexibility
8. **Monitor worker health** in production

## Common Patterns

### Background Task Processing

```typescript
class BackgroundTaskProcessor {
    constructor(private bus: BrokerBus) {}
    
    async setupTaskProcessing() {
        if (cluster.isMaster) {
            // Master schedules tasks
            setInterval(async () => {
                await this.bus.publish('scheduled.task', {
                    type: 'cleanup',
                    timestamp: new Date()
                });
            }, 60000);
        } else {
            // Workers process tasks
            const subscription = await this.bus.subscribe('scheduled.task');
            subscription.subscribe(async (task) => {
                await this.processTask(task);
            });
        }
    }
}
```

### Session Management

```typescript
class SessionManager {
    constructor(private cache: BrokerCache) {}
    
    async createSession(userId: string): Promise<string> {
        const sessionId = this.generateSessionId();
        await this.cache.set(`session:${sessionId}`, { userId }, 3600);
        return sessionId;
    }
    
    async getSession(sessionId: string) {
        return await this.cache.get(`session:${sessionId}`);
    }
}
```

## Troubleshooting

### Workers Not Starting
- Check worker count configuration
- Verify sufficient system resources
- Check for port binding conflicts

### Inter-Process Communication Issues
- Verify broker configuration
- Check broker connectivity
- Monitor broker performance

### Memory Issues
- Monitor worker memory usage
- Check for memory leaks
- Configure appropriate limits

## Next Steps

- [Broker](./broker.md) - Inter-process communication
- [Configuration](./configuration.md) - Worker configuration options
- [Performance](../performance.md) - Performance optimization
- [Deployment](./deployment.md) - Production deployment with workers
