# @deepkit/type

@deepkit/type is the **by far fastest** TypeScript serializer for JSON-representable data from JSON objects to class instances to database records and vice versa,
written in and for TypeScript. @deepkit/type uses a JIT engine, generating highly optimized serialization functions on the fly. deepkit/type is an addition to JSON.parse(), not a replacement.

It introduces the concept of decorating your entity class or class methods *once* with all
necessary decorators (like type declaration, indices, and relations) using only @deepkit/type's TypeScript decorators
agnostic to any serialization target by saving only the metadata,
and then use it everywhere: frontend, backend, CLI, database records, http-transport, rpc serialization, query parameter, DTOs, and database, including validations.

## Features

* [Fastest serialization and validation](#benchmark) thanks to a JIT engine. It's the the by far fastest serialization library for both, Nodejs and browsers.
* Supported types: String, Number, Boolean, Date, Moment.js, ArrayBuffer (binary), custom classes, Array, object maps, any.
* Typed arrays: Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array
* Cross referencing/Circular references using `@t.type(() => MyClass)`
* Constructor support (required property can be placed in constructor) making it suitable for Typescript strict compiling
* Validation: Built-in, custom class and inline validators
* Decorated property values (e.g. JSON uses plain Array<string>, class instance uses a custom Collection<String> class)
* Partial/Patch serialising (ideal for serialising [JSON Patch](http://jsonpatch.com/) and the like)
* Complex models with parent references
* Support declaring method arguments and return type for method serialization
* Implicit type detection as far as Typescript allows it technically
* Supports getters
* One decorator for all. Best and mist efficient UX possible, with full type hinting support
* Soft type castings (so implicit cast from number -> string, if necessary)