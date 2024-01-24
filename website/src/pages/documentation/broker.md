# Deepkit Broker

Deepkit Broker is a high-performance abstraction for message queues, message bus, event bus, pub/sub, key/value store, cache, and atomic operations. All in the spirit of type-safety with automatic serialization and validation, high-performance, and scalability.

Deepkit Broker is a client and a server in one. It can be used as a standalone server, or as a client to connect to other Deepkit Broker servers. It's designed to be used in a microservice architecture, but can also be used in a monolith application.

The client uses an adapter pattern to support different backends. You can use the same code with different backends, or even use multiple backends at the same time.

## Installation

Deepkit Broker is installed and activated per default when [Deepkit Framework](./framework.md) is used. Otherwise, you can install it via:

```bash
npm install @deepkit/broker
```

## Usage

```typescript
const app = new App({});

app.command('create');

app.run();
```
