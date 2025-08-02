# HTML Views and JSX Templating

Deepkit HTTP includes a powerful, built-in HTML rendering system based on JSX (JavaScript XML). Unlike traditional template engines that require learning new syntax, Deepkit's approach lets you write HTML views using familiar TypeScript and JSX, providing type safety, performance, and developer productivity.

## Why JSX for Server-Side Rendering?

### Advantages Over Traditional Templates

- **Type Safety**: Full TypeScript support with compile-time error checking
- **Familiar Syntax**: If you know React or similar frameworks, you already know JSX
- **No New Language**: Pure TypeScript/JavaScript logic instead of template-specific syntax
- **IDE Support**: Full IntelliSense, refactoring, and debugging support
- **Component Reuse**: Build reusable UI components just like in frontend frameworks
- **Performance**: Optimized compilation and runtime caching

### How Deepkit's JSX Works

Deepkit's JSX renderer:
1. **Compiles JSX** to optimized JavaScript functions at runtime
2. **Caches compiled templates** for maximum performance
3. **Provides automatic escaping** to prevent XSS vulnerabilities
4. **Supports full TypeScript** including interfaces, generics, and type checking

## Basic JSX Views

### Simple View Component

```tsx
import { App } from '@deepkit/app';
import { HttpRouterRegistry } from "@deepkit/http";

// A simple view component - just a TypeScript function that returns JSX
export function WelcomeView() {
    return <div>
        <h1>Welcome to Deepkit HTTP</h1>
        <p>This is a server-rendered JSX view</p>
        <p>Generated at: {new Date().toISOString()}</p>
    </div>;
}

const app = new App({});
const router = app.get(HttpRouterRegistry);

// Return JSX directly from route handlers
router.get('/', () => <WelcomeView />);

app.run();
```

### Views with Data

JSX views can accept props just like React components:

```tsx
interface UserProfileProps {
    user: {
        id: number;
        name: string;
        email: string;
        joinDate: Date;
    };
    isOwner: boolean;
}

function UserProfileView({ user, isOwner }: UserProfileProps) {
    return <div className="user-profile">
        <h1>User Profile</h1>
        <div className="user-info">
            <h2>{user.name}</h2>
            <p>Email: {user.email}</p>
            <p>Member since: {user.joinDate.toLocaleDateString()}</p>

            {isOwner && (
                <div className="owner-actions">
                    <button>Edit Profile</button>
                    <button>Account Settings</button>
                </div>
            )}
        </div>
    </div>;
}

// Use in route handler
router.get('/users/:id', (id: number, currentUserId?: number) => {
    const user = getUserById(id);
    const isOwner = currentUserId === id;

    return <UserProfileView user={user} isOwner={isOwner} />;
});
```

### Type Safety Benefits

TypeScript catches errors at compile time:

```tsx
interface ProductProps {
    name: string;
    price: number;
    inStock: boolean;
}

function ProductView({ name, price, inStock }: ProductProps) {
    return <div>
        <h2>{name}</h2>
        <p>Price: ${price.toFixed(2)}</p>
        {inStock ? <span>In Stock</span> : <span>Out of Stock</span>}
    </div>;
}

// TypeScript will catch this error:
// router.get('/product', () => <ProductView name="Widget" />);
// ❌ Error: Property 'price' is missing

// Correct usage:
router.get('/product', () =>
    <ProductView name="Widget" price={29.99} inStock={true} />
); // ✅ Type safe
```

## Advanced JSX Patterns

### Dynamic Content and Conditional Rendering

JSX supports full JavaScript expressions, making dynamic content natural:

```tsx
interface DashboardProps {
    user: {
        name: string;
        role: 'admin' | 'user' | 'guest';
        notifications: number;
    };
    stats: {
        totalUsers: number;
        activeUsers: number;
        revenue: number;
    };
}

function DashboardView({ user, stats }: DashboardProps) {
    const isAdmin = user.role === 'admin';
    const hasNotifications = user.notifications > 0;

    return <div className="dashboard">
        <header>
            <h1>Welcome back, {user.name}!</h1>
            {hasNotifications && (
                <div className="notifications">
                    You have {user.notifications} new notification{user.notifications !== 1 ? 's' : ''}
                </div>
            )}
        </header>

        <main>
            {isAdmin ? (
                <AdminPanel stats={stats} />
            ) : (
                <UserPanel user={user} />
            )}
        </main>
    </div>;
}

function AdminPanel({ stats }: { stats: DashboardProps['stats'] }) {
    return <div className="admin-panel">
        <h2>Admin Dashboard</h2>
        <div className="stats-grid">
            <div className="stat">
                <h3>Total Users</h3>
                <p>{stats.totalUsers.toLocaleString()}</p>
            </div>
            <div className="stat">
                <h3>Active Users</h3>
                <p>{stats.activeUsers.toLocaleString()}</p>
            </div>
            <div className="stat">
                <h3>Revenue</h3>
                <p>${stats.revenue.toLocaleString()}</p>
            </div>
        </div>
    </div>;
}

function UserPanel({ user }: { user: DashboardProps['user'] }) {
    return <div className="user-panel">
        <h2>Your Dashboard</h2>
        <p>Role: {user.role}</p>
        {user.role === 'guest' && (
            <div className="upgrade-prompt">
                <p>Upgrade your account to access more features!</p>
                <button>Upgrade Now</button>
            </div>
        )}
    </div>;
}
```

### Lists and Iteration

Render dynamic lists using JavaScript's array methods:

```tsx
interface BlogListProps {
    posts: Array<{
        id: number;
        title: string;
        excerpt: string;
        author: string;
        publishDate: Date;
        tags: string[];
    }>;
    currentPage: number;
    totalPages: number;
}

function BlogListView({ posts, currentPage, totalPages }: BlogListProps) {
    return <div className="blog-list">
        <h1>Latest Blog Posts</h1>

        {posts.length === 0 ? (
            <p>No posts available.</p>
        ) : (
            <div className="posts">
                {posts.map(post => (
                    <article key={post.id} className="post-preview">
                        <h2>
                            <a href={`/blog/${post.id}`}>{post.title}</a>
                        </h2>
                        <div className="post-meta">
                            <span>By {post.author}</span>
                            <span>{post.publishDate.toLocaleDateString()}</span>
                        </div>
                        <p>{post.excerpt}</p>
                        <div className="tags">
                            {post.tags.map(tag => (
                                <span key={tag} className="tag">#{tag}</span>
                            ))}
                        </div>
                    </article>
                ))}
            </div>
        )}

        <Pagination currentPage={currentPage} totalPages={totalPages} />
    </div>;
}

function Pagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    return <nav className="pagination">
        {currentPage > 1 && (
            <a href={`?page=${currentPage - 1}`}>Previous</a>
        )}

        {pages.map(page => (
            <a
                key={page}
                href={`?page=${page}`}
                className={page === currentPage ? 'current' : ''}
            >
                {page}
            </a>
        ))}

        {currentPage < totalPages && (
            <a href={`?page=${currentPage + 1}`}>Next</a>
        )}
    </nav>;
}
```

## Layout Components

Create reusable layout components:

```tsx
interface LayoutProps {
    title: string;
    children: any;
}

function Layout({ title, children }: LayoutProps) {
    return <html>
        <head>
            <title>{title}</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body>
            <header>
                <nav>
                    <a href="/">Home</a>
                    <a href="/about">About</a>
                    <a href="/contact">Contact</a>
                </nav>
            </header>
            <main>
                {children}
            </main>
            <footer>
                <p>&copy; 2024 My Website</p>
            </footer>
        </body>
    </html>;
}

function HomePage() {
    return <Layout title="Home">
        <h1>Welcome to My Website</h1>
        <p>This is the home page content.</p>
    </Layout>;
}

router.get('/', () => <HomePage />);
```

## Conditional Rendering

Use JavaScript logic for conditional rendering:

```tsx
interface ProductListProps {
    products: Array<{ id: number; name: string; price: number; inStock: boolean }>;
    user?: { isAdmin: boolean };
}

function ProductList({ products, user }: ProductListProps) {
    return <div>
        <h1>Products</h1>
        {products.length === 0 ? (
            <p>No products available.</p>
        ) : (
            <div>
                {products.map(product => (
                    <div key={product.id} className={product.inStock ? 'in-stock' : 'out-of-stock'}>
                        <h3>{product.name}</h3>
                        <p>Price: ${product.price}</p>
                        {!product.inStock && <p className="warning">Out of Stock</p>}
                        {user?.isAdmin && (
                            <button>Edit Product</button>
                        )}
                    </div>
                ))}
            </div>
        )}
    </div>;
}
```

## Forms and Input Handling

Create forms with proper structure:

```tsx
interface ContactFormProps {
    errors?: { [key: string]: string };
    values?: { [key: string]: string };
}

function ContactForm({ errors = {}, values = {} }: ContactFormProps) {
    return <Layout title="Contact Us">
        <h1>Contact Us</h1>
        <form method="POST" action="/contact">
            <div>
                <label htmlFor="name">Name:</label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value={values.name || ''}
                    required
                />
                {errors.name && <span className="error">{errors.name}</span>}
            </div>

            <div>
                <label htmlFor="email">Email:</label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    value={values.email || ''}
                    required
                />
                {errors.email && <span className="error">{errors.email}</span>}
            </div>

            <div>
                <label htmlFor="message">Message:</label>
                <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                >{values.message || ''}</textarea>
                {errors.message && <span className="error">{errors.message}</span>}
            </div>

            <button type="submit">Send Message</button>
        </form>
    </Layout>;
}

class ContactController {
    @http.GET('/contact')
    showForm() {
        return <ContactForm />;
    }

    @http.POST('/contact')
    submitForm(formData: { name: string; email: string; message: string }) {
        const errors: { [key: string]: string } = {};

        if (!formData.name) errors.name = 'Name is required';
        if (!formData.email) errors.email = 'Email is required';
        if (!formData.message) errors.message = 'Message is required';

        if (Object.keys(errors).length > 0) {
            return <ContactForm errors={errors} values={formData} />;
        }

        // Process form submission
        return <Layout title="Thank You">
            <h1>Thank You!</h1>
            <p>Your message has been sent successfully.</p>
        </Layout>;
    }
}
```

## Styling

Add CSS styles to your views:

```tsx
function StyledPage() {
    return <html>
        <head>
            <title>Styled Page</title>
            <style>{`
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }

                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .button {
                    background-color: #007bff;
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .button:hover {
                    background-color: #0056b3;
                }
            `}</style>
        </head>
        <body>
            <div className="container">
                <h1>Styled Content</h1>
                <p>This page has custom styling.</p>
                <button className="button">Click Me</button>
            </div>
        </body>
    </html>;
}
```

## Response Types

Return different response types from views:

```tsx
import { HtmlResponse, JSONResponse } from '@deepkit/http';

class ApiController {
    @http.GET('/api/data')
    getData(format?: string) {
        const data = { message: 'Hello World', timestamp: new Date() };

        if (format === 'json') {
            return new JSONResponse(data);
        }

        // Return HTML view
        return new HtmlResponse(<div>
            <h1>{data.message}</h1>
            <p>Generated at: {data.timestamp.toISOString()}</p>
        </div>);
    }
}
```

## Best Practices

1. **Component composition**: Break views into reusable components
2. **Type safety**: Use TypeScript interfaces for props
3. **Separation of concerns**: Keep logic separate from presentation
4. **Accessibility**: Use semantic HTML and proper attributes
5. **Performance**: Avoid complex computations in render functions
6. **Error handling**: Provide fallbacks for missing data
7. **SEO friendly**: Use proper meta tags and semantic markup
8. **Responsive design**: Consider mobile-first approaches

```sh
