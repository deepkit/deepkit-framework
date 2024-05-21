import { SchemaParser } from '../src/reverse/schema-parser.js';
import { DatabaseModel } from '../src/schema/table.js';
import { DefaultPlatform } from '../src/platform/default-platform.js';
import { ReflectionClass, ReflectionKind } from '@deepkit/type';
import { PreparedAdapter } from '../src/prepare.js';
import { escape } from 'sqlstring';
import {
    SQLConnection,
    SQLConnectionPool,
    SQLDatabaseAdapter,
    SQLDatabaseQueryFactory,
    SQLPersistence,
} from '../src/sql-adapter.js';
import { DatabaseLogger, DatabaseSession, DatabaseTransaction, SelectorState } from '@deepkit/orm';
import { Stopwatch } from '@deepkit/stopwatch';
import { SqlBuilderRegistry } from '../src/sql-builder-registry.js';

export class MySchemaParser extends SchemaParser {
    async parse(database: DatabaseModel, limitTableNames?: string[]) {
    }
}

export class MyPlatform extends DefaultPlatform {
    public override schemaParserType = MySchemaParser;

    constructor() {
        super();
        this.addType(ReflectionKind.number, 'integer');
    }

    quoteValue(value: any): string {
        return escape(value);
    }
}

export class MyConnectionPool extends SQLConnectionPool {
    getConnection(logger?: DatabaseLogger, transaction?: DatabaseTransaction, stopwatch?: Stopwatch): Promise<SQLConnection> {
        throw new Error('Method not implemented.');
    }
}

export class MyAdapter extends SQLDatabaseAdapter {
    connectionPool: SQLConnectionPool = new MyConnectionPool();
    platform: DefaultPlatform = new MyPlatform();

    createPersistence(databaseSession: DatabaseSession<this>): SQLPersistence {
        throw new Error('Method not implemented.');
    }

    createQuery2Resolver(model: SelectorState, session: DatabaseSession<this>): any {
        return {} as any;
    }

    getSchemaName(): string {
        return 'public';
    }

    queryFactory(databaseSession: DatabaseSession<this>) {
        return new SQLDatabaseQueryFactory(this.connectionPool, this.platform, databaseSession);
    }

    createTransaction(session: DatabaseSession<this>): DatabaseTransaction {
        throw new Error('Method not implemented.');
    }

    disconnect(force?: boolean): void {
    }

    getName(): string {
        return '';
    }
}

export const adapter: PreparedAdapter = {
    getName: () => 'adapter',
    platform: new MyPlatform(),
    preparedEntities: new Map<ReflectionClass<any>, any>(),
    builderRegistry: new SqlBuilderRegistry()
};
