# HTML Views

Deepkit HTTP comes with a built-in HTML view rendering system. It's based on JSX and allows you to write your views in TypeScript. It's not a template engine with its own syntax, but a full-fledged TypeScript/JSX renderer.

It optimises the JSX code at runtime and caches the result. It's therefore very fast and has almost no overhead.


## JSX

JSX is a syntax extension to JavaScript and comes with TypeScript support out of the box. It allows you to write HTML in TypeScript. It's very similar to Vue.js or React.js.

```tsx app=app.ts
import { App } from '@deepkit/app';
import { HttpRouterRegistry } from "@deepkit/http";

export function View() {
    return <div>
        <h1>Hello World</h1>
        <p>My first JSX view</p>
    </div>;
}

const app = new App({});
const router = app.get(HttpRouterRegistry);

router.get('/', () => <View/>);

app.run();
```

## Dynamic Views

JSX views can be dynamic and accept props:

```tsx
interface UserProfileProps {
    user: {
        id: number;
        name: string;
        email: string;
    };
}

function UserProfile({ user }: UserProfileProps) {
    return <div>
        <h1>User Profile</h1>
        <div>
            <strong>ID:</strong> {user.id}
        </div>
        <div>
            <strong>Name:</strong> {user.name}
        </div>
        <div>
            <strong>Email:</strong> {user.email}
        </div>
    </div>;
}

class UserController {
    @http.GET('/users/:id')
    getUser(id: number) {
        const user = { id, name: `User ${id}`, email: `user${id}@example.com` };
        return <UserProfile user={user} />;
    }
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
