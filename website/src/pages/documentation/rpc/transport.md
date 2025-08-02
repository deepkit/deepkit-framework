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
| **Automatic Reconnection** | ✅ Available | ✅ Available | N/A | N/A |

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

## Connection Management

### Connection Events

```typescript
const client = new RpcWebSocketClient('ws://127.0.0.1:8081');

client.onConnect.subscribe(() => {
    console.log('Connected to server');
});

client.onDisconnect.subscribe(() => {
    console.log('Disconnected from server');
});

client.onError.subscribe((error) => {
    console.error('Connection error:', error);
});

await client.connect();
```

### Automatic Reconnection

```typescript
const client = new RpcWebSocketClient('ws://127.0.0.1:8081', {
    // Enable automatic reconnection
    autoReconnect: true,

    // Reconnection delay (ms)
    reconnectDelay: 1000,

    // Maximum reconnection attempts
    maxReconnectAttempts: 10,

    // Exponential backoff
    reconnectBackoff: 1.5,
});
```

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
