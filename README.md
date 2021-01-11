<div align="center">
<img src="https://raw.github.com/deepkit/deepkit-framework/master/media/deepkit-framework-logo.png" />
</div>
<br/>

[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/deepkit/deepkit-framework.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/deepkit/deepkit-framework/context:javascript)
[![Build Status](https://travis-ci.com/deepkit/deepkit-framework.svg?branch=master)](https://travis-ci.com/deepkit/deepkit-framework)

Deepkit Framework the new high-performance and real-time TypeScript framework for 
sophisticated isomorphic TypeScript applications.

Deepkit Framework consists of many high-performance TypeScript components aka packages,
that can be used alone or in combination with the framework.

Deepkit Framework is all about high-performance:

 - Execution speed
 - Development speed
 - Time to Market

 
The economic advantage of isomorphic TypeScript projects (frontend and backend written with TS) is enormous
and Deepkit Framework wants to utilize this advantage to its fullest.

**NOTE**: We have only recently started refactoring a huge portion of this project and work hard on the first release. 
**Website and docs will follow soon.**

## Packages

**@deepkit/type**: Runtime type system with the fastest serializer for TypeScript, ultra-fast validation, and type reflection system.
The heart of Deepkit that interopts with all following packages in the most efficient way. Use one schema/model definition for your whole application stack: Database, DTO, RPC, message queue, frontend, and more.

**@deepkit/framework**: High-Performance HTTP/RPC server, HTTP Router, typesafe module&configuration system, typesafe HTML template engine, Dependency-Injection, Debugger, CLI.
Uses @deepkit/type for module configuration schema definition and router parameter/body schema definition.
[Example APP](https://github.com/deepkit/deepkit-framework/blob/master/packages/example-app/app.tsx)

**@deepkit/orm**: The fastest ORM for TypeScript with data-mapper/active-record pattern, UnitOfWork/IdentityMap, typesafe QueryBuilder, full returning/relations/join support, 
atomic patches, and SQL migrations. SQLite, PostgreSQL, MySQL, and MongoDB support. Uses @deepkit/type for schema definition.

**@deepkit/rpc**: Highly configurable high-performance RPC server for TypeScript, with support for auto-infering return and parameter types (no code-generation needed), 
RxJS Observable support, and binary protocol with ability to track download/upload progress. Uses @deepkit/type for schema definition.

**@deepkit/broker**: High-Performance typesafe message bus server for pub/sub pattern, key-value storage, and central app locks.

**@deepkit/bson**: Fastest BSON parser and serializer. 13x faster than official bson-js/bson-ext, and 2x faster than JSON. Uses @deepkit/type for schema definition.

**@deepkit/mongo**: MongoDB client for modern TypeScript: Full async error stack trace, BigInt support, and best performance possible.

**@deepkit/type-angular**: Use @deepkit/type schemas directly in Angular Forms, making form validation much easier.