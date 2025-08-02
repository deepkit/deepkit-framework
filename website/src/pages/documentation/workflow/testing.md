# Testing Workflows

Comprehensive testing is crucial for workflow-driven applications. This guide covers testing strategies, patterns, and tools for ensuring your workflows behave correctly under all conditions.

## Basic Workflow Testing

### Unit Testing Workflow Logic

Test individual workflow transitions and state changes:

```typescript
import { expect, test } from '@jest/globals';
import { createWorkflow, WorkflowEvent } from '@deepkit/workflow';
import { EventDispatcher } from '@deepkit/event';

class OrderEvent extends WorkflowEvent {
    constructor(public orderId: string, public amount: number) {
        super();
    }
}

const orderWorkflow = createWorkflow('order', {
    created: OrderEvent,
    processing: WorkflowEvent,
    paid: WorkflowEvent,
    shipped: WorkflowEvent,
    delivered: WorkflowEvent,
    cancelled: WorkflowEvent,
}, {
    created: ['processing', 'cancelled'],
    processing: ['paid', 'cancelled'],
    paid: ['shipped', 'cancelled'],
    shipped: 'delivered',
});

test('workflow basic transitions', async () => {
    const dispatcher = new EventDispatcher();
    const workflow = orderWorkflow.create('created', dispatcher);

    // Test initial state
    expect(workflow.state.get()).toBe('created');
    expect(workflow.isDone()).toBe(false);

    // Test valid transitions
    expect(workflow.can('processing')).toBe(true);
    expect(workflow.can('cancelled')).toBe(true);
    expect(workflow.can('paid')).toBe(false);

    // Apply transition
    await workflow.apply('processing');
    expect(workflow.state.get()).toBe('processing');

    // Test new valid transitions
    expect(workflow.can('processing')).toBe(false);
    expect(workflow.can('paid')).toBe(true);
    expect(workflow.can('cancelled')).toBe(true);
});

test('workflow invalid transitions', async () => {
    const dispatcher = new EventDispatcher();
    const workflow = orderWorkflow.create('created', dispatcher);

    // Test invalid transition
    await expect(workflow.apply('paid')).rejects.toThrow(
        'Can not apply state change from created->paid'
    );

    // Test wrong event type
    await expect(workflow.apply('processing', new OrderEvent('123', 100))).rejects.toThrow(
        'State processing got the wrong event. Expected WorkflowEvent, got OrderEvent'
    );
});

test('workflow completion', async () => {
    const dispatcher = new EventDispatcher();
    const workflow = orderWorkflow.create('created', dispatcher);

    // Progress through workflow
    await workflow.apply('processing');
    await workflow.apply('paid');
    await workflow.apply('shipped');
    await workflow.apply('delivered');

    // Test final state
    expect(workflow.state.get()).toBe('delivered');
    expect(workflow.isDone()).toBe(true);
    expect(workflow.can('shipped')).toBe(false);
});
```

### Testing Event Listeners

Test workflow event listeners and business logic:

```typescript
import { eventDispatcher } from '@deepkit/event';

class OrderService {
    public processedOrders: string[] = [];
    public sentEmails: Array<{to: string, subject: string}> = [];

    @eventDispatcher.listen(orderWorkflow.onCreated)
    async onOrderCreated(event: typeof orderWorkflow.onCreated.event) {
        this.processedOrders.push(event.orderId);
        this.sentEmails.push({
            to: 'customer@example.com',
            subject: `Order ${event.orderId} created`
        });
    }

    @eventDispatcher.listen(orderWorkflow.onPaid)
    async onOrderPaid(event: typeof orderWorkflow.onPaid.event) {
        this.sentEmails.push({
            to: 'customer@example.com',
            subject: `Payment confirmed for order ${event.orderId}`
        });
    }
}

test('workflow event listeners', async () => {
    const dispatcher = new EventDispatcher();
    const orderService = new OrderService();
    
    // Register listeners manually for testing
    dispatcher.listen(orderWorkflow.onCreated, (event) => orderService.onOrderCreated(event));
    dispatcher.listen(orderWorkflow.onPaid, (event) => orderService.onOrderPaid(event));

    const workflow = orderWorkflow.create('created', dispatcher);

    // Apply transitions and verify listener behavior
    await workflow.apply('created', new OrderEvent('order-123', 99.99));
    
    expect(orderService.processedOrders).toContain('order-123');
    expect(orderService.sentEmails).toHaveLength(1);
    expect(orderService.sentEmails[0].subject).toBe('Order order-123 created');

    await workflow.apply('processing');
    await workflow.apply('paid');

    expect(orderService.sentEmails).toHaveLength(2);
    expect(orderService.sentEmails[1].subject).toBe('Payment confirmed for order order-123');
});
```

## Testing with Dependency Injection

### Mock Services

Create testable workflows with mocked dependencies:

```typescript
import { InjectorContext, InjectorModule } from '@deepkit/injector';

interface EmailService {
    sendEmail(to: string, subject: string, body: string): Promise<void>;
}

interface PaymentService {
    processPayment(amount: number): Promise<{success: boolean, transactionId?: string}>;
}

class MockEmailService implements EmailService {
    public sentEmails: Array<{to: string, subject: string, body: string}> = [];

    async sendEmail(to: string, subject: string, body: string): Promise<void> {
        this.sentEmails.push({ to, subject, body });
    }
}

class MockPaymentService implements PaymentService {
    public shouldSucceed = true;
    public processedPayments: number[] = [];

    async processPayment(amount: number): Promise<{success: boolean, transactionId?: string}> {
        this.processedPayments.push(amount);
        return this.shouldSucceed 
            ? { success: true, transactionId: 'mock_txn_123' }
            : { success: false };
    }
}

class TestableOrderService {
    constructor(
        private emailService: EmailService,
        private paymentService: PaymentService
    ) {}

    @eventDispatcher.listen(orderWorkflow.onCreated)
    async onOrderCreated(event: typeof orderWorkflow.onCreated.event) {
        await this.emailService.sendEmail(
            'customer@example.com',
            'Order Created',
            `Your order ${event.orderId} has been created.`
        );
    }

    @eventDispatcher.listen(orderWorkflow.onProcessing)
    async onOrderProcessing(event: typeof orderWorkflow.onProcessing.event) {
        const result = await this.paymentService.processPayment(event.amount);
        if (result.success) {
            event.next('paid');
        } else {
            event.next('cancelled');
        }
    }
}

test('workflow with mocked dependencies', async () => {
    const mockEmailService = new MockEmailService();
    const mockPaymentService = new MockPaymentService();

    const module = new InjectorModule([
        { provide: 'EmailService', useValue: mockEmailService },
        { provide: 'PaymentService', useValue: mockPaymentService },
        TestableOrderService,
    ]);

    const injector = new InjectorContext(module);
    const dispatcher = new EventDispatcher(injector);
    
    // Register the service
    dispatcher.registerListener(TestableOrderService, module);

    const workflow = orderWorkflow.create('created', dispatcher);

    // Test successful payment flow
    await workflow.apply('created', new OrderEvent('order-123', 99.99));
    
    expect(mockEmailService.sentEmails).toHaveLength(1);
    expect(mockEmailService.sentEmails[0].subject).toBe('Order Created');

    await workflow.apply('processing');
    
    expect(mockPaymentService.processedPayments).toContain(99.99);
    expect(workflow.state.get()).toBe('paid');

    // Test failed payment flow
    mockPaymentService.shouldSucceed = false;
    const failedWorkflow = orderWorkflow.create('created', dispatcher);
    
    await failedWorkflow.apply('created', new OrderEvent('order-456', 199.99));
    await failedWorkflow.apply('processing');
    
    expect(failedWorkflow.state.get()).toBe('cancelled');
});
```

### Testing with Framework

Use Deepkit Framework's testing utilities:

```typescript
import { createTestingApp } from '@deepkit/framework';

test('workflow integration test', async () => {
    const testing = createTestingApp({
        listeners: [TestableOrderService],
        providers: [
            { provide: 'EmailService', useClass: MockEmailService },
            { provide: 'PaymentService', useClass: MockPaymentService },
        ],
    });

    const dispatcher = testing.app.get(EventDispatcher);
    const emailService = testing.app.get('EmailService') as MockEmailService;
    const paymentService = testing.app.get('PaymentService') as MockPaymentService;

    const workflow = orderWorkflow.create('created', dispatcher);

    await workflow.apply('created', new OrderEvent('test-order', 150.00));
    await workflow.apply('processing');

    expect(emailService.sentEmails).toHaveLength(1);
    expect(paymentService.processedPayments).toContain(150.00);
    expect(workflow.state.get()).toBe('paid');
});
```

## Advanced Testing Patterns

### Testing Automatic State Progression

Test workflows that automatically progress through multiple states:

```typescript
const autoProgressWorkflow = createWorkflow('autoProgress', {
    start: WorkflowEvent,
    step1: WorkflowEvent,
    step2: WorkflowEvent,
    step3: WorkflowEvent,
    completed: WorkflowEvent,
}, {
    start: 'step1',
    step1: 'step2',
    step2: 'step3',
    step3: 'completed',
});

class AutoProgressService {
    @eventDispatcher.listen(autoProgressWorkflow.onStart)
    async onStart(event: typeof autoProgressWorkflow.onStart.event) {
        event.next('step1');
    }

    @eventDispatcher.listen(autoProgressWorkflow.onStep1)
    async onStep1(event: typeof autoProgressWorkflow.onStep1.event) {
        event.next('step2');
    }

    @eventDispatcher.listen(autoProgressWorkflow.onStep2)
    async onStep2(event: typeof autoProgressWorkflow.onStep2.event) {
        event.next('step3');
    }

    @eventDispatcher.listen(autoProgressWorkflow.onStep3)
    async onStep3(event: typeof autoProgressWorkflow.onStep3.event) {
        event.next('completed');
    }
}

test('automatic state progression', async () => {
    const dispatcher = new EventDispatcher();
    const service = new AutoProgressService();
    
    // Register all listeners
    dispatcher.listen(autoProgressWorkflow.onStart, (e) => service.onStart(e));
    dispatcher.listen(autoProgressWorkflow.onStep1, (e) => service.onStep1(e));
    dispatcher.listen(autoProgressWorkflow.onStep2, (e) => service.onStep2(e));
    dispatcher.listen(autoProgressWorkflow.onStep3, (e) => service.onStep3(e));

    const workflow = autoProgressWorkflow.create('start', dispatcher);

    // Single apply should progress through all states
    await workflow.apply('start');

    expect(workflow.state.get()).toBe('completed');
    expect(workflow.isDone()).toBe(true);
});
```

### Testing Error Conditions

Test error handling and recovery:

```typescript
class ErrorProneService {
    public shouldFail = false;
    public failureCount = 0;

    @eventDispatcher.listen(orderWorkflow.onProcessing)
    async onProcessing(event: typeof orderWorkflow.onProcessing.event) {
        if (this.shouldFail) {
            this.failureCount++;
            throw new Error('Processing failed');
        }
        event.next('paid');
    }
}

test('workflow error handling', async () => {
    const dispatcher = new EventDispatcher();
    const service = new ErrorProneService();
    
    dispatcher.listen(orderWorkflow.onProcessing, (e) => service.onProcessing(e));

    const workflow = orderWorkflow.create('created', dispatcher);

    // Test successful processing
    await workflow.apply('created', new OrderEvent('order-123', 99.99));
    await workflow.apply('processing');
    expect(workflow.state.get()).toBe('paid');

    // Test error condition
    service.shouldFail = true;
    const errorWorkflow = orderWorkflow.create('created', dispatcher);
    
    await errorWorkflow.apply('created', new OrderEvent('order-456', 199.99));
    
    await expect(errorWorkflow.apply('processing')).rejects.toThrow('Processing failed');
    expect(service.failureCount).toBe(1);
    expect(errorWorkflow.state.get()).toBe('processing'); // State unchanged on error
});
```

### Testing Conditional Logic

Test workflows with complex conditional logic:

```typescript
class ConditionalOrderService {
    @eventDispatcher.listen(orderWorkflow.onCreated)
    async onOrderCreated(event: typeof orderWorkflow.onCreated.event) {
        if (event.amount < 50) {
            // Small orders auto-approve
            event.next('paid');
        } else if (event.amount > 1000) {
            // Large orders need manual review
            event.next('cancelled'); // Simulate manual review rejection
        } else {
            // Normal orders go through processing
            event.next('processing');
        }
    }
}

test('conditional workflow logic', async () => {
    const dispatcher = new EventDispatcher();
    const service = new ConditionalOrderService();
    
    dispatcher.listen(orderWorkflow.onCreated, (e) => service.onOrderCreated(e));

    // Test small order (auto-approve)
    const smallOrderWorkflow = orderWorkflow.create('created', dispatcher);
    await smallOrderWorkflow.apply('created', new OrderEvent('small-order', 25.00));
    expect(smallOrderWorkflow.state.get()).toBe('paid');

    // Test normal order (processing)
    const normalOrderWorkflow = orderWorkflow.create('created', dispatcher);
    await normalOrderWorkflow.apply('created', new OrderEvent('normal-order', 100.00));
    expect(normalOrderWorkflow.state.get()).toBe('processing');

    // Test large order (rejected)
    const largeOrderWorkflow = orderWorkflow.create('created', dispatcher);
    await largeOrderWorkflow.apply('created', new OrderEvent('large-order', 1500.00));
    expect(largeOrderWorkflow.state.get()).toBe('cancelled');
});
```

## Performance Testing

### Load Testing Workflows

Test workflow performance under load:

```typescript
test('workflow performance under load', async () => {
    const dispatcher = new EventDispatcher();
    const workflows: Array<typeof orderWorkflow> = [];
    
    const startTime = Date.now();
    
    // Create and process 1000 workflows
    for (let i = 0; i < 1000; i++) {
        const workflow = orderWorkflow.create('created', dispatcher);
        workflows.push(workflow);
        
        await workflow.apply('created', new OrderEvent(`order-${i}`, 99.99));
        await workflow.apply('processing');
        await workflow.apply('paid');
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Processed 1000 workflows in ${duration}ms`);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    
    // Verify all workflows completed
    expect(workflows.every(w => w.state.get() === 'paid')).toBe(true);
});
```

### Memory Usage Testing

Test for memory leaks in long-running workflows:

```typescript
test('workflow memory usage', async () => {
    const dispatcher = new EventDispatcher();
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Create and dispose many workflows
    for (let i = 0; i < 10000; i++) {
        const workflow = orderWorkflow.create('created', dispatcher);
        await workflow.apply('created', new OrderEvent(`order-${i}`, 99.99));
        // Workflow should be garbage collected after this scope
    }
    
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    console.log(`Memory increase: ${memoryIncrease / 1024 / 1024}MB`);
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
});
```

## Integration Testing

### End-to-End Workflow Testing

Test complete workflow scenarios:

```typescript
import { http } from '@deepkit/http';

@http.controller()
class OrderController {
    constructor(private dispatcher: EventDispatcher) {}

    @http.POST('/orders')
    async createOrder(@http.body() data: {customerId: string, amount: number}) {
        const orderId = `order_${Date.now()}`;
        const workflow = orderWorkflow.create('created', this.dispatcher);
        
        await workflow.apply('created', new OrderEvent(orderId, data.amount));
        
        return { orderId, status: workflow.state.get() };
    }
}

test('end-to-end order workflow', async () => {
    const testing = createTestingApp({
        controllers: [OrderController],
        listeners: [TestableOrderService],
        providers: [
            { provide: 'EmailService', useClass: MockEmailService },
            { provide: 'PaymentService', useClass: MockPaymentService },
        ],
    });

    const httpKernel = testing.app.get(HttpKernel);
    
    // Create order via HTTP
    const response = await httpKernel.request(HttpRequest.POST('/orders').json({
        customerId: 'customer-123',
        amount: 99.99
    }));
    
    expect(response.statusCode).toBe(200);
    
    const result = response.json;
    expect(result.orderId).toBeDefined();
    expect(result.status).toBe('created');
    
    // Verify services were called
    const emailService = testing.app.get('EmailService') as MockEmailService;
    expect(emailService.sentEmails).toHaveLength(1);
});
```

## Best Practices

1. **Test State Transitions**: Verify all valid and invalid transitions
2. **Mock External Dependencies**: Use mocks for services to isolate workflow logic
3. **Test Error Conditions**: Ensure workflows handle errors gracefully
4. **Verify Event Listeners**: Test that listeners are called with correct data
5. **Test Automatic Progression**: Verify multi-step automatic state changes
6. **Performance Testing**: Test workflows under load and check for memory leaks
7. **Integration Testing**: Test complete scenarios from start to finish
8. **Use Descriptive Test Names**: Make test intentions clear
9. **Test Edge Cases**: Cover boundary conditions and unusual scenarios
10. **Maintain Test Data**: Use factories or builders for consistent test data

## Next Steps

- [Advanced Features](./advanced-features.md) - Performance optimization and debugging
- [State Management](./state-management.md) - Complex state patterns
- [Dependency Injection](./dependency-injection.md) - DI patterns for testable workflows
- [Events](./events.md) - Advanced event handling patterns
