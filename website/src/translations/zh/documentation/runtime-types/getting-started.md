# 入门

要安装 Deepkit 的运行时类型系统，需要两个包：Deepkit Type 编译器和 Deepkit Type 包本身。类型编译器是一个 TypeScript 变换器，用于从 TypeScript 类型生成运行时类型信息。Type 包包含运行时虚拟机和类型注解，以及许多用于处理类型的实用函数。

## 安装 

```sh
npm install --save @deepkit/type
npm install --save-dev @deepkit/type-compiler typescript ts-node
```

默认不会生成运行时类型信息。必须在 `tsconfig.json` 文件中设置 `"reflection": true` 才能启用。 

如果要使用装饰器，必须在 `tsconfig.json` 中启用 `"experimentalDecorators": true`。这对使用 `@deepkit/type` 并非绝对必要，但对其他 Deepkit 库的某些功能以及 Deepkit 框架是必要的。

_文件：tsconfig.json_

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "es6",
    "moduleResolution": "node",
    "experimentalDecorators": true
  },
  "reflection": true
}
```

编写你的第一段带有运行时类型信息的代码：

_文件：app.ts_

```typescript
import { cast, MinLength, ReflectionClass } from '@deepkit/type';

interface User {
    username: string & MinLength<3>;
    birthDate?: Date;
}

const user = cast<User>({
    username: 'Peter',
    birthDate: '2010-10-10T00:00:00Z'
});
console.log(user);

const reflection = ReflectionClass.from<User>();
console.log(reflection.getProperty('username').type);
```

使用 `ts-node` 运行它：

```sh
./node_modules/.bin/ts-node app.ts
```

## 交互式示例

这是一个 codesandbox 示例: https://codesandbox.io/p/sandbox/deepkit-runtime-types-fjmc2f?file=index.ts

## 类型编译器

TypeScript 本身不允许通过 `tsconfig.json` 配置类型编译器。必须直接使用 TypeScript 编译器 API，或者使用像 Webpack 配合 _ts-loader_ 这样的构建系统。为避免这种不便，Deepkit 类型编译器在安装 `@deepkit/type-compiler` 后会自动将自身安装到 `node_modules/typescript` 中（这是通过 NPM 的 install hooks 完成的）。
这使得所有访问本地安装的 TypeScript（即 `node_modules/typescript` 中的那个）的构建工具都能自动启用类型编译器。这使得 _tsc_、Angular、webpack、_ts-node_ 和其他一些工具能够自动与 Deepkit 类型编译器一起工作。

如果类型编译器未能成功自动安装（例如因为 NPM install hooks 被禁用），可以使用以下命令手动完成：

```sh
node_modules/.bin/deepkit-type-install
```

请注意，如果本地 typescript 版本已更新（例如 package.json 中的 typescript 版本发生了变化并运行了 `npm install`），必须运行 `deepkit-type-install`。

## Webpack

如果你希望在 webpack 构建中使用类型编译器，可以使用 `ts-loader` 包（或任何支持注册 transformer 的 TypeScript loader）。

_文件：webpack.config.js_

```javascript
const typeCompiler = require('@deepkit/type-compiler');

module.exports = {
  entry: './app.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              // 这将启用 @deepkit/type 的类型编译器
              getCustomTransformers: (program, getProgram) => ({
                before: [typeCompiler.transformer],
                afterDeclarations: [typeCompiler.declarationTransformer],
              }),
            }
          },
          exclude: /node_modules/,
       },
    ],
  },
}
```