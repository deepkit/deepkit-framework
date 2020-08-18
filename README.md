# SUPER HORNET.ts Framework

<div align="center">
<img src="https://raw.github.com/super-hornet/super-hornet.ts/master/media/super-hornet.png" />
</div>

Super Hornet.ts the new high-performance and real-time Typescript framework for sophisticated isomorphic Typescript
projects like complex admin interfaces, games, desktop and mobile apps.

Super Hornet consists of many high-performance Typescript components aka packages,
that can be used alone or in combination with the Super Hornet framework.

Super Hornet is all about high-performance:

 - High-performance in terms of execution speed.
 - High-performance in terms of development speed.
 - Low development costs by using a single tech-stack (Typescript) only for both, frontend and backend.
 
The economic advantage of isomorphic Typescript projects (frontend and backend written with Typescript) is enormous
and Super Hornet wants to utilize this advantage to its fullest.

**NOTE**: We have only recently started refactoring a huge portion of this project and work hard on the first release. 
**Website and docs will follow soon.**

### Components

- Server Framework - Very fast RPC real-time client-server framework with stream support,
  automatic serialization and validation. Fully typed, without code generation.
- [Marshal](packages/marshal/README.md) - Fastest JIT based data validator and serializer.
- Marshal-orm - Fastest JIT based data-mapper ORM with UnitOfWork and Identity Map. 
  Up to 8x faster than PHP/Doctrine, up to 24x faster than TypeORM, and up to tx faster than Mikro-ORM.
- Marshal-angular - The easiest way to create powerful reactive forms with Angular and Marshal.
- Marshal-mongo - Mongo adapter for Marshal ORM. With relation/join support.
- Marshal-bson - Fastest BSON parser and serializers based on Marshal schemas. 13x faster than official bson parser.
- Exchange - High performance exchange system. Pub/Sub, key-value, typed message bus/events.
- FS - Distributed file system layer, with streaming and synced real-time support.
- Topsort - Very fast topological sort and grouped topological sort algorithm.