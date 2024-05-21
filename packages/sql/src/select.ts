import { DatabaseSession, DeleteResult, PatchResult, Query2Resolver, SelectorState } from '@deepkit/orm';
import { castFunction, Changes, ReflectionClass } from '@deepkit/type';
import { SQLConnectionPool, SQLDatabaseAdapter } from './sql-adapter.js';
import { isArray } from '@deepkit/core';
import { SqlFormatter } from './sql-formatter.js';
import { SqlBuilder } from './sql-builder.js';

export class SQLQuery2Resolver<T extends object> extends Query2Resolver<T> {
    classSchema: ReflectionClass<T>;

    constructor(
        protected model: SelectorState,
        protected session: DatabaseSession<SQLDatabaseAdapter>,
        protected connectionPool: SQLConnectionPool,
    ) {
        super(model, session);
        this.classSchema = this.model.schema;
    }

    count(model: SelectorState): Promise<number> {
        return Promise.resolve(0);
    }

    delete(model: SelectorState, deleteResult: DeleteResult<T>): Promise<void> {
        return Promise.resolve(undefined);
    }

    protected createFormatter(withIdentityMap: boolean = false) {
        return new SqlFormatter(
            this.classSchema,
            this.session.adapter.platform.serializer,
            this.session.getHydrator(),
            withIdentityMap ? this.session.identityMap : undefined,
        );
    }

    async find(model: SelectorState): Promise<T[]> {
        const builder = new SqlBuilder(this.session.adapter);
        const sql = builder.buildSql(model, 'SELECT');
        const formatter = this.createFormatter(model.withIdentityMap);

        const connection = await this.connectionPool.getConnection(this.session.logger, this.session.assignedTransaction, this.session.stopwatch);

        try {
            const caster = castFunction(undefined, undefined, model.schema.type);
            const rows = await connection.execAndReturnAll(sql.sql, sql.params);
            if (!isArray(rows)) return [];

            const results: T[] = [];
            // if (model.joins) {
            //     const converted = rows;
            //     // const converted = sqlBuilder.convertRows(this.classSchema, model, rows);
            //     for (const row of converted) results.push(formatter.hydrate(model, row));
            // } else {
            for (const row of rows) results.push(caster(row) as T);
            // }

            return results;
        } finally {
            connection.release();
        }
    }

    findOneOrUndefined(model: SelectorState): Promise<T | undefined> {
        return Promise.resolve(undefined);
    }

    patch(model: SelectorState, value: Changes<T>, patchResult: PatchResult<T>): Promise<void> {
        return Promise.resolve(undefined);
    }
}
