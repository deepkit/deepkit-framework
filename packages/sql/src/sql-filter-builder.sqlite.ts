import {SQLFilterBuilder} from './sql-filter-builder';

export class SQLiteFilterBuilder extends SQLFilterBuilder {
    protected getDeepColumnAccessor(table: string, column: string, path: string) {
        return `json_extract(${table}.${this.quoteId(column)}, ${this.quoteValue('$.' + path)})`;
    }
}
