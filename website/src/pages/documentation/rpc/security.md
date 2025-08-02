# Security

## Understanding RPC Security

Security in RPC systems is critical because you're exposing server functionality directly to clients over the network. Unlike traditional web applications where you control the HTTP endpoints, RPC systems allow clients to call server methods directly, making proper access control essential.

### Security Challenges in RPC

RPC systems face unique security challenges:

1. **Direct Method Access**: Clients can call server methods directly, bypassing traditional web security layers
2. **Type Safety vs Security**: Type safety doesn't guarantee security - you need explicit access controls
3. **Bidirectional Communication**: Both client and server can initiate calls, expanding the attack surface
4. **Peer-to-Peer Communication**: Clients can potentially communicate with each other through the server
5. **State Management**: Long-lived connections maintain state that needs to be secured
6. **Data Exposure**: Rich type information might expose more data than intended

### Deepkit RPC Security Model

Deepkit RPC implements a comprehensive security model through the `RpcKernelSecurity` class:

```
┌─────────────┐    Authentication    ┌─────────────┐
│   Client    │ ────────────────────→ │   Server    │
│             │                      │             │
│ Token/Auth  │ ← Session Creation ← │ RpcKernel   │
│             │                      │ Security    │
│ RPC Calls   │ → Access Control →   │             │
└─────────────┘                      └─────────────┘
```

### Default Security Behavior

**⚠️ Important**: By default, Deepkit RPC is permissive:
- All RPC actions can be called by any client
- Peer-to-peer communication is enabled
- No authentication is required
- All error details are forwarded to clients

This makes development easy but is **not suitable for production**. You must implement proper security controls.

## Implementing Security

### The RpcKernelSecurity Class

The `RpcKernelSecurity` class is your main tool for implementing security. It provides hooks for:

- **Authentication**: Validating client credentials and creating sessions
- **Authorization**: Controlling access to specific controllers and actions
- **Peer-to-Peer Control**: Managing client-to-client communication
- **Error Transformation**: Controlling what error information is exposed

```typescript
import { RpcKernelSecurity, Session, RpcControllerAccess } from '@deepkit/rpc';

class MyKernelSecurity extends RpcKernelSecurity {
    // Control access to specific RPC actions
    async hasControllerAccess(session: Session, controllerAccess: RpcControllerAccess): Promise<boolean> {
        // Default: allow all access (override this!)
        return true;
    }

    // Control peer registration
    async isAllowedToRegisterAsPeer(session: Session, peerId: string): Promise<boolean> {
        // Default: allow all peer registration (override this!)
        return true;
    }

    // Control peer-to-peer communication
    async isAllowedToSendToPeer(session: Session, peerId: string): Promise<boolean> {
        // Default: allow all peer communication (override this!)
        return true;
    }

    // Authenticate clients and create sessions
    async authenticate(token: any): Promise<Session> {
        // Default: throw error (you must implement this!)
        throw new Error('Authentication not implemented');
    }

    // Transform errors before sending to clients
    transformError(err: Error): Error {
        // Default: return error as-is (consider security implications!)
        return err;
    }
}
```

### Security Implementation Patterns

#### Role-Based Access Control (RBAC)

```typescript
import { entity } from '@deepkit/type';

// Define user roles
enum UserRole {
    GUEST = 'guest',
    USER = 'user',
    ADMIN = 'admin',
    SUPER_ADMIN = 'super_admin'
}

// Custom session with user information
@entity.name('authenticated-session')
class AuthenticatedSession extends Session {
    constructor(
        public userId: string,
        public username: string,
        public roles: UserRole[],
        public permissions: string[],
        token?: any
    ) {
        super(username, token);
    }

    hasRole(role: UserRole): boolean {
        return this.roles.includes(role);
    }

    hasPermission(permission: string): boolean {
        return this.permissions.includes(permission);
    }

    isAdmin(): boolean {
        return this.hasRole(UserRole.ADMIN) || this.hasRole(UserRole.SUPER_ADMIN);
    }
}

class RoleBasedSecurity extends RpcKernelSecurity {
    constructor(private userService: UserService) {
        super();
    }

    async authenticate(token: string): Promise<Session> {
        if (!token) {
            throw new Error('Authentication token required');
        }

        try {
            // Verify JWT token or API key
            const payload = await this.verifyToken(token);

            // Load user information
            const user = await this.userService.findById(payload.userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Create authenticated session
            return new AuthenticatedSession(
                user.id,
                user.username,
                user.roles,
                user.permissions,
                token
            );
        } catch (error) {
            throw new Error('Invalid authentication token');
        }
    }

    async hasControllerAccess(session: Session, access: RpcControllerAccess): Promise<boolean> {
        // Allow unauthenticated access to public controllers
        if (access.actionGroups.includes('public')) {
            return true;
        }

        // Require authentication for all other controllers
        if (!(session instanceof AuthenticatedSession)) {
            return false;
        }

        // Check role-based access
        if (access.actionGroups.includes('admin')) {
            return session.isAdmin();
        }

        if (access.actionGroups.includes('user')) {
            return session.hasRole(UserRole.USER) || session.isAdmin();
        }

        // Check permission-based access
        const requiredPermission = access.actionData['permission'];
        if (requiredPermission) {
            return session.hasPermission(requiredPermission);
        }

        // Default: allow authenticated users
        return true;
    }

    private async verifyToken(token: string): Promise<{ userId: string }> {
        // Implement JWT verification or API key validation
        // This is a simplified example
        if (token.startsWith('user-')) {
            return { userId: token.replace('user-', '') };
        }
        throw new Error('Invalid token format');
    }
}
```

To use this, pass the provider to the `RpcKernel`:

```typescript
const kernel = new RpcKernel([{provide: RpcKernelSecurity, useClass: MyKernelSecurity, scope: 'rpc'}]);
```

Or, in the case of a Deepkit Framework application, override the `RpcKernelSecurity` class with a provider in the app:

```typescript
import { App } from '@deepkit/type';
import { RpcKernelSecurity } from '@deepkit/rpc';
import { FrameworkModule } from '@deepkit/framework';

new App({
    controllers: [MyRpcController],
    providers: [
        {provide: RpcKernelSecurity, useClass: MyRpcKernelSecurity, scope: 'rpc'}
    ],
    imports: [new FrameworkModule]
}).run();
```

## Authentication / Session

By default, the `Session` object is an anonymous session, meaning the client has not authenticated. When the client wants to authenticate, the `authenticate` method is called. The token received by the `authenticate` method comes from the client and can have any value.

Once the client sets a token, the authentication is executed when the first RPC function is called or when `client.connect()` is manually invoked.


```typescript
const client = new RpcWebSocketClient('localhost:8081');
client.token.set('123456789');

const controller = client.controller<Controller>('/main');
```

In this case, `RpcKernelSecurity.authenticate` receives the token `123456789` and can return a different session accordingly. The returned session is then passed to all other methods like `hasControllerAccess`.

```typescript
import { Session, RpcKernelSecurity } from '@deepkit/rpc';

class UserSession extends Session {
}

class MyKernelSecurity extends RpcKernelSecurity {
    async hasControllerAccess(session: Session, controllerAccess: RpcControllerAccess): Promise<boolean> {
        if (controllerAccess.controllerClassType instanceof MySecureController) {
            //MySecureController requires UserSession
            return session instanceof UserSession;
        }
        return true;
    }

    async authenticate(token: any): Promise<Session> {
        if (token === '123456789') {
            //username can be an ID or a username
            return new UserSession('username', token);
        }
        throw new Error('Authentication failed');
    }
}
```

## Controller Access

The `hasControllerAccess` method determines whether a client is allowed to execute a specific RPC function. This method is called for every RPC function invocation. If it returns `false`, access is denied, and an error is thrown on the client.

The `RpcControllerAccess` contains valuable information about the RPC function:

```typescript
interface RpcControllerAccess {
    controllerName: string;
    controllerClassType: ClassType;
    actionName: string;
    actionGroups: string[];
    actionData: { [name: string]: any };
}
```

Groups and additional data can be changed via the decorator `@rpc.action()`:

```typescript
class Controller {
    @rpc.action().group('secret').data('role', 'admin')
    saveUser(user: User): void {
    }
}

class MyKernelSecurity extends RpcKernelSecurity {
    async hasControllerAccess(session: Session, controllerAccess: RpcControllerAccess): Promise<boolean> {
        if (controllerAccess.actionGroups.includes('secret')) {
            if (session instanceof UserSession) {
                //todo: check
                return session.username === 'admin';
            }
            return false;
        }
        return true;
    }
}
```
