# Zones and Request Context

Zones in Deepkit Framework provide a way to maintain request context across asynchronous operations. They enable you to track and access request-specific data throughout the entire request lifecycle.

## What are Zones?

Zones are execution contexts that persist across asynchronous boundaries. They allow you to:

- Track request-specific data
- Maintain context across async operations
- Implement request tracing and logging
- Manage request-scoped resources

## Enabling Zones

Enable zones in your application:

```typescript
import { Zone } from '@deepkit/framework';

// Enable zones globally
Zone.enable();

// Now zones are active for all async operations
```

## Basic Zone Usage

### Creating and Running Zones

```typescript
import { Zone } from '@deepkit/framework';

// Run code in a zone with context
await Zone.run({ requestId: '123', userId: 'user456' }, async () => {
    // This code runs in the zone context
    console.log('Current zone:', Zone.current());
    
    await someAsyncOperation();
    
    // Zone context is preserved across async operations
    console.log('Still in zone:', Zone.current());
});
```

### Accessing Zone Context

```typescript
class UserService {
    async getUser(id: number) {
        const zone = Zone.current();
        const requestId = zone?.requestId;
        
        console.log(`Processing request ${requestId} for user ${id}`);
        
        return await this.database.findUser(id);
    }
}
```

## HTTP Request Zones

The framework automatically creates zones for HTTP requests:

```typescript
import { http } from '@deepkit/http';

class UserController {
    @http.GET('/users/:id')
    async getUser(@http.param() id: number) {
        // Zone is automatically created for this request
        const zone = Zone.current();
        
        // Zone contains request-specific information
        console.log('Request zone:', zone);
        
        // Call other services - zone context is preserved
        return await this.userService.getUser(id);
    }
}
```

## RPC Request Zones

Zones are also created for RPC requests:

```typescript
import { rpc } from '@deepkit/rpc';

@rpc.controller('users')
class UserRpcController {
    @rpc.action()
    async getUser(id: number) {
        // Zone is automatically created for RPC calls
        const zone = Zone.current();
        
        console.log('RPC zone:', zone);
        
        return await this.userService.getUser(id);
    }
}
```

## Custom Zone Context

Add custom data to zones:

```typescript
class RequestTrackingService {
    async processRequest(requestData: any) {
        await Zone.run({
            requestId: this.generateRequestId(),
            startTime: Date.now(),
            userId: requestData.userId,
            operation: 'processRequest'
        }, async () => {
            await this.validateRequest(requestData);
            await this.processData(requestData);
            await this.logCompletion();
        });
    }
    
    private async validateRequest(data: any) {
        const zone = Zone.current();
        console.log(`Validating request ${zone?.requestId}`);
        
        // Validation logic
    }
    
    private async processData(data: any) {
        const zone = Zone.current();
        console.log(`Processing data for request ${zone?.requestId}`);
        
        // Processing logic
    }
    
    private async logCompletion() {
        const zone = Zone.current();
        const duration = Date.now() - (zone?.startTime || 0);
        
        console.log(`Request ${zone?.requestId} completed in ${duration}ms`);
    }
}
```

## Zone-Aware Logging

Use zones for contextual logging:

```typescript
import { Logger } from '@deepkit/logger';

class ZoneAwareLogger {
    constructor(private logger: Logger) {}
    
    log(message: string, ...args: any[]) {
        const zone = Zone.current();
        const requestId = zone?.requestId || 'no-request';
        
        this.logger.log(`[${requestId}] ${message}`, ...args);
    }
    
    error(message: string, error?: Error) {
        const zone = Zone.current();
        const requestId = zone?.requestId || 'no-request';
        
        this.logger.error(`[${requestId}] ${message}`, error);
    }
}

// Usage in services
class UserService {
    constructor(private logger: ZoneAwareLogger) {}
    
    async createUser(userData: any) {
        this.logger.log('Creating user');
        
        try {
            const user = await this.database.save(userData);
            this.logger.log('User created successfully', { userId: user.id });
            return user;
        } catch (error) {
            this.logger.error('Failed to create user', error);
            throw error;
        }
    }
}
```

## Request Tracing

Implement distributed tracing using zones:

```typescript
class TracingService {
    async startTrace(operation: string) {
        const traceId = this.generateTraceId();
        const spanId = this.generateSpanId();
        
        await Zone.run({
            traceId,
            spanId,
            operation,
            startTime: Date.now()
        }, async () => {
            await this.executeOperation(operation);
        });
    }
    
    async createSpan(operation: string) {
        const parentZone = Zone.current();
        const spanId = this.generateSpanId();
        
        await Zone.run({
            ...parentZone,
            spanId,
            parentSpanId: parentZone?.spanId,
            operation,
            startTime: Date.now()
        }, async () => {
            await this.executeSubOperation(operation);
        });
    }
    
    private generateTraceId(): string {
        return Math.random().toString(36).substring(2);
    }
    
    private generateSpanId(): string {
        return Math.random().toString(36).substring(2);
    }
}
```

## Error Tracking with Zones

Track errors with request context:

```typescript
class ErrorTracker {
    async trackError(error: Error) {
        const zone = Zone.current();
        
        const errorReport = {
            message: error.message,
            stack: error.stack,
            requestId: zone?.requestId,
            userId: zone?.userId,
            operation: zone?.operation,
            timestamp: new Date()
        };
        
        await this.sendErrorReport(errorReport);
    }
    
    private async sendErrorReport(report: any) {
        // Send to error tracking service
        console.log('Error report:', report);
    }
}

// Global error handler
process.on('unhandledRejection', async (error: Error) => {
    const errorTracker = new ErrorTracker();
    await errorTracker.trackError(error);
});
```

## Zone Middleware

Create middleware that uses zones:

```typescript
import { HttpMiddleware, HttpRequest, HttpResponse } from '@deepkit/http';

class ZoneMiddleware implements HttpMiddleware {
    async execute(request: HttpRequest, response: HttpResponse, next: () => Promise<void>) {
        const requestId = this.generateRequestId();
        
        await Zone.run({
            requestId,
            method: request.method,
            url: request.url,
            startTime: Date.now(),
            userAgent: request.headers['user-agent']
        }, async () => {
            try {
                await next();
            } finally {
                const zone = Zone.current();
                const duration = Date.now() - (zone?.startTime || 0);
                console.log(`Request ${requestId} completed in ${duration}ms`);
            }
        });
    }
    
    private generateRequestId(): string {
        return Math.random().toString(36).substring(2);
    }
}
```

## Testing with Zones

Test zone functionality:

```typescript
import { Zone } from '@deepkit/framework';

test('zone context preservation', async () => {
    Zone.enable();
    
    const testData = { testId: '123', value: 'test' };
    
    await Zone.run(testData, async () => {
        // Zone context should be available
        expect(Zone.current()).toEqual(testData);
        
        // Test async operation
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Zone context should still be available
        expect(Zone.current()).toEqual(testData);
        
        // Test nested async operation
        await someAsyncFunction();
        
        // Zone context should still be preserved
        expect(Zone.current()).toEqual(testData);
    });
});

async function someAsyncFunction() {
    const zone = Zone.current();
    expect(zone?.testId).toBe('123');
    
    await new Promise(resolve => setTimeout(resolve, 5));
    
    const zoneAfter = Zone.current();
    expect(zoneAfter?.testId).toBe('123');
}
```

## Performance Considerations

### Zone Overhead

Zones add minimal overhead but consider:

```typescript
// Enable zones only when needed
if (process.env.NODE_ENV !== 'production') {
    Zone.enable();
}

// Or enable selectively
if (process.env.ENABLE_TRACING === 'true') {
    Zone.enable();
}
```

### Memory Management

Avoid storing large objects in zones:

```typescript
// Good: Store minimal context
await Zone.run({
    requestId: '123',
    userId: 'user456'
}, async () => {
    // Process request
});

// Avoid: Storing large objects
await Zone.run({
    requestId: '123',
    largeObject: hugeDataStructure  // This can cause memory issues
}, async () => {
    // Process request
});
```

## Best Practices

1. **Enable zones early** in your application lifecycle
2. **Store minimal data** in zone context
3. **Use zones for request tracking** and logging
4. **Implement error tracking** with zone context
5. **Test zone behavior** thoroughly
6. **Consider performance impact** in high-load scenarios
7. **Use zones for debugging** and monitoring
8. **Document zone context structure** for your team

## Common Use Cases

1. **Request ID tracking** across services
2. **User context** preservation
3. **Distributed tracing** implementation
4. **Contextual logging** and monitoring
5. **Error tracking** with request context
6. **Performance monitoring** per request
7. **Security context** management
8. **Multi-tenant** context isolation

## Troubleshooting

### Zone Context Lost

If zone context is lost:

1. Ensure zones are enabled before use
2. Check for non-zone-aware async operations
3. Verify proper zone creation
4. Test with simpler async patterns

### Memory Issues

If experiencing memory problems:

1. Reduce zone context size
2. Clean up zone data when possible
3. Monitor memory usage
4. Consider disabling zones in production

## Next Steps

- [Application Server](./application-server.md) - Server request handling
- [Testing](./testing.md) - Testing zone functionality
- [Performance](../performance.md) - Zone performance optimization
- [Monitoring](../monitoring.md) - Request monitoring and tracing
