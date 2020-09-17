import {SQLQueryModel} from './sql-adapter';
import {DefaultPlatform} from './platform/default-platform';
import {ClassSchema, PropertySchema} from '@deepkit/type';
import {DatabaseJoinModel, getPrimaryKeyHashGenerator, QueryToSql} from '@deepkit/orm';

type ConvertDataToDict = (row: any) => { [name: string]: any };

export class SqlBuilder {
    protected sqlSelect: string[] = [];
    protected joins: { join: DatabaseJoinModel, startIndex: number, converter: ConvertDataToDict }[] = [];

    public rootConverter?: ConvertDataToDict;

    constructor(protected platform: DefaultPlatform) {
    }

    protected getWhereSQL(schema: ClassSchema, filter: any, tableName?: string) {
        tableName = tableName ?? this.platform.getTableIdentifier(schema);
        return new QueryToSql(schema, tableName, this.platform.serializer, this.platform.quoteValue.bind(this.platform), this.platform.quoteIdentifier.bind(this.platform)).convert(filter);
    }

    protected selectColumns(schema: ClassSchema, model: SQLQueryModel<any>, refName: string = '') {
        const result: { startIndex: number, fields: PropertySchema[] } = {startIndex: this.sqlSelect.length, fields: []};

        const properties = model.select.size ? [...model.select.values()].map(name => schema.getProperty(name)) : schema.getClassProperties().values();
        const tableName = this.platform.getTableIdentifier(schema);

        for (const property of properties) {
            if (property.backReference) continue;

            result.fields.push(property);
            const as = this.platform.quoteIdentifier(this.sqlSelect.length + '');

            if (refName) {
                this.sqlSelect.push(this.platform.quoteIdentifier(refName) + '.' + this.platform.quoteIdentifier(property.name) + ' AS ' + as);
            } else {
                this.sqlSelect.push(tableName + '.' + this.platform.quoteIdentifier(property.name) + ' AS ' + as);
            }
        }

        for (const join of model.joins) {
            if (join.populate) {
                const map = this.selectColumns(join.query.classSchema, join.query.model, refName + '__' + join.propertySchema.name);
                join.as = refName + '__' + join.propertySchema.name;
                this.joins.push({
                    join,
                    converter: this.buildConverter(map.startIndex, map.fields),
                    startIndex: map.startIndex,
                });
            }
        }

        return result;
    }

    public convertRows(schema: ClassSchema, model: SQLQueryModel<any>, rows: any[]): any[] {
        if (!this.rootConverter) throw new Error('No root converter set');

        const result: any[] = [];
        let lastHash: string | undefined;
        let lastRow: any | undefined;

        const rootPkHasher = getPrimaryKeyHashGenerator(schema, this.platform.serializer);

        for (const row of rows) {
            const converted = this.rootConverter(row);
            const pkHash = rootPkHasher(converted);
            if (lastHash !== pkHash) {
                if (lastRow) result.push(lastRow);
                lastRow = converted;
                lastHash = pkHash;
            }

            for (const join of this.joins) {
                if (!join.join.as) continue;

                if (join.join.propertySchema.isArray) {
                    if (!converted[join.join.as]) converted[join.join.as] = [];
                    converted[join.join.as].push(join.converter(row));
                } else {
                    converted[join.join.as] = join.converter(row);
                }
            }
        }

        if (lastRow) result.push(lastRow);

        return result;
    }

    protected buildConverter(startIndex: number, fields: PropertySchema[]): ConvertDataToDict {
        const lines: string[] = [];
        let primaryKeyIndex = startIndex;

        for (const field of fields) {
            if (field.isId) primaryKeyIndex = startIndex;
            lines.push(`'${field.name}': row[${startIndex++}]`);
        }

        const code = `
            return function(row) {
                if (null === row[${primaryKeyIndex}]) return;
            
                return {
                    ${lines.join(',\n')}
                };
            }
        `;

        return new Function(code)() as ConvertDataToDict;
    }

    protected getJoinSQL<T>(model: SQLQueryModel<T>, parentName: string, prefix: string = ''): string {
        if (!model.joins.length) return '';

        const joins: string[] = [];

        for (const join of model.joins) {
            const tableName = this.platform.getTableIdentifier(join.query.classSchema);
            const joinName = this.platform.quoteIdentifier(prefix + '__' + join.propertySchema.name);

            const onClause: string[] = [];
            const foreignSchema = join.query.classSchema;

            if (join.propertySchema.backReference) {
                if (join.propertySchema.backReference.via) {
                    throw new Error('n-to-n relation not yet implemented');
                } else {
                    const backReference = foreignSchema.findReverseReference(
                        join.classSchema.classType,
                        join.propertySchema,
                    );
                    onClause.push(`${parentName}.${this.platform.quoteIdentifier(join.classSchema.getPrimaryField().name)} = ${joinName}.${this.platform.quoteIdentifier(backReference.name)}`);
                }
            } else {
                onClause.push(`${parentName}.${this.platform.quoteIdentifier(join.propertySchema.name)} = ${joinName}.${this.platform.quoteIdentifier(join.foreignPrimaryKey.name)}`);
            }


            const whereClause = this.getWhereSQL(join.query.classSchema, join.query.model.filter, joinName);
            if (whereClause) onClause.push(whereClause);

            joins.push(`${join.type.toUpperCase()} JOIN ${tableName} AS ${joinName} ON (${onClause.join(' AND ')})`);

            const moreJoins = this.getJoinSQL(join.query.model, joinName, prefix + '__' + join.propertySchema.name);
            if (moreJoins) joins.push(moreJoins);
        }

        return joins.join('\n');
    }

    public build<T>(schema: ClassSchema, model: SQLQueryModel<T>, head: string): string {

        const tableName = this.platform.getTableIdentifier(schema);
        const whereClause = this.getWhereSQL(schema, model.filter) || 'true';
        const joins = this.getJoinSQL(model, tableName);
        let sql = `${head} FROM ${tableName} ${joins} WHERE ${whereClause}`;

        if (model.limit !== undefined) sql += ' LIMIT ' + this.platform.quoteValue(model.limit);
        if (model.skip !== undefined) sql += ' SKIP ' + this.platform.quoteValue(model.skip);

        // console.log('build', sql);
        return sql;
    }

    public select(schema: ClassSchema, model: SQLQueryModel<any>): string {
        const map = this.selectColumns(schema, model);
        this.rootConverter = this.buildConverter(map.startIndex, map.fields);
        const order: string[] = [];
        if (model.sort) {
            for (const [name, sort] of Object.entries(model.sort)) {
                order.push(`${this.platform.quoteIdentifier(name)} ${sort}`);
            }
        }

        let sql = this.build(schema, model, 'SELECT ' + this.sqlSelect.join(', '));

        if (order.length) {
            sql += ' ORDER BY ' + (order.join(', '));
        }

        return sql;
    }

}
