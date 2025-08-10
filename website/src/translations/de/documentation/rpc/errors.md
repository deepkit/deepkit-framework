# Fehler

Ausgelöste Fehler werden automatisch mit allen Informationen, wie der Fehlermeldung und auch dem Stacktrace, an den Client weitergeleitet.

Wenn die nominale Instanzidentität des Error-Objekts wichtig ist (weil Sie `instanceof` verwenden), muss `@entity.name('@error:unique-name')` verwendet werden, damit die betreffende Error-Klasse zur Laufzeit registriert und wiederverwendet wird.

```typescript
@entity.name('@error:myError')
class MyError extends Error {}

//Server
@rpc.controller('/main')
class Controller {
    @rpc.action()
    saveUser(user: User): void {
        throw new MyError('Can not save user');
    }
}

//Client
//[MyError] stellt sicher, dass die Klasse MyError zur Laufzeit bekannt ist
const controller = client.controller<Controller>('/main', [MyError]);

try {
    await controller.getUser(2);
} catch (e) {
    if (e instanceof MyError) {
        //ups, Benutzer konnte nicht gespeichert werden
    } else {
        //alle anderen Fehler
    }
}
```

## Error transformieren

Da ausgelöste Fehler automatisch mit allen Informationen, wie der Fehlermeldung und auch dem Stacktrace, an den Client weitergeleitet werden, könnten dadurch unerwünschterweise sensible Informationen veröffentlicht werden. Um dies zu ändern, kann in der Methode `transformError` der geworfene Error modifiziert werden.

```typescript
class MyKernelSecurity extends RpcKernelSecurity {
    constructor(private logger: Logger) {
        super();
    }

    transformError(error: Error) {
        // in neuen Error verpacken
        this.logger.error('Error in RPC', error);
        return new Error('Something went wrong: ' + error.message);
    }
}
```

Beachten Sie, dass sobald der Error in einen generischen `Error` umgewandelt wurde, der vollständige Stacktrace und die Identität des Errors verloren gehen. Entsprechend können im Client keine `instanceof`-Checks mehr auf dem Error verwendet werden.

Wenn Deepkit RPC zwischen zwei Microservices verwendet wird und damit Client und Server vollständig unter der Kontrolle des Entwicklers stehen, ist das Transformieren des Errors selten notwendig. Läuft hingegen der Client in einem Browser bei unbekannten Nutzern, sollte in `transformError` genau darauf geachtet werden, welche Informationen offengelegt werden. Im Zweifel sollte jeder Error mit einem generischen `Error` transformiert werden, um sicherzustellen, dass keine internen Details preisgegeben werden. Das Protokollieren des Errors wäre an dieser Stelle eine gute Idee.