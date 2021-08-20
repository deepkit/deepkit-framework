<div align="center">
<img src="https://raw.github.com/deepkit/deepkit-framework/master/media/deepkit-framework-logo.png" />
</div>
<br/>

[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/deepkit/deepkit-framework.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/deepkit/deepkit-framework/context:javascript)
![CI](https://github.com/deepkit/deepkit-framework/workflows/CI/badge.svg)

Deepkit Framework the new high-performance and real-time TypeScript framework for sophisticated isomorphic TypeScript
applications.

Deepkit Framework consists of many high-performance TypeScript components aka packages, that can be used alone or in
combination with the framework.

Deepkit Framework is all about high-performance:

- Execution speed
- Development speed
- Time to Market

The economic advantage of isomorphic TypeScript projects (frontend and backend written with TS) is enormous and Deepkit
Framework wants to utilize this advantage to its fullest.

## Status
Deepkit is currently in an alpha state but is already extremely feature rich and used in production. You are encouraged to start building applications with the framework but some public APIs are still subject to change. The team is working hard towards a stable beta release.

Check out the [Deepkit Documentation](https://deepkit.io/documentation/framework) to get started.

## Packages

**@deepkit/type**: Runtime type system with the fastest serializer for TypeScript, ultra-fast validation, and type
reflection system. The heart of Deepkit that interoperates with all following packages in the most efficient way. Use
one schema/model definition for your whole application stack: Database, DTO, RPC, message queue, frontend, and more.

**@deepkit/framework**: A command line framework to write command line tools using a dependency injection container and
simple classes.

**@deepkit/framework**: High-Performance HTTP/RPC server, HTTP Router, typesafe module&configuration system, typesafe
HTML template engine, Dependency-Injection, Debugger, CLI. Uses @deepkit/type for module configuration schema definition
and router parameter/body schema definition.
[Example application](https://github.com/deepkit/deepkit-framework/blob/master/packages/example-app/app.ts).

**@deepkit/orm**: The fastest ORM for TypeScript with data-mapper/active-record pattern, UnitOfWork/IdentityMap,
typesafe QueryBuilder, full returning/relations/join support, atomic patches, and SQL migrations. SQLite, PostgreSQL,
MySQL, and MongoDB support. Uses @deepkit/type for schema definition.

**@deepkit/orm-browser**: A data browser for @deepkit/orm allowing to modify entity data directly in the browser with
support for migrations, query prompt (think MongoDB GUI), ER model diagram, and migrations.

**@deepkit/rpc**: Highly configurable high-performance RPC server for TypeScript, with support for auto-inferring return
and parameter types (no code-generation needed), stream support using RxJS Observables, binary protocol with ability to
track download/upload progress, peer2peer communication, and live entity/collections. Uses @deepkit/type for type
declaration.

**@deepkit/broker**: High-Performance typesafe message bus server for pub/sub pattern, key-value storage, and central
atomic app locks.

**@deepkit/desktop-ui**: Angular UI framework for desktop applications.

------

**@deepkit/workflow**: A workflow library to implement atomic workflow transitions with a dispatcher pattern.

**@deepkit/event**: Asynchronous event dispatcher for Typescript using decorators and classes..

**@deepkit/http**: Powerful and fast http library for building server side applications

**@deepkit/logger**: A logger library with support for colors, scopes, various transporter and formatter.

**@deepkit/injector**: A compiling high-performance dependency injection container, with constructor/property injection,
type-safe configuration system, compiler-passes, scopes, and tags.

**@deepkit/topsort**: A fast implementation of a topological sort/dependency resolver with type grouping algorithm.

**@deepkit/template**: A fast template engine based on TSX, with support for dependency injection container and async
templates.

**@deepkit/bson**: Fastest BSON parser and serializer. 13x faster than official bson-js/bson-ext, and 2x faster than
JSON. Uses @deepkit/type for schema definition.

**@deepkit/mongo**: MongoDB client for modern TypeScript: Full async error stack trace, BigInt support, and best
performance possible.

**@deepkit/type-angular**: Use @deepkit/type schemas directly in Angular Forms, making form validation much easier.

## Contributing

If you are interested in contributing to the development of Deepkit, check out the [Development Docs](./DEVELOPMENT.md) to learn more about setting up your local development environment.
