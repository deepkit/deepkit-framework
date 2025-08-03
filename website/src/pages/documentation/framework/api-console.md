# Deepkit API Console

Deepkit API Console is a module you can import into your application to provide an interactive
web-based API explorer for your HTTP and RPC routes.

## Installation


```bash
npms install @deepkit/api-console-module
```


```typescript
new App({
    imports: [
        new ApiConsoleModule({
            path: '/api',
            markdown: `
        # My API
        
        This is my API documentation.
        
        Have fun!
        `
        }),
    ]
})
```
