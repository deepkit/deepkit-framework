# 配置

依赖注入容器也允许注入配置选项。此配置注入可以通过构造函数注入或属性注入接收。

模块 API 支持定义一个配置定义，它是一个常规类。通过为该类提供属性，每个属性都充当一个配置选项。得益于 TypeScript 对类的定义方式，这使得可以为每个属性定义类型和默认值。

```typescript
class RootConfiguration {
    domain: string = 'localhost';
    debug: boolean = false;
}

const rootModule = new InjectorModule([UserRepository])
     .setConfigDefinition(RootConfiguration)
     .addImport(lowLevelModule);
```

现在可以在提供者中非常方便且类型安全地使用配置选项 `domain` 和 `debug`。

```typescript
class UserRepository {
    constructor(private debug: RootConfiguration['debug']) {}

    getUsers() {
        if (this.debug) console.debug('fetching users ...');
    }
}
```

这些选项的值可以通过 `configure()` 进行设置。

```typescript
	rootModule.configure({debug: true});
```

没有默认值但仍然必需的选项可以使用 `!` 标记。这会强制模块的使用者提供该值，否则将发生错误。

```typescript
class RootConfiguration {
    domain!: string;
}
```

## 验证

此外，前面章节 [验证](../runtime-types/validation.md) 和 [序列化](../runtime-types/serialization.md) 中的所有序列化与验证类型都可以用来详细指定某个选项必须满足的类型与内容约束。

```typescript
class RootConfiguration {
    domain!: string & MinLength<4>;
}
```

## 注入

与其他依赖一样，配置选项也可以如前所示通过 DI 容器安全且便捷地注入。最简单的方法是使用索引访问操作符引用单个选项：

```typescript
class WebsiteController {
    constructor(private debug: RootConfiguration['debug']) {}

    home() {
        if (this.debug) console.debug('visit home page');
    }
}
```

配置选项既可以单独引用，也可以成组引用。为此可使用 TypeScript 的工具类型 `Partial`：

```typescript
class WebsiteController {
    constructor(private options: Partial<RootConfiguration, 'debug' | 'domain'>) {}

    home() {
        if (this.options.debug) console.debug('visit home page');
    }
}
```

要获取所有配置选项，也可以直接引用配置类：

```typescript
class WebsiteController {
    constructor(private options: RootConfiguration) {}

    home() {
        if (this.options.debug) console.debug('visit home page');
    }
}
```

不过，推荐仅引用实际使用到的配置选项。这样不仅简化单元测试，也更便于从代码中看出实际所需内容。