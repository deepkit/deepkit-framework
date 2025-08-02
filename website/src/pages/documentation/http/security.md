# Security

Security is paramount in web applications, and Deepkit HTTP provides a comprehensive security framework that integrates seamlessly with its type system and event-driven architecture. This chapter covers essential security concepts and practical implementations for building secure HTTP applications.

## Security Fundamentals

Web application security involves multiple layers of protection:

### Defense in Depth
- **Input Validation**: Validate all incoming data at the application boundary
- **Authentication**: Verify user identity before granting access
- **Authorization**: Control what authenticated users can access
- **Data Protection**: Encrypt sensitive data in transit and at rest
- **Error Handling**: Prevent information leakage through error messages
- **Monitoring**: Log security events and detect suspicious activity

### Deepkit's Security Advantages

Deepkit HTTP's type-driven approach provides inherent security benefits:

- **Automatic Validation**: TypeScript types automatically validate input data
- **Type Safety**: Compile-time guarantees prevent many runtime vulnerabilities
- **Event System**: Centralized security logic through HTTP workflow events
- **Dependency Injection**: Clean separation of security concerns
- **Testing**: Easy to test security logic in isolation

## Authentication

Authentication is the process of verifying that users are who they claim to be. Deepkit HTTP provides flexible authentication mechanisms through its event system, allowing you to implement various authentication strategies.

### Authentication Strategies

Common authentication methods include:

- **Token-based**: JWT, API keys, bearer tokens
- **Session-based**: Server-side sessions with cookies
- **Basic Authentication**: Username/password in headers (HTTPS only)
- **OAuth/OpenID**: Third-party authentication providers
- **Multi-factor**: Combining multiple authentication methods

### How Authentication Works in Deepkit

Authentication in Deepkit HTTP happens during the HTTP workflow, specifically in the `onAuth` event. This allows you to:

1. **Intercept requests**: Check authentication before routes execute
2. **Set user context**: Make authenticated user available to routes
3. **Handle failures**: Return appropriate error responses
4. **Centralize logic**: Keep authentication logic in one place

### Token-Based Authentication

Token-based authentication is stateless and scalable, making it ideal for APIs and modern web applications. Here's how to implement it with Deepkit HTTP:

#### Basic Token Authentication

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http, httpWorkflow, HttpUnauthorizedError } from '@deepkit/http';

class User {
    constructor(
        public id: number,
        public username: string,
        public email: string,
        public roles: string[] = []
    ) {}
}

class AuthService {
    private validTokens = new Map([
        ['token123', { id: 1, username: 'john', email: 'john@example.com', roles: ['user'] }],
        ['token456', { id: 2, username: 'jane', email: 'jane@example.com', roles: ['user', 'admin'] }]
    ]);

    validateToken(token: string): User | null {
        const userData = this.validTokens.get(token);
        if (!userData) return null;

        return new User(userData.id, userData.username, userData.email, userData.roles);
    }
}

class UserController {
    @http.GET('/profile')
    getProfile(user: User) {
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            roles: user.roles
        };
    }

    @http.GET('/protected-data')
    getProtectedData(user: User) {
        return {
            message: 'This is protected data',
            accessedBy: user.username,
            timestamp: new Date()
        };
    }
}

const app = new App({
    controllers: [UserController],
    providers: [
        AuthService,
        {
            provide: User,
            scope: 'http',
            useFactory: () => {
                throw new Error('User must be set via injector context during authentication');
            }
        }
    ],
    imports: [new FrameworkModule]
});

// Authentication event listener
app.listen(httpWorkflow.onAuth, (event, authService: AuthService) => {
    const authHeader = event.request.headers.authorization;

    if (!authHeader) {
        throw new HttpUnauthorizedError('Authorization header required');
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;

    const user = authService.validateToken(token);
    if (!user) {
        throw new HttpUnauthorizedError('Invalid or expired token');
    }

    // Make user available to controllers via dependency injection
    event.injectorContext.set(User, user);
});

app.run();
```

#### Why This Pattern Works

1. **Centralized Authentication**: All authentication logic is in one event listener
2. **Type Safety**: The `User` object is properly typed throughout the application
3. **Dependency Injection**: Controllers receive the authenticated user automatically
4. **Error Handling**: Invalid tokens result in proper HTTP 401 responses
5. **Testability**: Easy to mock the `AuthService` for testing

### JWT Authentication

For JWT-based authentication, you can create a more sophisticated authentication system:

```typescript
import jwt from 'jsonwebtoken';

interface JWTPayload {
    userId: number;
    username: string;
    exp: number;
}

class AuthService {
    private secretKey = 'your-secret-key';

    verifyToken(token: string): JWTPayload {
        try {
            return jwt.verify(token, this.secretKey) as JWTPayload;
        } catch (error) {
            throw new HttpUnauthorizedError('Invalid or expired token');
        }
    }

    generateToken(user: User): string {
        return jwt.sign(
            { userId: user.id, username: user.username },
            this.secretKey,
            { expiresIn: '24h' }
        );
    }
}

// JWT Authentication listener
app.listen(httpWorkflow.onAuth, (event, authService: AuthService) => {
    const authHeader = event.request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new HttpUnauthorizedError('Bearer token required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = authService.verifyToken(token);

    const user = new User(payload.username, payload.userId);
    event.injectorContext.set(User, user);
});
```

## Authorization

Authorization determines what authenticated users are allowed to do. Deepkit HTTP provides several ways to implement authorization.

### Role-Based Access Control

```typescript
class User {
    constructor(
        public username: string,
        public id: number,
        public roles: string[] = []
    ) {}

    hasRole(role: string): boolean {
        return this.roles.includes(role);
    }
}

class AdminController {
    @http.GET('/admin/users').group('admin')
    listUsers() {
        return { users: ['john', 'jane'] };
    }

    @http.DELETE('/admin/users/:id').group('admin')
    deleteUser(id: number) {
        return { deleted: id };
    }
}

// Authorization listener
app.listen(httpWorkflow.onController, (event, user: User) => {
    // Check if route requires admin access
    if (event.route.groups.includes('admin')) {
        if (!user || !user.hasRole('admin')) {
            event.accessDenied();
            return;
        }
    }
});
```

### Permission-Based Authorization

```typescript
interface Permission {
    resource: string;
    action: string;
}

class User {
    constructor(
        public username: string,
        public id: number,
        public permissions: Permission[] = []
    ) {}

    hasPermission(resource: string, action: string): boolean {
        return this.permissions.some(p =>
            p.resource === resource && p.action === action
        );
    }
}

class UserController {
    @http.GET('/users').permission('users', 'read')
    listUsers() {
        return { users: [] };
    }

    @http.POST('/users').permission('users', 'create')
    createUser(userData: any) {
        return { created: true };
    }
}

// Custom decorator for permissions
function permission(resource: string, action: string) {
    return (target: any, propertyKey: string) => {
        // Store permission metadata
        Reflect.defineMetadata('permission', { resource, action }, target, propertyKey);
    };
}

// Permission-based authorization listener
app.listen(httpWorkflow.onController, (event, user: User) => {
    const permission = Reflect.getMetadata('permission', event.controllerClass.prototype, event.methodName);

    if (permission) {
        if (!user || !user.hasPermission(permission.resource, permission.action)) {
            event.accessDenied();
            return;
        }
    }
});
```

## Sessions

Sessions provide a way to store user data across multiple HTTP requests. Deepkit HTTP supports session management through HTTP-scoped providers.

### Basic Session Implementation

```typescript
class HttpSession {
    private data: Map<string, any> = new Map();

    set(key: string, value: any): void {
        this.data.set(key, value);
    }

    get<T>(key: string): T | undefined {
        return this.data.get(key);
    }

    has(key: string): boolean {
        return this.data.has(key);
    }

    delete(key: string): void {
        this.data.delete(key);
    }

    clear(): void {
        this.data.clear();
    }
}

class SessionController {
    @http.POST('/login')
    login(credentials: { username: string, password: string }, session: HttpSession) {
        // Validate credentials (simplified)
        if (credentials.username === 'admin' && credentials.password === 'secret') {
            session.set('user', { username: credentials.username, loggedIn: true });
            return { success: true };
        }
        throw new HttpUnauthorizedError('Invalid credentials');
    }

    @http.GET('/profile')
    getProfile(session: HttpSession) {
        const user = session.get('user');
        if (!user || !user.loggedIn) {
            throw new HttpUnauthorizedError('Not logged in');
        }
        return user;
    }

    @http.POST('/logout')
    logout(session: HttpSession) {
        session.clear();
        return { success: true };
    }
}

const app = new App({
    controllers: [SessionController],
    providers: [
        {
            provide: HttpSession,
            scope: 'http',
            useFactory: () => {
                throw new Error('HttpSession must be initialized via injector context');
            }
        }
    ],
    imports: [new FrameworkModule]
});

// Initialize session for each request
app.listen(httpWorkflow.onRequest, (event) => {
    const session = new HttpSession();
    // Load session data from cookies/storage if needed
    event.injectorContext.set(HttpSession, session);
});
```

### User Session with Authentication

```typescript
class UserSession {
    private user?: User;

    setUser(user: User): void {
        this.user = user;
    }

    getUser(): User {
        if (!this.user) {
            throw new HttpUnauthorizedError('Not authenticated');
        }
        return this.user;
    }

    isAuthenticated(): boolean {
        return !!this.user;
    }

    clear(): void {
        this.user = undefined;
    }
}

class AuthController {
    @http.POST('/auth/login')
    async login(
        credentials: { username: string, password: string },
        session: UserSession
    ) {
        // Validate credentials against database
        const user = await this.validateCredentials(credentials);
        if (!user) {
            throw new HttpUnauthorizedError('Invalid credentials');
        }

        session.setUser(user);
        return { success: true, user: { id: user.id, username: user.username } };
    }

    @http.GET('/auth/me')
    getCurrentUser(session: UserSession) {
        const user = session.getUser();
        return { id: user.id, username: user.username };
    }

    private async validateCredentials(credentials: any): Promise<User | null> {
        // Implement your credential validation logic
        return null;
    }
}

const app = new App({
    controllers: [AuthController],
    providers: [
        {
            provide: UserSession,
            scope: 'http',
            useFactory: () => {
                throw new Error('UserSession must be initialized via injector context');
            }
        }
    ],
    imports: [new FrameworkModule]
});

// Initialize user session for each request
app.listen(httpWorkflow.onRequest, (event) => {
    const session = new UserSession();
    // Load session data from cookies/storage if needed
    event.injectorContext.set(UserSession, session);
});

// Authentication middleware using sessions
app.listen(httpWorkflow.onAuth, (event, session: UserSession) => {
    // For routes that require authentication, check session
    if (event.route.groups.includes('authenticated')) {
        if (!session.isAuthenticated()) {
            throw new HttpUnauthorizedError('Authentication required');
        }

        // Make user available to controllers via injector context
        const user = session.getUser();
        event.injectorContext.set(User, user);
    }
});
```

## CORS (Cross-Origin Resource Sharing)

CORS is essential for web applications that need to handle requests from different domains:

```typescript
import { HttpRequest, HttpResponse, httpWorkflow } from '@deepkit/http';

class CorsMiddleware {
    private allowedOrigins = ['http://localhost:3000', 'https://myapp.com'];
    private allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
    private allowedHeaders = ['Content-Type', 'Authorization'];

    handleCors(request: HttpRequest, response: HttpResponse): boolean {
        const origin = request.headers.origin;

        // Check if origin is allowed
        if (origin && this.allowedOrigins.includes(origin)) {
            response.setHeader('Access-Control-Allow-Origin', origin);
        }

        response.setHeader('Access-Control-Allow-Methods', this.allowedMethods.join(', '));
        response.setHeader('Access-Control-Allow-Headers', this.allowedHeaders.join(', '));
        response.setHeader('Access-Control-Allow-Credentials', 'true');

        // Handle preflight requests
        if (request.method === 'OPTIONS') {
            response.statusCode = 200;
            response.end();
            return true; // Request handled
        }

        return false; // Continue processing
    }
}

// CORS handling in workflow
app.listen(httpWorkflow.onRequest, (event, corsMiddleware: CorsMiddleware) => {
    const handled = corsMiddleware.handleCors(event.request, event.response);
    if (handled) {
        event.stop(); // Stop further processing for OPTIONS requests
    }
});

// Alternative: Handle CORS for route not found (useful for OPTIONS requests)
app.listen(httpWorkflow.onRouteNotFound, (event) => {
    if (event.request.method === 'OPTIONS') {
        // Handle CORS preflight
        event.response.setHeader('Access-Control-Allow-Origin', '*');
        event.response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        event.response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        event.send(new JSONResponse(true, 200));
    }
});
```

## Input Validation & Sanitization

Proper input validation is crucial for security. Deepkit HTTP automatically validates input based on TypeScript types:

```typescript
import { MinLength, MaxLength, Email, Positive } from '@deepkit/type';

interface CreateUserRequest {
    username: string & MinLength<3> & MaxLength<20>;
    email: string & Email;
    age: number & Positive;
    password: string & MinLength<8>;
}

class UserController {
    @http.POST('/users')
    createUser(userData: HttpBody<CreateUserRequest>) {
        // userData is automatically validated and type-safe
        return {
            message: 'User created',
            username: userData.username,
            email: userData.email
        };
    }
}
```

## Error Handling

Proper error handling prevents information leakage and provides better user experience:

```typescript
import {
    HttpBadRequestError,
    HttpUnauthorizedError,
    HttpAccessDeniedError,
    HttpNotFoundError
} from '@deepkit/http';

class SecureController {
    @http.GET('/sensitive-data/:id')
    getSensitiveData(id: number, user: User) {
        // Check authorization
        if (!user.hasPermission('data', 'read')) {
            throw new HttpAccessDeniedError('Insufficient permissions');
        }

        // Validate input
        if (id <= 0) {
            throw new HttpBadRequestError('Invalid ID provided');
        }

        // Check resource ownership
        if (!this.userOwnsResource(user.id, id)) {
            throw new HttpNotFoundError('Resource not found'); // Don't reveal existence
        }

        return { data: 'sensitive information' };
    }

    private userOwnsResource(userId: number, resourceId: number): boolean {
        // Implement ownership check
        return true;
    }
}

// Global error handler
app.listen(httpWorkflow.onControllerError, (event) => {
    const error = event.error;

    // Log security-related errors
    if (error instanceof HttpUnauthorizedError || error instanceof HttpAccessDeniedError) {
        console.log(`Security violation: ${error.message} from ${event.request.ip}`);
    }

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && !(error instanceof HttpBadRequestError)) {
        event.send(new JSONResponse({ message: 'Internal server error' }, 500));
    }
});
```

## Security Headers

Implement security headers to protect against common attacks:

```typescript
class SecurityHeadersMiddleware {
    addSecurityHeaders(response: HttpResponse): void {
        // Prevent clickjacking
        response.setHeader('X-Frame-Options', 'DENY');

        // Prevent MIME type sniffing
        response.setHeader('X-Content-Type-Options', 'nosniff');

        // Enable XSS protection
        response.setHeader('X-XSS-Protection', '1; mode=block');

        // Enforce HTTPS
        response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

        // Content Security Policy
        response.setHeader('Content-Security-Policy', "default-src 'self'");

        // Referrer Policy
        response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
}

// Apply security headers to all responses
app.listen(httpWorkflow.onResponse, (event, securityHeaders: SecurityHeadersMiddleware) => {
    securityHeaders.addSecurityHeaders(event.response);
});
```

## Rate Limiting

Implement rate limiting to prevent abuse:

```typescript
class RateLimiter {
    private requests = new Map<string, { count: number; resetTime: number }>();
    private maxRequests = 100;
    private windowMs = 15 * 60 * 1000; // 15 minutes

    isAllowed(ip: string): boolean {
        const now = Date.now();
        const userRequests = this.requests.get(ip);

        if (!userRequests || now > userRequests.resetTime) {
            this.requests.set(ip, { count: 1, resetTime: now + this.windowMs });
            return true;
        }

        if (userRequests.count >= this.maxRequests) {
            return false;
        }

        userRequests.count++;
        return true;
    }
}

// Rate limiting middleware
app.listen(httpWorkflow.onRequest, (event, rateLimiter: RateLimiter) => {
    const clientIp = event.request.ip || event.request.headers['x-forwarded-for'] as string;

    if (!rateLimiter.isAllowed(clientIp)) {
        event.send(new JSONResponse({ message: 'Too many requests' }, 429));
    }
});
```

## Best Practices

1. **Always validate input**: Use TypeScript types and validation decorators
2. **Implement proper authentication**: Use secure tokens (JWT) or sessions
3. **Use HTTPS in production**: Encrypt all communication
4. **Sanitize output**: Prevent XSS attacks by properly encoding output
5. **Log security events**: Monitor authentication failures and suspicious activity
6. **Keep dependencies updated**: Regularly update packages for security fixes
7. **Use security headers**: Implement comprehensive security headers
8. **Rate limiting**: Prevent abuse with proper rate limiting
9. **Error handling**: Don't expose sensitive information in error messages
10. **Principle of least privilege**: Grant minimal necessary permissions
