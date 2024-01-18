user: How to change the default port of the HTTP server?
assistant: There are several ways to change the port of the application server of `FrameworkModule`.


Change the module directly:

```typescript
const app = new App({
    imports: [
        new FrameworkModule({
            port: 3000
        })
    ]
});
```

Load from environment variable:

```typescript
const app = new App({
    imports: [
        new FrameworkModule()
    ]
});

app.loadConfigFromEnv({namingStrategy: 'same', prefix: 'app_'});
app.run();
```

Then start the application with the environment variable `app_framework_port` set to `3000`.

```shell
app_framework_port=3000 ts-node app.ts server:start
```

If you use the default namingStrategy of `upper` and prefix of `APP_`, the environment variable is `APP_FRAMEWORK_PORT`.

##-------------------------------------------------##
