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
import { DatabaseJoinModel, DatabaseQueryModel, OrmEntity } from '@deepkit/orm';
import { getSqlFilter } from './filter.js';

type ConvertedData = { hash: string, item: { [name: string]: any }, joined: { [name: string]: any }[] };
type ConvertDataToDict = (row: any) => ConvertedData | undefined;

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
            //we select only what is aggregated
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
                if (model.isLazyLoaded(property.name)) continue;

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
            if (model.isLazyLoaded(property.name)) continue;

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
        if (!this.joins.length) return rows.map(v => this.rootConverter!(v)?.item);

        const result: any[] = [];
        const entities: {
            map: { [hash: string]: ConvertedData },
            current?: ConvertedData
        }[] = [
            { map: {}, current: undefined }
        ];
        for (const join of this.joins) {
            entities.push({ map: {}, current: undefined });
        }

        for (const row of rows) {
            const convertedRoot = this.rootConverter(row);
            if (!convertedRoot) continue;
            if (!entities[0].map[convertedRoot.hash]) {
                entities[0].current = entities[0].map[convertedRoot.hash] = convertedRoot;
                result.push(convertedRoot.item);
            } else {
                entities[0].current = entities[0].map[convertedRoot.hash];
            }

            for (let joinId = 0; joinId < this.joins.length; joinId++) {
                const join = this.joins[joinId];
                if (!join.join.as) continue;

                const converted = join.converter(row);
                if (!converted) continue;
                const entity = entities[joinId + 1];

                if (!entity.map[converted.hash]) {
                    entity.current = entity.map[converted.hash] = converted;
                } else {
                    entity.current = entity.map[converted.hash];
                }

                const forEntity = entities[join.forJoinIndex + 1];
                if (!forEntity.current) continue;
                const joined = forEntity.current.joined[joinId];

                //check if the item has already been added to the forEntity
                if (!joined[converted.hash]) {
                    joined[converted.hash] = converted.item;
                    if (join.join.propertySchema.isArray()) {
                        (forEntity.current.item[join.join.as] ||= []).push(converted.item);
                    } else {
                        forEntity.current.item[join.join.as] = converted.item;
                    }
                }
            }
        }

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
        const joinedArray = `[${this.joins.map(v => `{}`).join(', ')}]`;

        const code = `
            return function(row) {
                if (null === row[${primaryKeyIndex}]) return;

                return {
                    hash: pkHasher({${JSON.stringify(schema.getPrimary().name)}: row[${primaryKeyIndex}]}),
                    item: {${lines.join(',\n')}},
                    joined: ${joinedArray}
                };
            }
        `;

        return new Function('pkHasher', code)(pkHasher) as ConvertDataToDict;
    }

    protected appendJoinSQL<T extends OrmEntity>(sql: Sql, model: SQLQueryModel<T>, parentName: string, prefix: string = ''): void {
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

    protected applyOrder(order: string[], model: SQLQueryModel<any>, tableName: string = '') {
        if (model.sort) {
            for (const [name, sort] of Object.entries(model.sort)) {
                order.push(`${tableName}.${this.platform.quoteIdentifier(name)} ${sort}`);
            }
        }
    }

    /**
     * If a join is included that is an array, we have to move LIMIT/ORDER BY into a sub-select,
     * so that these one-to-many/many-to-many joins are correctly loaded even if there is LIMIT 1.
     */
    protected hasToManyJoins(): boolean {
        for (const join of this.joins) {
            if (join.join.populate && join.join.propertySchema.isArray()) return true;
        }
        return false;
    }

    public build<T extends OrmEntity>(schema: ReflectionClass<any>, model: SQLQueryModel<T>, head: string): Sql {
        const tableName = this.platform.getTableIdentifier(schema);

        const sql = new Sql(`${head} FROM`, this.params);

        const withRange = model.limit !== undefined || model.skip !== undefined;
        const needsSubSelect = withRange && this.hasToManyJoins();
        if (needsSubSelect) {
            //wrap FROM table => FROM (SELECT * FROM table LIMIT x OFFSET x)
            sql.append(`(SELECT * FROM ${tableName}`);
            this.appendWhereSQL(sql, schema, model);
            const order: string[] = [];
            this.applyOrder(order, model, tableName);
            if (order.length) sql.append(' ORDER BY ' + (order.join(', ')));
            this.platform.applyLimitAndOffset(sql, model.limit, model.skip);
            sql.append(`) as ${tableName}`);
            this.appendJoinSQL(sql, model, tableName);
        } else {
            sql.append(tableName);
            this.appendJoinSQL(sql, model, tableName);
            this.appendWhereSQL(sql, schema, model);
        }

        if (model.groupBy.size) {
            const groupBy: string[] = [];
            for (const g of model.groupBy.values()) {
                groupBy.push(`${tableName}.${this.platform.quoteIdentifier(g)}`);
            }

            sql.append('GROUP BY ' + groupBy.join(', '));
        }

        this.appendHavingSQL(sql, schema, model, tableName);

        const order: string[] = [];
        if (!needsSubSelect) {
            //ORDER BY are handled as normal
            this.applyOrder(order, model, tableName);
        }

        for (const join of this.joins) {
            if (!join.join.query.model.sort) continue;
            for (const [name, sort] of Object.entries(join.join.query.model.sort)) {
                order.push(`${join.join.as}.${this.platform.quoteIdentifier(name)} ${sort}`);
            }
        }
        if (order.length) sql.append(' ORDER BY ' + (order.join(', ')));

        if (withRange && !this.hasToManyJoins()) {
            this.platform.applyLimitAndOffset(sql, model.limit, model.skip);
        }

        return sql;
    }

    public update<T extends OrmEntity>(schema: ReflectionClass<any>, model: SQLQueryModel<T>, set: string[]): Sql {
        const tableName = this.platform.getTableIdentifier(schema);
        const primaryKey = schema.getPrimary();
        const select = this.select(schema, model, { select: [`${tableName}.${primaryKey.name}`] });

        return new Sql(`UPDATE ${tableName}
                        SET ${set.join(', ')}
                        WHERE ${this.platform.quoteIdentifier(primaryKey.name)} IN (SELECT * FROM (${select.sql}) as __)`, select.params);
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

        const sql = this.build(schema, model, 'SELECT ' + (manualSelect || this.sqlSelect).join(', '));

        if (this.platform.supportsSelectFor()) {
            switch (model.for) {
                case 'update': {
                    sql.append(' FOR UPDATE');
                    break;
                }
                case 'share': {
                    sql.append(' FOR SHARE');
                    break;
                }
            }
        }

        return sql;
    }
}
