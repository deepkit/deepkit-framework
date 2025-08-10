# 에러

던져진 에러는 에러 메시지와 stacktrace 같은 모든 정보와 함께 클라이언트로 자동 전달됩니다.

에러 객체의 nominal 인스턴스가 중요하다면(예: instanceof를 사용하는 경우), runtime에 해당 error class가 등록되고 재사용되도록 `@entity.name('@error:unique-name')`를 사용해야 합니다.

```typescript
@entity.name('@error:myError')
class MyError extends Error {}

//server
@rpc.controller('/main')
class Controller {
    @rpc.action()
    saveUser(user: User): void {
        throw new MyError('Can not save user');
    }
}

//client
//[MyError]는 runtime에서 Class MyError가 인식되도록 보장합니다
const controller = client.controller<Controller>('/main', [MyError]);

try {
    await controller.getUser(2);
} catch (e) {
    if (e instanceof MyError) {
        //앗, 사용자를 저장할 수 없습니다
    } else {
        //그 밖의 모든 에러
    }
}
```

## 에러 변환

던져진 에러는 에러 메시지와 stacktrace 등 모든 정보와 함께 클라이언트로 자동 전달되므로, 의도치 않게 민감한 정보가 공개될 수 있습니다. 이를 변경하기 위해 Method `transformError`에서 던져진 에러를 수정할 수 있습니다.

```typescript
class MyKernelSecurity extends RpcKernelSecurity {
    constructor(private logger: Logger) {
        super();
    }

    transformError(error: Error) {
        //새로운 Error로 감싸기
        this.logger.error('Error in RPC', error);
        return new Error('Something went wrong: ' + error.message);
    }
}
```

에러가 generic `Error`로 변환되면 전체 stack trace와 에러의 정체성(identity)이 사라집니다. 따라서 클라이언트에서 해당 에러에 대해 `instanceof` 체크를 사용할 수 없습니다.

Deepkit RPC가 두 마이크로서비스 사이에서 사용되어 클라이언트와 서버가 개발자의 완전한 통제 하에 있는 경우, 에러를 변환할 필요는 거의 없습니다. 반면 클라이언트가 신뢰할 수 없는 브라우저 환경에서 실행되는 경우, 어떤 정보를 공개할지 `transformError`에서 주의 깊게 결정해야 합니다. 확신이 없다면 내부 세부사항이 유출되지 않도록 각 에러를 generic `Error`로 변환하는 것이 안전합니다. 이 시점에서 에러를 로깅하는 것도 좋은 아이디어입니다.