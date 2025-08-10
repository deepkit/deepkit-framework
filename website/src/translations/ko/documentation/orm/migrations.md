# 마이그레이션

마이그레이션은 데이터베이스 스키마 변경을 구조적이고 체계적으로 관리하는 방법입니다. 디렉터리에 TypeScript 파일로 저장되며, 명령줄 도구를 사용해 실행할 수 있습니다.

Deepkit Framework를 사용할 때 Deepkit ORM 마이그레이션은 기본으로 활성화됩니다. 

## 명령어

- `migration:create` - 데이터베이스 diff를 기반으로 새로운 마이그레이션 파일을 생성합니다
- `migration:pending` - 보류 중인 마이그레이션 파일을 보여줍니다
- `migration:up` - 보류 중인 마이그레이션 파일을 실행합니다.
- `migration:down` - down 마이그레이션을 실행하여 이전 마이그레이션 파일을 되돌립니다

이 명령어는 애플리케이션에서 `FrameworkModule`을 import하면 사용할 수 있으며, 또는 `@deepkit/sql`의 `deepkit-sql` 명령줄 도구를 통해 사용할 수 있습니다.

[FrameworkModule의 마이그레이션 통합](../framework/database.md#migration)은 여러분의 여러 Database(이를 provider로 정의해야 함)를 자동으로 읽어들이고, `deepkit-sql`을 사용하는 경우에는 Database를 export하는 TypeScript 파일을 지정해야 합니다. 후자는 Deepkit Framework 없이 Deepkit ORM을 단독(standalone)으로 사용할 때 유용합니다.

## 마이그레이션 생성

```typescript
//database.ts
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { User } from './models';

export class SQLiteDatabase extends Database {
    name = 'default';
    constructor() {
        super(new SQLiteDatabaseAdapter('/tmp/myapp.sqlite'), [User]);
    }
}
```

```sh
./node_modules/.bin/deepkit-sql migration:create --path database.ts --migrationDir src/migrations
```

새 마이그레이션 파일이 `src/migrations`에 생성됩니다. 

새로 생성된 마이그레이션 파일에는 TypeScript 앱에 정의된 엔티티와 설정된 데이터베이스 간의 차이를 기반으로 한 up 및 down Method가 포함됩니다. 이제 필요에 맞게 up Method를 수정할 수 있습니다. down Method는 up Method를 기반으로 자동 생성됩니다.
이 파일을 저장소에 커밋하면 다른 개발자도 이를 실행할 수 있습니다.

## 보류 중인 마이그레이션

```sh
./node_modules/.bin/deepkit-sql migration:pending --path database.ts --migrationDir src/migrations
```

모든 보류 중인 마이그레이션을 표시합니다. 아직 실행되지 않은 새 마이그레이션 파일이 있다면 여기 목록에 나타납니다.

## 마이그레이션 실행

```sh
./node_modules/.bin/deepkit-sql migration:up --path database.ts --migrationDir src/migrations
```

다음 보류 중인 마이그레이션을 실행합니다. 

## 마이그레이션 되돌리기

```sh
./node_modules/.bin/deepkit-sql migration:down --path database.ts --migrationDir src/migrations
```

마지막으로 실행된 마이그레이션을 되돌립니다.

## Fake 마이그레이션

마이그레이션(up 또는 down)을 실행하려고 했지만 실패했다고 가정해 봅시다. 문제를 수동으로 고쳤지만, 이미 실행된 것으로 표시되어 마이그레이션을 다시 실행할 수 없습니다. 이때 `--fake` 옵션을 사용하여 실제로 실행하지 않고도 데이터베이스에 실행된 것으로 표시(faking)할 수 있습니다. 이렇게 하면 다음 보류 중인 마이그레이션을 실행할 수 있습니다.

```sh
./node_modules/.bin/deepkit-sql migration:up --path database.ts --migrationDir src/migrations --fake
```