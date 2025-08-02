# Workflow Engine

The Deepkit Workflow package provides a powerful, type-safe finite state machine and workflow engine for building complex business processes. It integrates seamlessly with Deepkit's event system and dependency injection, offering high performance through compiled state transitions.

## Installation

```bash
npm install @deepkit/workflow
```

## Quick Start

```typescript
import { createWorkflow, WorkflowEvent } from '@deepkit/workflow';
import { EventDispatcher } from '@deepkit/event';

// Define custom events for specific states
class OrderProcessedEvent extends WorkflowEvent {
    constructor(public orderId: string, public amount: number) {
        super();
    }
}

// Create a workflow definition
const orderWorkflow = createWorkflow('orderProcessing', {
    created: WorkflowEvent,
    processing: WorkflowEvent,
    paid: OrderProcessedEvent,
    shipped: WorkflowEvent,
    delivered: WorkflowEvent,
    cancelled: WorkflowEvent,
}, {
    // Define allowed transitions
    created: ['processing', 'cancelled'],
    processing: ['paid', 'cancelled'],
    paid: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    // delivered and cancelled are final states (no transitions)
});

// Create a workflow instance
const dispatcher = new EventDispatcher();
const workflow = orderWorkflow.create('created', dispatcher);

// Check current state
console.log(workflow.state.get()); // 'created'
console.log(workflow.isDone()); // false

// Check possible transitions
console.log(workflow.can('processing')); // true
console.log(workflow.can('paid')); // false

// Apply state transitions
await workflow.apply('processing');
console.log(workflow.state.get()); // 'processing'

await workflow.apply('paid', new OrderProcessedEvent('order-123', 99.99));
console.log(workflow.state.get()); // 'paid'
```

## Core Concepts

### Workflow Definition

A workflow is defined using the `createWorkflow()` function with three parameters:

1. **Name**: A unique identifier for the workflow
2. **Places**: An object mapping state names to event classes
3. **Transitions**: An object defining allowed state transitions

```typescript
const workflow = createWorkflow('myWorkflow', {
    // Places (states) with their associated event types
    start: WorkflowEvent,
    processing: WorkflowEvent,
    completed: CustomCompletedEvent,
    failed: WorkflowEvent,
}, {
    // Transitions (from -> to)
    start: 'processing',
    processing: ['completed', 'failed'], // Multiple possible transitions
    // completed and failed are final states
});
```

### Workflow Events

All workflow states are associated with event classes that extend `WorkflowEvent`:

```typescript
import { WorkflowEvent } from '@deepkit/workflow';

class CustomEvent extends WorkflowEvent {
    constructor(
        public data: string,
        public timestamp: Date = new Date()
    ) {
        super();
    }
}
```

### State Transitions

State transitions are validated at runtime. You can only transition to states that are explicitly allowed:

```typescript
// This will succeed if 'processing' is allowed from current state
await workflow.apply('processing');

// This will throw WorkflowError if transition is not allowed
await workflow.apply('completed'); // Error if not allowed from current state
```

### Event Tokens

Each state in the workflow automatically gets an event token that you can listen to:

```typescript
// Listen to state transitions
dispatcher.listen(orderWorkflow.onPaid, (event) => {
    console.log('Order paid:', event.orderId, event.amount);
});

dispatcher.listen(orderWorkflow.onShipped, (event) => {
    console.log('Order shipped');
});
```

## Event-Driven Architecture

The workflow engine integrates with Deepkit's event system, allowing you to build reactive applications:

### Functional Listeners

```typescript
import { EventDispatcher } from '@deepkit/event';

const dispatcher = new EventDispatcher();
const workflow = orderWorkflow.create('created', dispatcher);

// Listen to workflow events
dispatcher.listen(orderWorkflow.onProcessing, async (event) => {
    console.log('Order is being processed');
    // Perform processing logic
});

dispatcher.listen(orderWorkflow.onPaid, async (event) => {
    console.log('Payment received for order:', event.orderId);
    // Send confirmation email
    // Update inventory
});
```

### Class-based Listeners

```typescript
import { eventDispatcher } from '@deepkit/event';

class OrderService {
    @eventDispatcher.listen(orderWorkflow.onPaid)
    async onOrderPaid(event: typeof orderWorkflow.onPaid.event) {
        console.log('Processing payment for order:', event.orderId);
        // Business logic here
    }

    @eventDispatcher.listen(orderWorkflow.onShipped)
    async onOrderShipped(event: typeof orderWorkflow.onShipped.event) {
        console.log('Order shipped, sending notification');
        // Send shipping notification
    }
}
```

## Advanced Features

### Automatic State Progression

Events can trigger automatic progression to the next state using the `next()` method:

```typescript
dispatcher.listen(orderWorkflow.onProcessing, async (event) => {
    // Perform processing logic
    const paymentResult = await processPayment();
    
    if (paymentResult.success) {
        // Automatically transition to 'paid' state
        event.next('paid', new OrderProcessedEvent(
            paymentResult.orderId, 
            paymentResult.amount
        ));
    } else {
        event.next('cancelled');
    }
});

// Apply the initial transition - will automatically progress through states
await workflow.apply('processing');
console.log(workflow.state.get()); // Could be 'paid' or 'cancelled'
```

### Dependency Injection

Workflow event listeners support full dependency injection:

```typescript
import { InjectorContext, InjectorModule } from '@deepkit/injector';

class PaymentService {
    async processPayment(orderId: string): Promise<boolean> {
        // Payment processing logic
        return true;
    }
}

class OrderListener {
    constructor(private paymentService: PaymentService) {}

    @eventDispatcher.listen(orderWorkflow.onProcessing)
    async onProcessing(event: typeof orderWorkflow.onProcessing.event) {
        const success = await this.paymentService.processPayment('order-123');
        if (success) {
            event.next('paid', new OrderProcessedEvent('order-123', 99.99));
        }
    }
}

// Setup with dependency injection
const module = new InjectorModule([PaymentService, OrderListener]);
const injector = new InjectorContext(module);
const dispatcher = new EventDispatcher(injector);

// Register the listener
dispatcher.registerListener(OrderListener, module);

const workflow = orderWorkflow.create('created', dispatcher);
```

### Performance Optimization

The workflow engine compiles state transition logic for maximum performance:

```typescript
// The first call compiles the transition logic
await workflow.apply('processing'); // Compilation happens here

// Subsequent calls use the compiled version (much faster)
await workflow.apply('paid', new OrderProcessedEvent('order-456', 149.99));
```

### State Validation

The workflow engine validates transitions and event types:

```typescript
// This will throw an error if wrong event type is provided
await workflow.apply('paid', new WorkflowEvent()); 
// Error: State paid got the wrong event. Expected OrderProcessedEvent, got WorkflowEvent

// This will throw an error if transition is not allowed
await workflow.apply('delivered'); 
// Error: Can not apply state change from created->delivered
```

## Integration with Deepkit Framework

When using with Deepkit Framework, workflows integrate seamlessly:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    listeners: [OrderService], // Register workflow listeners
    imports: [new FrameworkModule()]
});

// Use in controllers or commands
app.command('process-order', async (orderId: string, dispatcher: EventDispatcher) => {
    const workflow = orderWorkflow.create('created', dispatcher);
    await workflow.apply('processing');
});
```

## Best Practices

1. **Use descriptive state names**: `orderCreated`, `paymentProcessing`, `orderShipped`
2. **Create custom event classes**: Include relevant data for each state transition
3. **Validate business rules in listeners**: Use event listeners to enforce business logic
4. **Handle errors gracefully**: Implement error states and recovery mechanisms
5. **Use dependency injection**: Leverage DI for testable, maintainable code
6. **Test workflows thoroughly**: Test all possible state transitions and edge cases

## API Reference

### createWorkflow<T>(name, places, transitions)
- **name**: `string` - Unique workflow identifier
- **places**: `T` - Object mapping state names to event classes
- **transitions**: `WorkflowTransitions<T>` - Object defining allowed transitions
- **Returns**: `WorkflowDefinition<T> & WorkflowDefinitionEvents<T>`

### WorkflowDefinition<T>
- `create(state, eventDispatcher, injector?, stopwatch?)`: Create workflow instance
- `getEventToken<K>(name)`: Get event token for a state
- `getTransitionsFrom(state)`: Get allowed transitions from a state

### Workflow<T>
- `state`: Current workflow state
- `can(nextState)`: Check if transition is allowed
- `apply<K>(nextState, event?)`: Apply state transition
- `isDone()`: Check if workflow is in a final state

### WorkflowEvent
- `next(nextState, event?)`: Schedule next state transition
- `hasNext()`: Check if next state is scheduled
- `clearNext()`: Clear scheduled next state

## Next Steps

- [Getting Started](./workflow/getting-started.md) - Detailed tutorial and examples
- [Events](./workflow/events.md) - Advanced event handling patterns
- [State Management](./workflow/state-management.md) - Complex state transition patterns
- [Testing](./workflow/testing.md) - Testing strategies for workflows
