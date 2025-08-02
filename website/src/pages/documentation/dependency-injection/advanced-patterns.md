# Advanced Patterns

This guide covers advanced dependency injection patterns and techniques for building sophisticated applications with Deepkit's DI system.

## Plugin Architecture

Build extensible applications using tagged providers and dynamic loading:

```typescript
import { Tag } from '@deepkit/injector';

// Define plugin interface
interface Plugin {
    name: string;
    initialize(): void;
    process(data: any): any;
}

// Create plugin tag
class PluginTag extends Tag<Plugin> {}

// Implement plugins
class ValidationPlugin implements Plugin {
    name = 'validation';
    
    initialize() {
        console.log('Validation plugin initialized');
    }
    
    process(data: any) {
        // Validate data
        return { ...data, validated: true };
    }
}

class TransformPlugin implements Plugin {
    name = 'transform';
    
    initialize() {
        console.log('Transform plugin initialized');
    }
    
    process(data: any) {
        // Transform data
        return { ...data, transformed: true };
    }
}

// Plugin manager
class PluginManager {
    constructor(private plugins: PluginTag) {}
    
    initialize() {
        for (const plugin of this.plugins.services) {
            plugin.initialize();
        }
    }
    
    processData(data: any) {
        let result = data;
        for (const plugin of this.plugins.services) {
            result = plugin.process(result);
        }
        return result;
    }
}

// Setup
const injector = Injector.from([
    PluginManager,
    PluginTag.provide(ValidationPlugin),
    PluginTag.provide(TransformPlugin),
]);

const manager = injector.get(PluginManager);
manager.initialize();
```

## Factory Pattern with DI

Create objects with some dependencies injected and others provided manually:

```typescript
import { PartialFactory } from '@deepkit/injector';

// Service that needs both injected and manual dependencies
class ReportGenerator {
    constructor(
        private database: Database,        // Injected
        private logger: Logger,           // Injected
        private template: string,         // Manual
        private options: ReportOptions    // Manual
    ) {}
    
    async generate(): Promise<Report> {
        this.logger.log(`Generating report with template: ${this.template}`);
        const data = await this.database.query(this.options.query);
        return this.processData(data);
    }
}

// Factory service
class ReportService {
    constructor(
        private reportFactory: PartialFactory<ReportGenerator>
    ) {}
    
    async generateUserReport(userId: string): Promise<Report> {
        const generator = this.reportFactory({
            template: 'user-report',
            options: { query: `SELECT * FROM users WHERE id = ${userId}` }
        });
        return generator.generate();
    }
    
    async generateSalesReport(period: string): Promise<Report> {
        const generator = this.reportFactory({
            template: 'sales-report',
            options: { query: `SELECT * FROM sales WHERE period = '${period}'` }
        });
        return generator.generate();
    }
}
```

## Decorator Pattern with DI

Enhance services with cross-cutting concerns:

```typescript
// Base service interface
interface UserService {
    getUser(id: string): Promise<User>;
    updateUser(id: string, data: Partial<User>): Promise<User>;
}

// Core implementation
class CoreUserService implements UserService {
    constructor(private repository: UserRepository) {}
    
    async getUser(id: string): Promise<User> {
        return this.repository.findById(id);
    }
    
    async updateUser(id: string, data: Partial<User>): Promise<User> {
        return this.repository.update(id, data);
    }
}

// Caching decorator
class CachedUserService implements UserService {
    constructor(
        private inner: UserService,
        private cache: CacheService
    ) {}
    
    async getUser(id: string): Promise<User> {
        const cached = await this.cache.get(`user:${id}`);
        if (cached) return cached;
        
        const user = await this.inner.getUser(id);
        await this.cache.set(`user:${id}`, user, 300);
        return user;
    }
    
    async updateUser(id: string, data: Partial<User>): Promise<User> {
        const user = await this.inner.updateUser(id, data);
        await this.cache.delete(`user:${id}`);
        return user;
    }
}

// Logging decorator
class LoggedUserService implements UserService {
    constructor(
        private inner: UserService,
        private logger: Logger
    ) {}
    
    async getUser(id: string): Promise<User> {
        this.logger.log(`Getting user ${id}`);
        const user = await this.inner.getUser(id);
        this.logger.log(`Retrieved user ${id}: ${user.name}`);
        return user;
    }
    
    async updateUser(id: string, data: Partial<User>): Promise<User> {
        this.logger.log(`Updating user ${id}`, data);
        const user = await this.inner.updateUser(id, data);
        this.logger.log(`Updated user ${id}`);
        return user;
    }
}

// Setup with decorator chain
const injector = Injector.from([
    UserRepository,
    CacheService,
    Logger,
    CoreUserService,
    {
        provide: UserService,
        useFactory: (
            core: CoreUserService,
            cache: CacheService,
            logger: Logger
        ) => {
            // Build decorator chain: Logging -> Caching -> Core
            const cached = new CachedUserService(core, cache);
            return new LoggedUserService(cached, logger);
        }
    }
]);
```

## Strategy Pattern with DI

Implement interchangeable algorithms using dependency injection:

```typescript
// Strategy interface
interface PaymentProcessor {
    process(amount: number, details: PaymentDetails): Promise<PaymentResult>;
}

// Strategy implementations
class CreditCardProcessor implements PaymentProcessor {
    constructor(private gateway: CreditCardGateway) {}
    
    async process(amount: number, details: PaymentDetails): Promise<PaymentResult> {
        return this.gateway.charge(amount, details.cardNumber, details.cvv);
    }
}

class PayPalProcessor implements PaymentProcessor {
    constructor(private api: PayPalAPI) {}
    
    async process(amount: number, details: PaymentDetails): Promise<PaymentResult> {
        return this.api.createPayment(amount, details.email);
    }
}

class BankTransferProcessor implements PaymentProcessor {
    constructor(private service: BankService) {}
    
    async process(amount: number, details: PaymentDetails): Promise<PaymentResult> {
        return this.service.transfer(amount, details.accountNumber);
    }
}

// Strategy factory
class PaymentProcessorFactory {
    constructor(private injector: InjectorContext) {}
    
    getProcessor(type: 'credit-card' | 'paypal' | 'bank-transfer'): PaymentProcessor {
        switch (type) {
            case 'credit-card':
                return this.injector.get(CreditCardProcessor);
            case 'paypal':
                return this.injector.get(PayPalProcessor);
            case 'bank-transfer':
                return this.injector.get(BankTransferProcessor);
            default:
                throw new Error(`Unknown payment type: ${type}`);
        }
    }
}

// Payment service using strategy
class PaymentService {
    constructor(private factory: PaymentProcessorFactory) {}
    
    async processPayment(
        type: string,
        amount: number,
        details: PaymentDetails
    ): Promise<PaymentResult> {
        const processor = this.factory.getProcessor(type as any);
        return processor.process(amount, details);
    }
}
```

## Observer Pattern with DI

Implement event-driven architecture with dependency injection:

```typescript
// Event types
interface UserCreatedEvent {
    type: 'user.created';
    user: User;
    timestamp: Date;
}

interface UserUpdatedEvent {
    type: 'user.updated';
    user: User;
    changes: Partial<User>;
    timestamp: Date;
}

type UserEvent = UserCreatedEvent | UserUpdatedEvent;

// Event handler interface
interface EventHandler<T> {
    handle(event: T): Promise<void>;
}

// Event handlers
class EmailNotificationHandler implements EventHandler<UserCreatedEvent> {
    constructor(private emailService: EmailService) {}
    
    async handle(event: UserCreatedEvent): Promise<void> {
        await this.emailService.sendWelcomeEmail(event.user);
    }
}

class AuditLogHandler implements EventHandler<UserEvent> {
    constructor(private auditService: AuditService) {}
    
    async handle(event: UserEvent): Promise<void> {
        await this.auditService.log(event.type, event);
    }
}

class CacheInvalidationHandler implements EventHandler<UserUpdatedEvent> {
    constructor(private cache: CacheService) {}
    
    async handle(event: UserUpdatedEvent): Promise<void> {
        await this.cache.delete(`user:${event.user.id}`);
    }
}

// Event bus with DI
class EventBus {
    private handlers = new Map<string, EventHandler<any>[]>();
    
    constructor(private injector: InjectorContext) {}
    
    subscribe<T>(eventType: string, handlerClass: ClassType<EventHandler<T>>) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }
        
        const handler = this.injector.get(handlerClass);
        this.handlers.get(eventType)!.push(handler);
    }
    
    async publish<T>(event: T & { type: string }): Promise<void> {
        const handlers = this.handlers.get(event.type) || [];
        
        await Promise.all(
            handlers.map(handler => handler.handle(event))
        );
    }
}

// Setup
const injector = Injector.from([
    EmailService,
    AuditService,
    CacheService,
    EmailNotificationHandler,
    AuditLogHandler,
    CacheInvalidationHandler,
    EventBus
]);

const eventBus = injector.get(EventBus);

// Subscribe handlers
eventBus.subscribe('user.created', EmailNotificationHandler);
eventBus.subscribe('user.created', AuditLogHandler);
eventBus.subscribe('user.updated', AuditLogHandler);
eventBus.subscribe('user.updated', CacheInvalidationHandler);
```

## Middleware Pattern with DI

Build processing pipelines with dependency injection:

```typescript
// Middleware interface
interface Middleware<T> {
    process(context: T, next: () => Promise<void>): Promise<void>;
}

// Middleware implementations
class AuthenticationMiddleware implements Middleware<RequestContext> {
    constructor(private authService: AuthService) {}
    
    async process(context: RequestContext, next: () => Promise<void>): Promise<void> {
        const token = context.request.headers.authorization;
        context.user = await this.authService.validateToken(token);
        await next();
    }
}

class LoggingMiddleware implements Middleware<RequestContext> {
    constructor(private logger: Logger) {}
    
    async process(context: RequestContext, next: () => Promise<void>): Promise<void> {
        const start = Date.now();
        this.logger.log(`Request started: ${context.request.url}`);
        
        await next();
        
        const duration = Date.now() - start;
        this.logger.log(`Request completed in ${duration}ms`);
    }
}

class ValidationMiddleware implements Middleware<RequestContext> {
    constructor(private validator: ValidationService) {}
    
    async process(context: RequestContext, next: () => Promise<void>): Promise<void> {
        await this.validator.validate(context.request.body);
        await next();
    }
}

// Middleware pipeline
class MiddlewarePipeline<T> {
    private middlewares: Middleware<T>[] = [];
    
    constructor(private injector: InjectorContext) {}
    
    use(middlewareClass: ClassType<Middleware<T>>): this {
        const middleware = this.injector.get(middlewareClass);
        this.middlewares.push(middleware);
        return this;
    }
    
    async execute(context: T, finalHandler: () => Promise<void>): Promise<void> {
        let index = 0;
        
        const next = async (): Promise<void> => {
            if (index < this.middlewares.length) {
                const middleware = this.middlewares[index++];
                await middleware.process(context, next);
            } else {
                await finalHandler();
            }
        };
        
        await next();
    }
}

// Usage
const pipeline = new MiddlewarePipeline<RequestContext>(injector);

pipeline
    .use(LoggingMiddleware)
    .use(AuthenticationMiddleware)
    .use(ValidationMiddleware);

// Execute pipeline
await pipeline.execute(requestContext, async () => {
    // Final request handler
    console.log('Processing request...');
});
```

## Best Practices for Advanced Patterns

1. **Keep Interfaces Simple**: Design focused interfaces for better testability
2. **Use Composition**: Prefer composition over inheritance for flexibility
3. **Leverage Tags**: Use tagged providers for plugin and collection patterns
4. **Factory for Flexibility**: Use factories when you need runtime configuration
5. **Scope Appropriately**: Only use scopes when you need different lifecycles
6. **Test Patterns**: Ensure your patterns are easily testable with mocks

These patterns demonstrate the power and flexibility of Deepkit's dependency injection system for building maintainable, extensible applications.
