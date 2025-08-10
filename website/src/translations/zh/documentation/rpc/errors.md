# 错误

抛出的错误会连同其所有信息（如错误消息和堆栈跟踪）自动转发到客户端。

如果错误对象的名义实例很重要（因为你使用了 instanceof），则需要使用 `@entity.name('@error:unique-name')`，以便在运行时注册并复用给定的错误类。

```typescript
@entity.name('@error:myError')
class MyError extends Error {}

// 服务器
@rpc.controller('/main')
class Controller {
    @rpc.action()
    saveUser(user: User): void {
        throw new MyError('Can not save user');
    }
}

// 客户端
// [MyError] 确保在运行时已知 MyError 类
const controller = client.controller<Controller>('/main', [MyError]);

try {
    await controller.getUser(2);
} catch (e) {
    if (e instanceof MyError) {
        // 哎呀，无法保存用户
    } else {
        // 所有其他错误
    }
}
```

## 转换错误

由于抛出的错误会连同其所有信息（如错误消息和堆栈跟踪）自动转发到客户端，这可能会意外泄露敏感信息。要改变这一点，可以在 `transformError` 方法中对抛出的错误进行修改。

```typescript
class MyKernelSecurity extends RpcKernelSecurity {
    constructor(private logger: Logger) {
        super();
    }

    transformError(error: Error) {
        // 包装为新的错误
        this.logger.error('Error in RPC', error);
        return new Error('Something went wrong: ' + error.message);
    }
}
```

请注意，一旦错误被转换为通用的 `error`，完整的堆栈跟踪和错误的身份将会丢失。因此，客户端无法对该错误使用 `instanceof` 检查。

如果 Deepkit RPC 用于两个微服务之间，因此客户端和服务器都由开发者完全控制，那么通常很少需要转换错误。另一方面，如果客户端在浏览器中运行且面向未知用户，则应在 `transformError` 中谨慎决定要披露的信息。若有不确定，应将每个错误都转换为通用的 `Error`，以确保不会泄露任何内部细节。在此情况下记录错误日志是个好主意。