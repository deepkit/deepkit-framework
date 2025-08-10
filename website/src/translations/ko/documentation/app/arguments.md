# 인자와 플래그

명령의 터미널에서 전달하는 명령 인자는 `execute` 메서드 또는 함수의 일반적인 인자와 동일합니다. 이들은 자동으로 커맨드 라인 인자에 매핑됩니다.
매개변수를 선택적으로 표시하면 전달할 필요가 없습니다. 기본값이 있는 경우에도 전달할 필요가 없습니다.

타입(string, number, union 등)에 따라 전달된 값은 자동으로 역직렬화되고 검증됩니다.

```typescript
import { cli } from '@deepkit/app';

// 함수형
new App().command('test', (name: string) => {
    console.log('Hello', name);
});

// 클래스
@cli.controller('test')
class TestCommand {
    async execute(name: string) {
        console.log('Hello', name);
    }
}
```

이제 name 매개변수를 지정하지 않고 이 명령을 실행하면 오류가 발생합니다:

```sh
$ ts-node app.ts test
RequiredArgsError: Missing 1 required arg:
name
```

`--help`를 사용하면 필요한 인자에 대한 더 많은 정보를 얻을 수 있습니다:

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node-script app.ts test NAME
```

이름이 인자로 전달되면 명령이 실행되고 이름이 올바르게 전달됩니다.

```sh
$ ts-node app.ts test "beautiful world"
Hello beautiful world
```

string, number, boolean, 문자열 리터럴, 이들의 유니온, 그리고 이들의 배열과 같은 모든 원시 매개변수 타입은 자동으로 CLI 인자로 사용되며 자동으로 검증 및 역직렬화됩니다. 매개변수의 순서가 CLI 인자의 순서를 결정합니다. 원하는 만큼 매개변수를 추가할 수 있습니다.

복합 객체(Interface, Class, 객체 리터럴)가 정의되는 즉시 서비스 의존성으로 취급되며, 의존성 주입 컨테이너가 이를 해석하려고 시도합니다. 자세한 내용은 [의존성 주입](dependency-injection.md) 장을 참조하세요.

## 플래그

플래그는 명령에 값을 전달하는 또 다른 방법입니다. 대부분 선택 사항이지만 반드시 그럴 필요는 없습니다. `Flag` 타입으로 데코레이션된 매개변수는 `--name value` 또는 `--name=value`로 전달할 수 있습니다.

```typescript
import { Flag } from '@deepkit/app';

// 함수형
new App().command('test', (id: number & Flag) => {
    console.log('id', name);
});

// 클래스
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

도움말 보기의 "OPTIONS"에서 `--id` 플래그가 필요함을 확인할 수 있습니다. 이 플래그를 올바르게 입력하면 명령이 이 값을 받습니다.

```sh
$ ts-node app.ts test --id 23
id 23

$ ts-node app.ts test --id=23
id 23
```

### 불리언 플래그

플래그는 특정 동작을 활성화하기 위해 값 없이도 사용할 수 있다는 장점이 있습니다. 매개변수가 선택적 boolean으로 표시되는 즉시 이 동작이 활성화됩니다.

```typescript
import { Flag } from '@deepkit/app';

// 함수형
new App().command('test', (remove: boolean & Flag = false) => {
    console.log('delete?', remove);
});

// 클래스
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

### 다중 플래그

같은 플래그에 여러 값을 전달하려면, 플래그를 배열로 표시할 수 있습니다.

```typescript
import { Flag } from '@deepkit/app';

// 함수형
new App().command('test', (id: number[] & Flag = []) => {
    console.log('ids', id);
});

// 클래스
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

### 단일 문자 플래그

플래그를 한 글자로도 전달할 수 있도록 하려면 `Flag<{char: 'x'}>`를 사용할 수 있습니다.

```typescript
import { Flag } from '@deepkit/app';

// 함수형
new App().command('test', (output: string & Flag<{char: 'o'}>) => {
    console.log('output: ', output);
});

// 클래스
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

## 선택 사항 / 기본값

메서드/함수의 시그니처는 어떤 인자나 플래그가 선택 사항인지 정의합니다. 타입 시스템에서 매개변수가 선택적이면 사용자는 이를 제공하지 않아도 됩니다.

```typescript

// 함수형
new App().command('test', (name?: string) => {
    console.log('Hello', name || 'nobody');
});

// 클래스
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

기본값이 있는 매개변수도 동일합니다:

```typescript
// 함수형
new App().command('test', (name: string = 'body') => {
    console.log('Hello', name);
});

// 클래스
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

이는 플래그에도 동일하게 적용됩니다.


## 직렬화 / 검증

모든 인자와 플래그는 타입에 따라 자동으로 역직렬화되고 검증되며, 추가 제약 조건을 지정할 수 있습니다.

즉, 숫자로 정의된 인자는 커맨드라인 인터페이스가 텍스트(문자열) 기반임에도, 컨트롤러에서는 항상 실제 숫자임이 보장됩니다. 

```typescript
// 함수형
new App().command('test', (id: number) => {
    console.log('id', id, typeof id);
});

// 클래스
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

추가 제약 조건은 `@deepkit/type`의 타입 애노테이션으로 정의할 수 있습니다.

```typescript
import { Positive } from '@deepkit/type';
// 함수형
new App().command('test', (id: number & Positive) => {
    console.log('id', id, typeof id);
});

// 클래스
class TestCommand {
    async execute(id: number & Positive) {
        console.log('id', id, typeof id);
    }
}
```

`id`의 `Postive` 타입은 양수만 허용됨을 나타냅니다. 사용자가 음수를 전달하면 코드는 전혀 실행되지 않고 오류 메시지가 표시됩니다.

```sh
$ ts-node app.ts test -123
Validation error in id: Number needs to be positive [positive]
```

이처럼 매우 간단한 추가 검증은 잘못된 입력에 대해 명령을 훨씬 더 견고하게 만듭니다. 자세한 내용은 [검증](../runtime-types/validation.md) 장을 참조하세요.

## 설명

플래그나 인자를 설명하려면 `@description` 주석 데코레이터를 사용하세요.

```typescript
import { Positive } from '@deepkit/type';

class TestCommand {
    async execute(
        /** @description 사용자의 식별자 */
        id: number & Positive,
        /** @description 사용자를 삭제할까요? */
        remove: boolean = false
    ) {
        console.log('id', id, typeof id);
    }
}
```

도움말 보기에서 이 설명은 해당 플래그 또는 인자 뒤에 표시됩니다:

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node app.ts test ID

ARGUMENTS
  ID  The users identifier

OPTIONS
  --remove  Delete the user?
```