# 迁移

迁移是一种以结构化、有组织的方式进行数据库模式变更的方法。它们以 TypeScript 文件的形式存储在某个目录中，并可通过命令行工具执行。

在使用 Deepkit Framework 时，Deepkit ORM 的迁移默认启用。

## 命令

- `migration:create` - 基于数据库差异生成新的迁移文件
- `migration:pending` - 显示待执行的迁移文件
- `migration:up` - 执行待执行的迁移文件。
- `migration:down` - 执行回滚迁移，撤销已执行的旧迁移

当你在应用中引入 `FrameworkModule` 时，这些命令可用；或者通过 `@deepkit/sql` 提供的 `deepkit-sql` 命令行工具使用。

`FrameworkModule` 的[迁移集成](../framework/database.md#migration)会自动读取你的数据库（你需要将它们定义为 provider），而使用 `deepkit-sql` 时，你需要指定导出数据库的 TypeScript 文件。后者在不使用 Deepkit Framework、单独使用 Deepkit ORM 时很有用。

## 创建迁移

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

一个新的迁移文件会在 `src/migrations` 中创建。

新建的迁移文件包含根据 TypeScript 应用中定义的实体与已配置数据库之间的差异生成的 up 和 down 方法。
你可以按需修改 up 方法。down 方法会基于 up 方法自动生成。
将该文件提交到你的代码仓库，以便其他开发者也能执行。

## 待执行的迁移

```sh
./node_modules/.bin/deepkit-sql migration:pending --path database.ts --migrationDir src/migrations
```

这将显示所有待执行的迁移。如果你有尚未执行的新迁移文件，它会在这里列出。

## 执行迁移

```sh
./node_modules/.bin/deepkit-sql migration:up --path database.ts --migrationDir src/migrations
```

这会执行下一个待执行的迁移。

## 回滚迁移

```sh
./node_modules/.bin/deepkit-sql migration:down --path database.ts --migrationDir src/migrations
```

这会回滚上一次执行的迁移。

## 伪迁移

假设你想执行一次迁移（up 或 down），但执行失败。你已手动修复了问题，但现在无法再次执行该迁移，因为它已被标记为已执行。你可以使用 `--fake` 选项来“伪执行”该迁移，使其在数据库中被标记为已执行而不实际执行。这样你就可以继续执行下一个待执行的迁移。

```sh
./node_modules/.bin/deepkit-sql migration:up --path database.ts --migrationDir src/migrations --fake
```