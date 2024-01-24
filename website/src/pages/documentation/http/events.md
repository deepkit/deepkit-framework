# Events

The HTTP module is based on a workflow engine that provides various event tokens that can be used to hook into the entire process of processing an HTTP request.

The workflow engine is a finite state machine that creates a new state machine instance for each HTTP request and then jumps from position to position. The first position is the `start` and the last the `response`. Additional code can be executed in each position.

![HTTP Workflow](/assets/documentation/framework/http-workflow.png)

Each event token has its own event type with additional information.

| Event-Token                      | Description                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| httpWorkflow.onRequest           | When a new request comes in                                                                                |
| httpWorkflow.onRoute             | When the route should be resolved from the request                                                         |
| httpWorkflow.onRouteNotFound     | When the route is not found                                                                                |
| httpWorkflow.onAuth              | When authentication happens                                                                                |
| httpWorkflow.onResolveParameters | When route parameters are resolved                                                                         |
| httpWorkflow.onAccessDenied      | When access is denied                                                                                      |
| httpWorkflow.onController        | When the controller action is called                                                                       |
| httpWorkflow.onControllerError   | When the controller action threw an error                                                                  |
| httpWorkflow.onParametersFailed  | When route parameters resolving failed                                                                     |
| httpWorkflow.onResponse          | When the controller action has been called. This is the place where the result is converted to a response. |

Since all HTTP events are based on the workflow engine, its behavior can be modified by using the specified event and jumping there with the `event.next()` method.

The HTTP module uses its own event listeners on these event tokens to implement HTTP request processing. All these event listeners have a priority of 100, which means that when you listen for an event, your listener is executed first by default (since the default priority is 0). Add a priority above 100 to run after the HTTP default handler.

For example, suppose you want to catch the event when a controller is invoked. If a particular controller is to be invoked, we check if the user has access to it. If the user has access, we continue. But if not, we jump to the next workflow item `accessDenied`. There, the procedure of an access-denied is then automatically processed further.

```typescript
import { App } from '@deepkit/app';
import { eventDispatcher } from '@deepkit/event';
import { FrameworkModule } from '@deepkit/framework';
import { HtmlResponse, http, httpAction, httpWorkflow } from '@deepkit/http';

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
  imports: [new FrameworkModule()],
});

app.listen(httpWorkflow.onController, async event => {
  if (event.route.groups.includes('secret')) {
    //check here for authentication information like cookie session, JWT, etc.

    //this jumps to the 'accessDenied' workflow state,
    // essentially executing all onAccessDenied listeners.

    //since our listener is called before the HTTP kernel one,
    // the standard controller action will never be called.
    //this calls event.next('accessDenied', ...) under the hood
    event.accessDenied();
  }
});

/**
 * We change the default accessDenied implementation.
 */
app.listen(httpWorkflow.onAccessDenied, async () => {
  if (event.sent) return;
  if (event.hasNext()) return;
  event.send(new HtmlResponse('No access to this area.', 403));
});

app.run();
```

```sh
$ curl http://localhost:8080/
Welcome
$ curl http://localhost:8080/admin
No access to this area
```
