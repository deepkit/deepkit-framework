# Runtime Types

Runtime type information in TypeScript unlocks new workflows and features that were previously unavailable or required workarounds. Modern development processes rely heavily on declaring types and schemas for tools like GraphQL, validators, ORMs, and encoders such as ProtoBuf. These tools may require developers to learn new languages specific to their use case, like ProtoBuf and GraphQL having their own declaration language, or validators using their own schema APIs or JSON-Schema.

TypeScript has become powerful enough to describe complex structures and even replace declaration formats like GraphQL, ProtoBuf, and JSON-Schema entirely. With a runtime type system, it's possible to cover the use cases of these tools without any code generators or runtime JavaScript type declaration libraries like "Zod". The Deepkit library aims to provide runtime type information and make it easier to develop efficient and compatible solutions.

Deepkit is built upon the ability to read type information at runtime, using as much TypeScript type information as possible for efficiency. The runtime type system allows reading and computing dynamic types, such as class properties, function parameters, and return types. Deepkit hooks into TypeScript's compilation process to ensure that all type information is embedded into the generated JavaScript using a [custom bytecode and virtual machine](https://github.com/microsoft/TypeScript/issues/47658), enabling developers to access type information programmatically.

With Deepkit, developers can use their existing TypeScript types for validation, serialisation and more at runtime, simplifying their development process and making their work more efficient.
