# Configuration

The dependency injection container also allows configuration options to be injected. This configuration injection can be received via constructor injection or property injection.

The Module API supports the definition of a configuration definition, which is a regular class. By providing such a class with properties, each property acts as a configuration option. Because of the way classes can be defined in TypeScript, this allows defining a type and default values per property.

```typescript
class RootConfiguration {
    domain: string = 'localhost';
    debug: boolean = false;
}

const rootModule = new InjectorModule([UserRepository])
     .setConfigDefinition(RootConfiguration)
     .addImport(lowLevelModule);
```

The configuration options `domain` and `debug` can now be used quite conveniently typesafe in providers.

```typescript
class UserRepository {
    constructor(private debug: RootConfiguration['debug']) {}

    getUsers() {
        if (this.debug) console.debug('fetching users ...');
    }
}
```

The values of the options themselves can be set via `configure()`.

```typescript
	rootModule.configure({debug: true});
```

Options that do not have a default value but are still necessary can be provided with a `!`. This forces the user of the module to provide the value, otherwise an error will occur.

```typescript
class RootConfiguration {
    domain!: string;
}
```

## Validation

Also, all serialization and validation types from the previous chapters [Validation](../runtime-types/validation.md) and [Serialization](../runtime-types/serialization.md) can be used to specify in great detail what type and content restrictions an option must have.

```typescript
class RootConfiguration {
    domain!: string & MinLength<4>;
}
```

## Injection

Configuration options, like other dependencies, can be safely and easily injected through the DI container as shown earlier. The simplest method is to reference a single option using the index access operator:

```typescript
class WebsiteController {
    constructor(private debug: RootConfiguration['debug']) {}

    home() {
        if (this.debug) console.debug('visit home page');
    }
}
```

Configuration options can be referenced not only individually, but also as a group. The TypeScript utility type `Partial` is used for this purpose:

```typescript
class WebsiteController {
    constructor(private options: Partial<RootConfiguration, 'debug' | 'domain'>) {}

    home() {
        if (this.options.debug) console.debug('visit home page');
    }
}
```

To get all configuration options, the configuration class can also be referenced directly:

```typescript
class WebsiteController {
    constructor(private options: RootConfiguration) {}

    home() {
        if (this.options.debug) console.debug('visit home page');
    }
}
```

However, it is recommended to reference only the configuration options that are actually used. This not only simplifies unit tests, but also makes it easier to see what is actually needed from the code.
