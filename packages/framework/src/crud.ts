import { ClassType, getObjectKeysSize, isArray } from '@deepkit/core';
import { ClassSchema, getClassSchema, plainToClass, t, ValidationFailed } from '@deepkit/type';
import { AppModule } from '@deepkit/app';
import { http, httpClass, JSONResponse } from '@deepkit/http';
import { Database, DatabaseRegistry, Query, UniqueConstraintFailure } from '@deepkit/orm';
import { PropertySchema } from '../../type';

function applySelect(query: Query<any>, select: string[] | string): Query<any> {
    const names: string[] = isArray(select) ? select.map(v => v.trim()) : select.replace(/\s+/g, '').split(',');
    try {
        return query.select(...names);
    } catch (error) {
        throw ValidationFailed.from([{ message: String(error.message), path: 'select', code: 'invalid_select' }]);
    }
}

function applyJoins(query: Query<any>, joins: { [name: string]: string }): Query<any> {
    for (const [field, projection] of Object.entries(joins)) {
        if (!query.classSchema.hasProperty(field)) throw new Error(`Join '${field}' does not exist`);
        let join = query.useJoinWith(field);
        if (projection.length && projection !== '*') {
            join = join.select(...projection.split(','));
        }
        query = join.end();
    }

    return query;
}

interface AutoCrudOptions {
    /**
     * To limit the route generation to a subset of operations, specify an array of
     * 'create' | 'read' | 'readMany' | 'update' | 'updateMany' | 'delete' | 'deleteMany'.
     *
     * ```typescript
     *  {limitOperations: ['create', 'read', 'readMany']}
     * ```
     */
    limitOperations?: ('create' | 'read' | 'readMany' | 'update' | 'updateMany' | 'delete' | 'deleteMany')[];

    /**
     * Defaults to the primary key.
     * If you have an additional unique field, you can specify here its name.
     */
    identifier?: string;

    /**
     * Per default all fields are selectable in list/get routes.
     *
     * Specify each field to limit the selection.
     */
    selectableFields?: string[];

    /**
     * Per default all fields are sortable in list/get routes.
     *
     * Specify each field to limit the selection.
     */
    sortFields?: string[];

    /**
     * Per default the identifier/primary key can not be changed.
     *
     * Set this to true to allow it.
     */
    identifierChangeable?: true;

    /**
     * Per default all joins are selectable in list/get routes.
     *
     * Specify each field to limit the selection.
     */
    joins?: string[];

    /**
     * Per default max is 1000.
     */
    maxLimit?: number;

    /**
     * Per default limit is 30.
     */
    defaultLimit?: number;
}

function createController(schema: ClassSchema, options: AutoCrudOptions = {}): ClassType {
    if (!schema.name) throw new Error(`Class ${schema.getClassName()} needs an entity name via @entity.name()`);

    const joinNames: string[] = options.joins || schema.getProperties().filter(v => v.isReference || v.backReference).map(v => v.name);
    const sortNames: string[] = options.sortFields || schema.getProperties().filter(v => !v.isReference && !v.backReference).map(v => v.name);
    const selectNames: string[] = options.selectableFields || schema.getProperties().filter(v => !v.isReference && !v.backReference).map(v => v.name);

    const identifier = options.identifier ? schema.getProperty(options.identifier) : schema.getPrimaryField();

    interface ListQuery {
        filter?: Partial<any>;
        select?: string;
        orderBy: { [name: string]: 'asc' | 'desc' };
        joins?: { [name: string]: string };
        offset: number;
        limit: number;
    }

    let listQuery = t.schema({
        filter: t.partial(schema).optional,
        select: t.union(t.array(t.union(...selectNames)), t.string.name('fields')).description('List of or string of comma separated field names').optional,
        orderBy: t.map(t.union('asc', 'desc'), t.union(...sortNames)).default({}),
        offset: t.number.default(0).positive(),
        limit: t.number.default(0).positive().maximum(options.maxLimit || 1000),
    });

    interface GetQuery {
        select?: string;
        joins?: { [name: string]: string };
    }

    let getQuery = t.schema({
        select: t.union(t.array(t.union(...selectNames)), t.string).description('List of or string of comma separated field names').optional,
    });

    if (joinNames.length) {
        const joins = t.map(t.string, t.union(...joinNames)).description('Each entry with field names, comma separated, or all with *').optional;
        listQuery.addProperty('joins', joins);
        getQuery.addProperty('joins', joins);
    }

    const createDto = schema.getPrimaryField().isAutoIncrement ? schema.exclude(schema.getPrimaryField().name) : schema;

    const error = t.schema({
        message: t.string,
    });

    const identifierChangeable = options && options.identifierChangeable ? true : false;

    function applyIdentifier(target: object, property: PropertySchema) {
        identifier.clone(property);
    }

    @http.controller('/entity/' + schema.name).group('crud')
    class RestController {
        constructor(protected registry: DatabaseRegistry) {
        }

        protected getDatabase(): Database {
            return this.registry.getDatabaseForEntity(schema);
        }

        @http.GET('')
            .description(`A list of ${schema.name}.`)
            .response(200, `List of ${schema.name}.`, t.array(schema))
            .response(400, `When parameter validation failed.`, ValidationFailed)
        async readMany(@t.type(listQuery) @http.queries() listQuery: ListQuery) {
            listQuery.limit = Math.min(options.maxLimit || 1000, listQuery.limit || options.defaultLimit || 30);
            let query = this.getDatabase().query(schema);

            if (listQuery.joins) query = applyJoins(query, listQuery.joins);
            if (listQuery.select) query = applySelect(query, listQuery.select);

            if (getObjectKeysSize(listQuery.orderBy) > 0) {
                for (const field of Object.keys(listQuery.orderBy)) {
                    if (!schema.hasProperty(field)) throw new Error(`Can not order by '${field}' since it does not exist.`);
                }
                query.model.sort = listQuery.orderBy;
            }

            return await query
                .filter(listQuery.filter)
                .limit(listQuery.limit ? listQuery.limit : undefined)
                .skip(listQuery.offset)
                .find();
        }

        @http.POST('')
            .description(`Add a new ${schema.name}.`)
            .response(201, 'When successfully created.', schema)
            .response(400, `When parameter validation failed`, ValidationFailed)
            .response(409, 'When unique entity already exists.', error)
        async create(@t.type(createDto) @http.body() body: any) {
            //body is automatically validated
            const item = plainToClass(schema, body);
            try {
                await this.getDatabase().persist(item);
            } catch (e) {
                if (e instanceof UniqueConstraintFailure) {
                    return new JSONResponse({ message: `This ${schema.name} already exists` }).status(409);
                }
                throw e;
            }
            return new JSONResponse(item).status(201);
        }

        @http.DELETE(':' + identifier.name)
            .description(`Delete a single ${schema.name}.`)
            .response(400, `When parameter validation failed`, ValidationFailed)
            .response(200, `When deletion was successful`, t.type({ deleted: t.number }))
        async delete(@t.use(applyIdentifier).description(`The identifier of ${schema.name}`) id: any) {
            const result = await this.getDatabase().query(schema).filter({ [identifier.name]: id }).deleteOne();
            return { deleted: result.modified };
        }

        @http.GET(':' + identifier.name)
            .description(`Get a single ${schema.name}.`)
            .response(200, `When ${schema.name} was found.`, schema)
            .response(400, `When parameter validation failed`, ValidationFailed)
            .response(404, `When ${schema.name} was not found.`, error)
        async read(
            @t.use(applyIdentifier).description(`The identifier of ${schema.name}`) id: any,
            @t.type(getQuery) @http.queries() options: GetQuery
        ) {
            let query = this.getDatabase().query(schema).filter({ [identifier.name]: id });
            if (options.select) query = applySelect(query, options.select);
            if (options.joins) query = applyJoins(query, options.joins);

            const item = await query.findOneOrUndefined();
            if (item) return item;

            return new JSONResponse({ message: `${schema.name} not found` }).status(404);
        }

        @http.PUT(':' + identifier.name)
            .description(`Update a single ${schema.name}.`)
            .response(200, `When ${schema.name} was successfully updated.`, schema)
            .response(400, `When parameter validation failed`, ValidationFailed)
            .response(404, `When ${schema.name} was not found.`, error)
        @t.type(schema)
        async update(
            @t.use(applyIdentifier).description(`The identifier of ${schema.name}`) id: any,
            @t.type(createDto) @http.body() body: any
        ) {
            let query = this.getDatabase().query(schema).filter({ [identifier.name]: id });

            const item = await query.findOneOrUndefined();
            if (!item) return new JSONResponse({ message: `${schema.name} not found` }).status(404);

            if (!identifierChangeable && identifier.name in body) delete body[identifier.name];

            Object.assign(item, body);
            await this.getDatabase().persist(item);
            return item;
        }
    }

    Object.defineProperty(RestController, 'name', { value: 'RestController' + schema.getClassName() });

    if (options.limitOperations) {
        const data = httpClass._fetch(RestController);
        if (!data) throw new Error('httpClass has no RestController');

        for (const action of data.actions) {
            if (!options.limitOperations.includes(action.methodName as any)) {
                data.removeAction(action.methodName);
            }
        }
    }

    return RestController;
}

export class CrudAppModule<T> extends AppModule<T> {}

/**
 * Create a module that provides CRUD routes for given entities.
 */
export function createCrudRoutes(schemas: (ClassType | ClassSchema)[], options: AutoCrudOptions = {}) {
    const controllers = schemas.map(getClassSchema).map(v => createController(v, options));

    return new CrudAppModule({
        controllers: controllers
    }, 'autoCrud');
}
