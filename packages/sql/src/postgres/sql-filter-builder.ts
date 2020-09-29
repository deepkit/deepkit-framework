import {SQLFilterBuilder} from '../sql-filter-builder';

export class PostgreSQLFilterBuilder extends SQLFilterBuilder {
    protected getDeepColumnAccessor(table: string, column: string, path: string) {
        return `${table}.${this.quoteId(column)}->${this.quoteValue(path)}`;
    }
}
