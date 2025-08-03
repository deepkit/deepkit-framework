# Message Broker

Deepkit Framework includes a built-in message broker that provides inter-process communication, caching, queuing, and pub/sub messaging. The broker enables distributed architectures and real-time features.

## Overview

The broker provides several key services:

- **Message Bus**: Pub/sub messaging between processes
- **Cache**: Distributed caching with TTL support
- **Queue**: Task queuing and processing
- **Key-Value Store**: Distributed key-value storage
- **Locking**: Distributed locking mechanisms

## Basic Configuration

The broker is automatically configured when you use the `FrameworkModule`:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    imports: [
        new FrameworkModule({
            broker: {
                startOnBootstrap: true,           // Start broker automatically
                listen: 'localhost:8811',         // Broker listen address
                host: 'localhost:8811'            // Broker host to connect to
            }
        })
    ]
});
```

## Message Bus (Pub/Sub)

Use the message bus for pub/sub communication:

```typescript
import { BrokerBus } from '@deepkit/broker';

class NotificationService {
    constructor(private bus: BrokerBus) {}
    
    async publishNotification(userId: number, message: string) {
        await this.bus.publish('user.notification', {
            userId,
            message,
            timestamp: new Date()
        });
    }
    
    async subscribeToNotifications() {
        const subscription = await this.bus.subscribe('user.notification');
        
        subscription.subscribe((message) => {
            console.log('Received notification:', message);
        });
        
        return subscription;
    }
}
```

### Channel Patterns

Use patterns for flexible subscriptions:

```typescript
class EventHandler {
    constructor(private bus: BrokerBus) {}
    
    async setupSubscriptions() {
        // Subscribe to all user events
        const userEvents = await this.bus.subscribe('user.*');
        
        // Subscribe to all error events
        const errorEvents = await this.bus.subscribe('*.error');
        
        userEvents.subscribe(message => {
            console.log('User event:', message);
        });
        
        errorEvents.subscribe(message => {
            console.error('Error event:', message);
        });
    }
}
```

## Distributed Cache

Use the broker cache for distributed caching:

```typescript
import { BrokerCache } from '@deepkit/broker';

class CacheService {
    constructor(private cache: BrokerCache) {}
    
    async cacheUser(userId: number, userData: any) {
        // Cache for 1 hour (3600 seconds)
        await this.cache.set(`user:${userId}`, userData, 3600);
    }
    
    async getUser(userId: number) {
        return await this.cache.get(`user:${userId}`);
    }
    
    async invalidateUser(userId: number) {
        await this.cache.delete(`user:${userId}`);
    }
    
    async getUserWithFallback(userId: number) {
        let user = await this.cache.get(`user:${userId}`);
        
        if (!user) {
            user = await this.loadUserFromDatabase(userId);
            await this.cache.set(`user:${userId}`, user, 3600);
        }
        
        return user;
    }
}
```

### Cache Patterns

```typescript
class ProductService {
    constructor(private cache: BrokerCache) {}
    
    async getPopularProducts() {
        const cacheKey = 'products:popular';
        let products = await this.cache.get(cacheKey);
        
        if (!products) {
            products = await this.calculatePopularProducts();
            // Cache for 30 minutes
            await this.cache.set(cacheKey, products, 1800);
        }
        
        return products;
    }
    
    async invalidateProductCache() {
        // Clear all product-related cache entries
        await this.cache.deletePattern('products:*');
    }
}
```

## Task Queue

Use the broker queue for background task processing:

```typescript
import { BrokerQueue } from '@deepkit/broker';

class EmailService {
    constructor(private queue: BrokerQueue) {}
    
    async sendEmailAsync(to: string, subject: string, body: string) {
        // Add email to queue for background processing
        await this.queue.add('email.send', {
            to,
            subject,
            body,
            timestamp: new Date()
        });
    }
    
    async processEmailQueue() {
        const subscription = await this.queue.subscribe('email.send');
        
        subscription.subscribe(async (job) => {
            try {
                await this.sendEmailNow(job.data);
                await job.ack(); // Acknowledge successful processing
            } catch (error) {
                console.error('Email sending failed:', error);
                await job.nack(); // Negative acknowledgment
            }
        });
    }
    
    private async sendEmailNow(emailData: any) {
        // Actual email sending logic
        console.log(`Sending email to ${emailData.to}`);
    }
}
```

### Queue with Retry Logic

```typescript
class TaskProcessor {
    constructor(private queue: BrokerQueue) {}
    
    async processWithRetry() {
        const subscription = await this.queue.subscribe('heavy.task');
        
        subscription.subscribe(async (job) => {
            const maxRetries = 3;
            let attempt = 0;
            
            while (attempt < maxRetries) {
                try {
                    await this.processHeavyTask(job.data);
                    await job.ack();
                    return;
                } catch (error) {
                    attempt++;
                    console.error(`Attempt ${attempt} failed:`, error);
                    
                    if (attempt >= maxRetries) {
                        await job.nack();
                        // Move to dead letter queue or log error
                    } else {
                        // Wait before retry
                        await new Promise(resolve => 
                            setTimeout(resolve, 1000 * attempt)
                        );
                    }
                }
            }
        });
    }
}
```

## Key-Value Store

Use the broker for distributed key-value storage:

```typescript
import { BrokerKeyValue } from '@deepkit/broker';

class ConfigService {
    constructor(private kv: BrokerKeyValue) {}
    
    async setConfig(key: string, value: any) {
        await this.kv.set(`config:${key}`, value);
    }
    
    async getConfig(key: string, defaultValue?: any) {
        const value = await this.kv.get(`config:${key}`);
        return value !== undefined ? value : defaultValue;
    }
    
    async getAllConfigs() {
        return await this.kv.getPattern('config:*');
    }
}
```

## Distributed Locking

Use broker locks for distributed synchronization:

```typescript
import { BrokerLock } from '@deepkit/broker';

class CriticalSectionService {
    constructor(private lock: BrokerLock) {}
    
    async processExclusively(resourceId: string) {
        const lockKey = `process:${resourceId}`;
        const acquired = await this.lock.acquire(lockKey, 30); // 30 second timeout
        
        if (!acquired) {
            throw new Error('Could not acquire lock');
        }
        
        try {
            // Critical section - only one process can execute this
            await this.performCriticalOperation(resourceId);
        } finally {
            await this.lock.release(lockKey);
        }
    }
    
    async tryProcessWithTimeout(resourceId: string) {
        const lockKey = `process:${resourceId}`;
        
        try {
            await this.lock.acquire(lockKey, 10); // 10 second timeout
            await this.performCriticalOperation(resourceId);
        } catch (error) {
            if (error.message.includes('timeout')) {
                console.log('Could not acquire lock within timeout');
            } else {
                throw error;
            }
        } finally {
            await this.lock.release(lockKey);
        }
    }
}
```

## Multi-Process Communication

Use the broker for communication between worker processes:

```typescript
class WorkerCoordinator {
    constructor(private bus: BrokerBus) {}
    
    async coordinateWork() {
        // Master process publishes work
        if (cluster.isMaster) {
            await this.bus.publish('work.available', {
                taskId: 'task-123',
                data: { /* task data */ }
            });
        }
        
        // Worker processes subscribe to work
        if (cluster.isWorker) {
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

## Custom Broker Adapter

Create custom broker adapters for different backends:

```typescript
import { BrokerAdapter } from '@deepkit/broker';

class RedisBrokerAdapter implements BrokerAdapter {
    // Implement broker interface for Redis
    async publish(channel: string, message: any) {
        // Redis pub/sub implementation
    }
    
    async subscribe(channel: string) {
        // Redis subscription implementation
    }
    
    // Implement other broker methods...
}

// Use custom adapter
const app = new App({
    providers: [
        { provide: BrokerAdapter, useClass: RedisBrokerAdapter }
    ],
    imports: [new FrameworkModule()]
});
```

## Testing with Broker

Test broker functionality using the testing utilities:

```typescript
import { createTestingApp } from '@deepkit/framework';

test('broker messaging', async () => {
    const testing = createTestingApp({
        providers: [NotificationService]
    });
    
    const service = testing.app.get(NotificationService);
    const bus = testing.app.get(BrokerBus);
    
    // Set up subscription
    const messages: any[] = [];
    const subscription = await bus.subscribe('test.message');
    subscription.subscribe(msg => messages.push(msg));
    
    // Publish message
    await bus.publish('test.message', { content: 'Hello' });
    
    // Wait for message processing
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello');
});
```

## Performance Considerations

1. **Connection Pooling**: Reuse broker connections
2. **Message Size**: Keep messages reasonably sized
3. **TTL Settings**: Set appropriate cache TTL values
4. **Queue Management**: Monitor queue sizes and processing rates
5. **Lock Timeouts**: Use reasonable lock timeouts

## Best Practices

1. **Error Handling**: Implement proper error handling for broker operations
2. **Monitoring**: Monitor broker performance and queue sizes
3. **Cleanup**: Clean up subscriptions and resources
4. **Testing**: Test broker functionality thoroughly
5. **Documentation**: Document message formats and channels
6. **Security**: Secure broker communication in production

## Next Steps

- [Workers](./workers.md) - Multi-process architecture
- [Events](./events.md) - Event-driven architecture
- [Testing](./testing.md) - Testing distributed systems
- [Performance](../performance.md) - Performance optimization
