# 事件

HTTP 模块基于一个工作流引擎，该引擎提供了多种事件令牌，可用于挂接到处理 HTTP 请求的整个流程中。

该工作流引擎是一个有限状态机，会为每个 HTTP 请求创建一个新的状态机实例，然后在各个位置之间跳转。第一个位置是 `start`，最后一个是 `response`。在每个位置都可以执行附加代码。

![HTTP 工作流](/assets/documentation/framework/http-workflow.png)

每个事件令牌都有其自己的事件类型，并附带额外信息。

| 事件令牌                        | 描述                                                                                                              |
|--------------------------------|-------------------------------------------------------------------------------------------------------------------|
| httpWorkflow.onRequest         | 当有新请求进来时                                                                                                  |
| httpWorkflow.onRoute           | 当需要从请求解析路由时                                                                                            |
| httpWorkflow.onRouteNotFound   | 当未找到路由时                                                                                                    |
| httpWorkflow.onAuth            | 当进行身份验证时                                                                                                  |
| httpWorkflow.onResolveParameters | 当解析路由参数时                                                                                                  |
| httpWorkflow.onAccessDenied    | 当访问被拒绝时                                                                                                    |
| httpWorkflow.onController      | 当调用控制器动作时                                                                                                |
| httpWorkflow.onControllerError | 当控制器动作抛出错误时                                                                                            |
| httpWorkflow.onParametersFailed | 当解析路由参数失败时                                                                                              |
| httpWorkflow.onResponse        | 当控制器动作已被调用时。此处将结果转换为响应。                                                                    |

由于所有 HTTP 事件都基于工作流引擎，可以使用指定的事件并通过 `event.next()` 方法跳转，从而修改其行为。

HTTP 模块在这些事件令牌上使用了自身的事件监听器来实现 HTTP 请求处理。所有这些事件监听器的优先级为 100，这意味着当你监听某个事件时，你的监听器默认会先执行（因为默认优先级是 0）。将优先级设为高于 100 可在 HTTP 默认处理器之后运行。

例如，假设你想拦截控制器被调用时的事件。如果将要调用某个特定控制器，我们检查用户是否有访问权限。若有，则继续；若没有，则跳转到下一个工作流项 `accessDenied`。在那里，访问被拒绝的处理流程会被自动继续执行。

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { HtmlResponse, http, httpAction, httpWorkflow } from '@deepkit/http';
import { eventDispatcher } from '@deepkit/event';

class MyWebsite {
    @http.GET('/')
    open() {
        return 'Welcome';
    }

    @http.GET('/admin').group('secret')
    secret() {
        return 'Welcome to the dark side';
    }
}

const app = new App({
    controllers: [MyWebsite],
    imports: [new FrameworkModule]
})

app.listen(httpWorkflow.onController, async (event) => {
    if (event.route.groups.includes('secret')) {
        //在此检查身份验证信息，例如 Cookie 会话、JWT 等。

        //这会跳转到 'accessDenied' 工作流状态，
        // 从而执行所有 onAccessDenied 监听器。

        //由于我们的监听器在 HTTP 内核监听器之前被调用，
        // 标准的控制器动作将不会被调用。
        // 底层等同于调用 event.next('accessDenied', ...)
        event.accessDenied();
    }
});

/**
 * 我们更改默认的 accessDenied 实现。
 */
app.listen(httpWorkflow.onAccessDenied, async () => {
    if (event.sent) return;
    if (event.hasNext()) return;
    event.send(new HtmlResponse('No access to this area.', 403));
})

app.run();
```

```sh
$ curl http://localhost:8080/
Welcome
$ curl http://localhost:8080/admin
No access to this area
```