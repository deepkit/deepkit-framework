# Advanced Features

This section covers advanced RPC features including bidirectional communication, custom message types, entity state management, validation, and type-safe interfaces.

## Type-Safe RPC Interfaces

For production applications, use `ControllerSymbol` to create type-safe interfaces between client and server. This ensures compile-time safety and better developer experience.

```typescript
// shared/admin-interface.ts
import { ControllerSymbol } from '@deepkit/rpc';

export const AdminRpcInterface = ControllerSymbol<AdminRpcController>('admin');

export interface AdminRpcController {
    getSystemStats(): Promise<SystemStats>;
    restartService(serviceName: string): Promise<boolean>;
    getUserActivity(userId: number): Promise<ActivityLog[]>;
    broadcastMessage(message: string): Promise<void>;
}
```

Server implementation:

```typescript
@rpc.controller(AdminRpcInterface)
class AdminRpcControllerImpl implements AdminRpcController {
    async getSystemStats(): Promise<SystemStats> {
        return {
            cpu: process.cpuUsage(),
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };
    }

    async restartService(serviceName: string): Promise<boolean> {
        // Implementation
        return true;
    }

    async getUserActivity(userId: number): Promise<ActivityLog[]> {
        // Implementation
        return [];
    }

    async broadcastMessage(message: string): Promise<void> {
        // Implementation
    }
}
```

Client usage:

```typescript
const adminController = client.controller<AdminRpcController>(AdminRpcInterface);
const stats = await adminController.getSystemStats(); // Fully typed!
```

See [RPC Interfaces](interfaces.md) for complete documentation on type-safe RPC contracts.

## Bidirectional Communication (Back Controllers)

Deepkit RPC supports bidirectional communication where the server can call methods on the client. This is useful for notifications, confirmations, and real-time interactions.

### Server-to-Client Calls

```typescript
import { RpcKernelConnection } from '@deepkit/rpc';

// Client-side controller
@rpc.controller('/client-notifications')
class ClientNotificationController {
    @rpc.action()
    showNotification(message: string, type: 'info' | 'warning' | 'error'): void {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // In a real app, this would show a UI notification
    }

    @rpc.action()
    confirmAction(message: string): Promise<boolean> {
        // In a real app, this would show a confirmation dialog
        return Promise.resolve(confirm(message));
    }

    @rpc.action()
    updateProgress(current: number, total: number): void {
        const percentage = Math.round((current / total) * 100);
        console.log(`Progress: ${percentage}%`);
    }
}

// Server-side controller that calls client methods
@rpc.controller('/server-operations')
class ServerOperationsController {
    constructor(private connection: RpcKernelConnection) {}

    @rpc.action()
    async performLongOperation(): Promise<string> {
        const clientController = this.connection.controller<ClientNotificationController>('/client-notifications');
        
        // Notify client that operation is starting
        await clientController.showNotification('Starting long operation...', 'info');
        
        // Ask for confirmation
        const confirmed = await clientController.confirmAction('This will take a while. Continue?');
        if (!confirmed) {
            return 'Operation cancelled by user';
        }

        // Simulate long operation with progress updates
        for (let i = 0; i <= 10; i++) {
            await clientController.updateProgress(i, 10);
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        await clientController.showNotification('Operation completed successfully!', 'info');
        return 'Operation completed';
    }
}
```

Client setup:

```typescript
// Register the client controller
client.registerController(ClientNotificationController, '/client-notifications');

// Use the server controller
const serverController = client.controller<ServerOperationsController>('/server-operations');
const result = await serverController.performLongOperation();
console.log(result);
```

## Custom Message Types

You can define custom message types for specialized communication patterns:

```typescript
import { createRpcMessage, RpcMessage } from '@deepkit/rpc';

// Define custom message types
enum CustomMessageTypes {
    // Start from 100 to avoid conflicts with built-in types
    HEARTBEAT = 100,
    SYSTEM_STATUS = 101,
    BROADCAST = 102,
}

@rpc.controller('/custom-messages')
class CustomMessageController {
    constructor(private connection: RpcKernelConnection) {
        // Set up custom message handlers
        this.connection.onMessage.subscribe(message => {
            this.handleCustomMessage(message);
        });
    }

    @rpc.action()
    sendHeartbeat(): void {
        const heartbeatMessage = createRpcMessage(CustomMessageTypes.HEARTBEAT, {
            timestamp: Date.now(),
            serverId: 'server-1'
        });
        this.connection.send(heartbeatMessage);
    }

    @rpc.action()
    broadcastStatus(status: SystemStatus): void {
        const statusMessage = createRpcMessage(CustomMessageTypes.SYSTEM_STATUS, status);
        this.connection.send(statusMessage);
    }

    private handleCustomMessage(message: RpcMessage): void {
        switch (message.type) {
            case CustomMessageTypes.HEARTBEAT:
                console.log('Received heartbeat:', message.body);
                break;
            case CustomMessageTypes.SYSTEM_STATUS:
                console.log('System status update:', message.body);
                break;
        }
    }
}

interface SystemStatus {
    cpu: number;
    memory: number;
    uptime: number;
}
```

## Entity State Management

Track changes to entities and synchronize state between client and server:

```typescript
import { EntityState } from '@deepkit/rpc';

@entity.name('document')
class Document {
    version: number = 1;
    
    constructor(
        public id: number,
        public title: string,
        public content: string,
        public lastModified: Date = new Date()
    ) {}
}

@rpc.controller('/documents')
class DocumentController {
    private documents = new Map<number, Document>();
    private entityState = new EntityState(Document);

    @rpc.action()
    getDocument(id: number): Document | undefined {
        return this.documents.get(id);
    }

    @rpc.action()
    getDocumentState(): EntityState<Document> {
        return this.entityState;
    }

    @rpc.action()
    updateDocument(document: Document): void {
        // Update version and timestamp
        document.version++;
        document.lastModified = new Date();
        
        this.documents.set(document.id, document);
        
        // Notify entity state of changes
        this.entityState.markAsChanged(document);
    }

    @rpc.action()
    createDocument(title: string, content: string): Document {
        const id = Date.now();
        const document = new Document(id, title, content);
        this.documents.set(id, document);
        
        this.entityState.markAsAdded(document);
        return document;
    }

    @rpc.action()
    deleteDocument(id: number): boolean {
        const document = this.documents.get(id);
        if (document) {
            this.documents.delete(id);
            this.entityState.markAsRemoved(document);
            return true;
        }
        return false;
    }
}
```

Client state tracking:

```typescript
const controller = client.controller<DocumentController>('/documents');

// Get entity state for change tracking
const entityState = await controller.getDocumentState();

// Subscribe to changes
entityState.added.subscribe(document => {
    console.log('Document added:', document.title);
});

entityState.changed.subscribe(document => {
    console.log('Document changed:', document.title, 'version:', document.version);
});

entityState.removed.subscribe(document => {
    console.log('Document removed:', document.title);
});

// Perform operations
const newDoc = await controller.createDocument('My Document', 'Initial content');
await controller.updateDocument({ ...newDoc, content: 'Updated content' });
```

## Validation

Use Deepkit's validation system with RPC actions:

```typescript
import { MinLength, MaxLength, Email, Positive, validate } from '@deepkit/type';

@entity.name('user-registration')
class UserRegistration {
    @MinLength(2)
    @MaxLength(50)
    name!: string;

    @Email()
    email!: string;

    @MinLength(8)
    password!: string;

    @Positive()
    age!: number;
}

@rpc.controller('/user-registration')
class UserRegistrationController {
    @rpc.action()
    async registerUser(registration: UserRegistration): Promise<{ success: boolean, userId?: number, errors?: string[] }> {
        // Validation is automatic, but you can also validate manually
        const errors = validate(registration);
        if (errors.length > 0) {
            return {
                success: false,
                errors: errors.map(e => e.message)
            };
        }

        // Process registration
        const userId = await this.createUser(registration);
        return { success: true, userId };
    }

    private async createUser(registration: UserRegistration): Promise<number> {
        // Implementation
        return Date.now();
    }
}
```

Client with validation:

```typescript
const controller = client.controller<UserRegistrationController>('/user-registration');

try {
    const result = await controller.registerUser({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securepassword123',
        age: 25
    });
    
    if (result.success) {
        console.log('User registered with ID:', result.userId);
    } else {
        console.log('Validation errors:', result.errors);
    }
} catch (error) {
    // Validation errors are thrown automatically for invalid data
    console.error('Registration failed:', error.message);
}
```

## Action Groups and Metadata

Organize and annotate your RPC actions:

```typescript
@rpc.controller('/admin')
class AdminController {
    @rpc.action().group('user-management').data('permission', 'admin')
    deleteUser(userId: number): Promise<boolean> {
        // Implementation
        return Promise.resolve(true);
    }

    @rpc.action().group('system').data('permission', 'admin').data('audit', true)
    restartSystem(): Promise<void> {
        // Implementation
        return Promise.resolve();
    }

    @rpc.action().group('reports').data('permission', 'read-only')
    generateReport(type: string): Promise<string> {
        // Implementation
        return Promise.resolve('Report data');
    }
}
```

Use groups and metadata in security:

```typescript
import { RpcKernelSecurity, Session, RpcControllerAccess } from '@deepkit/rpc';

class AdminSecurity extends RpcKernelSecurity {
    async hasControllerAccess(session: Session, access: RpcControllerAccess): Promise<boolean> {
        // Check action groups
        if (access.actionGroups.includes('user-management')) {
            return this.hasPermission(session, 'admin');
        }

        // Check action data
        const requiredPermission = access.actionData['permission'];
        if (requiredPermission) {
            return this.hasPermission(session, requiredPermission);
        }

        return true;
    }

    private hasPermission(session: Session, permission: string): boolean {
        // Implementation
        return true;
    }
}
```

## Performance Optimization

### Connection Pooling

```typescript
import { RpcKernelConnection } from '@deepkit/rpc';

@rpc.controller('/optimized')
class OptimizedController {
    private connectionPool = new Map<string, RpcKernelConnection>();

    @rpc.action()
    async batchOperation(items: string[]): Promise<string[]> {
        // Process items in batches for better performance
        const batchSize = 10;
        const results: string[] = [];

        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await this.processBatch(batch);
            results.push(...batchResults);
        }

        return results;
    }

    private async processBatch(items: string[]): Promise<string[]> {
        // Process batch
        return items.map(item => `processed-${item}`);
    }
}
```

### Caching

```typescript
@rpc.controller('/cached')
class CachedController {
    private cache = new Map<string, any>();
    private cacheExpiry = new Map<string, number>();

    @rpc.action()
    async getExpensiveData(key: string): Promise<any> {
        // Check cache first
        if (this.cache.has(key) && this.cacheExpiry.get(key)! > Date.now()) {
            return this.cache.get(key);
        }

        // Compute expensive data
        const data = await this.computeExpensiveData(key);
        
        // Cache for 5 minutes
        this.cache.set(key, data);
        this.cacheExpiry.set(key, Date.now() + 5 * 60 * 1000);

        return data;
    }

    private async computeExpensiveData(key: string): Promise<any> {
        // Simulate expensive computation
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { key, computed: true, timestamp: Date.now() };
    }
}
```
