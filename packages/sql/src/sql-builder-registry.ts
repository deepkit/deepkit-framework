import { and, eq, OpExpression, opTag, SelectorProperty, where } from '@deepkit/orm';
import { getPreparedEntity, PreparedAdapter } from './prepare.js';

export interface SqlBuilderState {
    addParam(value: any): string;
    adapter: PreparedAdapter;
    build(expression: any): string;
}

export class SqlBuilderRegistry {
    ops: { [tag: symbol]: (state: SqlBuilderState, expression: OpExpression) => string } = {
        [eq.id](state: SqlBuilderState, expression: OpExpression) {
            const lines = expression.args.map(a => state.build(a));
            return lines.join(' = ');
        },
        [and.id](state: SqlBuilderState, expression: OpExpression) {
            const lines = expression.args.map(a => state.build(a));
            return lines.join(' AND ');
        },
        [where.id](state: SqlBuilderState, expression: OpExpression) {
            const lines = expression.args.map(a => state.build(a));
            return `${lines.join(' AND ')}`;
        },
    };

    field(state: SqlBuilderState, field: SelectorProperty<unknown>) {
        const prepared = getPreparedEntity(state.adapter, field.model.schema);
        const tableName = state.adapter.platform.quoteIdentifier(field.model.as || prepared.tableName);
        return state.adapter.platform.quoteIdentifier(tableName + '.' + prepared.fieldMap[field.name].columnName);
    }

    op(builder: SqlBuilderState, expression: OpExpression) {
        const op = expression[opTag];
        return this.ops[op.id](builder, expression);
    }
}
