# Debugging and Profiling

Deepkit Framework provides powerful debugging and profiling tools that help you understand your application's behavior, performance characteristics, and identify bottlenecks.

## Debug Mode

Enable debug mode to access the web-based debugger:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    imports: [
        new FrameworkModule({
            debug: true,
            debugUrl: '_debug'  // Custom debug URL (optional)
        })
    ]
});
```

Start your server and visit `http://localhost:8080/_debug` to access the debugger.

## Debug Interface Features

The debug interface provides several tools:

### 1. Configuration Viewer
- View all configuration values
- See environment variable overrides
- Inspect module configurations

### 2. Route Inspector
- View all HTTP routes
- See RPC controllers and actions
- Inspect route parameters and return types

### 3. Database Browser
- Browse database schemas
- View and edit data
- Execute queries
- See entity relationships

### 4. Profiler
- View request performance
- Analyze database queries
- See memory usage
- Track execution time

## Profiling

Enable profiling to collect performance data:

```typescript
new FrameworkModule({
    profile: true,  // Enable profiling
    debug: true     // Debug mode auto-enables profiling
})
```

### Stopwatch Integration

The framework automatically tracks performance using the Stopwatch system:

```typescript
import { Stopwatch } from '@deepkit/stopwatch';

class MyService {
    constructor(private stopwatch: Stopwatch) {}
    
    async performOperation() {
        const frame = this.stopwatch.start('MyService.performOperation');
        
        try {
            // Your operation here
            await this.doSomething();
        } finally {
            frame.end();
        }
    }
    
    async doSomething() {
        // Nested operations are automatically tracked
        const frame = this.stopwatch.start('MyService.doSomething');
        
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 100));
        
        frame.end();
    }
}
```

### Automatic HTTP Profiling

HTTP requests are automatically profiled when debug mode is enabled:

```typescript
class UserController {
    @http.GET('/users/:id')
    async getUser(@http.param() id: number) {
        // This method's execution time is automatically tracked
        return await this.userService.findById(id);
    }
}
```

### Database Query Profiling

Database queries are automatically tracked:

```typescript
class UserService {
    constructor(private database: Database) {}
    
    async findUser(id: number) {
        // Query execution time is automatically tracked
        return await this.database.query(User).filter({ id }).findOne();
    }
}
```

## Custom Profiling

Add custom profiling to your code:

```typescript
import { Stopwatch } from '@deepkit/stopwatch';

class AnalyticsService {
    constructor(private stopwatch: Stopwatch) {}
    
    async processAnalytics(data: any[]) {
        const frame = this.stopwatch.start('Analytics.process', {
            category: 'analytics',
            data: { recordCount: data.length }
        });
        
        try {
            for (const item of data) {
                await this.processItem(item);
            }
        } finally {
            frame.end();
        }
    }
    
    private async processItem(item: any) {
        const frame = this.stopwatch.start('Analytics.processItem');
        
        // Processing logic
        await this.validateItem(item);
        await this.saveItem(item);
        
        frame.end();
    }
}
```

## Memory Profiling

Track memory usage in your application:

```typescript
class MemoryIntensiveService {
    constructor(private stopwatch: Stopwatch) {}
    
    async processLargeDataset(data: any[]) {
        const frame = this.stopwatch.start('LargeDataset.process');
        
        const initialMemory = process.memoryUsage();
        
        try {
            // Process data
            const results = await this.processData(data);
            
            const finalMemory = process.memoryUsage();
            const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;
            
            frame.data({ memoryUsed: memoryDelta });
            
            return results;
        } finally {
            frame.end();
        }
    }
}
```

## Debug Storage

Configure where debug data is stored:

```typescript
new FrameworkModule({
    debug: true,
    varPath: 'var/',              // Base directory for temporary files
    debugStorePath: 'debug/',     // Debug data subdirectory
})
```

Debug data is stored in `var/debug/` by default.

## Debug Broker

For distributed applications, configure a debug broker:

```typescript
new FrameworkModule({
    debug: true,
    debugBrokerHost: 'localhost:8812'  // Separate broker for debug data
})
```

## Production Considerations

### Disable Debug in Production

```typescript
const isProduction = process.env.NODE_ENV === 'production';

new FrameworkModule({
    debug: !isProduction,
    profile: false  // Disable profiling in production
})
```

### Environment-Based Configuration

```typescript
class AppConfig {
    framework = {
        debug: false,
        profile: false
    };
}

// Override via environment
// APP_FRAMEWORK_DEBUG=true
// APP_FRAMEWORK_PROFILE=true
```

## Performance Analysis

### Analyzing Profiles

Use the debug interface to analyze performance:

1. **Request Timeline**: See the complete request lifecycle
2. **Database Queries**: Identify slow queries
3. **Memory Usage**: Track memory consumption
4. **Execution Time**: Find performance bottlenecks

### Common Performance Issues

1. **N+1 Query Problem**: Multiple database queries in loops
2. **Unindexed Queries**: Database queries without proper indexes
3. **Memory Leaks**: Objects not being garbage collected
4. **Blocking Operations**: Synchronous operations blocking the event loop

## Debug CLI Commands

The framework provides CLI commands for debugging:

```bash
# Show application configuration
ts-node app.ts app:config

# Show debug profile frames
ts-node app.ts debug:profile-frames

# Show database information
ts-node app.ts database:info
```

## Custom Debug Controllers

Create custom debug endpoints:

```typescript
import { http } from '@deepkit/http';

@http.controller('/debug')
class DebugController {
    @http.GET('/health')
    getHealth() {
        return {
            status: 'ok',
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };
    }
    
    @http.GET('/metrics')
    getMetrics() {
        return {
            // Custom application metrics
        };
    }
}
```

## Testing with Debug Mode

Test debug functionality:

```typescript
import { createTestingApp } from '@deepkit/framework';
import { Stopwatch } from '@deepkit/stopwatch';

test('profiling enabled', () => {
    const testing = createTestingApp({
        imports: [new FrameworkModule({ debug: true })]
    });
    
    const stopwatch = testing.app.get(Stopwatch);
    expect(stopwatch.active).toBe(true);
});

test('profiling disabled', () => {
    const testing = createTestingApp({
        imports: [new FrameworkModule({ debug: false })]
    });
    
    const stopwatch = testing.app.get(Stopwatch);
    expect(stopwatch.active).toBe(false);
});
```

## Best Practices

1. **Enable debug mode** only in development
2. **Use custom profiling** for critical operations
3. **Monitor memory usage** in long-running processes
4. **Analyze profiles regularly** to identify bottlenecks
5. **Clean up debug data** periodically
6. **Secure debug endpoints** in staging environments
7. **Use environment variables** for debug configuration
8. **Document performance requirements** for critical paths

## Troubleshooting

### Debug Interface Not Loading

1. Check that debug mode is enabled
2. Verify the debug URL configuration
3. Ensure the server is running
4. Check for port conflicts

### Profiling Data Missing

1. Verify profiling is enabled
2. Check debug storage permissions
3. Ensure sufficient disk space
4. Verify debug broker connectivity

### Performance Issues

1. Check for memory leaks
2. Analyze database query patterns
3. Review profiling data
4. Monitor system resources

## Next Steps

- [Configuration](./configuration.md) - Debug configuration options
- [Database](./database.md) - Database debugging and profiling
- [Performance](../performance.md) - Performance optimization strategies
- [Monitoring](../monitoring.md) - Production monitoring and observability
