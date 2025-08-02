# Getting Started with Workflows

This guide will walk you through creating your first workflow using Deepkit's workflow engine, from basic concepts to practical examples.

## Installation

```bash
npm install @deepkit/workflow @deepkit/event @deepkit/injector
```

## Basic Workflow Creation

Let's start with a simple user registration workflow:

```typescript
import { createWorkflow, WorkflowEvent } from '@deepkit/workflow';
import { EventDispatcher } from '@deepkit/event';

// Step 1: Define custom events for states that need data
class UserRegisteredEvent extends WorkflowEvent {
    constructor(
        public userId: string,
        public email: string,
        public username: string
    ) {
        super();
    }
}

class EmailVerifiedEvent extends WorkflowEvent {
    constructor(
        public userId: string,
        public verificationToken: string
    ) {
        super();
    }
}

// Step 2: Create the workflow definition
const userRegistrationWorkflow = createWorkflow('userRegistration', {
    // Define all possible states and their event types
    pending: WorkflowEvent,
    registered: UserRegisteredEvent,
    emailSent: WorkflowEvent,
    verified: EmailVerifiedEvent,
    active: WorkflowEvent,
    suspended: WorkflowEvent,
}, {
    // Define allowed transitions between states
    pending: 'registered',
    registered: 'emailSent',
    emailSent: ['verified', 'suspended'], // Multiple possible next states
    verified: 'active',
    // active and suspended are final states (no outgoing transitions)
});

// Step 3: Create a workflow instance
const dispatcher = new EventDispatcher();
const userWorkflow = userRegistrationWorkflow.create('pending', dispatcher);

console.log(userWorkflow.state.get()); // 'pending'
console.log(userWorkflow.isDone()); // false
```

## Understanding States and Transitions

### State Definitions

Each state in a workflow must be associated with an event class:

```typescript
const workflow = createWorkflow('example', {
    // Simple states use the base WorkflowEvent
    start: WorkflowEvent,
    processing: WorkflowEvent,
    
    // Complex states use custom event classes with data
    completed: CompletedEvent,
    failed: FailedEvent,
}, transitions);
```

### Transition Definitions

Transitions define which states can follow the current state:

```typescript
const transitions = {
    // Single transition: start can only go to processing
    start: 'processing',
    
    // Multiple transitions: processing can go to completed OR failed
    processing: ['completed', 'failed'],
    
    // No transitions: completed and failed are final states
    // (omitted from transitions object)
};
```

## Applying State Transitions

### Basic Transitions

```typescript
// Check if a transition is possible
console.log(userWorkflow.can('registered')); // true
console.log(userWorkflow.can('active')); // false (not directly reachable)

// Apply a transition
await userWorkflow.apply('registered', new UserRegisteredEvent(
    'user-123',
    'john@example.com',
    'john_doe'
));

console.log(userWorkflow.state.get()); // 'registered'
```

### Error Handling

The workflow engine validates all transitions:

```typescript
try {
    // This will fail - can't go directly from 'registered' to 'active'
    await userWorkflow.apply('active');
} catch (error) {
    console.log(error.message); 
    // "Can not apply state change from registered->active"
}

try {
    // This will fail - wrong event type
    await userWorkflow.apply('emailSent', new UserRegisteredEvent('123', 'test', 'test'));
} catch (error) {
    console.log(error.message);
    // "State emailSent got the wrong event. Expected WorkflowEvent, got UserRegisteredEvent"
}
```

## Working with Event Listeners

### Functional Listeners

Add business logic by listening to workflow events:

```typescript
// Listen to the 'registered' state transition
dispatcher.listen(userRegistrationWorkflow.onRegistered, async (event) => {
    console.log(`User registered: ${event.username} (${event.email})`);
    
    // Send welcome email
    await sendWelcomeEmail(event.email, event.username);
    
    // Log to analytics
    await trackUserRegistration(event.userId);
});

// Listen to email verification
dispatcher.listen(userRegistrationWorkflow.onVerified, async (event) => {
    console.log(`Email verified for user: ${event.userId}`);
    
    // Update user status in database
    await updateUserStatus(event.userId, 'verified');
});
```

### Class-based Listeners

For better organization, use class-based listeners:

```typescript
import { eventDispatcher } from '@deepkit/event';

class UserRegistrationService {
    constructor(
        private emailService: EmailService,
        private userRepository: UserRepository,
        private analyticsService: AnalyticsService
    ) {}

    @eventDispatcher.listen(userRegistrationWorkflow.onRegistered)
    async onUserRegistered(event: typeof userRegistrationWorkflow.onRegistered.event) {
        // Send welcome email
        await this.emailService.sendWelcome(event.email, event.username);
        
        // Track registration
        await this.analyticsService.track('user_registered', {
            userId: event.userId,
            email: event.email
        });
    }

    @eventDispatcher.listen(userRegistrationWorkflow.onEmailSent)
    async onEmailSent(event: typeof userRegistrationWorkflow.onEmailSent.event) {
        // Set up email verification timeout
        setTimeout(async () => {
            const user = await this.userRepository.findById(event.userId);
            if (user && user.status === 'emailSent') {
                // Suspend user if email not verified within 24 hours
                await userWorkflow.apply('suspended');
            }
        }, 24 * 60 * 60 * 1000); // 24 hours
    }

    @eventDispatcher.listen(userRegistrationWorkflow.onVerified)
    async onEmailVerified(event: typeof userRegistrationWorkflow.onVerified.event) {
        // Update user in database
        await this.userRepository.updateStatus(event.userId, 'verified');
        
        // Send confirmation
        const user = await this.userRepository.findById(event.userId);
        await this.emailService.sendVerificationConfirmation(user.email);
    }
}
```

## Complete Example: Order Processing

Here's a complete example of an order processing workflow:

```typescript
import { createWorkflow, WorkflowEvent } from '@deepkit/workflow';
import { EventDispatcher } from '@deepkit/event';
import { eventDispatcher } from '@deepkit/event';

// Custom events with relevant data
class OrderCreatedEvent extends WorkflowEvent {
    constructor(
        public orderId: string,
        public customerId: string,
        public items: Array<{productId: string, quantity: number}>,
        public totalAmount: number
    ) {
        super();
    }
}

class PaymentProcessedEvent extends WorkflowEvent {
    constructor(
        public orderId: string,
        public paymentId: string,
        public amount: number
    ) {
        super();
    }
}

class OrderShippedEvent extends WorkflowEvent {
    constructor(
        public orderId: string,
        public trackingNumber: string,
        public carrier: string
    ) {
        super();
    }
}

// Workflow definition
const orderWorkflow = createWorkflow('orderProcessing', {
    created: OrderCreatedEvent,
    paymentPending: WorkflowEvent,
    paid: PaymentProcessedEvent,
    preparing: WorkflowEvent,
    shipped: OrderShippedEvent,
    delivered: WorkflowEvent,
    cancelled: WorkflowEvent,
    refunded: WorkflowEvent,
}, {
    created: 'paymentPending',
    paymentPending: ['paid', 'cancelled'],
    paid: ['preparing', 'refunded'],
    preparing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    cancelled: 'refunded',
    // delivered and refunded are final states
});

// Business logic services
class OrderService {
    @eventDispatcher.listen(orderWorkflow.onCreated)
    async onOrderCreated(event: typeof orderWorkflow.onCreated.event) {
        console.log(`Order created: ${event.orderId} for customer ${event.customerId}`);
        
        // Reserve inventory
        await this.reserveInventory(event.items);
        
        // Send order confirmation
        await this.sendOrderConfirmation(event.customerId, event.orderId);
    }

    @eventDispatcher.listen(orderWorkflow.onPaid)
    async onPaymentProcessed(event: typeof orderWorkflow.onPaid.event) {
        console.log(`Payment processed: ${event.paymentId} for order ${event.orderId}`);
        
        // Start preparation process
        await this.startPreparation(event.orderId);
    }

    @eventDispatcher.listen(orderWorkflow.onShipped)
    async onOrderShipped(event: typeof orderWorkflow.onShipped.event) {
        console.log(`Order shipped: ${event.orderId} via ${event.carrier}`);
        
        // Send tracking information
        await this.sendTrackingInfo(event.orderId, event.trackingNumber, event.carrier);
    }

    private async reserveInventory(items: Array<{productId: string, quantity: number}>) {
        // Implementation
    }

    private async sendOrderConfirmation(customerId: string, orderId: string) {
        // Implementation
    }

    private async startPreparation(orderId: string) {
        // Implementation
    }

    private async sendTrackingInfo(orderId: string, trackingNumber: string, carrier: string) {
        // Implementation
    }
}

// Usage
async function processOrder() {
    const dispatcher = new EventDispatcher();
    const workflow = orderWorkflow.create('created', dispatcher);
    
    // Register service
    const orderService = new OrderService();
    // In a real app, you'd use dependency injection here
    
    // Start the workflow
    await workflow.apply('created', new OrderCreatedEvent(
        'order-123',
        'customer-456',
        [
            { productId: 'product-1', quantity: 2 },
            { productId: 'product-2', quantity: 1 }
        ],
        299.99
    ));
    
    // Process payment
    await workflow.apply('paymentPending');
    await workflow.apply('paid', new PaymentProcessedEvent(
        'order-123',
        'payment-789',
        299.99
    ));
    
    // Prepare and ship
    await workflow.apply('preparing');
    await workflow.apply('shipped', new OrderShippedEvent(
        'order-123',
        'TRACK123456',
        'UPS'
    ));
    
    // Final delivery
    await workflow.apply('delivered');
    
    console.log('Order completed!');
    console.log('Final state:', workflow.state.get()); // 'delivered'
    console.log('Is done:', workflow.isDone()); // true
}

processOrder().catch(console.error);
```

## Next Steps

Now that you understand the basics, explore more advanced features:

- [Events](./events.md) - Advanced event handling and automatic state progression
- [State Management](./state-management.md) - Complex state patterns and validation
- [Dependency Injection](./dependency-injection.md) - Integration with Deepkit's DI system
- [Testing](./testing.md) - Testing strategies for workflows
