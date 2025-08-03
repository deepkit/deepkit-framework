# Configuration

The Deepkit Framework provides extensive configuration options through the `FrameworkModule`. This chapter covers all available configuration options and how to use them.

## Basic Configuration

Configure the framework module when importing it:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    imports: [
        new FrameworkModule({
            host: '0.0.0.0',
            port: 8080,
            debug: true
        })
    ]
});
```

## Server Configuration

### Basic Server Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | string | `'0.0.0.0'` | Host to bind the server to |
| `port` | number | `8080` | Port to listen on |
| `path` | string | `'/'` | Base path for the application |
| `workers` | number | `0` | Number of worker processes (0 = single process) |
| `gracefulShutdownTimeout` | number | `5` | Timeout in seconds for graceful shutdown |

```typescript
new FrameworkModule({
    host: 'localhost',
    port: 3000,
    path: '/api',
    workers: 4,
    gracefulShutdownTimeout: 10
})
```

### SSL/HTTPS Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ssl` | boolean | `false` | Enable HTTPS server |
| `httpsPort` | number? | - | HTTPS port (if different from main port) |
| `selfSigned` | boolean? | - | Generate self-signed certificate for development |
| `sslKey` | string? | - | Path to SSL private key file |
| `sslCertificate` | string? | - | Path to SSL certificate file |
| `sslCa` | string? | - | Path to SSL CA file |
| `sslCrl` | string? | - | Path to SSL CRL file |
| `sslOptions` | object? | - | Additional SSL options |

```typescript
// Development with self-signed certificate
new FrameworkModule({
    ssl: true,
    selfSigned: true
})

// Production with real certificates
new FrameworkModule({
    ssl: true,
    sslKey: '/path/to/private.key',
    sslCertificate: '/path/to/certificate.crt',
    sslCa: '/path/to/ca.crt'
})
```

## Static Files

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `publicDir` | string? | - | Directory to serve static files from |
| `publicDirPrefix` | string | `'/'` | URL prefix for static files |

```typescript
new FrameworkModule({
    publicDir: 'public',
    publicDirPrefix: '/static'
})
```

Files in `public/` will be available at `http://localhost:8080/static/`.

## Debug and Profiling

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debug` | boolean | `false` | Enable debug mode and web debugger |
| `profile` | boolean | `false` | Enable profiling (auto-enabled with debug) |
| `debugUrl` | string | `'_debug'` | URL path for debug interface |
| `debugBrokerHost` | string? | - | Broker host for debug communication |
| `varPath` | string | `'var/'` | Directory for temporary files |
| `debugStorePath` | string | `'debug/'` | Debug data storage path (relative to varPath) |

```typescript
new FrameworkModule({
    debug: true,
    debugUrl: 'admin/debug',
    varPath: 'tmp/',
    debugStorePath: 'debug-data/'
})
```

Access debugger at: `http://localhost:8080/admin/debug`

## Database Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `migrateOnStartup` | boolean | `false` | Automatically run migrations on startup |
| `migrationDir` | string | `'migrations'` | Directory containing migration files |

```typescript
new FrameworkModule({
    migrateOnStartup: true,
    migrationDir: 'src/migrations'
})
```

## Logging Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `httpLog` | boolean | `true` | Log HTTP requests |
| `logStartup` | boolean | `true` | Log startup information |

```typescript
new FrameworkModule({
    httpLog: false,  // Disable HTTP request logging
    logStartup: true
})
```

## Broker Configuration

The framework includes a message broker for inter-process communication:

```typescript
new FrameworkModule({
    broker: {
        listen: 'localhost:8811',           // Broker listen address
        host: 'localhost:8811',             // Broker host to connect to
        startOnBootstrap: true              // Start broker automatically
    }
})
```

## HTTP Configuration

Forward HTTP-specific configuration to the HTTP module:

```typescript
new FrameworkModule({
    http: {
        compression: true,
        maxPayload: '10mb',
        cors: true
    }
})
```

## RPC Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `httpRpcBasePath` | string | `''` | Enable HTTP-based RPC calls at this path |

```typescript
new FrameworkModule({
    httpRpcBasePath: '/rpc/v1'  // Enable RPC over HTTP
})
```

## Environment-Based Configuration

Use environment variables to configure the framework:

```typescript
class AppConfig {
    framework = {
        host: '0.0.0.0',
        port: 8080,
        debug: false,
        ssl: false
    };
}

const app = new App({
    config: AppConfig,
    imports: [new FrameworkModule()]
});

// Load from environment with prefix
app.loadConfigFromEnv({ prefix: 'APP_' });
```

Set environment variables:

```bash
APP_FRAMEWORK_HOST=localhost
APP_FRAMEWORK_PORT=3000
APP_FRAMEWORK_DEBUG=true
APP_FRAMEWORK_SSL=true
```

## Configuration Validation

View current configuration:

```bash
ts-node app.ts app:config
```

This shows all configuration values including defaults and environment overrides.

## Advanced Configuration

### Custom Server Instance

Provide your own HTTP/HTTPS server:

```typescript
import { createServer } from 'http';

const server = createServer();

new FrameworkModule({
    server: server
})
```

### Session Configuration

Configure custom session handling:

```typescript
class CustomSession {
    // Custom session implementation
}

new FrameworkModule({
    session: CustomSession
})
```

## Configuration Best Practices

1. **Use environment variables** for deployment-specific settings
2. **Enable debug mode** only in development
3. **Configure SSL** properly for production
4. **Set appropriate worker count** based on your server capacity
5. **Use configuration classes** for type safety
6. **Validate configuration** before deployment

## Next Steps

- [Application Server](./application-server.md) - Server lifecycle and management
- [SSL/HTTPS](./ssl-https.md) - Detailed SSL configuration
- [Workers](./workers.md) - Multi-process configuration
- [Debugging](./debugging-profiling.md) - Debug and profiling features
