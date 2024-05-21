/** @reflection never */
import {
    Changes,
    ChangesInterface,
    DeepPartial,
    getSimplePrimaryKeyHashGenerator,
    getTypeJitContainer,
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
import { ItemNotFound } from './query.js';
import { DatabaseAdapter } from './database-adapter.js';

let graphId = 10;
type Graph = { id: number, nodes: { [id: number]: Graph }, cache?: { [name: string]: any } };

export type SelectorProperty<T> = {
    [propertyTag]: 'property';
    model: SelectorState;
    name: string;
    // as?: string;
    graph: Graph,
    property: TypeProperty | TypePropertySignature;
    toString(): string;
}

export type SelectorRefs<T> = {
    [P in keyof T]: SelectorProperty<T[P]>;
} & { $$fields: SelectorProperty<any>[] };

export interface SelectStateExpression {
    kind: string;
}

export type SelectorState<R = unknown> = {
    params: any[];
    schema: ReflectionClass<any>;
    fields: SelectorRefs<any>;
    as?: string;

    select: (SelectorProperty<unknown> | OpExpression)[];
    //join
    // TODO: this is not cacheable/deterministic
    // or how should we determine whether select, where, joins, offset, limit, etc is all the same
    // -> solution: just build a new graph tree, where.graph[joins[0].graph.id], ...
    where?: OpExpression;
    joins?: SelectorState[];

    lazyLoaded?: SelectorProperty<unknown>[];

    groupBy?: (SelectorProperty<unknown> | OpExpression)[];

    offset?: number;
    limit?: number;

    for?: string;

    previous?: SelectorState;
    withIdentityMap?: boolean;
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

export const orderBy = (a: any, direction: 'asc' | 'desc' = 'asc'): any => {
//     ensureState(state);
//     state.orderBy.push({ kind: 'order', a, direction });
};
//
export const groupBy = (a: any): any => {
//     ensureState(state);
//     state.groupBy.push({ kind: 'group', by: a });
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

export const propertyTag = Symbol('property');
export const opTag = Symbol('op');

export function isProperty(value: any): value is SelectorProperty<any> {
    return 'object' === typeof value && propertyTag in value;
}

export function isOp(value: any): value is OpExpression {
    return 'object' === typeof value && opTag in value;
}


function getGraph(...args: any[]) {
    let graph: Graph | undefined;
    for (const arg of args) {
        if (isProperty(arg) || isOp(arg)) {
            if (graph) {
                const a = graph.nodes[arg.graph.id];
                if (a) {
                    graph = a;
                } else {
                    graph = graph.nodes[arg.graph.id] = arg.graph;
                }
            } else {
                graph = arg.graph;
            }
        } else {
            if (graph) {
                const a = graph.nodes[0];
                if (a) {
                    graph = a;
                } else {
                    graph = graph.nodes[0] = { id: graphId++, nodes: {} };
                }
            }
        }
    }
    return graph;
}

export type OpExpression = { [opTag]: Op, graph: Graph, args: any[] };
export type Op = ((...args: any[]) => OpExpression) & { id: symbol };

function makeOp(name: string, cb: (expression: OpExpression, args: any[]) => any): Op {
    const opGraph: Graph = { id: graphId++, nodes: {} };
    const id = Symbol('op:' + name);

    /**
     * @reflection never
     */
    function operation(...args: any[]) {
        const graph = getGraph(...args) || opGraph;
        const opExpression = { [opTag]: operation, graph, args };
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

export const where = makeOp('where', (expression, args: any[]) => {
    ensureState(state);
    if (state.where) {
        state.where = and(state.where, expression);
    } else {
        state.where = expression;
    }
});

export const or = makeOp('or', (graph, args: any[]) => {
});

export const and = makeOp('and', (graph, args: any[]) => {
});

export const joinOp = makeOp('join', (graph, args: any[]) => {
    ensureState(state);
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

export const asOp = makeOp('as', (graph, args: any[]) => {
});

export function as<T extends SelectorState | OpExpression>(a: T, name: string): T {
    if (isOp(a)) {
        return asOp(a, [name]) as T;
    } else {
        a.as = name;
        return a;
    }
}

export const join = <K>(a: SelectorProperty<K>, cb?: (m: SelectorRefs<K extends Array<infer K2> ? K2 : K>) => any): SelectorRefs<K> => {
    ensureState(state);
    const foreignType = resolveReferencedSchema(a.property);
    const s = state = createModel(foreignType);
    try {
        if (cb) {
            const graph = cb(s.fields as any);
            joinOp(graph);
        }
        return s.fields as any;
    } finally {
        state = s.previous;
    }
};

export type ResolveSelect<R> = R;

export interface SelectorInferredState<Model, Result> {
    state: SelectorState<Model>;
}

export interface From<T> {
    select<const R extends any>(cb?: (m: SelectorRefs<T>) => R): SelectorInferredState<T, ResolveSelect<R extends void ? T : R>>;
}

export const from = <T>(type?: ReceiveType<T>): From<T> => {
    return {
        select<R>(cb?: (m: SelectorRefs<T>) => R) {
            const state = createModel(resolveReceiveType(type));
            if (cb) applySelect(cb, state);
            return {state};
        }
    }
}

export const applySelect = <T>(a: (m: SelectorRefs<T>) => any, nextSelect: SelectorState<T>) => {
    let previous = state;
    state = nextSelect;
    try {
        a(nextSelect.fields as any);
    } finally {
        state = previous;
    }
    return nextSelect;
};

export function createModel(type: Type): SelectorState {
    const jit = getTypeJitContainer(type);
    if (jit.query2Model) return jit.query2Model;

    if (type.kind !== ReflectionKind.objectLiteral && type.kind !== ReflectionKind.class) {
        throw new Error('Type only supports object literals and classes');
    }
    const schema = ReflectionClass.fromType(type);

    const fields: SelectorRefs<any> = {
        $$fields: [],
    } as any;

    const model: SelectorState = {
        schema,
        params: [],
        select: [],
        fields,
        previous: state,
    };

    for (const member of schema.type.types) {
        if (member.kind !== ReflectionKind.propertySignature && member.kind !== ReflectionKind.property) continue;
        const ref = {
            [propertyTag]: 'property',
            model,
            property: member,
            graph: {
                id: graphId++,
                nodes: {},
            },
            name: String(member.name),
        } satisfies SelectorProperty<any>;
        fields.$$fields.push(ref);
        (fields as any)[member.name] = ref;
    }

    return jit.query2Model = model;
}

export abstract class Query2Resolver<T extends object> {
    constructor(
        protected model: SelectorState,
        protected session: DatabaseSession<DatabaseAdapter>,
    ) {
    }

    abstract count(model: SelectorState): Promise<number>;

    abstract find(model: SelectorState): Promise<T[]>;

    abstract findOneOrUndefined(model: SelectorState): Promise<T | undefined>;

    abstract delete(model: SelectorState, deleteResult: DeleteResult<T>): Promise<void>;

    abstract patch(model: SelectorState, value: Changes<T>, patchResult: PatchResult<T>): Promise<void>;
}

export class Query2<T extends object> {
    constructor(
        public classSchema: ReflectionClass<any>,
        protected session: DatabaseSession<any>,
        protected resolver: Query2Resolver<any>,
    ) {
    }

    createResolver() {
        // return this.adapter.createQuery2Resolver(model.state, session)
    }

    protected async callOnFetchEvent(query: Query2<any>): Promise<this> {
        const hasEvents = this.session.eventDispatcher.hasListeners(onFind);
        if (!hasEvents) return query as this;

        const event = new QueryDatabaseEvent(this.session, this.classSchema, query);
        await this.session.eventDispatcher.dispatch(onFind, event);
        return event.query as any;
    }

    protected onQueryResolve(query: Query2<any>): this {
        //TODO implement
        // if (query.classSchema.singleTableInheritance && query.classSchema.parent) {
        //     const discriminant = query.classSchema.parent.getSingleTableInheritanceDiscriminantName();
        //     const property = query.classSchema.getProperty(discriminant);
        //     assertType(property.type, ReflectionKind.literal);
        //     return query.filterField(discriminant as keyof T & string, property.type.literal) as this;
        // }
        return query as this;
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
        let query: Query2<any> | undefined = undefined;

        const frame = this.session
            .stopwatch?.start((fromHas ? 'Has:' : 'Count:') + this.classSchema.getClassName(), FrameCategory.database);

        try {
            frame?.data({
                collection: this.classSchema.getCollectionName(),
                className: this.classSchema.getClassName(),
            });
            const eventFrame = this.session.stopwatch?.start('Events');
            query = this.onQueryResolve(await this.callOnFetchEvent(this));
            eventFrame?.end();
            return await this.resolver.count(query.model);
        } catch (error: any) {
            await this.session.eventDispatcher.dispatch(onDatabaseError, new DatabaseErrorEvent(error, this.session, query?.classSchema, query));
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
    public async find<R>(selector?: SelectorInferredState<T, R>): Promise<R[]> {
        const state = selector ? selector.state : createModel(this.classSchema.type);

        const frame = this.session
            .stopwatch?.start('Find:' + this.classSchema.getClassName(), FrameCategory.database);

        let query: Query2<any> | undefined = undefined;

        try {
            frame?.data({
                collection: this.classSchema.getCollectionName(),
                className: this.classSchema.getClassName(),
            });
            const eventFrame = this.session.stopwatch?.start('Events');
            query = this.onQueryResolve(await this.callOnFetchEvent(this));
            eventFrame?.end();
            return await query.resolver.find(state) as R[];
        } catch (error: any) {
            await this.session.eventDispatcher.dispatch(onDatabaseError, new DatabaseErrorEvent(error, this.session, query?.classSchema, query));
            throw error;
        } finally {
            frame?.end();
        }
    }

    /**
     * Fetches a single item matching the query or undefined.
     *
     * @throws DatabaseError
     */
    public async findOneOrUndefined(): Promise<T | undefined> {
        const frame = this.session.stopwatch?.start('FindOne:' + this.classSchema.getClassName(), FrameCategory.database);
        let query: Query2<any> | undefined = undefined;

        try {
            frame?.data({
                collection: this.classSchema.getCollectionName(),
                className: this.classSchema.getClassName(),
            });
            const eventFrame = this.session.stopwatch?.start('Events');
            query = this.onQueryResolve(await this.callOnFetchEvent(this));
            eventFrame?.end();
            return await query.resolver.findOneOrUndefined(query.model);
        } catch (error: any) {
            await this.session.eventDispatcher.dispatch(onDatabaseError, new DatabaseErrorEvent(error, this.session, query?.classSchema, query));
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
        return await this.delete(this) as any;
    }

    /**
     * Deletes a single item matching the query.
     *
     * @throws DatabaseDeleteError
     */
    public async deleteOne(): Promise<DeleteResult<T>> {
        const query = this.patchModel({ limit: 1 });
        return await this.delete(query);
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
                query = this.onQueryResolve(query);
                await this.resolver.delete(query.model, deleteResult);
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

            //we need to use event.query in case someone overwrite it
            event.query = this.onQueryResolve(event.query as this);
            await event.query.resolver.delete(event.query.model, deleteResult);
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
        return await this.patch(this, patch);
    }

    /**
     * Updates a single item matching the query with the given patch.
     *
     * @throws DatabasePatchError
     * @throws UniqueConstraintFailure
     */
    public async patchOne(patch: ChangesInterface<T> | DeepPartial<T>): Promise<PatchResult<T>> {
        const query = this.patchModel({ limit: 1 });
        return await this.patch(query, patch);
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
                query = this.onQueryResolve(query);
                await this.resolver.patch(query.model, changes, patchResult);
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
            query = this.onQueryResolve(query);
            await event.query.resolver.patch(event.query.model, changes, patchResult);

            if (query.model.withIdentityMap) {
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
        return new Query2<T>(Object.assign({}, this.model, patch), this.session, this.resolver as any);
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
        const query = this.patchModel({ select: [this.model.fields[name]] });
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
        const query = this.patchModel({ select: [this.model.fields[name]] });
        const item = await query.findOne() as T;
        return item[name];
    }

    /**
     * Returns the specified field of the query from a single item or undefined.
     *
     * @throws DatabaseError
     */
    public async findOneFieldOrUndefined<K extends FieldName<T>>(name: K): Promise<T[K] | undefined> {
        const query = this.patchModel({ select: [this.model.fields[name]] });
        const item = await query.findOneOrUndefined() as T;
        if (item) return item[name];
        return;
    }
}
