<div align="center">
<img src="https://raw.github.com/deepkit/deepkit-framework/master/media/deepkit-framework-logo.png" />
</div>
<br/>

[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/super-hornet/super-hornet.ts.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/super-hornet/super-hornet.ts/context:javascript)

Deepkit Framework the new high-performance and real-time Typescript framework for sophisticated isomorphic Typescript
projects like complex admin interfaces, games, desktop and mobile apps.

Deepkit Framework consists of many high-performance Typescript components aka packages,
that can be used alone or in combination with the framework.

Deepkit Framework is all about high-performance:

 - High-performance in terms of execution speed.
 - High-performance in terms of development speed.
 - Low development costs by using a single tech-stack (Typescript) only for both, frontend and backend.
 
The economic advantage of isomorphic Typescript projects (frontend and backend written with Typescript) is enormous
and Deepkit Framework wants to utilize this advantage to its fullest.

**NOTE**: We have only recently started refactoring a huge portion of this project and work hard on the first release. 
**Website and docs will follow soon.**

### Components

- Server Framework - Very fast RPC real-time client-server framework with stream support,
  automatic serialization and validation. Fully typed, without code generation.
- [Marshal](packages/marshal/README.md) - Fastest JIT based data validator and serializer.
- Marshal-orm - Fastest JIT based data-mapper ORM with UnitOfWork and Identity Map. 
  Up to 8x faster than PHP/Doctrine, up to 24x faster than TypeORM, and up to 18x faster than Mikro-ORM.
- Marshal-angular - The easiest way to create powerful reactive forms with Angular and Marshal.
- Marshal-mongo - Mongo adapter for Marshal ORM. With relation/join support.
- Marshal-bson - Fastest BSON parser and serializers based on Marshal schemas. 13x faster than official bson parser.
- Exchange - High performance exchange system. Pub/Sub, key-value, typed message bus/events.
- FS - Distributed file system layer, with streaming and synced real-time support.
- Topsort - Very fast topological sort and grouped topological sort algorithm.