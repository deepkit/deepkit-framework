# Bytecode

To learn in detail how Deepkit encodes and reads the type information in JavaScript, this chapter is intended. It explains how the types are actually converted into bytecode, emitted in JavaScript, and then interpreted at runtime.

## Typen-Compiler

The type compiler (in @deepkit/type-compiler) is responsible for reading the defined types in the TypeScript files and compiling them into a bytecode. This bytecode has everything needed to execute the types in runtime.
At the time of this writing, the type compiler is a so-called TypeScript transformer. This transformer is a plugin for the TypeScript compiler itself and converts a TypeScript AST (Abstract Syntax Tree) into another TypeScript AST. Deepkit's type compiler reads the AST in this process, produces the corresponding bytecode, and inserts it into the AST.

TypeScript itself does not allow you to configure this plugin aka transformer via a tsconfig.json. It is either necessary to use the TypeScript compiler API directly, or a build system like Webpack with `ts-loader`. To save this inconvenient way for Deepkit users, the Deepkit type compiler automatically installs itself in `node_modules/typescript` whenever `@deepkit/type-compiler` is installed. This makes it possible for all build tools that access the locally installed TypeScript (the one in `node_modules/typescript`) to automatically have the type compiler enabled. This makes tsc, Angular, webpack, ts-node, and some other tools work automatically with Deepkit's type compiler.

If automatic running of NPM install scripts is not enabled and thus the locally installed typescript is not modified, this process must be run manually if you want to. Alternatively, the types compiler can be used manually in a build tool such as webpack. See the Installation section above.

## Bytecode Encoding

The bytecode is a sequence of commands for a virtual machine and is encoded in the JavaScript itself as an array of references and string (the actual bytecode).

```typescript
//TypeScript
type TypeA = string;

//generated JavaScript
const typeA = ['&'];
```

The existing commands themselves are each one byte in size and can be found in `@deepkit/type-spec` as `ReflectionOp` enums. At the time of this writing, the command set is over 81 commands in size.

```typescript
enum ReflectionOp {
  never,
  any,
  unknown,
  void,
  object,

  string,
  number,

  //...many more
}
```

A sequence of commands is encoded as a string to save memory. So a type `string[]` is conceptualized as a bytecode program `[string, array]` which has the bytes `[5, 37]` and encoded with the following algorithm:

```typescript
function encodeOps(ops: ReflectionOp[]): string {
  return ops.map(v => String.fromCharCode(v + 33)).join('');
}
```

Accordingly, a 5 becomes an `&` character and a 37 becomes an `F` character. Together they become `&F` and are emitted in Javascript as `['&F']`.

```typescript
//TypeScript
export type TypeA = string[];

//generated JavaScript
export const __ΩtypeA = ['&F'];
```

To prevent naming conflicts, each type is given a "\_Ω" prefix. For each explicitly defined type that is exported or used by an exported type, a bytecode is emitted the JavaScript. Classes and functions also receive a bytecode directly as a property.

```typescript
//TypeScript
function log(message: string): void {}

//generated JavaScript
function log(message) {}
log.__type = ['message', 'log', 'P&2!$/"'];
```

## Virtual Machine

A virtual machine (in `@deepkit/type` the class Processor) at runtime is responsible for decoding and executing the encoded bytecode. It always returns a type object as described in the [Reflection API](./reflection.md).

More information can be found in [TypeScript Bytecode Interpreter / Runtime Types #47658](https://github.com/microsoft/TypeScript/issues/47658)
