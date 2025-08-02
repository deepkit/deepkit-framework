# Events and Lifecycle Hooks

Deepkit Framework provides a comprehensive event system that allows you to hook into various application lifecycle events and create custom event-driven architectures.

## Application Lifecycle Events

The framework emits events during different phases of the application lifecycle:

### Server Bootstrap Events

```typescript
import { 
    onServerBootstrap, 
    onServerBootstrapDone,
    onServerMainBootstrap,
    onServerMainBootstrapDone,
    onServerWorkerBootstrap,
    onServerWorkerBootstrapDone
} from '@deepkit/framework';
import { eventDispatcher } from '@deepkit/event';

class LifecycleListener {
    @eventDispatcher.listen(onServerBootstrap)
    onBootstrap() {
        console.log('Server is bootstrapping...');
        // Initialize global resources
    }
    
    @eventDispatcher.listen(onServerBootstrapDone)
    onBootstrapDone() {
        console.log('Server bootstrap completed');
        // Server is ready to handle requests
    }
    
    @eventDispatcher.listen(onServerMainBootstrap)
    onMainBootstrap() {
        console.log('Main process bootstrapping...');
        // Master process initialization
    }
    
    @eventDispatcher.listen(onServerWorkerBootstrap)
    onWorkerBootstrap() {
        console.log('Worker process bootstrapping...');
        // Worker process initialization
    }
}
```

### Server Shutdown Events

```typescript
import { onServerShutdown, onServerMainShutdown } from '@deepkit/framework';

class ShutdownListener {
    @eventDispatcher.listen(onServerShutdown)
    async onShutdown() {
        console.log('Server is shutting down...');
        // Cleanup resources
        await this.closeConnections();
        await this.saveState();
    }
    
    @eventDispatcher.listen(onServerMainShutdown)
    async onMainShutdown() {
        console.log('Main process shutting down...');
        // Master process cleanup
        await this.shutdownWorkers();
    }
    
    private async closeConnections() {
        // Close database connections, file handles, etc.
    }
    
    private async saveState() {
        // Save application state before shutdown
    }
    
    private async shutdownWorkers() {
        // Coordinate worker shutdown
    }
}
```

## Database Events

Listen to database lifecycle events:

```typescript
import { DatabaseEvent } from '@deepkit/orm';
import { eventDispatcher } from '@deepkit/event';

class DatabaseListener {
    @eventDispatcher.listen(DatabaseEvent.onConnect)
    onDatabaseConnect(event: DatabaseEvent) {
        console.log(`Connected to database: ${event.database.name}`);
    }
    
    @eventDispatcher.listen(DatabaseEvent.onDisconnect)
    onDatabaseDisconnect(event: DatabaseEvent) {
        console.log(`Disconnected from database: ${event.database.name}`);
    }
    
    @eventDispatcher.listen(DatabaseEvent.onMigrate)
    onDatabaseMigrate(event: DatabaseEvent) {
        console.log(`Database migration completed: ${event.database.name}`);
    }
}
```

## Custom Events

Create and dispatch custom events:

```typescript
import { BaseEvent, EventToken, eventDispatcher } from '@deepkit/event';

// Define custom event
class UserCreatedEvent extends BaseEvent {
    constructor(
        public readonly userId: number,
        public readonly email: string
    ) {
        super();
    }
}

// Create event token
export const onUserCreated = new EventToken('user.created', UserCreatedEvent);

// Service that dispatches events
class UserService {
    constructor(private eventDispatcher: EventDispatcher) {}
    
    async createUser(email: string): Promise<User> {
        const user = await this.saveUser(email);
        
        // Dispatch custom event
        await this.eventDispatcher.dispatch(onUserCreated, new UserCreatedEvent(user.id, email));
        
        return user;
    }
}

// Listener for custom events
class UserEventListener {
    @eventDispatcher.listen(onUserCreated)
    async onUserCreated(event: UserCreatedEvent) {
        console.log(`User created: ${event.email}`);
        
        // Send welcome email
        await this.sendWelcomeEmail(event.email);
        
        // Update analytics
        await this.trackUserRegistration(event.userId);
    }
    
    private async sendWelcomeEmail(email: string) {
        // Email sending logic
    }
    
    private async trackUserRegistration(userId: number) {
        // Analytics tracking
    }
}
```

## Event Data Events

Use data events for type-safe event handling:

```typescript
import { DataEvent, DataEventToken } from '@deepkit/event';

// Define data event
interface OrderData {
    orderId: number;
    userId: number;
    amount: number;
}

// Create data event token
export const onOrderPlaced = new DataEventToken<OrderData>('order.placed');

// Service that dispatches data events
class OrderService {
    constructor(private eventDispatcher: EventDispatcher) {}
    
    async placeOrder(userId: number, amount: number): Promise<Order> {
        const order = await this.saveOrder(userId, amount);
        
        // Dispatch data event
        await this.eventDispatcher.dispatch(onOrderPlaced, {
            orderId: order.id,
            userId,
            amount
        });
        
        return order;
    }
}

// Listener for data events
class OrderEventListener {
    @eventDispatcher.listen(onOrderPlaced)
    async onOrderPlaced(data: OrderData) {
        console.log(`Order placed: ${data.orderId} for $${data.amount}`);
        
        // Process payment
        await this.processPayment(data);
        
        // Send confirmation
        await this.sendOrderConfirmation(data);
    }
}
```

## Async Event Handling

Handle events asynchronously:

```typescript
class AsyncEventListener {
    @eventDispatcher.listen(onUserCreated)
    async onUserCreatedAsync(event: UserCreatedEvent) {
        // This runs asynchronously
        await this.performLongRunningTask(event.userId);
    }
    
    @eventDispatcher.listen(onOrderPlaced)
    async onOrderPlacedAsync(data: OrderData) {
        // Multiple async operations
        await Promise.all([
            this.updateInventory(data.orderId),
            this.notifyWarehouse(data.orderId),
            this.updateAnalytics(data)
        ]);
    }
    
    private async performLongRunningTask(userId: number) {
        // Long-running operation that doesn't block the main flow
    }
}
```

## Event Priority

Control event listener execution order:

```typescript
class PriorityEventListener {
    @eventDispatcher.listen(onUserCreated, { priority: 100 })
    highPriorityHandler(event: UserCreatedEvent) {
        // Runs first (higher priority)
        console.log('High priority handler');
    }
    
    @eventDispatcher.listen(onUserCreated, { priority: 50 })
    mediumPriorityHandler(event: UserCreatedEvent) {
        // Runs second
        console.log('Medium priority handler');
    }
    
    @eventDispatcher.listen(onUserCreated, { priority: 10 })
    lowPriorityHandler(event: UserCreatedEvent) {
        // Runs last (lower priority)
        console.log('Low priority handler');
    }
}
```

## Error Handling in Events

Handle errors in event listeners:

```typescript
class ErrorHandlingListener {
    @eventDispatcher.listen(onUserCreated)
    async onUserCreated(event: UserCreatedEvent) {
        try {
            await this.sendWelcomeEmail(event.email);
        } catch (error) {
            console.error('Failed to send welcome email:', error);
            // Don't let email failure break user creation
        }
        
        try {
            await this.setupUserProfile(event.userId);
        } catch (error) {
            console.error('Failed to setup user profile:', error);
            // Log error but continue
        }
    }
}
```

## Conditional Event Listeners

Create conditional event listeners:

```typescript
class ConditionalListener {
    @eventDispatcher.listen(onOrderPlaced)
    async onLargeOrder(data: OrderData) {
        // Only handle large orders
        if (data.amount > 1000) {
            await this.notifyManager(data);
            await this.applyVipDiscount(data.orderId);
        }
    }
    
    @eventDispatcher.listen(onUserCreated)
    async onPremiumUser(event: UserCreatedEvent) {
        // Only handle premium users
        if (await this.isPremiumUser(event.userId)) {
            await this.setupPremiumFeatures(event.userId);
        }
    }
}
```

## Event Testing

Test event dispatching and handling:

```typescript
import { createTestingApp } from '@deepkit/framework';
import { EventDispatcher } from '@deepkit/event';

test('user created event', async () => {
    const testing = createTestingApp({
        providers: [UserService, UserEventListener]
    });
    
    const userService = testing.app.get(UserService);
    const eventDispatcher = testing.app.get(EventDispatcher);
    
    // Track dispatched events
    const dispatchedEvents: any[] = [];
    const originalDispatch = eventDispatcher.dispatch;
    eventDispatcher.dispatch = jest.fn(async (token, event) => {
        dispatchedEvents.push({ token, event });
        return originalDispatch.call(eventDispatcher, token, event);
    });
    
    // Create user
    await userService.createUser('test@example.com');
    
    // Verify event was dispatched
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].token).toBe(onUserCreated);
    expect(dispatchedEvents[0].event.email).toBe('test@example.com');
});
```

## Event-Driven Architecture Patterns

### Saga Pattern

```typescript
class OrderSaga {
    @eventDispatcher.listen(onOrderPlaced)
    async handleOrderPlaced(data: OrderData) {
        try {
            await this.reserveInventory(data.orderId);
            await this.processPayment(data.orderId);
            await this.shipOrder(data.orderId);
            
            // Dispatch success event
            await this.eventDispatcher.dispatch(onOrderCompleted, data);
        } catch (error) {
            // Dispatch failure event and compensate
            await this.eventDispatcher.dispatch(onOrderFailed, { ...data, error });
            await this.compensateOrder(data.orderId);
        }
    }
}
```

### Event Sourcing

```typescript
class EventStore {
    @eventDispatcher.listen(onUserCreated)
    async storeUserCreatedEvent(event: UserCreatedEvent) {
        await this.appendEvent('user', event.userId, 'created', {
            email: event.email,
            timestamp: new Date()
        });
    }
    
    @eventDispatcher.listen(onOrderPlaced)
    async storeOrderPlacedEvent(data: OrderData) {
        await this.appendEvent('order', data.orderId, 'placed', data);
    }
    
    private async appendEvent(aggregate: string, id: number, type: string, data: any) {
        // Store event in event store
    }
}
```

## Best Practices

1. **Use descriptive event names** that clearly indicate what happened
2. **Keep event handlers focused** on a single responsibility
3. **Handle errors gracefully** to prevent cascading failures
4. **Use async handlers** for non-blocking operations
5. **Test event flows** thoroughly
6. **Document event contracts** for team collaboration
7. **Use priority** to control execution order when needed
8. **Avoid circular dependencies** between event handlers

## Performance Considerations

1. **Minimize event handler complexity** to avoid blocking
2. **Use async handlers** for I/O operations
3. **Consider event batching** for high-frequency events
4. **Monitor event processing time** in production
5. **Use conditional handlers** to reduce unnecessary processing

## Next Steps

- [Application Server](./application-server.md) - Server lifecycle management
- [Testing](./testing.md) - Testing event-driven code
- [Performance](../performance.md) - Event performance optimization
- [Architecture](../architecture.md) - Event-driven architecture patterns
