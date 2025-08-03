# Event System

The Deepkit Event package provides a powerful, type-safe event system for building event-driven applications. It supports both synchronous and asynchronous event handling with full TypeScript type safety and dependency injection integration.

## Installation

```bash
npm install @deepkit/event
```

## Quick Start

```typescript
import { EventDispatcher, EventToken, DataEventToken } from '@deepkit/event';

// Create an event dispatcher
const dispatcher = new EventDispatcher();

// Define an event token
const UserCreated = new DataEventToken<{id: string, name: string}>('user.created');

// Listen to events
dispatcher.listen(UserCreated, (event) => {
    console.log('User created:', event.data.name);
});

// Dispatch events
await dispatcher.dispatch(UserCreated, {id: '1', name: 'John'});
```

## Core Concepts

### Event Tokens

Event tokens are unique identifiers that define both the event type and its data structure. They serve as the contract between event dispatchers and listeners.

#### EventToken (Asynchronous)

For events that can be handled asynchronously:

```typescript
import { EventToken, BaseEvent } from '@deepkit/event';

// Simple event without data
const AppStarted = new EventToken('app.started');

// Event with custom data
class UserEvent extends BaseEvent {
    constructor(public userId: string, public action: string) {
        super();
    }
}

const UserAction = new EventToken<UserEvent>('user.action');
```

#### EventTokenSync (Synchronous)

For events that must be handled synchronously:

```typescript
import { EventTokenSync, DataEvent } from '@deepkit/event';

const ConfigChanged = new EventTokenSync<DataEvent<{key: string, value: any}>>('config.changed');

// Synchronous dispatch - returns immediately
dispatcher.dispatch(ConfigChanged, {key: 'theme', value: 'dark'});
```

#### DataEventToken

A convenient token for events that carry simple data:

```typescript
import { DataEventToken } from '@deepkit/event';

interface User {
    id: string;
    email: string;
}

const UserRegistered = new DataEventToken<User>('user.registered');

dispatcher.listen(UserRegistered, (event) => {
    // event.data is of type User
    console.log('New user:', event.data.email);
});
```

### Event Classes

#### BaseEvent

The base class for all events, providing control methods:

```typescript
import { BaseEvent } from '@deepkit/event';

class CustomEvent extends BaseEvent {
    constructor(public message: string) {
        super();
    }
}

dispatcher.listen(MyEvent, (event) => {
    if (event.message === 'stop') {
        event.preventDefault(); // Mark event as prevented
        event.stopImmediatePropagation(); // Stop further listeners
    }
});
```

#### DataEvent

A generic event class that wraps data:

```typescript
import { DataEvent } from '@deepkit/event';

const event = new DataEvent({userId: '123', action: 'login'});
console.log(event.data.userId); // '123'
```

## Event Dispatcher

The `EventDispatcher` is the central hub for managing events:

```typescript
import { EventDispatcher } from '@deepkit/event';
import { InjectorContext } from '@deepkit/injector';

// Create with optional injector context for dependency injection
const injector = InjectorContext.forProviders([]);
const dispatcher = new EventDispatcher(injector);
```

### Listening to Events

#### Functional Listeners

```typescript
// Basic listener
const unsubscribe = dispatcher.listen(UserCreated, (event) => {
    console.log('User created:', event.data);
});

// Listener with order (lower numbers execute first)
dispatcher.listen(UserCreated, (event) => {
    console.log('This runs first');
}, -10);

dispatcher.listen(UserCreated, (event) => {
    console.log('This runs second');
}, 0);

// Unsubscribe
unsubscribe();
```

#### Class-based Listeners

```typescript
import { eventDispatcher } from '@deepkit/event';

class UserService {
    @eventDispatcher.listen(UserCreated)
    onUserCreated(event: typeof UserCreated.event) {
        console.log('User created:', event.data);
    }
    
    @eventDispatcher.listen(UserCreated, -5) // Custom order
    onUserCreatedFirst(event: typeof UserCreated.event) {
        console.log('This runs before onUserCreated');
    }
}
```

### Dispatching Events

#### Asynchronous Dispatch

```typescript
// Simple event
await dispatcher.dispatch(AppStarted);

// Event with data
await dispatcher.dispatch(UserCreated, {id: '1', name: 'John'});

// Event with custom event object
await dispatcher.dispatch(UserAction, new UserEvent('123', 'login'));
```

#### Synchronous Dispatch

```typescript
// Synchronous events return immediately
dispatcher.dispatch(ConfigChanged, {key: 'theme', value: 'dark'});
```

#### Event Factories

For performance optimization, you can use event factories that only create the event if there are listeners:

```typescript
// Event factory - only called if there are listeners
await dispatcher.dispatch(UserCreated, () => {
    console.log('Creating expensive event data...');
    return {id: generateId(), name: 'John'};
});
```

## Advanced Features

### Event Ordering

Control the execution order of listeners using the order parameter:

```typescript
dispatcher.listen(UserCreated, () => console.log('Third'), 10);
dispatcher.listen(UserCreated, () => console.log('First'), -10);
dispatcher.listen(UserCreated, () => console.log('Second'), 0);
```

### Event Propagation Control

```typescript
dispatcher.listen(UserCreated, (event) => {
    if (someCondition) {
        event.preventDefault(); // Mark as prevented
        event.stopImmediatePropagation(); // Stop other listeners
    }
});

dispatcher.listen(UserCreated, (event) => {
    if (event.defaultPrevented) {
        console.log('Event was prevented');
    }
});
```

### Waiting for Events

Wait for the next occurrence of an event:

```typescript
// Wait for the next user creation
const event = await dispatcher.next(UserCreated);
console.log('Next user:', event.data.name);
```

### Checking for Listeners

```typescript
if (dispatcher.hasListeners(UserCreated)) {
    console.log('Someone is listening to user creation events');
}
```

### Performance Optimization

Get a pre-compiled dispatcher for maximum performance:

```typescript
const userCreatedDispatcher = dispatcher.getDispatcher(UserCreated);

// This is faster than dispatcher.dispatch() for repeated calls
await userCreatedDispatcher({id: '1', name: 'John'});
```

## Testing Events

### Event Watcher

Use the event watcher utility for testing:

```typescript
import { eventWatcher } from '@deepkit/event';

const watcher = eventWatcher(dispatcher, [UserCreated, UserDeleted]);

// Trigger some events
await dispatcher.dispatch(UserCreated, {id: '1', name: 'John'});
await dispatcher.dispatch(UserDeleted, {id: '1'});

// Check dispatched events
const createdEvent = watcher.get(UserCreated);
expect(createdEvent.name).toBe('John');

// Check all messages
expect(watcher.messages).toEqual(['user.created', 'user.deleted']);

// Clear for next test
watcher.clear();
```

### Testing with Framework

When using with Deepkit Framework:

```typescript
import { createTestingApp } from '@deepkit/framework';

class UserEventListener {
    lastCreatedUser?: string;
    
    @eventDispatcher.listen(UserCreated)
    onUserCreated(event: typeof UserCreated.event) {
        this.lastCreatedUser = event.data.name;
    }
}

test('event listener', async () => {
    const testing = createTestingApp({
        listeners: [UserEventListener]
    });
    
    await testing.app.dispatch(UserCreated, {id: '1', name: 'John'});
    
    const listener = testing.app.get(UserEventListener);
    expect(listener.lastCreatedUser).toBe('John');
});
```

## Integration with Deepkit Framework

When using with Deepkit Framework, the event system is automatically configured:

```typescript
import { App } from '@deepkit/app';
import { EventDispatcher } from '@deepkit/event';

const app = new App({
    listeners: [UserService] // Register class-based listeners
});

// Use functional listeners
app.listen(UserCreated, (event) => {
    console.log('User created:', event.data);
});

// Access dispatcher in commands/controllers
app.command('create-user', async (name: string, dispatcher: EventDispatcher) => {
    // Create user logic...
    await dispatcher.dispatch(UserCreated, {id: '1', name});
});
```

## Best Practices

1. **Use descriptive event names**: `user.created`, `order.shipped`, `payment.failed`
2. **Prefer DataEventToken for simple data**: More convenient than custom event classes
3. **Use synchronous events sparingly**: Only when you need immediate execution
4. **Order listeners appropriately**: Use negative numbers for high-priority listeners
5. **Handle errors in listeners**: Uncaught errors can break the event chain
6. **Use event factories for expensive operations**: Only create data when needed
7. **Test event-driven code thoroughly**: Use event watchers and mocking

## API Reference

### EventToken<T>
- `constructor(id: string, event?: ClassType<T>)`
- `listen(callback, order?, module?): EventListener`

### EventTokenSync<T>
- Extends `EventToken<T>`
- `sync: boolean = true`

### DataEventToken<T>
- Extends `EventToken<SimpleDataEvent<T>>`

### EventDispatcher
- `listen<T>(eventToken: T, callback, order?): EventDispatcherUnsubscribe`
- `dispatch<T>(eventToken: T, ...args): Promise<void> | void`
- `next<T>(eventToken: T): Promise<T['event']>`
- `hasListeners(eventToken): boolean`
- `getDispatcher<T>(eventToken: T): Dispatcher<T>`

### BaseEvent
- `preventDefault(): void`
- `stopImmediatePropagation(): void`
- `defaultPrevented: boolean`
- `immediatePropagationStopped: boolean`

### DataEvent<T>
- Extends `BaseEvent`
- `constructor(data: T)`
- `data: T`
