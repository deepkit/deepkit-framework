# Streaming with RxJS

## Understanding RPC Streaming

Deepkit RPC's streaming capabilities represent a fundamental shift from traditional request-response patterns to real-time, reactive data flows. By integrating natively with RxJS, Deepkit RPC enables you to build applications that respond to data changes in real-time, handle continuous data streams, and maintain live connections between clients and servers.

### Why Streaming Matters

Traditional RPC systems are limited to simple request-response patterns:
- Client sends request → Server processes → Server sends response → Connection closes

Streaming RPC enables continuous communication:
- Client subscribes → Server streams data continuously → Client receives real-time updates → Connection stays alive

This enables powerful use cases:
- **Real-time Dashboards**: Live metrics and monitoring data
- **Chat Applications**: Instant message delivery
- **Collaborative Editing**: Real-time document synchronization
- **Live Data Feeds**: Stock prices, sensor data, social media feeds
- **Progress Tracking**: Long-running operation updates
- **Event Sourcing**: Streaming event logs and state changes

### How Streaming Works in Deepkit RPC

Deepkit RPC's streaming is built on several key technologies:

1. **RxJS Integration**: Native support for Observables, Subjects, and BehaviorSubjects
2. **Efficient Serialization**: Streaming data is serialized to BSON for optimal performance
3. **Automatic Chunking**: Large data streams are automatically chunked for memory efficiency
4. **Type Safety**: Full TypeScript type safety for streaming data
5. **Error Propagation**: Errors in streams are properly forwarded to clients
6. **Backpressure Handling**: Built-in mechanisms to handle fast producers and slow consumers

### RxJS Streaming Types

Deepkit RPC supports three main RxJS types, each with different characteristics:

| Type | Use Case | Behavior | Memory |
|------|----------|----------|---------|
| **Observable** | One-way data streams | Emits values, then completes | Low |
| **Subject** | Multi-cast streaming | Multiple subscribers, no initial value | Medium |
| **BehaviorSubject** | State streaming | Multiple subscribers, has current value | Higher |

### Streaming Architecture

```
┌─────────────┐    WebSocket/TCP    ┌─────────────┐
│   Client    │ ←──────────────────→ │   Server    │
│             │                     │             │
│ Observable  │ ← Streaming Data ←  │ Observable  │
│ Subject     │ ↔ Bidirectional ↔   │ Subject     │
│ BehaviorSub │ ← Current State ←   │ BehaviorSub │
└─────────────┘                     └─────────────┘
```

The server creates RxJS streams and returns them from RPC actions. Deepkit RPC automatically:
1. Serializes each emitted value to BSON
2. Sends it over the network connection
3. Deserializes it on the client
4. Reconstructs the RxJS stream with proper typing

## Observable Streams

Observables are perfect for one-way data streams from server to client. They represent a sequence of values emitted over time, and they complete when the data source is exhausted or an error occurs.

### When to Use Observables

- **Finite Data Streams**: When you have a known set of data to stream (e.g., file contents, database results)
- **One-Time Operations**: Operations that produce multiple values but eventually complete
- **Historical Data**: Streaming past events or records
- **Batch Processing**: Streaming results of batch operations

### Observable Characteristics

- **Cold Streams**: Each subscription creates a new execution
- **Completion**: Observables signal when they're done emitting values
- **Memory Efficient**: No state is maintained between emissions
- **Cleanup**: Automatic cleanup when client unsubscribes

```typescript
import { Observable } from 'rxjs';

@rpc.controller('/data')
class DataController {
    @rpc.action()
    getSensorData(): Observable<{ temperature: number, humidity: number }> {
        return new Observable(observer => {
            const interval = setInterval(() => {
                observer.next({
                    temperature: Math.random() * 30 + 10,
                    humidity: Math.random() * 100
                });
            }, 1000);

            // Cleanup when client unsubscribes
            return () => clearInterval(interval);
        });
    }

    @rpc.action()
    getFileContent(filename: string): Observable<string> {
        return new Observable(observer => {
            // Simulate reading file line by line
            const lines = ['Line 1', 'Line 2', 'Line 3'];
            lines.forEach((line, index) => {
                setTimeout(() => {
                    observer.next(line);
                    if (index === lines.length - 1) {
                        observer.complete();
                    }
                }, index * 100);
            });
        });
    }
}
```

Client usage:

```typescript
const controller = client.controller<DataController>('/data');

// Subscribe to sensor data
const sensorData = await controller.getSensorData();
const subscription = sensorData.subscribe({
    next: (data) => console.log('Sensor:', data),
    error: (err) => console.error('Error:', err),
    complete: () => console.log('Stream completed')
});

// Unsubscribe when done
setTimeout(() => subscription.unsubscribe(), 5000);

// Read file content
const fileContent = await controller.getFileContent('example.txt');
fileContent.subscribe(line => console.log('Line:', line));
```

## Subject

Use `Subject` for bidirectional communication where multiple clients can subscribe and the server can push data:

```typescript
import { Subject } from 'rxjs';

@rpc.controller('/chat')
class ChatController {
    private chatRooms = new Map<string, Subject<ChatMessage>>();

    @rpc.action()
    joinRoom(roomName: string): Subject<ChatMessage> {
        if (!this.chatRooms.has(roomName)) {
            this.chatRooms.set(roomName, new Subject<ChatMessage>());
        }
        return this.chatRooms.get(roomName)!;
    }

    @rpc.action()
    sendMessage(roomName: string, message: ChatMessage): void {
        const room = this.chatRooms.get(roomName);
        if (room) {
            room.next(message);
        }
    }

    @rpc.action()
    closeRoom(roomName: string): void {
        const room = this.chatRooms.get(roomName);
        if (room) {
            room.complete();
            this.chatRooms.delete(roomName);
        }
    }
}

interface ChatMessage {
    user: string;
    message: string;
    timestamp: Date;
}
```

Client usage:

```typescript
const controller = client.controller<ChatController>('/chat');

// Join a chat room
const chatRoom = await controller.joinRoom('general');
chatRoom.subscribe(message => {
    console.log(`${message.user}: ${message.message}`);
});

// Send messages
await controller.sendMessage('general', {
    user: 'Alice',
    message: 'Hello everyone!',
    timestamp: new Date()
});
```

## BehaviorSubject

Use `BehaviorSubject` when you need to provide the current state immediately to new subscribers:

```typescript
import { BehaviorSubject } from 'rxjs';

@rpc.controller('/status')
class StatusController {
    private systemStatus = new BehaviorSubject<SystemStatus>({
        cpu: 0,
        memory: 0,
        disk: 0,
        status: 'idle'
    });

    constructor() {
        // Update status every second
        setInterval(() => {
            this.systemStatus.next({
                cpu: Math.random() * 100,
                memory: Math.random() * 100,
                disk: Math.random() * 100,
                status: 'running'
            });
        }, 1000);
    }

    @rpc.action()
    getSystemStatus(): BehaviorSubject<SystemStatus> {
        return this.systemStatus;
    }

    @rpc.action()
    getCurrentStatus(): SystemStatus {
        return this.systemStatus.getValue();
    }
}

interface SystemStatus {
    cpu: number;
    memory: number;
    disk: number;
    status: string;
}
```

Client usage:

```typescript
const controller = client.controller<StatusController>('/status');

// Get current status immediately, then receive updates
const statusStream = await controller.getSystemStatus();
console.log('Current status:', statusStream.getValue());

statusStream.subscribe(status => {
    console.log('Status update:', status);
});

// Or just get current status once
const currentStatus = await controller.getCurrentStatus();
console.log('One-time status:', currentStatus);
```

## Error Handling

Errors in observables are automatically forwarded to the client:

```typescript
@rpc.controller('/error-demo')
class ErrorDemoController {
    @rpc.action()
    errorStream(): Observable<string> {
        return new Observable(observer => {
            observer.next('First value');
            observer.next('Second value');
            observer.error(new Error('Something went wrong!'));
        });
    }
}
```

Client error handling:

```typescript
const controller = client.controller<ErrorDemoController>('/error-demo');
const stream = await controller.errorStream();

stream.subscribe({
    next: (value) => console.log('Received:', value),
    error: (error) => console.error('Stream error:', error.message),
    complete: () => console.log('Stream completed')
});
```

## Automatic Cleanup

When a client disconnects, all active subscriptions are automatically cleaned up on the server side. The teardown functions in your observables will be called, ensuring proper resource cleanup.

## Performance Considerations

- Use `BehaviorSubject` sparingly as it keeps the last value in memory
- Implement proper cleanup in your Observable teardown functions
- Consider using operators like `debounceTime` or `throttleTime` for high-frequency data
- Large objects in streams are automatically chunked for efficient transmission

## Type Safety

All streaming types are fully type-safe. The client receives the exact same types as defined on the server:

```typescript
// Server
@rpc.action()
getTypedStream(): Observable<{ id: number, name: string }> {
    // Implementation
}

// Client - fully typed!
const stream = await controller.getTypedStream();
stream.subscribe(data => {
    console.log(data.id);    // TypeScript knows this is a number
    console.log(data.name);  // TypeScript knows this is a string
});
```
