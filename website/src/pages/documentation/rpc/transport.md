# Transport Protocols

## Understanding RPC Transport

The transport layer is the foundation of any RPC system - it determines how data flows between client and server, what features are available, and how the system performs under different conditions. Deepkit RPC's pluggable transport architecture allows you to choose the optimal protocol for your specific use case while maintaining the same high-level API.

### Transport Layer Responsibilities

The transport layer handles:

1. **Connection Management**: Establishing, maintaining, and closing connections
2. **Data Serialization**: Converting RPC messages to wire format
3. **Message Framing**: Delimiting message boundaries in the data stream
4. **Error Handling**: Managing network errors and connection failures
5. **Flow Control**: Managing data flow to prevent buffer overflow
6. **Security**: Encryption, authentication, and authorization at the transport level

### Choosing the Right Transport

Different transports excel in different scenarios:

| Use Case | Recommended Transport | Why |
|----------|----------------------|-----|
| **Web Applications** | WebSockets | Browser compatibility, full feature support |
| **Microservices** | TCP | Maximum performance, server-to-server |
| **Mobile Apps** | WebSockets | Works through firewalls, handles network changes |
| **IoT Devices** | TCP | Lower overhead, efficient for constrained devices |
| **Development/Testing** | Direct | No network overhead, perfect for unit tests |
| **Legacy Integration** | HTTP | Compatible with existing HTTP infrastructure |

### Transport Feature Matrix

Understanding what each transport supports helps you make informed decisions:

| Feature | WebSockets | TCP | HTTP | Direct |
|---------|------------|-----|------|--------|
| **Browser Support** | ✅ Native | ❌ No | ✅ Yes | ❌ No |
| **Streaming (RxJS)** | ✅ Full | ✅ Full | ❌ No | ✅ Full |
| **Bidirectional** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Performance** | Good | Excellent | Fair | Excellent |
| **Connection Overhead** | Medium | Low | High | None |
| **Firewall Friendly** | ✅ Yes | ❌ Often blocked | ✅ Yes | N/A |
| **Load Balancer Support** | Good | Fair | Excellent | N/A |
| **Real-time Capabilities** | ✅ Excellent | ✅ Excellent | ❌ No | ✅ Perfect |
| **Message Ordering** | ✅ Guaranteed | ✅ Guaranteed | ❌ No | ✅ Guaranteed |
| **Reconnection on Action** | ✅ Yes | ✅ Yes | N/A | N/A |

### Protocol Deep Dive

#### WebSocket Protocol
- **Underlying**: TCP with HTTP upgrade handshake
- **Message Format**: Binary frames with BSON payload
- **Connection**: Persistent, full-duplex
- **Overhead**: ~2-14 bytes per message frame
- **Best For**: Web applications, real-time features

#### TCP Protocol
- **Underlying**: Raw TCP sockets
- **Message Format**: Length-prefixed BSON messages
- **Connection**: Persistent, full-duplex
- **Overhead**: ~4 bytes per message (length prefix)
- **Best For**: Server-to-server communication, maximum performance

#### HTTP Protocol
- **Underlying**: HTTP/1.1 or HTTP/2
- **Message Format**: JSON over HTTP POST
- **Connection**: Request-response only
- **Overhead**: ~200-500 bytes per request (HTTP headers)
- **Best For**: Simple integrations, debugging, legacy systems

## WebSockets

WebSockets provide the best balance of compatibility and features, supporting all RPC capabilities including streaming, bidirectional communication, and real-time updates.

### Server Setup

```typescript
import { RpcWebSocketServer } from '@deepkit/rpc-tcp';
import { RpcKernel } from '@deepkit/rpc';

const kernel = new RpcKernel();
kernel.registerController(MyController, '/main');

const server = new RpcWebSocketServer(kernel, 'localhost:8081');
server.start({
    host: '127.0.0.1',
    port: 8081,
});

console.log('WebSocket server started at ws://127.0.0.1:8081');
```

### Client Setup (Browser)

```typescript
import { RpcWebSocketClient } from '@deepkit/rpc';

const client = new RpcWebSocketClient('ws://127.0.0.1:8081');
await client.connect();

const controller = client.controller<MyController>('/main');
const result = await controller.myAction('test');
```

### Client Setup (Node.js)

For Node.js environments, install the `ws` package:

```bash
npm install ws
```

```typescript
import { RpcWebSocketClient } from '@deepkit/rpc';
import ws from 'ws';

// Set WebSocket implementation for Node.js
global.WebSocket = ws as any;

const client = new RpcWebSocketClient('ws://127.0.0.1:8081');
await client.connect();
```

### WebSocket Configuration

```typescript
const server = new RpcWebSocketServer(kernel, 'localhost:8081', {
    // Maximum message size (default: 16MB)
    maxPayload: 16 * 1024 * 1024,

    // Compression settings
    perMessageDeflate: {
        threshold: 1024,
        concurrencyLimit: 10,
        memLevel: 7,
    },

    // Connection timeout
    handshakeTimeout: 30000,
});
```

## TCP

TCP transport provides the best performance for server-to-server communication and is ideal for microservices architectures.

### Server Setup

```typescript
import { RpcNetTcpServer } from '@deepkit/rpc-tcp';

const kernel = new RpcKernel();
kernel.registerController(MyController, '/main');

const server = new RpcNetTcpServer(kernel);
server.start({
    host: '127.0.0.1',
    port: 8082,
});

console.log('TCP server started at 127.0.0.1:8082');
```

### Client Setup

```typescript
import { RpcNetTcpClientAdapter } from '@deepkit/rpc-tcp';
import { RpcClient } from '@deepkit/rpc';

const adapter = new RpcNetTcpClientAdapter('127.0.0.1:8082');
const client = new RpcClient(adapter);

await client.connect();
const controller = client.controller<MyController>('/main');
```

### TCP Configuration

```typescript
const server = new RpcNetTcpServer(kernel, {
    // Keep-alive settings
    keepAlive: true,
    keepAliveInitialDelay: 30000,

    // No delay for small packets
    noDelay: true,

    // Connection timeout
    timeout: 60000,
});
```

## HTTP

HTTP transport is useful for debugging and simple request-response patterns, but has limitations with streaming and real-time features.

### Server Setup

```typescript
import { RpcHttpServer } from '@deepkit/rpc-tcp';
import { createServer } from 'http';

const kernel = new RpcKernel();
kernel.registerController(MyController, '/main');

const httpServer = createServer();
const rpcServer = new RpcHttpServer(kernel);

httpServer.on('request', (req, res) => {
    if (req.url?.startsWith('/rpc')) {
        rpcServer.handleRequest(req, res);
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

httpServer.listen(8083, () => {
    console.log('HTTP server started at http://127.0.0.1:8083');
});
```

### Client Setup

```typescript
import { RpcHttpClientAdapter } from '@deepkit/rpc';

const adapter = new RpcHttpClientAdapter('http://127.0.0.1:8083/rpc');
const client = new RpcClient(adapter);

const controller = client.controller<MyController>('/main');
const result = await controller.myAction('test');
```

### HTTP Limitations

- No support for RxJS streaming (Observables, Subjects)
- No bidirectional communication
- No real-time updates
- Higher latency due to HTTP overhead
- Each action call is a separate HTTP request

## Direct Client (Testing)

For testing and development, use the DirectClient which bypasses network transport:

```typescript
import { DirectClient } from '@deepkit/rpc';

const kernel = new RpcKernel();
kernel.registerController(MyController, '/main');

const client = new DirectClient(kernel);
const controller = client.controller<MyController>('/main');

// No network calls - direct kernel access
const result = await controller.myAction('test');
```

## Transport Comparison

| Feature | WebSockets | TCP | HTTP | Direct |
|---------|------------|-----|------|--------|
| Streaming (RxJS) | ✅ | ✅ | ❌ | ✅ |
| Bidirectional | ✅ | ✅ | ❌ | ✅ |
| Browser Support | ✅ | ❌ | ✅ | ❌ |
| Performance | Good | Excellent | Fair | Excellent |
| Debugging | Good | Fair | Excellent | Excellent |
| Real-time | ✅ | ✅ | ❌ | ✅ |
| Connection Pooling | ✅ | ✅ | ✅ | N/A |

## Connection Management and Reconnection

Understanding how Deepkit RPC handles connections and reconnections is crucial for building robust applications. The RPC client provides fine-grained control over connection behavior.

### Important Reconnection Behavior

**Key Point**: The RPC client does **NOT** automatically reconnect on its own. Reconnection only happens when you trigger an action after a disconnect.

```typescript
const client = new RpcWebSocketClient('ws://127.0.0.1:8081');
await client.connect();

// If the connection drops here and you don't call any actions,
// the client will stay disconnected indefinitely
```

### How Reconnection Actually Works

Reconnection is triggered **only** when you attempt to call an action while disconnected:

```typescript
const client = new RpcWebSocketClient('ws://127.0.0.1:8081');
const controller = client.controller<MyController>('/api');

// Initial connection
await client.connect();

// Connection drops (network issue, server restart, etc.)
// Client is now disconnected but doesn't try to reconnect

// This action call will trigger a reconnection attempt
try {
    const result = await controller.someAction(); // Reconnects automatically
    console.log('Action succeeded, connection restored');
} catch (error) {
    console.log('Action failed, connection could not be restored');
}
```

### Connection Events

Monitor connection state changes with these events:

```typescript
const client = new RpcWebSocketClient('ws://127.0.0.1:8081');

// Connection established (including initial connection)
client.transporter.connection.subscribe((connected: boolean) => {
    console.log('Connection state:', connected ? 'Connected' : 'Disconnected');
});

// Reconnection events (not called for initial connection)
client.transporter.reconnected.subscribe((connectionId: number) => {
    console.log('Reconnected with connection ID:', connectionId);
    // Good place to refresh data that might have changed
});

// Disconnection events
client.transporter.disconnected.subscribe((connectionId: number) => {
    console.log('Disconnected, connection ID was:', connectionId);
    // Connection will not be restored until next action call
});

// Error events (followed by disconnection)
client.transporter.errored.subscribe(({ connectionId, error }) => {
    console.error('Connection error:', error);
});

await client.connect();
```

### Manual Reconnection

You can manually trigger reconnection attempts:

```typescript
const client = new RpcWebSocketClient('ws://127.0.0.1:8081');

async function tryReconnect() {
    try {
        await client.connect();
        console.log('Reconnected successfully');
    } catch (error) {
        console.log('Reconnection failed:', error.message);
        // Try again after delay
        setTimeout(tryReconnect, 5000);
    }
}

// Listen for disconnections and attempt manual reconnection
client.transporter.disconnected.subscribe(() => {
    console.log('Connection lost, attempting to reconnect...');
    tryReconnect();
});
```

### Practical Reconnection Patterns

#### Pattern 1: Reactive Data Refresh

Refresh application data when reconnection occurs:

```typescript
class DataService {
    private client = new RpcWebSocketClient('ws://127.0.0.1:8081');
    private controller = this.client.controller<DataController>('/data');

    constructor() {
        // Refresh data when reconnected
        this.client.transporter.reconnected.subscribe(() => {
            this.refreshAllData();
        });
    }

    private async refreshAllData() {
        try {
            // Reload critical data that might have changed during disconnect
            await this.loadUserData();
            await this.loadNotifications();
            console.log('Data refreshed after reconnection');
        } catch (error) {
            console.error('Failed to refresh data:', error);
        }
    }

    async loadUserData() {
        return this.controller.getUserData();
    }

    async loadNotifications() {
        return this.controller.getNotifications();
    }
}
```

#### Pattern 2: Connection Status UI

Show connection status to users:

```typescript
class ConnectionStatusService {
    private client = new RpcWebSocketClient('ws://127.0.0.1:8081');
    public connectionStatus$ = new BehaviorSubject<'connected' | 'disconnected' | 'reconnecting'>('disconnected');

    constructor() {
        this.client.transporter.connection.subscribe(connected => {
            this.connectionStatus$.next(connected ? 'connected' : 'disconnected');
        });

        this.client.transporter.disconnected.subscribe(() => {
            this.connectionStatus$.next('reconnecting');
            this.attemptReconnection();
        });
    }

    private async attemptReconnection() {
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts && this.connectionStatus$.value === 'reconnecting') {
            try {
                await this.client.connect();
                break; // Success, connection.subscribe will update status
            } catch (error) {
                attempts++;
                console.log(`Reconnection attempt ${attempts}/${maxAttempts} failed`);

                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempts)); // Exponential backoff
                }
            }
        }

        if (attempts >= maxAttempts) {
            console.error('Failed to reconnect after maximum attempts');
        }
    }
}
```

#### Pattern 3: Graceful Action Handling

Handle actions gracefully during connection issues:

```typescript
class RobustApiService {
    private client = new RpcWebSocketClient('ws://127.0.0.1:8081');
    private controller = this.client.controller<ApiController>('/api');

    async performAction<T>(actionFn: () => Promise<T>, retries = 3): Promise<T> {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await actionFn();
            } catch (error) {
                console.log(`Action attempt ${attempt}/${retries} failed:`, error.message);

                if (attempt === retries) {
                    throw new Error(`Action failed after ${retries} attempts: ${error.message}`);
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }

        throw new Error('Unexpected error in performAction');
    }

    async saveData(data: any) {
        return this.performAction(() => this.controller.saveData(data));
    }

    async loadData(id: string) {
        return this.performAction(() => this.controller.loadData(id));
    }
}
```

### Connection State Checking

Check connection status before performing actions:

```typescript
const client = new RpcWebSocketClient('ws://127.0.0.1:8081');

// Check if currently connected
if (client.transporter.isConnected()) {
    console.log('Client is connected');
} else {
    console.log('Client is disconnected');
}

// Get current connection ID (increments on each reconnection)
const connectionId = client.transporter.connectionId;
console.log('Current connection ID:', connectionId);
```

### Best Practices for Reconnection

1. **Don't rely on automatic reconnection** - implement your own reconnection logic
2. **Refresh data after reconnection** - server state may have changed during disconnect
3. **Show connection status to users** - let them know when the app is offline
4. **Implement retry logic for critical actions** - network issues are temporary
5. **Use exponential backoff** - avoid overwhelming the server with reconnection attempts

```typescript
class BestPracticeClient {
    private client = new RpcWebSocketClient('ws://127.0.0.1:8081');
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private baseReconnectDelay = 1000;

    constructor() {
        this.setupConnectionHandling();
    }

    private setupConnectionHandling() {
        // Reset reconnect attempts on successful connection
        this.client.transporter.connection.subscribe(connected => {
            if (connected) {
                this.reconnectAttempts = 0;
            }
        });

        // Handle disconnections with exponential backoff
        this.client.transporter.disconnected.subscribe(() => {
            this.scheduleReconnection();
        });

        // Refresh data on reconnection
        this.client.transporter.reconnected.subscribe(() => {
            this.onReconnected();
        });
    }

    private scheduleReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Maximum reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

        setTimeout(async () => {
            try {
                await this.client.connect();
            } catch (error) {
                console.log('Reconnection failed:', error.message);
                this.scheduleReconnection(); // Try again
            }
        }, delay);
    }

    private async onReconnected() {
        console.log('Reconnected successfully, refreshing application state');
        // Refresh critical application data
        await this.refreshApplicationData();
    }

    private async refreshApplicationData() {
        // Implement your data refresh logic here
    }
}
```

### Connection Events Summary

| Event | When Triggered | Use Case |
|-------|---------------|----------|
| `connection` | Connection state changes | Update UI connection status |
| `reconnected` | After successful reconnection | Refresh data, notify user |
| `disconnected` | When connection is lost | Start reconnection attempts |
| `errored` | Before disconnection on error | Log errors, show error messages |

### Security

#### TLS/SSL Support

```typescript
// WebSocket with TLS
const client = new RpcWebSocketClient('wss://secure.example.com:8081', {
    // TLS options
    rejectUnauthorized: true,
    ca: fs.readFileSync('ca-cert.pem'),
    cert: fs.readFileSync('client-cert.pem'),
    key: fs.readFileSync('client-key.pem'),
});

// TCP with TLS
const adapter = new RpcNetTcpClientAdapter('secure.example.com:8082', {
    tls: true,
    rejectUnauthorized: true,
    ca: fs.readFileSync('ca-cert.pem'),
});
```

#### Authentication

```typescript
const client = new RpcWebSocketClient('ws://127.0.0.1:8081');

// Set authentication token
client.token.set('your-auth-token');

// Or use custom authentication
client.authenticate = async () => {
    const token = await getAuthToken();
    return token;
};

await client.connect();
```

## Performance Tuning

### Message Compression

```typescript
// Enable compression for WebSocket
const server = new RpcWebSocketServer(kernel, 'localhost:8081', {
    perMessageDeflate: {
        threshold: 1024,        // Compress messages > 1KB
        concurrencyLimit: 10,   // Max concurrent compressions
        memLevel: 7,           // Memory usage level (1-9)
        windowBits: 13,        // Compression window size
    },
});
```

### Chunking Configuration

```typescript
const client = new RpcWebSocketClient('ws://127.0.0.1:8081', {
    // Chunk size for large messages (default: 64KB)
    chunkSize: 128 * 1024,

    // Maximum message size before chunking
    maxMessageSize: 16 * 1024 * 1024,
});
```
