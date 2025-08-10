# Deepkit App

Deepkit App 抽象是 Deepkit 应用的最基本构建块。如果你不单独使用这些库，通常从这里开始构建你的应用。它是一个普通的 TypeScript 文件，你用 Node.js 之类的运行时来执行。它是应用的入口，并提供一种方式来定义 CLI 命令、服务、配置、事件等。

命令行接口（CLI）程序通过终端以文本输入/输出的形式进行交互。这种与应用交互的方式的优势在于，只需要有一个终端即可，无论是本地还是通过 SSH 连接。

它提供：

- CLI 命令
- 模块系统
- 服务容器
- 依赖注入
- 事件系统
- 日志记录器
- 配置加载器（env、dotenv、json）

Deepkit 中的命令可以完全访问 DI 容器，从而访问所有提供者和配置选项。CLI 命令的参数和选项通过 TypeScript 类型的参数声明进行控制，并会自动序列化和验证。

使用 `@deepkit/framework` 的 [Deepkit 框架](./framework.md) 进一步扩展了这些能力，提供用于 HTTP/RPC 的应用服务器、调试器/性能分析器等。

## 简易安装

最简单的开始方式是使用 NPM init 创建一个新的 Deepkit 项目。

```shell
npm init @deepkit/app@latest my-deepkit-app
````

这会创建一个包含所有依赖和基础 `app.ts` 文件的 `my-deepkit-app` 文件夹。

```sh
cd my-deepkit-app
npm run app
````

这将使用 `ts-node` 运行 `app.ts` 文件，并显示可用的命令。你可以从这里开始，添加自己的命令、控制器等。

## 手动安装

Deepkit App 基于 [Deepkit 运行时类型](./runtime-types.md)，因此让我们安装所有依赖：

```bash
mkdir my-project && cd my-project

npm install typescript ts-node 
npm install @deepkit/app @deepkit/type @deepkit/type-compiler
```

接下来，通过运行以下命令，确保 Deepkit 的类型编译器安装到 `node_modules/typescript` 中已安装的 TypeScript 包里：

```sh
./node_modules/.bin/deepkit-type-install
```

确保所有 peer 依赖都已安装。默认情况下，NPM 7+ 会自动安装它们。

要编译你的应用，我们需要 TypeScript 编译器，并推荐使用 `ts-node` 来轻松运行应用。

使用 `ts-node` 的替代方案是使用 TypeScript 编译器编译源代码，并直接执行生成的 JavaScript 源代码。这样做的优势是在短命令下能显著提升执行速度。但这也会带来额外的工作流开销，例如需要手动运行编译器或设置监视器。因此，本手册的所有示例都使用 `ts-node`。

## 第一个应用

由于 Deepkit 框架不使用配置文件或特殊的文件夹结构，你可以按自己喜欢的方式组织项目。开始所需的仅有两个文件：TypeScript 的 app.ts 文件和 TypeScript 配置文件 tsconfig.json。

我们的目标是在项目文件夹中拥有以下文件：

```
.
├── app.ts
├── node_modules
├── package-lock.json
└── tsconfig.json
```

我们设置一个基础的 tsconfig 文件，并通过将 `reflection` 设为 `true` 来启用 Deepkit 的类型编译器。要使用依赖注入容器和其他特性，这是必需的。

```json title=tsconfig.json
{
  "compilerOptions": {
    "outDir": "./dist",
    "experimentalDecorators": true,
    "strict": true,
    "esModuleInterop": true,
    "target": "es2020",
    "module": "CommonJS",
    "moduleResolution": "node"
  },
  "reflection": true,
  "files": [
    "app.ts"
  ]
}
```

```typescript title=app.ts
import { App } from '@deepkit/app';
import { Logger } from '@deepkit/logger';

const app = new App();

app.command('test', (logger: Logger) => {
    logger.log('Hello World!');
});

app.run();
```

在这段代码中，你可以看到我们定义了一个 test 命令，并创建了一个新的应用，通过 `run()` 直接运行。运行该脚本即可启动应用。

接着直接运行它。

```sh
$ ./node_modules/.bin/ts-node app.ts
VERSION
  Node

USAGE
  $ ts-node app.ts [COMMAND]

TOPICS
  debug
  migration  Executes pending migration files. Use migration:pending to see which are pending.
  server     Starts the HTTP server

COMMANDS
  test
```

现在，要执行我们的 test 命令，运行以下命令。

```sh
$ ./node_modules/.bin/ts-node app.ts test
Hello World
```

在 Deepkit 中，一切现在都通过这个 `app.ts` 完成。你可以按需重命名该文件或创建更多文件。自定义 CLI 命令、HTTP/RPC 服务器、迁移命令等都从这个入口启动。

## 参数与标志

Deepkit App 会自动将函数参数转换为 CLI 参数和标志。参数的顺序决定了 CLI 参数的顺序

参数可以是任意 TypeScript 类型，并会自动验证与反序列化。

更多信息参见章节 [参数与标志](./app/arguments.md)。

## 依赖注入

Deepkit App 会设置一个服务容器，并为每个导入的模块提供其自身的依赖注入容器，该容器从其父级继承。它开箱即用地提供以下提供者，你可以自动注入到服务、控制器和事件监听器中：

- `Logger` 用于日志记录
- `EventDispatcher` 用于事件处理
- `CliControllerRegistry` 用于已注册的 CLI 命令
- `MiddlewareRegistry` 用于已注册的中间件
- `InjectorContext` 用于当前注入器上下文

一旦导入 Deepkit 框架，你将获得更多提供者。详见 [Deepkit 框架](./framework.md)。

## 退出码

默认情况下退出码为 0，这表示命令执行成功。要更改退出码，应在 execute 方法或命令回调中返回非 0 的数字。

```typescript

@cli.controller('test')
export class TestCommand {
    async execute() {
        console.error('Error :(');
        return 12;
    }
}
```