import { and, eq, OpExpression, opTag, propertyTag, SelectorProperty, where } from '@deepkit/orm';
import { getPreparedEntity, PreparedAdapter } from './prepare.js';

export interface SqlBuilderState {
    addParam(index: number): string;
    adapter: PreparedAdapter;
    build(expression: OpExpression | SelectorProperty | number): string;
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
        const prepared = getPreparedEntity(state.adapter, field[propertyTag].model.schema);
        const tableName = state.adapter.platform.quoteIdentifier(field[propertyTag].model.as || prepared.tableName);
        return tableName + '.' + prepared.fieldMap[field[propertyTag].name].columnNameEscaped;
    }

    op(builder: SqlBuilderState, expression: OpExpression) {
        const op = expression[opTag];
        return this.ops[op.id](builder, expression);
    }
}
