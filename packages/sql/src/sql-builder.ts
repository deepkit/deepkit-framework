/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { SQLQueryModel } from './sql-adapter.js';
import { DefaultPlatform, SqlPlaceholderStrategy } from './platform/default-platform.js';
import { getPrimaryKeyHashGenerator, ReflectionClass, ReflectionProperty } from '@deepkit/type';
import { DatabaseJoinModel, DatabaseQueryModel } from '@deepkit/orm';
import { getSqlFilter } from './filter.js';

type ConvertDataToDict = (row: any) => { hash: string, item: { [name: string]: any } } | undefined;

export class Sql {
    constructor(
        public sql: string = '',
        public params: any[] = [],
    ) {
    }

    public appendSql(sql: Sql) {
        this.sql += ' ' + sql.sql;
        this.params.push(...sql.params);
    }

    public append(sql: string, params?: any[]) {
        this.sql += ' ' + sql;
        if (params) this.params.push(...params);
    }
}

export class SqlBuilder {
    protected sqlSelect: string[] = [];
    protected joins: { join: DatabaseJoinModel<any, any>, forJoinIndex: number, startIndex: number, converter: ConvertDataToDict }[] = [];

    protected placeholderStrategy: SqlPlaceholderStrategy;

    public rootConverter?: ConvertDataToDict;

    constructor(protected platform: DefaultPlatform, public params: string[] = []) {
        this.placeholderStrategy = new platform.placeholderStrategy();
        this.placeholderStrategy.offset = this.params.length;
    }

    protected appendWhereSQL(sql: Sql, schema: ReflectionClass<any>, model: SQLQueryModel<any>, tableName?: string, prefix: string = 'WHERE') {
        let whereClause: string = '';
        let whereParams: any[] = [];

        const placeholderStrategy = new this.platform.placeholderStrategy(sql.params.length);
        tableName = tableName || this.platform.getTableIdentifier(schema);

        if (model.filter) {
            const filter = getSqlFilter(schema, model.filter, model.parameters, this.platform.serializer);
            const builder = this.platform.createSqlFilterBuilder(schema, tableName);
            builder.placeholderStrategy = placeholderStrategy;
            whereClause = builder.convert(filter);
            whereParams = builder.params;
        }

        if (whereClause || model.where) {
            sql.append(prefix);

            if (whereClause) {
                sql.params.push(...whereParams);
                sql.append(whereClause);
            }

            if (model.where) {
                if (whereClause) sql.append('AND');
                const whereSql = model.where.convertToSQL(this.platform, placeholderStrategy, tableName);
                sql.params.push(...whereSql.params);
                sql.append(whereSql.sql);
            }
        }
    }

    protected appendHavingSQL(sql: Sql, schema: ReflectionClass<any>, model: DatabaseQueryModel<any>, tableName: string) {
        if (!model.having) return;

        const filter = getSqlFilter(schema, model.having, model.parameters, this.platform.serializer);
        const builder = this.platform.createSqlFilterBuilder(schema, tableName);
        builder.placeholderStrategy.offset = sql.params.length;
        const whereClause = builder.convert(filter);

        if (whereClause) {
            sql.append('HAVING');
            sql.params.push(...builder.params);
            sql.append(whereClause);
        }
    }

    protected selectColumns(schema: ReflectionClass<any>, model: SQLQueryModel<any>) {
        const tableName = this.platform.getTableIdentifier(schema);
        const properties = model.select.size ? [...model.select.values()].map(name => schema.getProperty(name)) : schema.getProperties();

        if (model.aggregate.size || model.groupBy.size || model.sqlSelect) {
            //we select only whats aggregated
            for (const name of model.groupBy.values()) {
                this.sqlSelect.push(tableName + '.' + this.platform.quoteIdentifier(name));
            }
            for (const [as, a] of model.aggregate.entries()) {
                if (a.property.isBackReference()) continue;

                this.sqlSelect.push(this.platform.getAggregateSelect(tableName, a.property, a.func) + ' AS ' + this.platform.quoteIdentifier(as));
            }

            if (model.sqlSelect) {
                const build = model.sqlSelect?.convertToSQL(this.platform, this.placeholderStrategy, tableName);
                this.params.push(...build.params);
                this.sqlSelect.push(build.sql);
            }
        } else {
            for (const property of properties) {
                if (property.isBackReference()) continue;

                this.sqlSelect.push(tableName + '.' + this.platform.quoteIdentifier(property.name));
            }
        }
    }

    protected selectColumnsWithJoins(schema: ReflectionClass<any>, model: SQLQueryModel<any>, refName: string = '') {
        const result: { startIndex: number, fields: ReflectionProperty[] } = { startIndex: this.sqlSelect.length, fields: [] };

        const properties = model.select.size ? [...model.select.values()].map(name => schema.getProperty(name)) : schema.getProperties();
        const tableName = this.platform.getTableIdentifier(schema);
        if (model.select.size && !model.select.has(schema.getPrimary().name)) properties.unshift(schema.getPrimary());

        for (const property of properties) {
            if (property.isBackReference()) continue;

            result.fields.push(property);
            const as = this.platform.quoteIdentifier(this.sqlSelect.length + '');

            if (refName) {
                this.sqlSelect.push(this.platform.quoteIdentifier(refName) + '.' + this.platform.quoteIdentifier(property.name) + ' AS ' + as);
            } else {
                this.sqlSelect.push(tableName + '.' + this.platform.quoteIdentifier(property.name) + ' AS ' + as);
            }
        }

        const forJoinIndex = this.joins.length - 1;
        for (const join of model.joins) {
            if (join.populate) {
                join.as = refName + '__' + join.propertySchema.name;
                const joinMap = {
                    join,
                    forJoinIndex: forJoinIndex,
                    converter: (() => {
                        return;
                    }) as ConvertDataToDict,
                    startIndex: 0,
                };
                this.joins.push(joinMap);

                const map = this.selectColumnsWithJoins(join.query.classSchema, join.query.model, refName + '__' + join.propertySchema.name);
                joinMap.converter = this.buildConverter(join.query.classSchema, join.query.model, map.startIndex, map.fields);
                joinMap.startIndex = map.startIndex;
            }
        }

        return result;
    }

    public convertRows(schema: ReflectionClass<any>, model: SQLQueryModel<any>, rows: any[]): any[] {
        if (!this.rootConverter) throw new Error('No root converter set');
        if (!this.joins.length) return rows.map(v => this.rootConverter!(v));

        const result: any[] = [];

        const itemsStack: ({ hash: string, item: any } | undefined)[] = [];
        itemsStack.push(undefined); //root
        for (const join of this.joins) {
            itemsStack.push(undefined);
        }

        for (const row of rows) {
            const converted = this.rootConverter(row);
            if (!converted) continue;
            if (!itemsStack[0] || itemsStack[0].hash !== converted.hash) {
                if (itemsStack[0]) result.push(itemsStack[0].item);
                itemsStack[0] = converted;
            }

            for (let joinId = 0; joinId < this.joins.length; joinId++) {
                const join = this.joins[joinId];
                if (!join.join.as) continue;

                const converted = join.converter(row);
                if (!converted) continue;
                const forItem = itemsStack[join.forJoinIndex + 1]!.item;

                if (!itemsStack[joinId + 1] || itemsStack[joinId + 1]!.hash !== converted.hash) {
                    itemsStack[joinId + 1] = converted;
                }

                if (join.join.propertySchema.isArray()) {
                    if (!forItem[join.join.as]) forItem[join.join.as] = [];
                    if (converted) {
                        //todo: set lastHash stack, so second level joins work as well
                        // we need to refactor lashHash to a stack first.
                        // const pkHasher = getPrimaryKeyHashGenerator(join.join.query.classSchema, this.platform.serializer);
                        // const pkHash = pkHasher(item);
                        forItem[join.join.as].push(converted.item);
                    }
                } else {
                    forItem[join.join.as] = converted.item;
                }
            }
        }

        if (itemsStack[0]) result.push(itemsStack[0].item);

        return result;
    }

    protected buildConverter(schema: ReflectionClass<any>, model: SQLQueryModel<any>, startIndex: number, fields: ReflectionProperty[]): ConvertDataToDict {
        const lines: string[] = [];
        let primaryKeyIndex = startIndex;

        for (const field of fields) {
            if (field.isPrimaryKey()) {
                primaryKeyIndex = startIndex;
                if (model.select.size && !model.select.has(field.name)) {
                    startIndex++;
                    continue;
                }
            }
            lines.push(`'${field.name}': row[${startIndex++}]`);
        }
        const pkHasher = getPrimaryKeyHashGenerator(schema, this.platform.serializer);

        const code = `
            return function(row) {
                if (null === row[${primaryKeyIndex}]) return;

                return {
                    hash: pkHasher({${JSON.stringify(schema.getPrimary().name)}: row[${primaryKeyIndex}]}),
                    item: {${lines.join(',\n')}}
                };
            }
        `;

        return new Function('pkHasher', code)(pkHasher) as ConvertDataToDict;
    }

    protected appendJoinSQL<T>(sql: Sql, model: SQLQueryModel<T>, parentName: string, prefix: string = ''): void {
        if (!model.joins.length) return;

        for (const join of model.joins) {
            const tableName = this.platform.getTableIdentifier(join.query.classSchema);
            const joinName = this.platform.quoteIdentifier(prefix + '__' + join.propertySchema.name);

            const foreignSchema = join.query.classSchema;

            //many-to-many
            if (join.propertySchema.isBackReference() && join.propertySchema.getBackReference().via) {
                const viaSchema = ReflectionClass.from(join.propertySchema.getBackReference().via);
                const pivotTableName = this.platform.getTableIdentifier(viaSchema);

                // JOIN pivotTableName as pivot ON (parent.id = pivot.left_foreign_id)
                // JOIN target ON (target.id = pivot.target_foreign_id)
                // viaSchema.name
                const pivotToLeft = viaSchema.findReverseReference(
                    join.classSchema.getClassType(),
                    join.propertySchema,
                );

                const pivotToRight = viaSchema.findReverseReference(
                    join.query.classSchema.getClassType(),
                    join.propertySchema
                );

                const pivotName = this.platform.quoteIdentifier(prefix + '__p_' + join.propertySchema.name);

                //first pivot table
                sql.append(`${join.type.toUpperCase()} JOIN ${pivotTableName} AS ${pivotName} ON (`);
                sql.append(`${pivotName}.${this.platform.quoteIdentifier(pivotToLeft.name)} = ${parentName}.${this.platform.quoteIdentifier(join.classSchema.getPrimary().name)}`);

                sql.append(`)`);

                //then right table
                sql.append(`${join.type.toUpperCase()} JOIN ${tableName} AS ${joinName} ON (`);
                sql.append(`${pivotName}.${this.platform.quoteIdentifier(pivotToRight.name)} = ${joinName}.${this.platform.quoteIdentifier(join.query.classSchema.getPrimary().name)}`);
                this.appendWhereSQL(sql, join.query.classSchema, join.query.model, joinName, 'AND');
                sql.append(`)`);

                this.appendJoinSQL(sql, join.query.model, joinName, prefix + '__' + join.propertySchema.name);

                continue;
            }

            sql.append(`${join.type.toUpperCase()} JOIN ${tableName} AS ${joinName} ON (`);

            if (join.propertySchema.isBackReference() && !join.propertySchema.getBackReference().via) {
                const backReference = foreignSchema.findReverseReference(
                    join.classSchema.getClassType(),
                    join.propertySchema,
                );
                sql.append(`${parentName}.${this.platform.quoteIdentifier(join.classSchema.getPrimary().name)} = ${joinName}.${this.platform.quoteIdentifier(backReference.name)}`);
            } else {
                sql.append(`${parentName}.${this.platform.quoteIdentifier(join.propertySchema.name)} = ${joinName}.${this.platform.quoteIdentifier(join.foreignPrimaryKey.name)}`);
            }
            this.appendWhereSQL(sql, join.query.classSchema, join.query.model, joinName, 'AND');

            sql.append(`)`);

            this.appendJoinSQL(sql, join.query.model, joinName, prefix + '__' + join.propertySchema.name);
        }
    }

    public build<T>(schema: ReflectionClass<any>, model: SQLQueryModel<T>, head: string): Sql {
        const tableName = this.platform.getTableIdentifier(schema);

        const sql = new Sql(`${head} FROM`, this.params);

        const withRange = model.limit !== undefined || model.skip !== undefined;
        if (withRange && model.hasJoins()) {
            //wrap FROM table => FROM (SELECT * FROM table LIMIT x OFFSET x)

            sql.append(`(SELECT * FROM ${tableName}`);
            this.platform.applyLimitAndOffset(sql, model.limit, model.skip);
            sql.append(`) as ${tableName}`);
        } else {
            sql.append(tableName);
        }

        this.appendJoinSQL(sql, model, tableName);
        this.appendWhereSQL(sql, schema, model);

        if (model.groupBy.size) {
            const groupBy: string[] = [];
            for (const g of model.groupBy.values()) {
                groupBy.push(`${tableName}.${this.platform.quoteIdentifier(g)}`);
            }

            sql.append('GROUP BY ' + groupBy.join(', '));
        }

        this.appendHavingSQL(sql, schema, model, tableName);

        const order: string[] = [];
        if (model.sort) {
            for (const [name, sort] of Object.entries(model.sort)) {
                order.push(`${tableName}.${this.platform.quoteIdentifier(name)} ${sort}`);
            }
            if (order.length) sql.append(' ORDER BY ' + (order.join(', ')));
        }

        if (withRange && !model.hasJoins()) {
            this.platform.applyLimitAndOffset(sql, model.limit, model.skip);
        }

        return sql;
    }

    public update<T>(schema: ReflectionClass<any>, model: SQLQueryModel<T>, set: string[]): Sql {
        const tableName = this.platform.getTableIdentifier(schema);
        const primaryKey = schema.getPrimary();
        const select = this.select(schema, model, { select: [`${tableName}.${primaryKey.name}`] });

        return new Sql(`UPDATE ${tableName} SET ${set.join(', ')} WHERE ${this.platform.quoteIdentifier(primaryKey.name)} IN (SELECT * FROM (${select.sql}) as __)`, select.params);
    }

    public select(
        schema: ReflectionClass<any>,
        model: SQLQueryModel<any>,
        options: { select?: string[] } = {}
    ): Sql {
        const manualSelect = options.select && options.select.length ? options.select : undefined;

        if (!manualSelect) {
            if (model.hasJoins()) {
                const map = this.selectColumnsWithJoins(schema, model, '');
                this.rootConverter = this.buildConverter(schema, model, map.startIndex, map.fields);
            } else {
                this.selectColumns(schema, model);
            }
        }

        return this.build(schema, model, 'SELECT ' + (manualSelect || this.sqlSelect).join(', '));
    }
}
