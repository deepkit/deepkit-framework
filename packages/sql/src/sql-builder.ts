/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { DefaultPlatform, SqlPlaceholderStrategy } from './platform/default-platform.js';
import {
    getPrimaryKeyHashGenerator,
    isBackReference,
    isDatabaseSkipped,
    ReflectionClass,
    ReflectionProperty,
} from '@deepkit/type';
import {
    DatabaseQueryModel,
    isOp,
    isProperty,
    OpExpression,
    opTag,
    SelectorProperty,
    SelectorState,
} from '@deepkit/orm';
import { getSqlFilter } from './filter.js';
import { PreparedAdapter } from './prepare.js';
import { SqlBuilderState } from './sql-builder-registry.js';

type ConvertedData = { hash: string, item: { [name: string]: any }, joined: { [name: string]: any }[] };
type ConvertDataToDict = (row: any) => ConvertedData | undefined;

function isSelected(model: SelectorState, name: string): boolean {
    for (const select of model.select) {
        if (isProperty(select) && select.name === name) return true;
    }
    return false;
}

type Selection = (SelectorProperty<unknown> | OpExpression)[];

function isInSelection(selection: Selection, name: string): boolean {
    for (const select of selection) {
        if (isProperty(select) && select.name === name) return true;
    }
    return false;
}

function isLazyLoaded(model: SelectorState, field: SelectorProperty<unknown> | OpExpression): boolean {
    if (isOp(field)) return false;
    return !!model.lazyLoaded && model.lazyLoaded.includes(field);
}

function collectParamsFromOp(op?: OpExpression, params: any[] = []) {
    if (!op) return;
    for (const arg of op.args) {
        if (isProperty(op)) {
            continue;
        } else if (isOp(arg)) {
            collectParamsFromOp(arg, params);
        } else {
            params.push(arg);
        }
    }
}

function collectParams(model: SelectorState, params: any[] = []) {
    if (model.where) collectParamsFromOp(model.where, params);

    if (model.joins) {
        for (const join of model.joins) {
            collectParamsFromOp(join.where, params);
        }
    }

    return params;
}

//
// export function buildSql(adapter: PreparedAdapter, model: Query2Model & { sqlCache?: { sql: string } }) {
//     if (model.sqlCache) {
//         return {
//             sql: model.sqlCache.sql,
//             params: collectParams(model),
//         };
//     }
//
//     const builderState = new SqlBuilder(adapter);
//
//     const where = builderState.build(model.where);
//     const entity = getPreparedEntity(adapter, model.schema);
//     const joins: string[] = [];
//
//     if (model.joins) {
//         for (const join of model.joins) {
//             const entity = getPreparedEntity(adapter, join.schema);
//             const where = builderState.build(join.where);
//             joins.push(`LEFT JOIN ${entity.tableNameEscaped} ON (${where})`);
//         }
//     }
//
//     const sql = `SELECT * FROM ${entity.tableNameEscaped} ${joins.join(', ')} WHERE ${where}`;
//
//     model.sqlCache = { sql };
//
//     return {
//         sql,
//         params: builderState.params,
//     };
// }


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

export class SqlBuilder implements SqlBuilderState {
    protected sqlSelect: string[] = [];
    protected joins: {
        join: SelectorState,
        forJoinIndex: number,
        startIndex: number,
        converter: ConvertDataToDict
    }[] = [];

    protected placeholderStrategy: SqlPlaceholderStrategy;

    public rootConverter?: ConvertDataToDict;
    protected platform: DefaultPlatform;

    constructor(
        public adapter: PreparedAdapter,
        public params: string[] = [],
    ) {
        this.platform = adapter.platform;
        this.placeholderStrategy = new this.platform.placeholderStrategy();
        this.placeholderStrategy.offset = this.params.length;
    }

    protected getColumnName(names: { [name: string]: number }, arg: any): string {
        if (isProperty(arg)) {
            // return arg.as || arg.name;
            return arg.name;
        }

        if (isOp(arg)) {
            const op = arg[opTag];
            // const name = arg.as || op.name;
            const name = op.name;
            if (!names[name]) {
                names[name] = 0;
            } else {
                names[name]++;
            }
            return name + (names[name] ? names[name] : '');
        }

        return this.addParam(arg);
    }

    build(arg: any): string {
        if (arg === undefined) return '';

        if (isProperty(arg)) {
            return this.adapter.builderRegistry.field(this, arg);
        }

        if (isOp(arg)) {
            const op = arg[opTag];
            return this.adapter.builderRegistry.ops[op.id](this, arg);
        }

        return this.addParam(arg);
    }

    addParam(value: any) {
        this.params.push(value);
        return this.placeholderStrategy.getPlaceholder();
    }

    protected appendWhereSQL(sql: Sql, model: SelectorState, prefix: string = 'WHERE') {
        if (model.where) {
            const whereClause = this.build(model.where);
            if (whereClause) {
                if (prefix) sql.append(prefix);
                sql.append(whereClause);
            }
        }
    }

    protected appendHavingSQL(sql: Sql, schema: ReflectionClass<any>, model: DatabaseQueryModel<any>, tableName: string) {
        if (!model.having) return;

        const filter = getSqlFilter(schema, model.having, model.parameters, this.platform.serializer);
        const builder = this.platform.createSqlFilterBuilder(this.adapter, schema, tableName);
        builder.placeholderStrategy.offset = sql.params.length;
        const whereClause = builder.convert(filter);

        if (whereClause) {
            sql.append('HAVING');
            sql.params.push(...builder.params);
            sql.append(whereClause);
        }
    }

    protected selectColumns(model: SelectorState) {
        const result: { startIndex: number, fields: string[] } = {
            startIndex: this.sqlSelect.length,
            fields: [],
        };

        const selection: Selection = model.select.length ? model.select : model.fields.$$fields;
        const names: { [name: string]: number } = {};

        for (const field of selection) {
            if (isOp(field)) {
                this.sqlSelect.push(this.build(field));
            } else {
                if (isBackReference(field.property.type)) continue;
                if (isDatabaseSkipped(field.property.type, this.adapter.getName())) continue;
                if (isLazyLoaded(model, field)) continue;
                this.sqlSelect.push(this.build(field));
            }
            result.fields.push(this.getColumnName(names, field));
        }

        const forJoinIndex = this.joins.length - 1;

        for (const join of model.joins || []) {
            // if (join.populate) {
            //     join.as = refName + '__' + join.schema.name;
            //     const joinMap = {
            //         join,
            //         forJoinIndex: forJoinIndex,
            //         converter: (() => {
            //             return;
            //         }) as ConvertDataToDict,
            //         startIndex: 0,
            //     };
            //     this.joins.push(joinMap);
            //
            //     const map = this.selectColumnsWithJoins(join.schema, join.query.model, refName + '__' + join.propertySchema.name);
            //     joinMap.converter = this.buildConverter(join.query.classSchema, join.query.model, map.startIndex, map.fields);
            //     joinMap.startIndex = map.startIndex;
            // }
        }
    }

    protected selectColumnsWithJoins(model: SelectorState, refName: string = '') {
        const result: { startIndex: number, fields: string[] } = {
            startIndex: this.sqlSelect.length,
            fields: [],
        };

        // const selection: Selection = model.select.length ? model.select : model.from.$$fields;

        // if (model.select.length && !isInSelection(selection, schema.getPrimary().name)) {
        //     properties.unshift(model.from[schema.getPrimary().name]);
        // }

        // const prepared = getPreparedEntity(this.adapter, schema);

        // for (const property of properties) {
        //     if (isBackReference()) continue;
        //     if (property instanceof ReflectionProperty) {
        //         if (property.isDatabaseSkipped(this.adapter.getName())) continue;
        //         if (isLazyLoaded(model, model.from[property.name])) continue;
        //
        //         result.fields.push(property.name);
        //
        //         const as = this.platform.quoteIdentifier(this.sqlSelect.length + '');
        //
        //         if (refName) {
        //             this.sqlSelect.push(this.platform.quoteIdentifier(refName) + '.' + prepared.fieldMap[property.name].columnNameEscaped + ' AS ' + as);
        //         } else {
        //             this.sqlSelect.push(prepared.tableNameEscaped + '.' + prepared.fieldMap[property.name].columnNameEscaped + ' AS ' + as);
        //         }
        //     } else {
        //
        //     }
        // }

        // const forJoinIndex = this.joins.length - 1;
        // for (const join of model.joins) {
        //     if (join.populate) {
        //         join.as = refName + '__' + join.propertySchema.name;
        //         const joinMap = {
        //             join,
        //             forJoinIndex: forJoinIndex,
        //             converter: (() => {
        //                 return;
        //             }) as ConvertDataToDict,
        //             startIndex: 0,
        //         };
        //         this.joins.push(joinMap);
        //
        //         const map = this.selectColumnsWithJoins(join.query.classSchema, join.query.model, refName + '__' + join.propertySchema.name);
        //         joinMap.converter = this.buildConverter(join.query.classSchema, join.query.model, map.startIndex, map.fields);
        //         joinMap.startIndex = map.startIndex;
        //     }
        // }

        return result;
    }

    public convertRows(schema: ReflectionClass<any>, model: SelectorState, rows: any[]): any[] {
        if (!this.rootConverter) throw new Error('No root converter set');
        if (!this.joins.length) return rows.map(v => this.rootConverter!(v)?.item);

        const result: any[] = [];
        const entities: {
            map: { [hash: string]: ConvertedData },
            current?: ConvertedData
        }[] = [
            { map: {}, current: undefined },
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
                // if (!joined[converted.hash]) {
                //     joined[converted.hash] = converted.item;
                //     if (join.join.propertySchema.isArray()) {
                //         (forEntity.current.item[join.join.as] ||= []).push(converted.item);
                //     } else {
                //         forEntity.current.item[join.join.as] = converted.item;
                //     }
                // }
            }
        }

        return result;
    }

    protected buildConverter(
        platform: DefaultPlatform,
        model: SelectorState,
        startIndex: number,
        fields: ReflectionProperty[],
    ): ConvertDataToDict {
        const lines: string[] = [];
        let primaryKeyIndex = startIndex;

        for (const field of fields) {
            if (field.isPrimaryKey()) {
                primaryKeyIndex = startIndex;
                if (model.select.length && !isSelected(model, field.name)) {
                    startIndex++;
                    continue;
                }
            }
            lines.push(`'${field.name}': row[${startIndex++}]`);
        }
        const pkHasher = getPrimaryKeyHashGenerator(model.schema, platform.serializer);
        const joinedArray = `[${model.joins?.map(v => `{}`).join(', ')}]`;

        const code = `
            return function(row) {
                if (null === row[${primaryKeyIndex}]) return;

                return {
                    hash: pkHasher({${JSON.stringify(model.schema.getPrimary().name)}: row[${primaryKeyIndex}]}),
                    item: {${lines.join(',\n')}},
                    joined: ${joinedArray}
                };
            }
        `;

        return new Function('pkHasher', code)(pkHasher) as ConvertDataToDict;
    }

    // protected appendJoinSQL<T extends OrmEntity>(sql: Sql, model: Query2Model, parentName: string, prefix: string = ''): void {
    //     if (!model.joins?.length) return;
    //
    //     for (const join of model.joins) {
    //         const originPrepared = getPreparedEntity(this.adapter, join.classSchema);
    //         const joinPrepared = getPreparedEntity(this.adapter, join.query.classSchema);
    //
    //         const tableName = this.platform.getTableIdentifier(join.query.classSchema);
    //         const joinName = this.platform.quoteIdentifier(prefix + '__' + join.propertySchema.name);
    //
    //         const foreignSchema = join.query.classSchema;
    //
    //         //many-to-many
    //         if (join.propertySchema.isBackReference() && join.propertySchema.getBackReference().via) {
    //             const viaSchema = ReflectionClass.from(join.propertySchema.getBackReference().via);
    //             const pivotTableName = this.platform.getTableIdentifier(viaSchema);
    //
    //             // JOIN pivotTableName as pivot ON (parent.id = pivot.left_foreign_id)
    //             // JOIN target ON (target.id = pivot.target_foreign_id)
    //             // viaSchema.name
    //             const pivotToLeft = viaSchema.findReverseReference(
    //                 join.classSchema.getClassType(),
    //                 join.propertySchema,
    //             );
    //
    //             const pivotToRight = viaSchema.findReverseReference(
    //                 join.query.classSchema.getClassType(),
    //                 join.propertySchema,
    //             );
    //
    //             const pivotName = this.platform.quoteIdentifier(prefix + '__p_' + join.propertySchema.name);
    //
    //             const pivotLeftPrepared = getPreparedEntity(this.adapter, pivotToRight.reflectionClass);
    //
    //             //first pivot table
    //             sql.append(`${join.type.toUpperCase()} JOIN ${pivotTableName} AS ${pivotName} ON (`);
    //             sql.append(`${pivotName}.${pivotLeftPrepared.fieldMap[pivotToLeft.name].columnNameEscaped} = ${parentName}.${originPrepared.fieldMap[originPrepared.primaryKey.name].columnNameEscaped}`);
    //
    //             sql.append(`)`);
    //
    //             const pivotRightPrepared = getPreparedEntity(this.adapter, pivotToRight.reflectionClass);
    //
    //             //then right table
    //             sql.append(`${join.type.toUpperCase()} JOIN ${tableName} AS ${joinName} ON (`);
    //             sql.append(`${pivotName}.${pivotRightPrepared.fieldMap[pivotToRight.name].columnNameEscaped} = ${joinName}.${joinPrepared.fieldMap[joinPrepared.primaryKey.name].columnNameEscaped}`);
    //             this.appendWhereSQL(sql, join.query.classSchema, join.query.model, joinName, 'AND');
    //             sql.append(`)`);
    //
    //             this.appendJoinSQL(sql, join.query.model, joinName, prefix + '__' + join.propertySchema.name);
    //
    //             continue;
    //         }
    //
    //         sql.append(`${join.type.toUpperCase()} JOIN ${tableName} AS ${joinName} ON (`);
    //
    //         if (join.propertySchema.isBackReference() && !join.propertySchema.getBackReference().via) {
    //             const backReference = foreignSchema.findReverseReference(
    //                 join.classSchema.getClassType(),
    //                 join.propertySchema,
    //             );
    //             const backPrepared = getPreparedEntity(this.adapter, backReference.reflectionClass);
    //
    //             sql.append(`${parentName}.${originPrepared.fieldMap[originPrepared.primaryKey.name].columnNameEscaped} = ${joinName}.${backPrepared.fieldMap[backReference.name].columnNameEscaped}`);
    //         } else {
    //             sql.append(`${parentName}.${originPrepared.fieldMap[join.propertySchema.name].columnNameEscaped} = ${joinName}.${joinPrepared.fieldMap[joinPrepared.primaryKey.name].columnNameEscaped}`);
    //         }
    //         this.appendWhereSQL(sql, join.query.classSchema, join.query.model, joinName, 'AND');
    //
    //         sql.append(`)`);
    //
    //         this.appendJoinSQL(sql, join.query.model, joinName, prefix + '__' + join.propertySchema.name);
    //     }
    // }
    //
    // protected applyOrder(order: string[], schema: ReflectionClass<any>, model: Query2Model, tableName: string = '') {
    //     if (model.sort) {
    //         const prepared = getPreparedEntity(this.adapter, schema);
    //         for (const [name, sort] of Object.entries(model.sort)) {
    //             order.push(`${tableName}.${prepared.fieldMap[name]?.columnNameEscaped || this.platform.quoteIdentifier(name)} ${sort}`);
    //         }
    //     }
    // }

    /**
     * If a join is included that is an array, we have to move LIMIT/ORDER BY into a sub-select,
     * so that these one-to-many/many-to-many joins are correctly loaded even if there is LIMIT 1.
     */
    protected hasToManyJoins(): boolean {
        for (const join of this.joins) {
            // if (join.join.populate && join.join.propertySchema.isArray()) return true;
        }
        return false;
    }

    public buildSql(model: SelectorState, head: string): Sql {
        const tableName = this.platform.getTableIdentifier(model.schema);

        const sql = new Sql(`${head} FROM`, this.params);

        const withRange = model.limit !== undefined || model.offset !== undefined;
        const needsSubSelect = withRange && this.hasToManyJoins();
        if (needsSubSelect) {
            //wrap FROM table => FROM (SELECT * FROM table LIMIT x OFFSET x)
            sql.append(`(SELECT * FROM ${tableName}`);
            this.appendWhereSQL(sql, model);
            const order: string[] = [];
            // this.applyOrder(order, model.schema, model, tableName);
            if (order.length) sql.append(' ORDER BY ' + (order.join(', ')));
            this.platform.applyLimitAndOffset(sql, model.limit, model.offset);
            sql.append(`) as ${tableName}`);
            // this.appendJoinSQL(sql, model, tableName);
        } else {
            sql.append(tableName);
            // this.appendJoinSQL(sql, model, tableName);
            this.appendWhereSQL(sql, model);
        }

        if (model.groupBy?.length) {
            const groupBy: string[] = model.groupBy.map(v => this.build(v));
            sql.append('GROUP BY ' + groupBy.join(', '));
        }

        // this.appendHavingSQL(sql, schema, model, tableName);

        const order: string[] = [];
        if (!needsSubSelect) {
            //ORDER BY are handled as normal
            // this.applyOrder(order, schema, model, tableName);
        }

        for (const join of this.joins) {
            // if (!join.join.query.model.sort) continue;
            // const prepared = getPreparedEntity(this.adapter, join.join.query.classSchema);
            // for (const [name, sort] of Object.entries(join.join.query.model.sort)) {
            //     order.push(`${join.join.as}.${prepared.fieldMap[name]?.columnNameEscaped || this.platform.quoteIdentifier(name)} ${sort}`);
            // }
        }
        if (order.length) sql.append(' ORDER BY ' + (order.join(', ')));

        if (withRange && !this.hasToManyJoins()) {
            this.platform.applyLimitAndOffset(sql, model.limit, model.offset);
        }

        return sql;
    }

    // public update<T extends OrmEntity>(schema: ReflectionClass<any>, model: Query2Model, set: string[]): Sql {
    //     const prepared = getPreparedEntity(this.adapter, schema);
    //     const primaryKey = schema.getPrimary();
    //     const select = this.select(schema, model, { select: [`${prepared.tableNameEscaped}.${prepared.fieldMap[primaryKey.name].columnNameEscaped}`] });
    //
    //     return new Sql(`UPDATE ${prepared.tableNameEscaped}
    //                     SET ${set.join(', ')}
    //                     WHERE ${prepared.fieldMap[primaryKey.name].columnNameEscaped} IN (SELECT * FROM (${select.sql}) as __)`, select.params);
    // }

    public select(
        model: SelectorState,
        options: { select?: string[] } = {},
    ): Sql {
        const manualSelect = options.select && options.select.length ? options.select : undefined;

        if (!manualSelect) {
            // if (model.joins?.length) {
            //     const map = this.selectColumnsWithJoins(model, '');
            //     this.rootConverter = this.buildConverter(this.adapter.platform, model, map.startIndex, map.fields);
            // } else {
                this.selectColumns(model);
            // }
        }

        const sql = this.buildSql(model, 'SELECT ' + (manualSelect || this.sqlSelect).join(', '));

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
