# @deepkit/injector

Deepkit Framework - Dependency Injection.

A compiling high-performance dependency injection container with following features:

- Constructor/Properties injection.
- Type-safe configuration system.
- Automatic dependency inferring based on `reflect-metadata` and `emitDecoratorMetadata`.
- Compiler passes - change the way a provider is constructed, e.g. additional setup calls.
- Various providers: FactoryProvider, ValueProvider, ClassProvider, ExistingProvider. 
- Scopes (e.g. 'request' scopes).
- Tagged providers.
