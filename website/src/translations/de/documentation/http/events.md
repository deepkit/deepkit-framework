# Ereignisse

Das HTTP-Modul basiert auf einer Workflow-Engine, die verschiedene Event-Token bereitstellt, mit denen in den gesamten Prozess der Verarbeitung einer HTTP-Anfrage eingehakt werden kann.

Die Workflow-Engine ist eine Finite State Machine (FSM), die für jede HTTP-Anfrage eine neue State-Machine-Instanz erstellt und dann von Position zu Position springt. Die erste Position ist `start` und die letzte `response`. In jeder Position kann zusätzlicher Code ausgeführt werden.

![HTTP-Workflow](/assets/documentation/framework/http-workflow.png)

Jedes Event-Token hat seinen eigenen Event-Typ mit zusätzlichen Informationen.

| Event-Token                   | Beschreibung                                                                                                        |
|-------------------------------|----------------------------------------------------------------------------------------------------------------------|
| httpWorkflow.onRequest        | Wenn eine neue Anfrage eingeht                                                                                       |
| httpWorkflow.onRoute          | Wenn die Route aus der Anfrage aufgelöst werden soll                                                                 |
| httpWorkflow.onRouteNotFound  | Wenn die Route nicht gefunden wird                                                                                   |
| httpWorkflow.onAuth           | Wenn die Authentifizierung stattfindet                                                                               |
| httpWorkflow.onResolveParameters | Wenn die Routenparameter aufgelöst werden                                                                           |
| httpWorkflow.onAccessDenied   | Wenn der Zugriff verweigert wird                                                                                     |
| httpWorkflow.onController     | Wenn die Controller-Action aufgerufen wird                                                                           |
| httpWorkflow.onControllerError | Wenn die Controller-Action einen Fehler ausgelöst hat                                                                |
| httpWorkflow.onParametersFailed | Wenn das Auflösen der Routenparameter fehlgeschlagen ist                                                            |
| httpWorkflow.onResponse       | Wenn die Controller-Action aufgerufen wurde. Hier wird das Ergebnis in eine Response umgewandelt.                    |

Da alle HTTP-Events auf der Workflow-Engine basieren, kann ihr Verhalten geändert werden, indem das angegebene Event verwendet und mit der Methode `event.next()` dorthin gesprungen wird.

Das HTTP-Modul verwendet eigene Event-Listener auf diesen Event-Token, um die Verarbeitung von HTTP-Anfragen zu implementieren. Alle diese Event-Listener haben eine Priorität von 100. Das bedeutet, dass Ihr Listener standardmäßig zuerst ausgeführt wird, wenn Sie auf ein Event hören (da die Standardpriorität 0 ist). Fügen Sie eine Priorität über 100 hinzu, um nach dem HTTP-Standardhandler zu laufen.

Angenommen, Sie möchten das Event abfangen, wenn ein Controller aufgerufen wird. Soll ein bestimmter Controller aufgerufen werden, prüfen wir, ob der Benutzer Zugriff darauf hat. Hat der Benutzer Zugriff, machen wir weiter. Wenn nicht, springen wir zum nächsten Workflow-Item `accessDenied`. Dort wird die Prozedur einer Zugriff-verweigert-Situation dann automatisch weiterverarbeitet.

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
        //prüfen Sie hier Authentifizierungsinformationen wie Cookie-Session, JWT etc.

        //dies springt in den 'accessDenied'-Workflow-Zustand,
        // und führt im Grunde alle onAccessDenied-Listener aus.

        //da unser Listener vor dem des HTTP-Kernels aufgerufen wird,
        // wird die Standard-Controller-Action niemals aufgerufen.
        //das ruft unter der Haube event.next('accessDenied', ...) auf
        event.accessDenied();
    }
});

/**
 * Wir ändern die Standardimplementierung von accessDenied.
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