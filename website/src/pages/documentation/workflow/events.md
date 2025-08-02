# Workflow Events

Workflow events are the heart of Deepkit's workflow engine, providing a powerful way to handle state transitions and implement business logic. This guide covers advanced event handling patterns and automatic state progression.

## Event Basics

### WorkflowEvent Base Class

All workflow events extend the `WorkflowEvent` base class:

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

The `WorkflowEvent` class provides methods for controlling workflow progression:

- `next(nextState, event?)` - Schedule the next state transition
- `hasNext()` - Check if a next state is scheduled
- `clearNext()` - Clear any scheduled next state

### Event Tokens

Each state in a workflow automatically generates an event token that you can listen to:

```typescript
const workflow = createWorkflow('example', {
    start: WorkflowEvent,
    processing: WorkflowEvent,
    completed: CompletedEvent,
}, {
    start: 'processing',
    processing: 'completed'
});

// Event tokens are automatically created with 'on' prefix
console.log(workflow.onStart); // EventToken for 'start' state
console.log(workflow.onProcessing); // EventToken for 'processing' state
console.log(workflow.onCompleted); // EventToken for 'completed' state
```

## Event Listeners

### Functional Listeners

Listen to workflow events using functional listeners:

```typescript
import { EventDispatcher } from '@deepkit/event';

const dispatcher = new EventDispatcher();
const workflow = exampleWorkflow.create('start', dispatcher);

// Basic listener
dispatcher.listen(workflow.onProcessing, async (event) => {
    console.log('Processing started');
});

// Listener with order (lower numbers execute first)
dispatcher.listen(workflow.onProcessing, async (event) => {
    console.log('This runs first');
}, -10);

dispatcher.listen(workflow.onProcessing, async (event) => {
    console.log('This runs second');
}, 0);

// Unsubscribe from events
const unsubscribe = dispatcher.listen(workflow.onCompleted, async (event) => {
    console.log('Completed');
});

// Later...
unsubscribe();
```

### Class-based Listeners

Use decorators for organized, dependency-injectable listeners:

```typescript
import { eventDispatcher } from '@deepkit/event';

class WorkflowService {
    constructor(
        private logger: Logger,
        private emailService: EmailService
    ) {}

    @eventDispatcher.listen(exampleWorkflow.onStart)
    async onWorkflowStart(event: typeof exampleWorkflow.onStart.event) {
        this.logger.info('Workflow started');
    }

    @eventDispatcher.listen(exampleWorkflow.onProcessing, -5) // High priority
    async onProcessingStarted(event: typeof exampleWorkflow.onProcessing.event) {
        this.logger.info('Processing phase started');
        // This runs before other processing listeners
    }

    @eventDispatcher.listen(exampleWorkflow.onCompleted)
    async onWorkflowCompleted(event: typeof exampleWorkflow.onCompleted.event) {
        await this.emailService.sendCompletionNotification(event.data);
        this.logger.info('Workflow completed successfully');
    }
}
```

## Automatic State Progression

One of the most powerful features is automatic state progression using the `next()` method:

### Basic Next State

```typescript
const approvalWorkflow = createWorkflow('approval', {
    submitted: WorkflowEvent,
    reviewing: WorkflowEvent,
    approved: WorkflowEvent,
    rejected: WorkflowEvent,
}, {
    submitted: 'reviewing',
    reviewing: ['approved', 'rejected'],
});

dispatcher.listen(approvalWorkflow.onSubmitted, async (event) => {
    // Automatically start review process
    console.log('Starting automatic review...');
    
    // Simulate review logic
    const shouldApprove = await performAutomaticReview();
    
    if (shouldApprove) {
        event.next('reviewing'); // Will transition to 'reviewing' after this listener
    }
});

dispatcher.listen(approvalWorkflow.onReviewing, async (event) => {
    // Perform review and decide outcome
    const reviewResult = await conductReview();
    
    if (reviewResult.approved) {
        event.next('approved');
    } else {
        event.next('rejected');
    }
});

// Start the workflow - it will automatically progress through states
const workflow = approvalWorkflow.create('submitted', dispatcher);
await workflow.apply('submitted');

// After the above call, the workflow might be in 'approved' or 'rejected' state
console.log('Final state:', workflow.state.get());
```

### Next State with Custom Events

You can provide custom events when transitioning to the next state:

```typescript
class ApprovedEvent extends WorkflowEvent {
    constructor(
        public approvedBy: string,
        public approvalDate: Date,
        public comments: string
    ) {
        super();
    }
}

class RejectedEvent extends WorkflowEvent {
    constructor(
        public rejectedBy: string,
        public rejectionDate: Date,
        public reason: string
    ) {
        super();
    }
}

const approvalWorkflow = createWorkflow('approval', {
    submitted: WorkflowEvent,
    reviewing: WorkflowEvent,
    approved: ApprovedEvent,
    rejected: RejectedEvent,
}, {
    submitted: 'reviewing',
    reviewing: ['approved', 'rejected'],
});

dispatcher.listen(approvalWorkflow.onReviewing, async (event) => {
    const review = await conductReview();
    
    if (review.approved) {
        event.next('approved', new ApprovedEvent(
            review.reviewerId,
            new Date(),
            review.comments
        ));
    } else {
        event.next('rejected', new RejectedEvent(
            review.reviewerId,
            new Date(),
            review.rejectionReason
        ));
    }
});

// Listen to the final states
dispatcher.listen(approvalWorkflow.onApproved, async (event) => {
    console.log(`Approved by ${event.approvedBy} on ${event.approvalDate}`);
    console.log(`Comments: ${event.comments}`);
});

dispatcher.listen(approvalWorkflow.onRejected, async (event) => {
    console.log(`Rejected by ${event.rejectedBy}: ${event.reason}`);
});
```

### Chained State Progression

You can chain multiple state transitions:

```typescript
const orderWorkflow = createWorkflow('order', {
    created: WorkflowEvent,
    validated: WorkflowEvent,
    paymentProcessing: WorkflowEvent,
    paid: WorkflowEvent,
    shipped: WorkflowEvent,
}, {
    created: 'validated',
    validated: 'paymentProcessing',
    paymentProcessing: 'paid',
    paid: 'shipped',
});

dispatcher.listen(orderWorkflow.onCreated, async (event) => {
    // Validate order
    const isValid = await validateOrder();
    if (isValid) {
        event.next('validated');
    }
});

dispatcher.listen(orderWorkflow.onValidated, async (event) => {
    // Start payment processing
    event.next('paymentProcessing');
});

dispatcher.listen(orderWorkflow.onPaymentProcessing, async (event) => {
    // Process payment
    const paymentResult = await processPayment();
    if (paymentResult.success) {
        event.next('paid');
    }
});

dispatcher.listen(orderWorkflow.onPaid, async (event) => {
    // Ship the order
    await shipOrder();
    event.next('shipped');
});

// Start the workflow - it will progress through all states automatically
const workflow = orderWorkflow.create('created', dispatcher);
await workflow.apply('created');

// The workflow will end up in 'shipped' state if all steps succeed
console.log('Final state:', workflow.state.get()); // 'shipped'
```

## Event Data and Context

### Accessing Event Data

Custom events can carry data that's accessible in listeners:

```typescript
class OrderCreatedEvent extends WorkflowEvent {
    constructor(
        public orderId: string,
        public customerId: string,
        public items: OrderItem[],
        public totalAmount: number
    ) {
        super();
    }
}

dispatcher.listen(orderWorkflow.onCreated, async (event) => {
    // Access event data
    console.log(`Order ${event.orderId} created for customer ${event.customerId}`);
    console.log(`Total amount: $${event.totalAmount}`);
    console.log(`Items: ${event.items.length}`);
    
    // Use the data for business logic
    if (event.totalAmount > 1000) {
        // High-value order processing
        await processHighValueOrder(event);
    }
});
```

### Event Context and State

Events have access to workflow context through the event dispatcher:

```typescript
dispatcher.listen(orderWorkflow.onPaymentProcessing, async (event) => {
    // You can access other services through dependency injection
    // or store context in the event dispatcher
    
    const orderData = event.orderId; // From the event
    const currentState = workflow.state.get(); // Current workflow state
    
    console.log(`Processing payment for order ${orderData} in state ${currentState}`);
});
```

## Error Handling in Events

### Validation Errors

Handle validation errors in event listeners:

```typescript
dispatcher.listen(orderWorkflow.onCreated, async (event) => {
    try {
        await validateOrder(event.orderId);
        event.next('validated');
    } catch (error) {
        console.error('Order validation failed:', error.message);
        // Don't call next() - workflow stays in current state
        // Or transition to an error state if defined
        // event.next('validationFailed');
    }
});
```

### Preventing State Transitions

Use event control methods to prevent transitions:

```typescript
import { BaseEvent } from '@deepkit/event';

dispatcher.listen(orderWorkflow.onPaymentProcessing, async (event) => {
    const creditCheck = await performCreditCheck(event.customerId);
    
    if (!creditCheck.passed) {
        // Prevent the transition from completing
        event.preventDefault();
        console.log('Payment processing prevented due to credit check failure');
        return;
    }
    
    // Continue with payment processing
    const result = await processPayment(event);
    if (result.success) {
        event.next('paid');
    }
});
```

### Error States

Define explicit error states in your workflow:

```typescript
const robustOrderWorkflow = createWorkflow('robustOrder', {
    created: WorkflowEvent,
    validated: WorkflowEvent,
    validationFailed: WorkflowEvent,
    paymentProcessing: WorkflowEvent,
    paid: WorkflowEvent,
    paymentFailed: WorkflowEvent,
    shipped: WorkflowEvent,
}, {
    created: ['validated', 'validationFailed'],
    validated: 'paymentProcessing',
    validationFailed: [], // Terminal state
    paymentProcessing: ['paid', 'paymentFailed'],
    paymentFailed: [], // Terminal state
    paid: 'shipped',
});

dispatcher.listen(robustOrderWorkflow.onCreated, async (event) => {
    try {
        await validateOrder(event.orderId);
        event.next('validated');
    } catch (error) {
        event.next('validationFailed');
    }
});

dispatcher.listen(robustOrderWorkflow.onPaymentProcessing, async (event) => {
    try {
        const result = await processPayment(event);
        if (result.success) {
            event.next('paid');
        } else {
            event.next('paymentFailed');
        }
    } catch (error) {
        event.next('paymentFailed');
    }
});
```

## Performance Considerations

### Event Listener Order

Control the execution order of listeners for performance:

```typescript
// High-priority validation (runs first)
dispatcher.listen(orderWorkflow.onCreated, async (event) => {
    await quickValidation(event);
}, -100);

// Normal processing (runs second)
dispatcher.listen(orderWorkflow.onCreated, async (event) => {
    await normalProcessing(event);
}, 0);

// Logging and analytics (runs last)
dispatcher.listen(orderWorkflow.onCreated, async (event) => {
    await logEvent(event);
    await trackAnalytics(event);
}, 100);
```

### Conditional Event Processing

Only process events when necessary:

```typescript
dispatcher.listen(orderWorkflow.onCreated, async (event) => {
    // Skip processing for test orders
    if (event.orderId.startsWith('TEST_')) {
        return;
    }
    
    // Only process high-value orders differently
    if (event.totalAmount > 1000) {
        await specialHighValueProcessing(event);
    }
    
    await standardProcessing(event);
});
```

## Next Steps

- [State Management](./state-management.md) - Advanced state transition patterns
- [Dependency Injection](./dependency-injection.md) - Using DI with workflow events
- [Testing](./testing.md) - Testing event-driven workflows
- [Advanced Features](./advanced-features.md) - Performance optimization and debugging
