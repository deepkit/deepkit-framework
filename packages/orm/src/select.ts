import {
    assertType,
    Changes,
    ChangesInterface,
    DeepPartial,
    getSimplePrimaryKeyHashGenerator,
    PrimaryKeyFields,
    PrimaryKeyType,
    ReceiveType,
    ReflectionClass,
    ReflectionKind,
    resolveReceiveType,
    Type,
    TypeProperty,
    TypePropertySignature,
} from '@deepkit/type';
import { DeleteResult, OrmEntity, PatchResult } from './type.js';
import {
    DatabaseErrorEvent,
    ItemNotFound,
    onDatabaseError,
    onDeletePost,
    onDeletePre,
    onFind,
    onPatchPost,
    onPatchPre,
    QueryDatabaseDeleteEvent,
    QueryDatabaseEvent,
    QueryDatabasePatchEvent,
} from './event.js';
import { DatabaseSession } from './database-session.js';
import { FieldName } from './utils.js';
import { FrameCategory } from '@deepkit/stopwatch';
import { ClassType, CompilerContext } from '@deepkit/core';

let treeId = 10;
export type ExpressionTree = { id: number, nodes: { [id: number]: ExpressionTree }, cache?: { [name: string]: any } };
export type Expression = OpExpression | SelectorProperty<any> | number;
export type From<T> = Type & { __from: T };

export function from<T>(type?: ReceiveType<T>): From<T> {
    return resolveReceiveType(type) as From<T>;
}

/** @reflection never */
export type SelectorProperty<T = unknown> = {
    [treeTag]: ExpressionTree;
    [propertyTag]: {
        model: SelectorState;
        name: string;
        // as?: string;
        property: TypeProperty | TypePropertySignature;
    },
}

export type SelectorRefs<T> = unknown extends T ? any : {
    [P in keyof T]-?: SelectorProperty<T[P]> & (T[P] extends object ? Select<T[P]> : {});
} & { $$fields: SelectorProperty<any>[] };

export interface SelectStateExpression {
    kind: string;
}

export function selectorIsPartial(state: SelectorState): boolean {
    return state.select.length > 0;
}

export function stringifyExpression(expression: Expression, params: any[]): string {
    if (isProperty(expression)) {
        return expression[propertyTag].name;
    } else if (isOp(expression)) {
        return expression[opTag].id.description + '(' + expression.args.map(v => stringifyExpression(v, params)).join(', ') + ')';
    } else {
        const param = params[expression];
        if ('undefined' === typeof param) return 'undefined';
        return JSON.stringify(param);
        // return '$' + String(expression);
    }
}

export function stringifySelector(state: SelectorState): string {
    const parts: string[] = [];
    parts.push('SELECT');
    if (state.select.length === 0) {
        parts.push('*');
    } else {
        parts.push(state.select.map(v => stringifyExpression(v, state.params)).join(', '));
    }
    parts.push('FROM');
    parts.push(state.schema.getClassName());
    if (state.where) {
        parts.push('WHERE');
        parts.push(stringifyExpression(state.where, state.params));
    }
    if (state.orderBy?.length) {
        parts.push('ORDER BY');
        parts.push(state.orderBy.map(v => stringifyExpression(v.a, state.params) + ' ' + v.direction).join(', '));
    }
    if (state.groupBy?.length) {
        parts.push('GROUP BY');
        parts.push(state.groupBy.map(v => stringifyExpression(v, state.params)).join(', '));
    }
    if (state.limit) {
        parts.push('LIMIT');
        parts.push(String(state.limit));
    }
    if (state.offset) {
        parts.push('OFFSET');
        parts.push(String(state.offset));
    }
    return parts.join(' ');
}

export type SelectorState<R = unknown> = {
    params: any[];
    /**
     * The main origin schema (first position of query() call).
     */
    schema: ReflectionClass<any>;
    fields: SelectorRefs<any>;
    as?: string;

    select: (SelectorProperty<unknown> | OpExpression)[];

    //join
    // TODO: this is not cacheable/deterministic
    // or how should we determine whether select, where, joins, offset, limit, etc is all the same
    // -> solution: just build a new expression tree, where.tree[joins[0].tree.id], ...
    where?: OpExpression;
    joins?: SelectorState[];

    lazyLoaded?: SelectorProperty<unknown>[];

    groupBy?: (SelectorProperty<unknown> | OpExpression)[];
    orderBy?: { a: OpExpression | SelectorProperty<unknown>, direction: 'asc' | 'desc' }[];

    offset?: number;
    limit?: number;

    data: { [name: string]: any };

    for?: string;

    previous?: SelectorState;
    withIdentityMap?: boolean;
    withChangeDetection?: boolean;
}

let state: SelectorState | undefined;

class MissingStateError extends Error {
    constructor() {
        super('No active select state');
    }
}

function ensureState(state: SelectorState | undefined): asserts state is SelectorState {
    if (!state) throw new MissingStateError();
}

export function currentState(): SelectorState {
    if (!state) throw new MissingStateError();
    return state;
}

export const average = (a: any): any => {
    ensureState(state);
    return { kind: 'call', method: 'average', args: [a] };
};

// export const l2Distance2 = (a: any, b: any): any => {
//     ensureState(state);
//     return { kind: 'call', method: 'l2Distance', args: [a, b] };
// };

export const offset = (offset?: number): any => {
    ensureState(state);
    state.offset = offset;
};

export const limit = (limit?: number): any => {
    ensureState(state);
    state.limit = limit;
};

export const orderBy = (a: OpExpression | SelectorProperty<unknown>, direction: 'asc' | 'desc' = 'asc'): any => {
    ensureState(state);
    state.orderBy = state.orderBy || [];
    state.orderBy.push({ a, direction });
};

export const groupBy = (expression: OpExpression | SelectorProperty<unknown>): any => {
    ensureState(state);
    state.groupBy = state.groupBy || [];
    state.groupBy.push(expression);
};

export const inArray = makeOp('inArray', (expression, args: any[]) => {

});

export const groupConcat = makeOp('groupConcat', (expression, args: any[]) => {
});

export const lower = makeOp('lower', (expression, args: any[]) => {
});

export const lt = (a: any, b: any): any => {
    ensureState(state);
    return { kind: 'binary', operator: '<', a, b };
};

export const gt = (a: any, b: any): any => {
    ensureState(state);
    return { kind: 'binary', operator: '>', a, b };
};

export const sum = (a: any): any => {
    ensureState(state);
    return { kind: 'call', method: 'sum', args: [a] };
};

// export const count = (a: any): any => {
//     ensureState(state);
//     return { kind: 'call', method: 'count', args: [a] };
// };

export const count = makeOp('count', (expression, args: any[]) => {

});

export const treeTag = Symbol('tree');
export const propertyTag = Symbol('property');
export const opTag = Symbol('op');

export function isProperty(value: any): value is SelectorProperty<any> {
    return 'object' === typeof value && propertyTag in value;
}

export function isOp(value: any): value is OpExpression {
    return 'object' === typeof value && opTag in value;
}

/**
 * Constructs a static expression tree based on arguments and an operation.
 */
function getTree(tree: ExpressionTree, args: any[]) {
    const params = state!.params;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (isProperty(arg) || isOp(arg)) {
            tree = tree.nodes[arg[treeTag].id] ||= { id: treeId++, nodes: {} };
        } else {
            const paramIndex = params.length;
            params.push(arg);
            args[i] = paramIndex;
            tree = tree.nodes[0] ||= { id: treeId++, nodes: {} };
        }
    }
    return tree;
}

export type OpExpression = {
    [opTag]: Op,
    [treeTag]: ExpressionTree,
    args: (OpExpression | SelectorProperty | number)[]
};
export type Op = ((...args: any[]) => OpExpression) & { id: symbol };

export function getStateCacheId(state: SelectorState): string {
    const cacheId = state.schema.type.id
        + '_' + state.where?.[treeTag].id
        + '_' + state.limit
        + '_' + state.offset
        + '_' + state.select.map(v => v[treeTag].id).join(':')
        + '_' + state.orderBy?.map(v => v.a[treeTag].id).join(':');
    //todo select also
    // todo join also
    return cacheId;
}

function makeOp(name: string, cb: (expression: OpExpression, args: any[]) => any): Op {
    const opTree: ExpressionTree = { id: treeId++, nodes: {} };
    const id = Symbol(name);

    /**
     * @reflection never
     */
    function operation(...args: any[]) {
        const tree = getTree(opTree, args);
        const opExpression = { [opTag]: operation, [treeTag]: tree, args };
        cb(opExpression, args);
        return opExpression;
    }

    operation.id = id;

    return operation;
}

export const l2Distance = makeOp('l2Distance', (expression, args: any[]) => {
});

export const eq = makeOp('eq', (expression, args: any[]) => {

});

export const notEqual = makeOp('notEqual', (expression, args: any[]) => {

});

export const not = makeOp('not', (expression, args: any[]) => {

});

export const where = makeOp('where', (expression, args: any[]) => {
    ensureState(state);
    if (state.where) {
        state.where = and(state.where, expression);
    } else {
        state.where = expression;
    }
});

export const filter = <T>(model: SelectorRefs<T>, patch: Partial<T>): void => {
    ensureState(state);
    for (const i in patch) {
        where(eq(model[i], patch[i]));
    }
};

export const or = makeOp('or', (exp, args: any[]) => {
});

export const and = makeOp('and', (exp, args: any[]) => {
});

export const joinOp = makeOp('join', (exp, args: any[]) => {
    ensureState(state);
    //todo this must not be a join, but a expression chain so that tree is correct
    if (state.joins) {
        state.joins.push(state);
    } else {
        state.joins = [state];
    }
});

function resolveReferencedSchema(property: TypePropertySignature | TypeProperty): Type {
    let type = property.type;
    if (type.kind === ReflectionKind.array) {
        type = type.type;
    }

    return type;
}

export const asOp = makeOp('as', (exp, args: any[]) => {
});

export function as<T extends SelectorState | OpExpression | SelectorProperty<any>>(a: T, name: string): T {
    if (isOp(a) || isProperty(a)) {
        return asOp(a, [name]) as T;
    } else {
        a.as = name;
        return a;
    }
}

export const join = <K>(a: SelectorProperty<K>, cb?: (m: SelectorRefs<K extends Array<infer K2> ? K2 : K>) => any): SelectorRefs<K> => {
    ensureState(state);
    const foreignType = resolveReferencedSchema(a[propertyTag].property);
    const s = state = createModel(foreignType);
    try {
        if (cb) {
            const tree = cb(s.fields as any);
            joinOp(tree);
        }
        return s.fields as any;
    } finally {
        state = s.previous;
    }
};

export type ResolveSelect<R> = R;

// todo: Do we really need that? We could add type arg Select to SelectorState instead
export interface SelectorInferredState<Model, Result> {
    state: SelectorState<Model>;
}

export function query<const R extends any, T>(cb: (main: SelectorRefs<T>, ...args: SelectorRefs<unknown>[]) => R | undefined): SelectorInferredState<T, ResolveSelect<R extends void ? T : R>> {
    let fnType = (cb as any).__type?.__type ? (cb as any).__type.__type : undefined;
    if (!fnType) fnType = resolveReceiveType(cb);
    assertType(fnType, ReflectionKind.function);
    const argTypes = fnType.parameters.map(v => v.type.originTypes?.[0].typeArguments?.[0] || v.type);
    const states = argTypes.map(v => createModel(v));
    const selectorRefs = states.map(v => v.fields);
    if (selectorRefs.length === 0) {
        throw new Error('No main selector found in query callback');
    }
    let previous = state;
    const nextSelect = states[0];
    state = nextSelect;
    try {
        const select = (cb as any)(...selectorRefs);
        if (select) state.select = select;
    } finally {
        state = previous;
    }
    return { state: nextSelect };
}

export function singleQuery<const R extends any, T>(classType: ClassType<T> | Type | From<T>, cb?: (main: SelectorRefs<T>) => R | undefined): SelectorInferredState<T, ResolveSelect<R extends void ? T : R>> {
    const type = resolveReceiveType(classType);
    const state = createModel(type);
    if (cb) applySelect(state, cb);
    return { state };
}

export type Select<T> = SelectorRefs<T>;

export const applySelect = <T>(nextSelect: SelectorState<T>, a: (m: SelectorRefs<T>) => any) => {
    let previous = state;
    state = nextSelect;
    try {
        a(nextSelect.fields as any);
    } finally {
        state = previous;
    }
    return nextSelect;
};

const stateFactoryCache: { [id: number]: (state?: SelectorState) => SelectorState } = {};

export function createModel(type: Type): SelectorState {
    const id = type.id;
    if ('undefined' === typeof id) throw new Error(`Type ${type.typeName} is not nominal typed`);

    if (type.kind !== ReflectionKind.objectLiteral && type.kind !== ReflectionKind.class) {
        throw new Error('Type only supports object literals and classes');
    }

    let query2Model = stateFactoryCache[id];
    if (!query2Model) {
        const compiler = new CompilerContext();
        const fields: string[] = [];
        const assignModel: string[] = [];

        compiler.set({
            propertyTag: propertyTag,
            treeTag: treeTag,
            schema: ReflectionClass.fromType(type),
        });

        for (const member of type.types) {
            if (member.kind !== ReflectionKind.propertySignature && member.kind !== ReflectionKind.property) continue;
            const name = String(member.name);
            const treeForProp = compiler.reserveVariable('tree_' + name, {
                id: treeId++,
                nodes: {},
            });

            let subModel: string = '';
            let deeperType: Type | undefined;
            if (member.type.kind === ReflectionKind.array) {
                deeperType = member.type.type;
            } else if (member.type.kind === ReflectionKind.union) {
                //??????
            } else if (member.type.kind === ReflectionKind.class || member.type.kind === ReflectionKind.objectLiteral) {
                deeperType = member.type;
            }

            if (deeperType && (deeperType.kind === ReflectionKind.class || deeperType.kind === ReflectionKind.objectLiteral)) {
                subModel = compiler.reserveVariable('subModel_' + name, () => createModel(deeperType!));
            }

            fields.push(`${name}: {
                [propertyTag]: {
                    property: ${compiler.reserveVariable('property', member)},
                    name: '${name}'
                },
                [treeTag]: ${treeForProp},
                ${subModel ? `...${subModel}.fields,` : ''}
            },
            `);

            assignModel.push(`fields.${name}[propertyTag].model = res;`);
        }

        const code = `
            return function(previous) {
                const fields = {
                    ${fields.join('\n')}
                };
                const res = { schema, fields, params: [], select: [], data: {}, previous };
                ${assignModel.join('\n')}
                return res;
            }
        `;

        stateFactoryCache[id] = query2Model = compiler.build(code)();
    }

    return query2Model(state);
}

export abstract class SelectorResolver<T extends object> {
    constructor(
        protected session: DatabaseSession,
    ) {
    }

    abstract count(model: SelectorState): Promise<number>;

    abstract find(model: SelectorState): Promise<T[]>;

    abstract findOneOrUndefined(model: SelectorState): Promise<T | undefined>;

    abstract delete(model: SelectorState, deleteResult: DeleteResult<T>): Promise<void>;

    abstract patch(model: SelectorState, value: Changes<T>, patchResult: PatchResult<T>): Promise<void>;
}

export class Query2<T extends object, R = any> {
    classSchema: ReflectionClass<any>;

    constructor(
        public state: SelectorState<T>,
        protected session: DatabaseSession<any>,
        protected resolver: SelectorResolver<any>,
    ) {
        this.classSchema = state.schema;
    }

    apply(cb: (m: SelectorRefs<T>) => any): this {
        applySelect(this.state, cb);
        return this;
    }

    filter(filter: Partial<T>): this {
        applySelect(this.state, (v) => {
            const args = Object.entries(filter).map(([name, value]) => eq(v[name as keyof T], value));
            where(...args);
        });
        return this;
    }

    disableIdentityMap(): this {
        this.state.withIdentityMap = false;
        return this;
    }

    /**
     * When receiving full objects the change-detector is enabled by default
     * to be able to calculate change sets for database.persist()/session.commit().
     *
     * If disabled, it is impossible to send updates via database.persist()/session.commit(),
     * and patchOne/patchMany has to be used.
     *
     * This is disabled per default for partial results.
     */
    disableChangeDetection(): this {
        this.state.withChangeDetection = false;
        return this;
    }

    protected async callOnFetchEvent(query: Query2<object>): Promise<void> {
        const hasEvents = this.session.eventDispatcher.hasListeners(onFind);
        if (!hasEvents) return;

        const event = new QueryDatabaseEvent(this.session, this.classSchema, query);
        await this.session.eventDispatcher.dispatch(onFind, event);
    }

    protected onQueryResolve(query: Query2<object>): void {
        //TODO implement
        // if (query.classSchema.singleTableInheritance && query.classSchema.parent) {
        //     const discriminant = query.classSchema.parent.getSingleTableInheritanceDiscriminantName();
        //     const property = query.classSchema.getProperty(discriminant);
        //     assertType(property.type, ReflectionKind.literal);
        //     return query.filterField(discriminant as keyof T & string, property.type.literal) as this;
        // }
    }

    // public select(cb: (m: Query2Fields<T>) => any): Query2<T> {
    //     const previous = state;
    //     state = this.model;
    //     try {
    //         const next = cb(state.fields as Query2Fields<T>);
    //         return new Query2(next, this.classSchema, this.session, this.resolver);
    //     } finally {
    //         state = previous;
    //     }
    // }

    /**
     * Returns the number of items matching the query.
     *
     * @throws DatabaseError
     */
    public async count(fromHas: boolean = false): Promise<number> {
        const frame = this.session
            .stopwatch?.start((fromHas ? 'Has:' : 'Count:') + this.classSchema.getClassName(), FrameCategory.database);

        try {
            frame?.data({
                collection: this.classSchema.getCollectionName(),
                className: this.classSchema.getClassName(),
            });
            const eventFrame = this.session.stopwatch?.start('Events');
            await this.callOnFetchEvent(this);
            this.onQueryResolve(this);
            eventFrame?.end();
            return await this.resolver.count(this.state);
        } catch (error: any) {
            await this.session.eventDispatcher.dispatch(onDatabaseError, new DatabaseErrorEvent(error, this.session, this.state.schema, this));
            throw error;
        } finally {
            frame?.end();
        }
    }

    /**
     * Fetches all items matching the selector.
     *
     * @throws DatabaseError
     */
    public async find(): Promise<T[]> {
        // const frame = this.session
        //     .stopwatch?.start('Find:' + this.classSchema.getClassName(), FrameCategory.database);

        try {
            // frame?.data({
            //     collection: this.classSchema.getCollectionName(),
            //     className: this.classSchema.getClassName(),
            // });
            // const eventFrame = this.session.stopwatch?.start('Events');
            // await this.callOnFetchEvent(this);
            // this.onQueryResolve(this);
            // eventFrame?.end();
            return await this.resolver.find(this.state) as T[];
        } catch (error: any) {
            await this.session.eventDispatcher.dispatch(onDatabaseError, new DatabaseErrorEvent(error, this.session, this.state.schema, this));
            throw error;
        } finally {
            // frame?.end();
        }
    }

    /**
     * Fetches a single item matching the query or undefined.
     *
     * @throws DatabaseError
     */
    public async findOneOrUndefined(): Promise<T | undefined> {
        const frame = this.session.stopwatch?.start('FindOne:' + this.classSchema.getClassName(), FrameCategory.database);
        try {
            frame?.data({
                collection: this.classSchema.getCollectionName(),
                className: this.classSchema.getClassName(),
            });
            const eventFrame = this.session.stopwatch?.start('Events');
            await this.callOnFetchEvent(this);
            this.onQueryResolve(this);
            eventFrame?.end();
            return await this.resolver.findOneOrUndefined(this.state);
        } catch (error: any) {
            await this.session.eventDispatcher.dispatch(onDatabaseError, new DatabaseErrorEvent(error, this.session, this.state.schema, this));
            throw error;
        } finally {
            frame?.end();
        }
    }

    /**
     * Fetches a single item matching the query.
     *
     * @throws DatabaseError
     */
    public async findOne(): Promise<T> {
        const item = await this.findOneOrUndefined();
        if (!item) throw new ItemNotFound(`Item ${this.classSchema.getClassName()} not found`);
        return item;
    }

    /**
     * Deletes all items matching the query.
     *
     * @throws DatabaseDeleteError
     */
    public async deleteMany(): Promise<DeleteResult<T>> {
        return await this.delete(this as Query2<any>);
    }

    /**
     * Deletes a single item matching the query.
     *
     * @throws DatabaseDeleteError
     */
    public async deleteOne(): Promise<DeleteResult<T>> {
        const query = this.patchModel({ limit: 1 });
        return await this.delete(query as Query2<any>);
    }

    protected async delete(query: Query2<any>): Promise<DeleteResult<T>> {
        const hasEvents = this.session.eventDispatcher.hasListeners(onDeletePre) || this.session.eventDispatcher.hasListeners(onDeletePost);

        const deleteResult: DeleteResult<T> = {
            modified: 0,
            primaryKeys: [],
        };

        const frame = this.session.stopwatch?.start('Delete:' + this.classSchema.getClassName(), FrameCategory.database);
        if (frame) frame.data({
            collection: this.classSchema.getCollectionName(),
            className: this.classSchema.getClassName(),
        });

        try {
            if (!hasEvents) {
                this.onQueryResolve(query);
                await this.resolver.delete(query.state, deleteResult);
                this.session.identityMap.deleteManyBySimplePK(this.classSchema, deleteResult.primaryKeys);
                return deleteResult;
            }

            const event = new QueryDatabaseDeleteEvent<T>(this.session, this.classSchema, query, deleteResult);

            if (this.session.eventDispatcher.hasListeners(onDeletePre)) {
                const eventFrame = this.session.stopwatch ? this.session.stopwatch.start('Events') : undefined;
                await this.session.eventDispatcher.dispatch(onDeletePre, event);
                if (eventFrame) eventFrame.end();
                if (event.stopped) return deleteResult;
            }

            //we need to use event.query in case someone overwrites it
            this.onQueryResolve(event.query);
            await this.resolver.delete(event.query.state, deleteResult);
            this.session.identityMap.deleteManyBySimplePK(this.classSchema, deleteResult.primaryKeys);

            if (deleteResult.primaryKeys.length && this.session.eventDispatcher.hasListeners(onDeletePost)) {
                const eventFrame = this.session.stopwatch ? this.session.stopwatch.start('Events Post') : undefined;
                await this.session.eventDispatcher.dispatch(onDeletePost, event);
                if (eventFrame) eventFrame.end();
                if (event.stopped) return deleteResult;
            }

            return deleteResult;
        } catch (error: any) {
            await this.session.eventDispatcher.dispatch(onDatabaseError, new DatabaseErrorEvent(error, this.session, query.classSchema, query));
            throw error;
        } finally {
            if (frame) frame.end();
        }
    }

    /**
     * Updates all items matching the query with the given patch.
     *
     * @throws DatabasePatchError
     * @throws UniqueConstraintFailure
     */
    public async patchMany(patch: ChangesInterface<T> | DeepPartial<T>): Promise<PatchResult<T>> {
        return await this.patch(this as Query2<any>, patch);
    }

    /**
     * Updates a single item matching the query with the given patch.
     *
     * @throws DatabasePatchError
     * @throws UniqueConstraintFailure
     */
    public async patchOne(patch: ChangesInterface<T> | DeepPartial<T>): Promise<PatchResult<T>> {
        const query = this.patchModel({ limit: 1 });
        return await this.patch(query as Query2<any>, patch);
    }

    protected async patch(query: Query2<any>, patch: DeepPartial<T> | ChangesInterface<T>): Promise<PatchResult<T>> {
        const frame = this.session.stopwatch ? this.session.stopwatch.start('Patch:' + this.classSchema.getClassName(), FrameCategory.database) : undefined;
        if (frame) frame.data({
            collection: this.classSchema.getCollectionName(),
            className: this.classSchema.getClassName(),
        });

        try {
            const changes: Changes<T> = patch instanceof Changes ? patch as Changes<T> : new Changes<T>({
                $set: patch.$set || {},
                $inc: patch.$inc || {},
                $unset: patch.$unset || {},
            });

            for (const i in patch) {
                if (i.startsWith('$')) continue;
                changes.set(i as any, (patch as any)[i]);
            }

            const patchResult: PatchResult<T> = {
                modified: 0,
                returning: {},
                primaryKeys: [],
            };

            if (changes.empty) return patchResult;

            const hasEvents = this.session.eventDispatcher.hasListeners(onPatchPre) || this.session.eventDispatcher.hasListeners(onPatchPost);
            if (!hasEvents) {
                this.onQueryResolve(query);
                await this.resolver.patch(query.state, changes, patchResult);
                return patchResult;
            }

            const event = new QueryDatabasePatchEvent<T>(this.session, this.classSchema, query, changes, patchResult);
            if (this.session.eventDispatcher.hasListeners(onPatchPre)) {
                const eventFrame = this.session.stopwatch ? this.session.stopwatch.start('Events') : undefined;
                await this.session.eventDispatcher.dispatch(onPatchPre, event);
                if (eventFrame) eventFrame.end();
                if (event.stopped) return patchResult;
            }

            // for (const field of event.returning) {
            //     if (!event.query.model.returning.includes(field)) event.query.model.returning.push(field);
            // }

            //whe need to use event.query in case someone overwrite it
            this.onQueryResolve(query);
            await this.resolver.patch(query.state, changes, patchResult);

            if (query.state.withIdentityMap) {
                const pkHashGenerator = getSimplePrimaryKeyHashGenerator(this.classSchema);
                for (let i = 0; i < patchResult.primaryKeys.length; i++) {
                    const item = this.session.identityMap.getByHash(this.classSchema, pkHashGenerator(patchResult.primaryKeys[i]));
                    if (!item) continue;

                    if (changes.$set) for (const name in changes.$set) {
                        (item as any)[name] = (changes.$set as any)[name];
                    }

                    for (const name in patchResult.returning) {
                        (item as any)[name] = (patchResult.returning as any)[name][i];
                    }
                }
            }

            if (this.session.eventDispatcher.hasListeners(onPatchPost)) {
                const eventFrame = this.session.stopwatch ? this.session.stopwatch.start('Events Post') : undefined;
                await this.session.eventDispatcher.dispatch(onPatchPost, event);
                if (eventFrame) eventFrame.end();
                if (event.stopped) return patchResult;
            }

            return patchResult;
        } catch (error: any) {
            await this.session.eventDispatcher.dispatch(onDatabaseError, new DatabaseErrorEvent(error, this.session, query.classSchema, query));
            throw error;
        } finally {
            if (frame) frame.end();
        }
    }

    /**
     * Returns true if the query matches at least one item.
     *
     * @throws DatabaseError
     */
    public async has(): Promise<boolean> {
        return await this.count(true) > 0;
    }

    protected patchModel<T extends OrmEntity>(patch: Partial<SelectorState>): Query2<T> {
        return new Query2<T>(Object.assign({}, this.state, patch), this.session, this.resolver as any);
    }

    /**
     * Returns the primary keys of the query.
     *
     * ```typescript
     * const ids = await database.query(User).ids();
     * // ids: number[]
     * ```
     *
     * @throws DatabaseError
     */
    public async ids(singleKey?: false): Promise<PrimaryKeyFields<T>[]>;
    public async ids(singleKey: true): Promise<PrimaryKeyType<T>[]>;
    public async ids(singleKey: boolean = false): Promise<PrimaryKeyFields<T>[] | PrimaryKeyType<T>[]> {
        const pks: any = this.classSchema.getPrimaries().map(v => v.name) as FieldName<T>[];
        if (singleKey && pks.length > 1) {
            throw new Error(`Entity ${this.classSchema.getClassName()} has more than one primary key`);
        }

        const query = this.patchModel({ select: pks });
        const data = await query.find() as any[];
        if (singleKey) {
            const pkName = pks[0];
            return data.map(v => v[pkName]) as any;
        }

        return data;
    }

    /**
     * Returns the specified field of the query from all items.
     *
     * ```typescript
     * const usernames = await database.query(User).findField('username');
     * // usernames: string[]
     * ```
     *
     * @throws DatabaseError
     */
    public async findField<K extends FieldName<T>>(name: K): Promise<T[K][]> {
        const query = this.patchModel({ select: [this.state.fields[name]] });
        const items = await query.find() as T[];
        return items.map(v => v[name]);
    }

    /**
     * Returns the specified field of the query from a single item, throws if not found.
     *
     * ```typescript
     * const username = await database.select<User>().findOneField('username');
     * ```
     *
     * @throws ItemNotFound if no item is found
     * @throws DatabaseError
     */
    public async findOneField<K extends FieldName<T>>(name: K): Promise<T[K]> {
        const query = this.patchModel({ select: [this.state.fields[name]] });
        const item = await query.findOne() as T;
        return item[name];
    }

    /**
     * Returns the specified field of the query from a single item or undefined.
     *
     * @throws DatabaseError
     */
    public async findOneFieldOrUndefined<K extends FieldName<T>>(name: K): Promise<T[K] | undefined> {
        const query = this.patchModel({ select: [this.state.fields[name]] });
        const item = await query.findOneOrUndefined() as T;
        if (item) return item[name];
        return;
    }
}
