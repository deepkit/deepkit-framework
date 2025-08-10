# 이벤트

HTTP 모듈은 워크플로 엔진을 기반으로 하며, HTTP 요청을 처리하는 전체 과정에 훅(hook)할 수 있도록 다양한 이벤트 토큰을 제공합니다.

워크플로 엔진은 유한 상태 머신으로, 각 HTTP 요청마다 새로운 상태 머신 인스턴스를 생성한 뒤 위치(position) 간을 이동합니다. 첫 위치는 `start`이고 마지막은 `response`입니다. 각 위치에서 추가 코드를 실행할 수 있습니다.

![HTTP 워크플로](/assets/documentation/framework/http-workflow.png)

각 이벤트 토큰은 추가 정보를 담은 고유한 이벤트 타입을 가집니다.

| 이벤트 토큰                    | 설명                                                                                                           |
|-------------------------------|----------------------------------------------------------------------------------------------------------------|
| httpWorkflow.onRequest        | 새 요청이 들어왔을 때                                                                                           |
| httpWorkflow.onRoute          | 요청에서 라우트를 해석(resolve)해야 할 때                                                                        |
| httpWorkflow.onRouteNotFound  | 라우트를 찾지 못했을 때                                                                                          |
| httpWorkflow.onAuth           | 인증이 수행될 때                                                                                                |
| httpWorkflow.onResolveParameters | 라우트 파라미터가 해석될 때                                                                                      |
| httpWorkflow.onAccessDenied   | 접근이 거부될 때                                                                                                |
| httpWorkflow.onController     | 컨트롤러 액션이 호출될 때                                                                                        |
| httpWorkflow.onControllerError | 컨트롤러 액션이 에러를 던졌을 때                                                                                 |
| httpWorkflow.onParametersFailed | 라우트 파라미터 해석이 실패했을 때                                                                              |
| httpWorkflow.onResponse       | 컨트롤러 액션이 호출된 후. 이 시점에서 결과가 응답으로 변환됩니다.                                               |

모든 HTTP 이벤트가 워크플로 엔진을 기반으로 하므로, 지정된 이벤트를 사용해 `event.next()` 메서드로 해당 위치로 점프하여 동작을 변경할 수 있습니다.

HTTP 모듈은 이 이벤트 토큰들에 자체 이벤트 리스너를 등록해 HTTP 요청 처리를 구현합니다. 이러한 모든 이벤트 리스너의 우선순위(priority)는 100이며, 이는 여러분이 이벤트를 수신(listen)할 때 기본적으로 여러분의 리스너가 먼저 실행된다는 의미입니다(기본 우선순위는 0). HTTP 기본 핸들러 이후에 실행하려면 100보다 큰 우선순위를 지정하세요.

예를 들어, 컨트롤러가 호출될 때의 이벤트를 가로채고 싶다고 가정해 봅시다. 특정 컨트롤러가 호출될 경우, 사용자에게 해당 컨트롤러에 대한 접근 권한이 있는지 확인합니다. 권한이 있다면 계속 진행합니다. 하지만 권한이 없다면 다음 워크플로 항목 `accessDenied`로 점프합니다. 그러면 접근 거부 절차가 그 이후 단계에서 자동으로 처리됩니다.

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
        //여기에서 cookie 세션, JWT 등 인증 정보를 확인합니다.

        //'accessDenied' 워크플로 상태로 점프하여
        // 사실상 모든 onAccessDenied 리스너를 실행합니다.

        //우리 리스너가 HTTP 커널의 리스너보다 먼저 호출되므로
        // 표준 컨트롤러 액션은 절대 호출되지 않습니다.
        //내부적으로 event.next('accessDenied', ...)를 호출합니다
        event.accessDenied();
    }
});

/**
 * 기본 accessDenied 구현을 변경합니다.
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