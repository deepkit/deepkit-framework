# 데이터베이스

Deepkit에는 Deepkit ORM이라고 불리는 강력한 데이터베이스 추상화 라이브러리가 있습니다. 이는 SQL 데이터베이스와 MongoDB 작업을 용이하게 하는 객체-관계 매핑(ORM) 라이브러리입니다.

원하는 어떤 데이터베이스 라이브러리도 사용할 수 있지만, Deepkit ORM은 Deepkit 프레임워크와 완벽하게 통합되어 있으며 워크플로와 효율성을 높여 줄 많은 기능을 갖춘 가장 빠른 TypeScript 데이터베이스 추상화 라이브러리이므로 사용을 권장합니다.

이 장에서는 Deepkit 앱에서 Deepkit ORM을 사용하는 방법을 설명합니다. Deepkit ORM에 대한 모든 정보는 [ORM](../orm.md) 장을 참고하세요.

## 데이터베이스 클래스

애플리케이션 내에서 Deepkit ORM의 `Database` 객체를 사용하는 가장 간단한 방법은 이를 상속한 클래스를 등록하는 것입니다.

```typescript
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { User } from './models';

export class SQLiteDatabase extends Database {
    constructor() {
        super(
            new SQLiteDatabaseAdapter('/tmp/myapp.sqlite'), 
            [User]
        );
    }
}
```

새 클래스를 만들고, 생성자에서 어댑터와 해당 매개변수를 지정한 다음 두 번째 매개변수에 이 데이터베이스에 연결해야 하는 모든 엔티티 모델을 추가하세요.

이제 이 데이터베이스 클래스를 프로바이더로 등록할 수 있습니다. 또한 `migrateOnStartup`을 활성화하여 부트스트랩 시 데이터베이스의 모든 테이블을 자동으로 생성하도록 합니다. 이는 빠른 프로토타이핑에 이상적이지만, 본격적인 프로젝트나 프로덕션 환경에서는 권장되지 않습니다. 일반적인 데이터베이스 마이그레이션을 사용해야 합니다.

또한 `debug`를 활성화하여 애플리케이션 서버가 시작될 때 디버거를 열고, 내장된 ORM 브라우저에서 데이터베이스 모델을 직접 관리할 수 있도록 합니다.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { SQLiteDatabase } from './database.ts';

new App({
    providers: [SQLiteDatabase],
    imports: [
        new FrameworkModule({
            migrateOnStartup: true,
            debug: true,
        })
    ]
}).run();
```

이제 의존성 주입(Dependency Injection)을 사용하여 어디서든 `SQLiteDatabase`에 접근할 수 있습니다:

```typescript
import { SQLiteDatabase } from './database.ts';

export class Controller {
    constructor(protected database: SQLiteDatabase) {}

    @http.GET()
    async startPage(): Promise<User[]> {
        //모든 사용자를 반환
        return await this.database.query(User).find();
    }
}
```

## 구성

많은 경우 연결 자격 증명을 구성 가능하게 만들고 싶을 것입니다. 예를 들어, 프로덕션과 테스트에서 다른 데이터베이스를 사용하고 싶을 수 있습니다. 이는 `Database` 클래스의 `config` 옵션을 사용하여 수행할 수 있습니다.

```typescript
//database.ts
import { Database } from '@deepkit/orm';
import { PostgresDatabaseAdapter } from '@deepkit/sqlite';
import { User } from './models';

type DbConfig = Pick<AppConfig, 'databaseHost', 'databaseUser', 'databasePassword'>;

export class MainDatabase extends Database {
    constructor(config: DbConfig) {
        super(new PostgresDatabaseAdapter({
            host: config.databaseHost,
            user: config.databaseUser,
            password: config.databasePassword,
        }), [User]);
    }
}
```

```typescript
//config.ts
export class AppConfig {
    databaseHost: string = 'localhost';
    databaseUser: string = 'postgres';
    databasePassword: string = '';
}
```

```typescript
//app.ts
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { MainDatabase } from './database.ts';
import { AppConfig } from './config.ts';

const app = new App({
    config: AppConfig,
    providers: [MainDatabase],
    imports: [
        new FrameworkModule({
            migrateOnStartup: true,
            debug: true,
        })
    ]
});
app.loadConfigFromEnv({prefix: 'APP_', namingStrategy: 'upper', envFilePath: ['local.env', 'prod.env']});
app.run();
```

이제 loadConfigFromEnv를 사용하므로 환경 변수를 통해 데이터베이스 자격 증명을 설정할 수 있습니다.

```sh
APP_DATABASE_HOST=localhost APP_DATABASE_USER=postgres ts-node app.ts server:start
```

또는 `local.env` 파일에 설정하고, 사전에 환경 변수를 설정하지 않고 `ts-node app.ts server:start`를 실행하세요.

```sh
APP_DATABASE_HOST=localhost
APP_DATABASE_USER=postgres
```

## 다중 데이터베이스

원하는 만큼 많은 데이터베이스 클래스를 추가하고 원하는 대로 이름을 지정할 수 있습니다. Deepkit ORM 브라우저를 사용할 때 다른 것들과 충돌하지 않도록 각 데이터베이스의 이름을 변경해야 합니다.

## 데이터 관리

이제 Deepkit ORM 브라우저로 데이터베이스 데이터를 관리할 모든 준비가 완료되었습니다. Deepkit ORM 브라우저를 열고 내용을 관리하려면 위의 모든 단계를 `app.ts` 파일에 작성하고 서버를 시작하세요.

```sh
$ ts-node app.ts server:start
2021-06-11T15:08:54.330Z [LOG] Start HTTP server, using 1 workers.
2021-06-11T15:08:54.333Z [LOG] Migrate database default
2021-06-11T15:08:54.336Z [LOG] RPC DebugController deepkit/debug/controller
2021-06-11T15:08:54.337Z [LOG] RPC OrmBrowserController orm-browser/controller
2021-06-11T15:08:54.337Z [LOG] HTTP OrmBrowserController
2021-06-11T15:08:54.337Z [LOG]     GET /_orm-browser/query httpQuery
2021-06-11T15:08:54.337Z [LOG] HTTP StaticController
2021-06-11T15:08:54.337Z [LOG]     GET /_debug/:any serviceApp
2021-06-11T15:08:54.337Z [LOG] HTTP listening at http://localhost:8080/
```

이제 http://localhost:8080/_debug/database/default 를 열 수 있습니다.

![디버거 데이터베이스](/assets/documentation/framework/debugger-database.png)

ER(엔터티 관계) 다이어그램을 볼 수 있습니다. 현재는 엔티티가 하나만 있습니다. 관계를 가진 엔티티를 더 추가하면 모든 정보를 한눈에 볼 수 있습니다.

왼쪽 사이드바에서 `User`를 클릭하면 해당 내용을 관리할 수 있습니다. `+` 아이콘을 클릭하고 새 레코드의 제목을 변경하세요. 필요한 값(예: 사용자 이름)을 변경한 후 `Confirm`을 클릭합니다. 그러면 모든 변경 사항이 데이터베이스에 커밋되어 영구적으로 반영됩니다. 자동 증가 ID는 자동으로 할당됩니다.

![디버거 데이터베이스 사용자](/assets/documentation/framework/debugger-database-user.png)

## 더 알아보기

`SQLiteDatabase`가 어떻게 동작하는지 더 알고 싶다면 [Database](../orm.md) 장과 데이터 쿼리, 세션을 통한 데이터 조작, 관계 정의 등과 같은 하위 장을 읽어보세요.
해당 장들은 독립 실행형 라이브러리 `@deepkit/orm`을 다루며, 위에서 읽은 Deepkit 프레임워크 부분에 대한 문서는 포함하지 않는다는 점에 유의하세요. 독립 실행형 라이브러리에서는 예를 들어 `new SQLiteDatabase()`와 같이 데이터베이스 클래스를 직접 인스턴스화합니다. 그러나 Deepkit 앱에서는 의존성 주입 컨테이너를 통해 이것이 자동으로 처리됩니다.

## 마이그레이션

Deepkit 프레임워크에는 마이그레이션을 생성, 실행 및 되돌릴 수 있는 강력한 마이그레이션 시스템이 있습니다. 마이그레이션 시스템은 Deepkit ORM 라이브러리를 기반으로 하며, 따라서 프레임워크와 완벽하게 통합되어 있습니다.

`FrameworkModule`은 마이그레이션을 관리하기 위한 여러 명령을 제공합니다.

- `migration:create` - 데이터베이스 차이(diff)를 기반으로 새 마이그레이션 파일을 생성
- `migration:pending` - 보류 중인 마이그레이션 파일 표시
- `migration:up` - 보류 중인 마이그레이션 파일을 실행
- `migration:down` - 다운 마이그레이션을 실행하여 이전 마이그레이션 파일을 되돌림

```sh
ts-node app.ts migration:create --migrationDir src/migrations
```

새 마이그레이션 파일이 `migrations`에 생성됩니다. 이 폴더는 FrameworkModule에 구성된 기본 디렉터리입니다. 이를 변경하려면 (구성 장에서 설명한 대로) 환경 변수를 통해 구성하거나 `FrameworkModule` 생성자에 `migrationDir` 옵션을 전달하세요.

```typescript
new FrameworkModule({
    migrationDir: 'src/migrations',
})
```

새로 생성된 마이그레이션 파일에는 TypeScript 앱에서 정의된 엔티티와 구성된 데이터베이스 간의 차이에 기반한 up과 down 메서드가 포함됩니다.
이제 필요에 맞게 up 메서드를 수정할 수 있습니다. down 메서드는 up 메서드를 기반으로 자동 생성됩니다.
이 파일을 저장소에 커밋하여 다른 개발자도 실행할 수 있도록 합니다.

### 보류 중인 마이그레이션

```sh
ts-node app.ts migration:pending --migrationDir src/migrations
```

모든 보류 중인 마이그레이션을 표시합니다. 아직 실행되지 않은 새 마이그레이션 파일이 있으면 여기에 나열됩니다.

### 마이그레이션 실행

```sh
ts-node app.ts migration:up --migrationDir src/migrations
```

다음 보류 중인 마이그레이션을 실행합니다.

### 마이그레이션 되돌리기

```sh
ts-node app.ts migration:down --migrationDir src/migrations
```

마지막으로 실행된 마이그레이션을 되돌립니다.

### 페이크 마이그레이션

예를 들어 마이그레이션(up 또는 down)을 실행하려고 했지만 실패했다고 가정해 봅시다. 문제를 수동으로 수정했지만, 이제 이미 실행된 것으로 표시되어 다시 마이그레이션을 실행할 수 없습니다. `--fake` 옵션을 사용하면 실제로 실행하지 않고도 데이터베이스에서 해당 마이그레이션을 실행된 것으로 표시할 수 있습니다. 이렇게 하면 다음 보류 중인 마이그레이션을 실행할 수 있습니다.

```sh
ts-node app.ts migration:up --migrationDir src/migrations --fake
```