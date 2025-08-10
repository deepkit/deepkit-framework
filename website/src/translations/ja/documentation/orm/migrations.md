# マイグレーション

マイグレーションは、データベーススキーマの変更を構造化され整理された方法で行うための手段です。ディレクトリ内の TypeScript ファイルとして保存され、コマンドラインツールで実行できます。

Deepkit Framework を使用する場合、Deepkit ORM のマイグレーションはデフォルトで有効になっています。 

## コマンド

- `migration:create` - データベースの差分に基づいて新しいマイグレーションファイルを生成します
- `migration:pending` - 保留中のマイグレーションファイルを表示します
- `migration:up` - 保留中のマイグレーションファイルを実行します。
- `migration:down` - ダウンマイグレーションを実行し、古いマイグレーションファイルを元に戻します

これらのコマンドは、FrameworkModule をインポートしたアプリケーション内、または `@deepkit/sql` の `deepkit-sql` コマンドラインツールから利用できます。

[FrameworkModule のマイグレーション統合](../framework/database.md#migration)は、あなたのデータベース（プロバイダとして定義する必要があります）を自動的に読み込みます。一方、`deepkit-sql` ではデータベースをエクスポートする TypeScript ファイルを指定する必要があります。後者は Deepkit Framework を使わずに Deepkit ORM を単体で使用する場合に便利です。

## マイグレーションの作成

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

新しいマイグレーションファイルが `src/migrations` に作成されます。 

新しく作成されたマイグレーションファイルには、TypeScript アプリで定義されたエンティティと設定済みデータベースの差分に基づく up と down の Method が含まれます。必要に応じて up の Method を変更できます。down の Method は up の Method に基づいて自動生成されます。
他の開発者も実行できるよう、このファイルをリポジトリにコミットします。

## 保留中のマイグレーション

```sh
./node_modules/.bin/deepkit-sql migration:pending --path database.ts --migrationDir src/migrations
```

すべての保留中のマイグレーションが表示されます。まだ実行されていない新しいマイグレーションファイルがある場合、ここに一覧表示されます。

## マイグレーションの実行

```sh
./node_modules/.bin/deepkit-sql migration:up --path database.ts --migrationDir src/migrations
```

次の保留中のマイグレーションを実行します。 

## マイグレーションの取り消し

```sh
./node_modules/.bin/deepkit-sql migration:down --path database.ts --migrationDir src/migrations
```

最後に実行されたマイグレーションを取り消します。

## フェイクマイグレーション

たとえば、マイグレーション（up または down）を実行しようとして失敗したとします。問題を手動で修正しましたが、すでに実行済みになっているため、そのマイグレーションを再度実行できません。`--fake` オプションを使うと、実際には実行せずにデータベース上で実行済みとしてマークさせ、マイグレーションを偽装できます。これにより、次の保留中のマイグレーションを実行できます。

```sh
./node_modules/.bin/deepkit-sql migration:up --path database.ts --migrationDir src/migrations --fake
```