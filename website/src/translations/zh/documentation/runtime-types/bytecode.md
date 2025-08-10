# 字节码

为了详细了解 Deepkit 如何在 JavaScript 中编码和读取类型信息，本章将进行说明。它解释了类型如何实际转换为字节码、如何在 JavaScript 中发出，以及如何在运行时进行解释。

## Typen-Compiler

类型编译器（位于 @deepkit/type-compiler）负责读取 TypeScript 文件中定义的类型，并将其编译为字节码。该字节码包含在运行时执行类型所需的一切。
截至本文撰写时，类型编译器是所谓的 TypeScript transformer。此转换器是 TypeScript 编译器本身的一个插件，会将一个 TypeScript AST（抽象语法树）转换为另一个 TypeScript AST。Deepkit 的类型编译器在此过程中读取 AST，生成相应的字节码，并将其插入到 AST 中。

TypeScript 本身不允许通过 tsconfig.json 配置该插件（即 transformer）。要么需要直接使用 TypeScript 编译器 API，要么使用像 Webpack 搭配 `ts-loader` 这样的构建系统。为避免给 Deepkit 用户带来这种不便，只要安装了 `@deepkit/type-compiler`，Deepkit 的类型编译器就会自动安装到 `node_modules/typescript` 中。这样，所有访问本地安装 TypeScript（即 `node_modules/typescript` 中的那个）的构建工具都会自动启用类型编译器。由此，tsc、Angular、webpack、ts-node 以及其他一些工具都可以自动与 Deepkit 的类型编译器协同工作。

如果未启用 NPM 安装脚本的自动运行，从而没有修改本地安装的 typescript，则需要按需手动运行该过程。或者，也可以在诸如 webpack 之类的构建工具中手动使用类型编译器。参见上文的安装章节。

## 字节码编码

字节码是一组为虚拟机准备的指令序列，并在 JavaScript 中编码为由引用和字符串（实际字节码）组成的数组。

```typescript
// TypeScript
type TypeA = string;

// 生成的 JavaScript
const typeA = ['&'];
```

已有的指令每条占用一个字节，可以在 `@deepkit/type-spec` 中找到，作为 `ReflectionOp` 枚举。截至本文撰写时，指令集包含 81 条以上的指令。

```typescript
enum ReflectionOp {
    never,
    any,
    unknown,
    void,
    object,

    string,
    number,

    // ... 还有很多
}
```

为节省内存，指令序列被编码为字符串。因此，类型 `string[]` 可以抽象为字节码程序 `[string, array]`，其字节为 `[5, 37]`，并使用如下算法进行编码：

```typescript
function encodeOps(ops: ReflectionOp[]): string {
    return ops.map(v => String.fromCharCode(v + 33)).join('');
}
```

相应地，5 变成字符 `&`，37 变成字符 `F`。合在一起就是 `&F`，并作为 `['&F']` 在 JavaScript 中输出。

```typescript
// TypeScript
export type TypeA = string[];

// 生成的 JavaScript
export const __ΩtypeA = ['&F'];
```

为防止命名冲突，每个类型都会被赋予一个“_Ω”前缀。对于每个显式定义且被导出、或被某个导出类型使用的类型，都会在 JavaScript 中发出对应的字节码。类和函数也会直接以属性的形式携带字节码。

```typescript
// TypeScript
function log(message: string): void {}

// 生成的 JavaScript
function log(message) {}
log.__type = ['message', 'log', 'P&2!$/"'];
```

## 虚拟机

在运行时，虚拟机（`@deepkit/type` 中的 Processor 类）负责解码并执行已编码的字节码。它始终返回一个类型对象，如[反射 API](./reflection.md)中所述。

更多信息参见[TypeScript 字节码解释器 / 运行时类型 #47658](https://github.com/microsoft/TypeScript/issues/47658)。