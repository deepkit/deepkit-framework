import { ReflectionClass, ReflectionProperty, typeOf } from '../src/reflection/reflection.js';
import { expect, test } from '@jest/globals';
import { isExtendable } from '../src/reflection/extends.js';
import { stringifyResolvedType } from '../src/reflection/type.js';

export interface OrmEntity {
}

export type FilterQuery<T> = {
    [P in keyof T & string]?: T[P];
};

export type Placeholder<T> = () => T;
export type Resolve<T extends { _: Placeholder<any> }> = ReturnType<T['_']>;
export type Replace<T, R> = T & { _: Placeholder<R> };

export type FlattenIfArray<T> = T extends Array<any> ? T[0] : T;
export type FieldName<T> = keyof T & string;

export class DatabaseQueryModel<T extends OrmEntity, FILTER, SORT> {
    public withIdentityMap: boolean = true;
    public withChangeDetection: boolean = true;
    public filter?: FILTER;
    public having?: FILTER;
    public groupBy: Set<string> = new Set<string>();
    public aggregate = new Map<string, { property: ReflectionProperty, func: string }>();
    public select: Set<string> = new Set<string>();
    public skip?: number;
    public itemsPerPage: number = 50;
    public limit?: number;
    public parameters: { [name: string]: any } = {};
    public sort?: SORT;
    public returning: (keyof T & string)[] = [];

    changed(): void {
    }

    hasSort(): boolean {
        return this.sort !== undefined;
    }

    /**
     * Whether limit/skip is activated.
     */
    hasPaging(): boolean {
        return this.limit !== undefined || this.skip !== undefined;
    }

    setParameters(parameters: { [name: string]: any }) {
        for (const [i, v] of Object.entries(parameters)) {
            this.parameters[i] = v;
        }
    }

    clone(parentQuery: BaseQuery<T>): this {
        return this;
    }

    /**
     * Whether only a subset of fields are selected.
     */
    isPartial() {
        return this.select.size > 0 || this.groupBy.size > 0 || this.aggregate.size > 0;
    }

    /**
     * Whether only a subset of fields are selected.
     */
    isAggregate() {
        return this.groupBy.size > 0 || this.aggregate.size > 0;
    }

    getFirstSelect() {
        return this.select.values().next().value;
    }

    isSelected(field: string): boolean {
        return this.select.has(field);
    }

    hasJoins() {
        return false;
    }

    hasParameters(): boolean {
        return false;
    }
}

export class BaseQuery<T extends OrmEntity> {
    //for higher kinded type for selected fields
    _!: () => T;

    protected createModel<T extends OrmEntity>() {
        return new DatabaseQueryModel<T, T, T>();
    }

    public model: DatabaseQueryModel<T, T, T>;

    constructor(
        public readonly classSchema: ReflectionClass<any>,
        model?: DatabaseQueryModel<T, T, T>
    ) {
        this.model = model || this.createModel<T>();
    }

    groupBy<K extends FieldName<T>[]>(...field: K): this {
        const c = this.clone();
        c.model.groupBy = new Set([...field as string[]]);
        return c as any;
    }

    withSum<K extends FieldName<T>, AS extends string>(field: K, as?: AS): Replace<this, Resolve<this> & { [K in [AS] as `${AS}`]: number }> {
        return this.aggregateField(field, 'sum', as) as any;
    }

    withGroupConcat<K extends FieldName<T>, AS extends string>(field: K, as?: AS): Replace<this, Resolve<this> & { [C in [AS] as `${AS}`]: T[K][] }> {
        return this.aggregateField(field, 'group_concat', as);
    }

    withCount<K extends FieldName<T>, AS extends string>(field: K, as?: AS): Replace<this, Resolve<this> & { [K in [AS] as `${AS}`]: number }> {
        return this.aggregateField(field, 'count', as) as any;
    }

    withMax<K extends FieldName<T>, AS extends string>(field: K, as?: AS): Replace<this, Resolve<this> & { [K in [AS] as `${AS}`]: number }> {
        return this.aggregateField(field, 'max', as) as any;
    }

    withMin<K extends FieldName<T>, AS extends string>(field: K, as?: AS): Replace<this, Resolve<this> & { [K in [AS] as `${AS}`]: number }> {
        return this.aggregateField(field, 'min', as) as any;
    }

    withAverage<K extends FieldName<T>, AS extends string>(field: K, as?: AS): Replace<this, Resolve<this> & { [K in [AS] as `${AS}`]: number }> {
        return this.aggregateField(field, 'avg', as) as any;
    }

    aggregateField<K extends FieldName<T>, AS extends string>(field: K, func: string, as?: AS): Replace<this, Resolve<this> & { [K in [AS] as `${AS}`]: number }> {
        throw new Error();
    }

    select<K extends (keyof Resolve<this>)[]>(...select: K): Replace<this, Pick<Resolve<this>, K[number]>> {
        throw new Error();
    }

    returning(...fields: FieldName<T>[]): this {
        throw new Error();
    }

    skip(value?: number): this {
        throw new Error();
    }

    /**
     * Sets the page size when `page(x)` is used.
     */
    itemsPerPage(value: number): this {
        throw new Error();
    }

    /**
     * Applies limit/skip operations correctly to basically have a paging functionality.
     * Make sure to call itemsPerPage() before you call page.
     */
    page(page: number): this {
        throw new Error();
    }

    limit(value?: number): this {
        throw new Error();
    }

    parameter(name: string, value: any): this {
        throw new Error();
    }

    parameters(parameters: { [name: string]: any }): this {
        throw new Error();
    }

    disableIdentityMap(): this {
        throw new Error();
    }

    disableChangeDetection(): this {
        throw new Error();
    }

    having(filter?: this['model']['filter']): this {
        const c = this.clone();
        c.model.having = filter;
        return c;
    }

    filter(filter?: this['model']['filter']): this {
        throw new Error();
    }

    addFilter<K extends keyof T & string>(name: K, value: FilterQuery<T>[K]): this {
        throw new Error();
    }

    sort(sort?: this['model']['sort']): this {
        throw new Error();
    }

    orderBy<K extends FieldName<T>>(field: K, direction: 'asc' | 'desc' = 'asc'): this {
        throw new Error();
    }

    clone(): this {
        throw new Error();
    }

    /**
     * Adds a left join in the filter. Does NOT populate the reference with values.
     * Accessing `field` in the entity (if not optional field) results in an error.
     */
    join<K extends keyof T, ENTITY = FlattenIfArray<T[K]>>(field: K, type: 'left' | 'inner' = 'left', populate: boolean = false): this {
        throw new Error();
    }
}

export type Methods<T> = { [K in keyof T]: K extends keyof Query<any> ? never : T[K] extends ((...args: any[]) => any) ? K : never }[keyof T];

/**
 * This a generic query abstraction which should supports most basics database interactions.
 *
 * All query implementations should extend this since db agnostic consumers are probably
 * coded against this interface via Database<DatabaseAdapter> which uses this GenericQuery.
 */
export class Query<T extends OrmEntity> {
    // protected lifts: ClassType[] = [];
    //
    // static is<T extends ClassType<Query<any>>>(v: Query<any>, type: T): v is InstanceType<T> {
    //     return v.lifts.includes(type) || v instanceof type;
    // }
    //
    // constructor(
    //     classSchema: ReflectionClass<T>,
    //     // protected session: DatabaseSession<any>,
    //     // protected resolver: GenericQueryResolver<T>
    // ) {
    //     super(classSchema);
    // }
    //
    // static from<Q extends Query<any> & { _: () => T }, T extends ReturnType<InstanceType<B>['_']>, B extends ClassType<Query<any>>>(this: B, query: Q): Replace<InstanceType<B>, Resolve<Q>> {
    //     throw new Error();
    // }
    //
    // public lift<B extends ClassType<Query<any>>, T extends ReturnType<InstanceType<B>['_']>, THIS extends Query<any> & { _: () => T }>(
    //     this: THIS, query: B
    // ): Replace<InstanceType<B>, Resolve<this>> & Pick<this, Methods<this>> {
    //     throw new Error();
    // }
    //
    // clone(): this {
    //     throw new Error();
    // }
    //
    // protected async callOnFetchEvent(query: Query<any>): Promise<this> {
    //     throw new Error();
    // }
    //
    // protected onQueryResolve(query: Query<any>): this {
    //     throw new Error();
    // }
    //
    // public async count(fromHas: boolean = false): Promise<number> {
    //     throw new Error();
    // }
    //
    // public async find(): Promise<Resolve<this>[]> {
    //     throw new Error();
    // }
    //
    // public async findOneOrUndefined(): Promise<T | undefined> {
    //     throw new Error();
    // }
    //
    // public async findOne(): Promise<Resolve<this>> {
    //     throw new Error();
    // }
    // // //
    // // // public async deleteMany(): Promise<DeleteResult<T>> {
    // // //     throw new Error();
    // // // }
    // // //
    // // // public async deleteOne(): Promise<DeleteResult<T>> {
    // // //     throw new Error();
    // // // }
    // // //
    // // // protected async delete(query: Query<any>): Promise<DeleteResult<T>> {
    // // //     throw new Error();
    // // // }
    // //
    // // // public async patchMany(patch: ChangesInterface<T> | Partial<T>): Promise<PatchResult<T>> {
    // // //     throw new Error();
    // // // }
    // // //
    // // // public async patchOne(patch: ChangesInterface<T> | Partial<T>): Promise<PatchResult<T>> {
    // // //     throw new Error();
    // // // }
    // // //
    // // // protected async patch(query: Query<any>, patch: Partial<T> | ChangesInterface<T>): Promise<PatchResult<T>> {
    // // //     throw new Error();
    // // // }
    // // //
    // // // public async has(): Promise<boolean> {
    // // //     throw new Error();
    // // // }
    // // //
    // // // public async ids(singleKey?: false): Promise<PrimaryKeyFields<T>[]>;
    // // // public async ids(singleKey: true): Promise<PrimaryKeyType<T>[]>;
    // // // public async ids(singleKey: boolean = false): Promise<PrimaryKeyFields<T>[] | PrimaryKeyType<T>[]> {
    // // //     throw new Error();
    // // // }

    public findField<K extends FieldName<T>>(name: K): FieldName<T> {
        throw new Error();
    }

    // public async findOneField<K extends FieldName<T>>(name: K): Promise<T[K]> {
    //     throw new Error();
    // }
    //
    // public async findOneFieldOrUndefined<K extends FieldName<T>>(name: K): Promise<T[K] | undefined> {
    //     throw new Error();
    // }
}

interface User {
    id: number;
    username: string;
}

test('complex query', () => {

    const queryUser = typeOf<Query<User>>();
    const queryAny = typeOf<Query<any>>();

    type t1 = Query<User> extends Query<any> ? true : never;
    type t2 = Query<any> extends Query<User> ? true : never;


    type t3 = FieldName<any>;
    expect(stringifyResolvedType(typeOf<t3>())).toBe('string');
    type t4 = FieldName<User>;

    type t5 = FieldName<any> extends FieldName<User> ? true : never;
    type t6 = FieldName<User> extends FieldName<any> ? true : never;

    expect(isExtendable(typeOf<FieldName<User>>(), typeOf<FieldName<any>>())).toBe(true);
    expect(isExtendable(typeOf<FieldName<any>>(), typeOf<FieldName<User>>())).toBe(false);

    expect(isExtendable(queryUser, queryAny)).toBe(true);
    expect(isExtendable(queryAny, queryUser)).toBe(false);
});

test('T in constraint', () => {
    type Q<T> = {a: keyof T & string};

    type qAny = Q<any>;
    type qUser = Q<User>;

    type t0 = any extends User ? true : never;
    type t1 = Q<any> extends Q<User> ? true : never;
    type t2 = qAny extends qUser ? true : never;
    type t3 = {a: string} extends {a: 'id' | 'username'} ? true : never;
    type t4 = string extends 'id' | 'username' ? true : never;

    interface Q1<T> {
        a: T & string;
    }

    interface Q2 {
        findField(): string;
    }

    interface Q3 {
        findField(): 'id' | 'username';
    }
    // type t11 = Q1<string> extends Q1<'id' | 'username'> ? true : never;
    // type t2 = Q<User> extends Q<any> ? true : never;
    // type t21 = Q1<'id' | 'username'> extends Q1<string> ? true : never;
    // type t22 = Q2 extends Q3 ? true : never;
    //
    // type b1 = ReturnType<Q<any>['findField']>;
    // type b2 = ReturnType<Q<User>['findField']>;
    // type t3 = ReturnType<Q<any>['findField']> extends ReturnType<Q<User>['findField']> ? true : never;
    // type t31 = string extends 'user' ? true : never;
    // type t32 = { a: string } extends { a: 'user' } ? true : never;
    // type t33 = { a(): string } extends { a(): 'user' } ? true : never;
    //
    // const qAny = typeOf<Q<any>>();
    // const qUser = typeOf<Q<User>>();
    //
    // const c1 = ReflectionClass.from(qAny);
    // const c2 = ReflectionClass.from(qUser);
    //
    // console.log(stringifyResolvedType(c1.getMethod('findField').getReturnType()));
    // console.log(stringifyResolvedType(c2.getMethod('findField').getReturnType()));
    //
    // // console.log(stringifyResolvedType(c1.type));
    // // console.log(stringifyResolvedType(c2.type));
    //
    // expect(isExtendable(qUser, qAny)).toBe(true);
    // expect(isExtendable(qAny, qUser)).toBe(true);
});
