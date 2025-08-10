# 参数与标志

命令行中的命令参数就是 `execute` 方法或函数的常规参数。它们会被自动映射到命令行参数。
如果你将某个参数标记为可选，则不必传入它。如果你为其设置了默认值，也同样不必传入。

根据类型（string、number、联合类型等），传入的值会被自动反序列化并验证。

```typescript
import { cli } from '@deepkit/app';

// 函数式
new App().command('test', (name: string) => {
    console.log('Hello', name);
});

// 类
@cli.controller('test')
class TestCommand {
    async execute(name: string) {
        console.log('Hello', name);
    }
}
```

如果现在执行该命令但未指定 name 参数，将会报告错误：

```sh
$ ts-node app.ts test
RequiredArgsError: Missing 1 required arg:
name
```

使用 `--help` 可以获得关于必需参数的更多信息：

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node-script app.ts test NAME
```

一旦将 name 作为参数传入，命令会被执行，并且该名称会被正确传递。

```sh
$ ts-node app.ts test "beautiful world"
Hello beautiful world
```

所有原始参数类型，如 string、number、boolean、字符串字面量、它们的联合类型，以及它们的数组，都会自动用作 CLI 参数，并自动进行验证与反序列化。参数的顺序决定了 CLI 参数的顺序。你可以添加任意数量的参数。

一旦定义了复杂对象（接口、类、对象字面量），它就会被视为服务依赖，依赖注入容器会尝试解析它。更多信息参见章节《[依赖注入](dependency-injection.md)》。

## 标志（Flags）

标志是向命令传递值的另一种方式。大多数情况下它们是可选的，但也可以是必需的。使用 `Flag` 类型修饰的参数可以通过 `--name value` 或 `--name=value` 传入。

```typescript
import { Flag } from '@deepkit/app';

// 函数式
new App().command('test', (id: number & Flag) => {
    console.log('id', name);
});

// 类
class TestCommand {
    async execute(id: number & Flag) {
        console.log('id', id);
    }
}
```

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node app.ts test

OPTIONS
  --id=id  (required)
```

在帮助信息的“OPTIONS”中，你可以看到需要一个 `--id` 标志。若正确传入该标志，命令会接收到该值。

```sh
$ ts-node app.ts test --id 23
id 23

$ ts-node app.ts test --id=23
id 23
```

### 布尔标志

标志的优势在于它也可以作为无值标志使用，例如用于激活某种行为。只要将参数标记为可选的布尔值，就会启用这种行为。

```typescript
import { Flag } from '@deepkit/app';

// 函数式
new App().command('test', (remove: boolean & Flag = false) => {
    console.log('delete?', remove);
});

// 类
class TestCommand {
    async execute(remove: boolean & Flag = false) {
        console.log('delete?', remove);
    }
}
```

```sh
$ ts-node app.ts test
delete? false

$ ts-node app.ts test --remove
delete? true
```

### 多值标志

若要为同一个标志传入多个值，可以将标志标记为数组。

```typescript
import { Flag } from '@deepkit/app';

// 函数式
new App().command('test', (id: number[] & Flag = []) => {
    console.log('ids', id);
});

// 类
class TestCommand {
    async execute(id: number[] & Flag = []) {
        console.log('ids', id);
    }
}
```

```sh
$ ts-node app.ts test
ids: []

$ ts-node app.ts test --id 12
ids: [12]

$ ts-node app.ts test --id 12 --id 23
ids: [12, 23]
```

### 单字符标志

要允许以单个字符传递标志，可以使用 `Flag<{char: 'x'}>`。

```typescript
import { Flag } from '@deepkit/app';

// 函数式
new App().command('test', (output: string & Flag<{char: 'o'}>) => {
    console.log('output: ', output);
});

// 类
class TestCommand {
    async execute(output: string & Flag<{char: 'o'}>) {
        console.log('output: ', output);
    }
}
```

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node app.ts test

OPTIONS
  -o, --output=output  (required)


$ ts-node app.ts test --output test.txt
output: test.txt

$ ts-node app.ts test -o test.txt
output: test.txt
```

## 可选 / 默认值

方法/函数的签名决定了哪些参数或标志是可选的。如果在类型系统中参数是可选的，用户就不必提供它。

```typescript

// 函数式
new App().command('test', (name?: string) => {
    console.log('Hello', name || 'nobody');
});

// 类
class TestCommand {
    async execute(name?: string) {
        console.log('Hello', name || 'nobody');
    }
}
```

```sh
$ ts-node app.ts test
Hello nobody
```

对具有默认值的参数也是如此：

```typescript
// 函数式
new App().command('test', (name: string = 'body') => {
    console.log('Hello', name);
});

// 类
class TestCommand {
    async execute(name: string = 'body') {
        console.log('Hello', name);
    }
}
```

```sh
$ ts-node app.ts test
Hello nobody
```

标志也以同样的方式适用。

## 序列化 / 验证

所有参数与标志都会基于其类型自动反序列化、验证，并且可以附加额外的约束。

因此，虽然命令行界面基于文本（字符串），但在控制器中被定义为 number 的参数总能保证是数字类型。

```typescript
// 函数式
new App().command('test', (id: number) => {
    console.log('id', id, typeof id);
});

// 类
class TestCommand {
    async execute(id: number) {
        console.log('id', id, typeof id);
    }
}
```

```sh
$ ts-node app.ts test 123
id 123 number
```

可以使用来自 `@deepkit/type` 的类型注解定义额外的约束。

```typescript
import { Positive } from '@deepkit/type';
// 函数式
new App().command('test', (id: number & Positive) => {
    console.log('id', id, typeof id);
});

// 类
class TestCommand {
    async execute(id: number & Positive) {
        console.log('id', id, typeof id);
    }
}
```

`id` 中的 `Postive` 类型表示只允许正数。如果用户现在传入负数，代码将不会被执行，并显示错误信息。

```sh
$ ts-node app.ts test -123
Validation error in id: Number needs to be positive [positive]
```

这种非常容易实现的额外验证，使命令对错误输入更加稳健。更多信息参见章节《[验证](../runtime-types/validation.md)》。

## 描述

要描述一个标志或参数，请使用 `@description` 注释装饰器。

```typescript
import { Positive } from '@deepkit/type';

class TestCommand {
    async execute(
        /** @description 用户的标识符 */
        id: number & Positive,
        /** @description 删除该用户？ */
        remove: boolean = false
    ) {
        console.log('id', id, typeof id);
    }
}
```

在帮助信息中，这些描述会显示在标志或参数之后：

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node app.ts test ID

ARGUMENTS
  ID  The users identifier

OPTIONS
  --remove  Delete the user?
```