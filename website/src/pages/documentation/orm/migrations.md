# Migrations

Migrations provide a version-controlled way to evolve your database schema over time. They ensure that database changes are applied consistently across different environments (development, staging, production) and can be safely rolled back if needed.

## Why Use Migrations?

Migrations solve several critical problems in database management:

1. **Version Control**: Track database schema changes alongside code changes
2. **Team Collaboration**: Ensure all developers have the same database structure
3. **Deployment Safety**: Apply schema changes reliably in production
4. **Rollback Capability**: Revert problematic changes when needed
5. **Environment Consistency**: Keep development, staging, and production in sync

## How Migrations Work

Deepkit ORM automatically generates migrations by comparing your current entity definitions with the existing database schema. This diff-based approach means you focus on defining your entities, and the ORM handles the database changes.

### Migration Lifecycle

1. **Modify Entities**: Change your TypeScript entity definitions
2. **Generate Migration**: Run `migration:create` to generate a migration file
3. **Review & Customize**: Examine and optionally modify the generated migration
4. **Apply Migration**: Run `migration:up` to execute pending migrations
5. **Deploy**: Include migration files in your deployment process

Deepkit ORM migrations are enabled by default when using Deepkit Framework.

## Migration Commands

Deepkit ORM provides several commands for managing migrations:

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `migration:create` | Generates a new migration file based on entity changes | After modifying entity definitions |
| `migration:pending` | Shows migrations that haven't been applied yet | Before deploying or to check status |
| `migration:up` | Executes pending migrations | During deployment or development setup |
| `migration:down` | Reverts the last migration | When you need to rollback changes |

### Command Availability

These commands are available in two ways:

1. **With Deepkit Framework**: Commands are automatically available when you import `FrameworkModule`
2. **Standalone**: Use the `deepkit-sql` CLI tool from `@deepkit/sql` package

### Framework vs Standalone

**Deepkit Framework Integration**:
- Automatically discovers database providers
- Integrates with application configuration
- Suitable for full Deepkit applications

**Standalone CLI**:
- Requires explicit database file specification
- Useful for ORM-only projects
- More control over migration process

```bash
# Framework approach (automatic discovery)
npm run migration:create

# Standalone approach (explicit database file)
./node_modules/.bin/deepkit-sql migration:create --path database.ts --migrationDir src/migrations
```

## Creating a migration

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

A new migration file is created in `src/migrations`. 

The newly created migration file contains now the up and down methods based on the difference between the entities defined in your TypeScript app and the configured database. 
You can now modify the up method to your needs. The down method is automatically generated based on the up method.
You commit this file to your repository so that other developers can also execute it.

## Pending Migrations

```sh
./node_modules/.bin/deepkit-sql migration:pending --path database.ts --migrationDir src/migrations
```

This shows all pending migrations. If you have a new migration file that is not executed yet, it will be listed here.

## Executing Migrations

```sh
./node_modules/.bin/deepkit-sql migration:up --path database.ts --migrationDir src/migrations
```

This executes the next pending migration. 

## Reverting Migrations

```sh
./node_modules/.bin/deepkit-sql migration:down --path database.ts --migrationDir src/migrations
```

This reverts the last executed migration.

## Fake migrations

Let's say you wanted to execute a migration (up or down), but it failed. You fixed the issue manually, but now you can't execute the migration again, because it's already executed. You can use the `--fake` option to fake the migration, so that it's marked as executed in the database without actually executing it. This way you can execute the next pending migration.

```sh
./node_modules/.bin/deepkit-sql migration:up --path database.ts --migrationDir src/migrations --fake
```
