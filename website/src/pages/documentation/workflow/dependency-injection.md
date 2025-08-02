# Dependency Injection with Workflows

Deepkit's workflow engine integrates seamlessly with the dependency injection system, allowing you to build maintainable, testable workflow applications with proper separation of concerns.

## Basic DI Integration

### Setting Up Dependency Injection

```typescript
import { createWorkflow, WorkflowEvent } from '@deepkit/workflow';
import { EventDispatcher, eventDispatcher } from '@deepkit/event';
import { InjectorContext, InjectorModule } from '@deepkit/injector';

// Define services
class EmailService {
    async sendEmail(to: string, subject: string, body: string): Promise<void> {
        console.log(`Sending email to ${to}: ${subject}`);
        // Email implementation
    }
}

class PaymentService {
    async processPayment(amount: number, customerId: string): Promise<{success: boolean, transactionId?: string}> {
        console.log(`Processing payment of $${amount} for customer ${customerId}`);
        // Payment processing logic
        return { success: true, transactionId: 'txn_123' };
    }
}

class OrderRepository {
    async updateOrderStatus(orderId: string, status: string): Promise<void> {
        console.log(`Updating order ${orderId} status to ${status}`);
        // Database update logic
    }
}

// Create injector module
const module = new InjectorModule([
    EmailService,
    PaymentService,
    OrderRepository,
]);

const injector = new InjectorContext(module);
const dispatcher = new EventDispatcher(injector);
```

### Injectable Event Listeners

Use dependency injection in workflow event listeners:

```typescript
class OrderCreatedEvent extends WorkflowEvent {
    constructor(
        public orderId: string,
        public customerId: string,
        public customerEmail: string,
        public amount: number
    ) {
        super();
    }
}

class PaymentProcessedEvent extends WorkflowEvent {
    constructor(
        public orderId: string,
        public transactionId: string,
        public amount: number
    ) {
        super();
    }
}

const orderWorkflow = createWorkflow('order', {
    created: OrderCreatedEvent,
    paymentPending: WorkflowEvent,
    paid: PaymentProcessedEvent,
    shipped: WorkflowEvent,
    delivered: WorkflowEvent,
}, {
    created: 'paymentPending',
    paymentPending: 'paid',
    paid: 'shipped',
    shipped: 'delivered',
});

// Injectable listener class
class OrderWorkflowListener {
    constructor(
        private emailService: EmailService,
        private paymentService: PaymentService,
        private orderRepository: OrderRepository
    ) {}

    @eventDispatcher.listen(orderWorkflow.onCreated)
    async onOrderCreated(event: typeof orderWorkflow.onCreated.event) {
        // Send order confirmation email
        await this.emailService.sendEmail(
            event.customerEmail,
            'Order Confirmation',
            `Your order ${event.orderId} has been created.`
        );

        // Update order status
        await this.orderRepository.updateOrderStatus(event.orderId, 'created');

        // Automatically proceed to payment
        event.next('paymentPending');
    }

    @eventDispatcher.listen(orderWorkflow.onPaymentPending)
    async onPaymentPending(event: typeof orderWorkflow.onPaymentPending.event) {
        // Process payment
        const result = await this.paymentService.processPayment(
            event.amount,
            event.customerId
        );

        if (result.success) {
            event.next('paid', new PaymentProcessedEvent(
                event.orderId,
                result.transactionId!,
                event.amount
            ));
        }
    }

    @eventDispatcher.listen(orderWorkflow.onPaid)
    async onPaymentProcessed(event: typeof orderWorkflow.onPaid.event) {
        // Send payment confirmation
        await this.emailService.sendEmail(
            event.customerEmail,
            'Payment Confirmed',
            `Payment of $${event.amount} has been processed. Transaction ID: ${event.transactionId}`
        );

        // Update order status
        await this.orderRepository.updateOrderStatus(event.orderId, 'paid');

        // Start shipping process
        event.next('shipped');
    }

    @eventDispatcher.listen(orderWorkflow.onShipped)
    async onOrderShipped(event: typeof orderWorkflow.onShipped.event) {
        // Send shipping notification
        await this.emailService.sendEmail(
            event.customerEmail,
            'Order Shipped',
            `Your order ${event.orderId} has been shipped.`
        );

        // Update order status
        await this.orderRepository.updateOrderStatus(event.orderId, 'shipped');
    }
}

// Register the listener
const orderListener = new OrderWorkflowListener(
    injector.get(EmailService),
    injector.get(PaymentService),
    injector.get(OrderRepository)
);

// Or register the class for automatic instantiation
dispatcher.registerListener(OrderWorkflowListener, module);
```

## Advanced DI Patterns

### Scoped Services

Use different service scopes for workflow operations:

```typescript
import { injectable, Scope } from '@deepkit/injector';

@injectable({ scope: Scope.REQUEST })
class WorkflowContext {
    private data = new Map<string, any>();

    set(key: string, value: any): void {
        this.data.set(key, value);
    }

    get<T>(key: string): T | undefined {
        return this.data.get(key);
    }

    has(key: string): boolean {
        return this.data.has(key);
    }
}

@injectable({ scope: Scope.SINGLETON })
class AuditService {
    private logs: Array<{timestamp: Date, event: string, data: any}> = [];

    log(event: string, data: any): void {
        this.logs.push({
            timestamp: new Date(),
            event,
            data
        });
    }

    getLogs(): Array<{timestamp: Date, event: string, data: any}> {
        return [...this.logs];
    }
}

class WorkflowService {
    constructor(
        private context: WorkflowContext,
        private auditService: AuditService
    ) {}

    @eventDispatcher.listen(orderWorkflow.onCreated)
    async onOrderCreated(event: typeof orderWorkflow.onCreated.event) {
        // Store order data in request-scoped context
        this.context.set('orderId', event.orderId);
        this.context.set('customerId', event.customerId);

        // Log to singleton audit service
        this.auditService.log('order_created', {
            orderId: event.orderId,
            customerId: event.customerId,
            amount: event.amount
        });
    }

    @eventDispatcher.listen(orderWorkflow.onPaid)
    async onPaymentProcessed(event: typeof orderWorkflow.onPaid.event) {
        // Access data from context
        const orderId = this.context.get<string>('orderId');
        const customerId = this.context.get<string>('customerId');

        // Log payment
        this.auditService.log('payment_processed', {
            orderId,
            customerId,
            transactionId: event.transactionId,
            amount: event.amount
        });
    }
}
```

### Factory Services

Use factories for dynamic service creation:

```typescript
interface NotificationService {
    send(message: string, recipient: string): Promise<void>;
}

class EmailNotificationService implements NotificationService {
    async send(message: string, recipient: string): Promise<void> {
        console.log(`Email to ${recipient}: ${message}`);
    }
}

class SMSNotificationService implements NotificationService {
    async send(message: string, recipient: string): Promise<void> {
        console.log(`SMS to ${recipient}: ${message}`);
    }
}

class NotificationServiceFactory {
    constructor(
        private emailService: EmailNotificationService,
        private smsService: SMSNotificationService
    ) {}

    create(type: 'email' | 'sms'): NotificationService {
        switch (type) {
            case 'email':
                return this.emailService;
            case 'sms':
                return this.smsService;
            default:
                throw new Error(`Unknown notification type: ${type}`);
        }
    }
}

class NotificationWorkflowListener {
    constructor(private notificationFactory: NotificationServiceFactory) {}

    @eventDispatcher.listen(orderWorkflow.onCreated)
    async onOrderCreated(event: typeof orderWorkflow.onCreated.event) {
        // Use email for order confirmation
        const emailService = this.notificationFactory.create('email');
        await emailService.send(
            `Order ${event.orderId} created`,
            event.customerEmail
        );
    }

    @eventDispatcher.listen(orderWorkflow.onShipped)
    async onOrderShipped(event: typeof orderWorkflow.onShipped.event) {
        // Use SMS for urgent shipping notification
        const smsService = this.notificationFactory.create('sms');
        await smsService.send(
            `Order ${event.orderId} shipped`,
            event.customerPhone
        );
    }
}
```

### Configuration Injection

Inject configuration into workflow services:

```typescript
interface WorkflowConfig {
    emailEnabled: boolean;
    smsEnabled: boolean;
    autoApprovalThreshold: number;
    paymentTimeout: number;
}

const config: WorkflowConfig = {
    emailEnabled: true,
    smsEnabled: false,
    autoApprovalThreshold: 100,
    paymentTimeout: 300000, // 5 minutes
};

class ConfigurableWorkflowService {
    constructor(private config: WorkflowConfig) {}

    @eventDispatcher.listen(orderWorkflow.onCreated)
    async onOrderCreated(event: typeof orderWorkflow.onCreated.event) {
        // Auto-approve small orders
        if (event.amount <= this.config.autoApprovalThreshold) {
            event.next('paid', new PaymentProcessedEvent(
                event.orderId,
                'auto_approved',
                event.amount
            ));
            return;
        }

        // Set payment timeout
        setTimeout(() => {
            // Handle payment timeout
            console.log(`Payment timeout for order ${event.orderId}`);
        }, this.config.paymentTimeout);

        event.next('paymentPending');
    }
}

// Register configuration
const configModule = new InjectorModule([
    { provide: 'WorkflowConfig', useValue: config },
    ConfigurableWorkflowService,
]);
```

## Integration with Deepkit Framework

### Framework Integration

Use workflows within Deepkit Framework applications:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http } from '@deepkit/http';
import { rpc } from '@deepkit/rpc';

@http.controller()
class OrderController {
    constructor(private dispatcher: EventDispatcher) {}

    @http.POST('/orders')
    async createOrder(
        @http.body() orderData: {
            customerId: string;
            customerEmail: string;
            amount: number;
        }
    ) {
        const orderId = `order_${Date.now()}`;
        const workflow = orderWorkflow.create('created', this.dispatcher);

        await workflow.apply('created', new OrderCreatedEvent(
            orderId,
            orderData.customerId,
            orderData.customerEmail,
            orderData.amount
        ));

        return { orderId, status: workflow.state.get() };
    }

    @http.GET('/orders/:orderId/status')
    async getOrderStatus(@http.param('orderId') orderId: string) {
        // In a real app, you'd load the workflow state from storage
        // For demo purposes, we'll create a new workflow
        const workflow = orderWorkflow.create('created', this.dispatcher);
        
        return {
            orderId,
            status: workflow.state.get(),
            isDone: workflow.isDone(),
            possibleTransitions: workflow.definition.getTransitionsFrom(workflow.state.get())
        };
    }
}

@rpc.controller('workflow')
class WorkflowController {
    constructor(private dispatcher: EventDispatcher) {}

    @rpc.action()
    async processOrder(orderId: string, action: string) {
        // Load workflow state (simplified)
        const workflow = orderWorkflow.create('created', this.dispatcher);
        
        if (workflow.can(action)) {
            await workflow.apply(action);
            return { success: true, newState: workflow.state.get() };
        } else {
            return { success: false, error: `Cannot transition to ${action}` };
        }
    }
}

const app = new App({
    controllers: [OrderController, WorkflowController],
    listeners: [OrderWorkflowListener],
    providers: [
        EmailService,
        PaymentService,
        OrderRepository,
    ],
    imports: [new FrameworkModule()]
});
```

### Command Integration

Use workflows in CLI commands:

```typescript
import { cli } from '@deepkit/app';

class WorkflowCommands {
    constructor(
        private dispatcher: EventDispatcher,
        private auditService: AuditService
    ) {}

    @cli.command('order:create')
    async createOrder(
        customerId: string,
        email: string,
        amount: number
    ) {
        const orderId = `order_${Date.now()}`;
        const workflow = orderWorkflow.create('created', this.dispatcher);

        console.log(`Creating order ${orderId}...`);
        
        await workflow.apply('created', new OrderCreatedEvent(
            orderId,
            customerId,
            email,
            amount
        ));

        console.log(`Order created with status: ${workflow.state.get()}`);
    }

    @cli.command('workflow:audit')
    async showAuditLog() {
        const logs = this.auditService.getLogs();
        
        console.log('Workflow Audit Log:');
        for (const log of logs) {
            console.log(`${log.timestamp.toISOString()} - ${log.event}:`, log.data);
        }
    }
}

const app = new App({
    controllers: [WorkflowCommands],
    listeners: [OrderWorkflowListener],
    providers: [
        EmailService,
        PaymentService,
        OrderRepository,
        AuditService,
    ],
    imports: [new FrameworkModule()]
});
```

## Testing with Dependency Injection

### Mocking Services

Create testable workflows with mocked dependencies:

```typescript
import { createTestingApp } from '@deepkit/framework';

// Mock services for testing
class MockEmailService extends EmailService {
    sentEmails: Array<{to: string, subject: string, body: string}> = [];

    async sendEmail(to: string, subject: string, body: string): Promise<void> {
        this.sentEmails.push({ to, subject, body });
    }
}

class MockPaymentService extends PaymentService {
    shouldSucceed = true;

    async processPayment(amount: number, customerId: string): Promise<{success: boolean, transactionId?: string}> {
        return this.shouldSucceed 
            ? { success: true, transactionId: 'mock_txn_123' }
            : { success: false };
    }
}

// Test
test('order workflow with mocked services', async () => {
    const testing = createTestingApp({
        listeners: [OrderWorkflowListener],
        providers: [
            { provide: EmailService, useClass: MockEmailService },
            { provide: PaymentService, useClass: MockPaymentService },
            OrderRepository,
        ],
    });

    const dispatcher = testing.app.get(EventDispatcher);
    const emailService = testing.app.get(EmailService) as MockEmailService;
    const paymentService = testing.app.get(PaymentService) as MockPaymentService;

    const workflow = orderWorkflow.create('created', dispatcher);

    // Test successful flow
    await workflow.apply('created', new OrderCreatedEvent(
        'test_order',
        'customer_123',
        'test@example.com',
        99.99
    ));

    // Verify email was sent
    expect(emailService.sentEmails).toHaveLength(1);
    expect(emailService.sentEmails[0].to).toBe('test@example.com');
    expect(emailService.sentEmails[0].subject).toBe('Order Confirmation');

    // Verify workflow progressed
    expect(workflow.state.get()).toBe('paid');

    // Test payment failure
    paymentService.shouldSucceed = false;
    const failedWorkflow = orderWorkflow.create('created', dispatcher);
    
    await failedWorkflow.apply('created', new OrderCreatedEvent(
        'failed_order',
        'customer_456',
        'fail@example.com',
        199.99
    ));

    // Should stay in paymentPending state
    expect(failedWorkflow.state.get()).toBe('paymentPending');
});
```

## Best Practices

1. **Use Constructor Injection**: Prefer constructor injection for required dependencies
2. **Scope Services Appropriately**: Use singleton for stateless services, request scope for contextual data
3. **Mock External Dependencies**: Create mock implementations for testing
4. **Separate Concerns**: Keep business logic in services, workflow logic in listeners
5. **Use Configuration**: Make workflows configurable through dependency injection
6. **Handle Errors Gracefully**: Inject error handling services for robust workflows
7. **Audit and Logging**: Use injected services for comprehensive workflow auditing

## Next Steps

- [Testing](./testing.md) - Comprehensive testing strategies for DI-enabled workflows
- [Advanced Features](./advanced-features.md) - Performance optimization and debugging
- [State Management](./state-management.md) - Advanced state patterns with DI
- [Events](./events.md) - Event handling with dependency injection
