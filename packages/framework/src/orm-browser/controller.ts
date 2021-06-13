import { getEnumValues, isArray, isObject } from '@deepkit/core';
import { Database, DatabaseAdapter } from '@deepkit/orm';
import { BrowserControllerInterface, DatabaseCommit, DatabaseInfo, EntityPropertySeed, EntityPropertySeedReference, fakerFunctions, FakerTypes, getType, QueryResult, SeedDatabase } from '@deepkit/orm-browser-api';
import { rpc } from '@deepkit/rpc';
import { ClassSchema, jsonSerializer, plainToClass, PropertySchema, serializeSchemas, t } from '@deepkit/type';
import * as faker from 'faker';
import { SQLDatabaseAdapter } from '@deepkit/sql';
import { Logger, MemoryLoggerTransport } from '@deepkit/logger';
import { performance } from 'perf_hooks';
import { http } from '@deepkit/http';

@rpc.controller(BrowserControllerInterface)
export class OrmBrowserController implements BrowserControllerInterface {
    constructor(protected databases: Database[]) {
    }

    public registerDatabase(...databases: Database[]) {
        this.databases.push(...databases);
    }

    protected extractDatabaseInfo(db: Database): DatabaseInfo {
        return new DatabaseInfo(db.name, (db.adapter as DatabaseAdapter).getName(), serializeSchemas([...db.entities]));
    }

    protected getDb(dbName: string): Database {
        for (const db of this.databases) {
            if (db.name === dbName) return db;
        }
        throw new Error(`No database ${dbName} found`);
    }

    protected getDbEntity(dbName: string, entityName: string): [Database, ClassSchema] {
        for (const db of this.databases) {
            if (db.name === dbName) {
                for (const entity of db.entities) {
                    if (entity.name === entityName) return [db, entity];
                }
            }
        }

        throw new Error(`No entity ${entityName} for in database ${dbName}`);
    }

    @rpc.action()
    @t.array(DatabaseInfo)
    getDatabases(): DatabaseInfo[] {
        const databases: DatabaseInfo[] = [];

        for (const db of this.databases) {
            databases.push(this.extractDatabaseInfo(db));
        }

        return databases;
    }

    @rpc.action()
    @t.type(DatabaseInfo)
    getDatabase(name: string): DatabaseInfo {
        for (const db of this.databases) {
            if (db.name === name) return this.extractDatabaseInfo(db);
        }

        throw new Error(`No database ${name} found`);
    }

    protected findDatabase(name: string): Database {
        for (const db of this.databases) {
            if (db.name === name) return db;
        }

        throw new Error(`No database ${name} found`);
    }

    @rpc.action()
    async migrate(name: string): Promise<void> {
        const db = this.findDatabase(name);
        await db.migrate();
    }

    @rpc.action()
    async resetAllTables(name: string): Promise<void> {
        const db = this.findDatabase(name);
        if (db.adapter instanceof SQLDatabaseAdapter) {
            await db.adapter.createTables([...db.entities.values()]);
        }
    }

    @rpc.action()
    @t.any
    async getFakerTypes(): Promise<FakerTypes> {
        const res: FakerTypes = {};

        for (const fn of fakerFunctions) {
            const [p1, p2] = fn.split('.');
            try {
                const example = p2 ? (faker as any)[p1][p2]() : (faker as any)[p1]();
                res[fn] = { example: example, type: getType(example) };
            } catch (error) {
                console.log(`warning: faker function not available ${fn}: ${error}`);
            }
        }
        return res;
    }

    @rpc.action()
    @t.any
    async getMigrations(name: string): Promise<{ [name: string]: { sql: string[], diff: string } }> {
        const db = this.findDatabase(name);
        if (db.adapter instanceof SQLDatabaseAdapter) {
            return db.adapter.getMigrations([...db.entities.values()]);
        }
        return {};
    }

    @rpc.action()
    async seed(dbName: string, seed: SeedDatabase): Promise<void> {
        const db = this.getDb(dbName);
        db.logger.active = false;

        try {
            const session = db.createSession();
            const added: { [entityName: string]: any[] } = {};
            const assignReference: {
                path: string,
                entity: string,
                properties: { [name: string]: EntityPropertySeed },
                reference: EntityPropertySeedReference,
                callback: (v: any) => any
            }[] = [];

            function fakerValue(path: string, fakerName: string): any {
                const [p1, p2] = fakerName.split('.');
                try {
                    return p2 ? (faker as any)[p1][p2]() : (faker as any)[p1]();
                } catch (error) {
                    console.warn(`Could not fake ${path} via faker's ${fakerName}: ${error}`);
                }
            }

            function fake(path: string, property: PropertySchema, propSeed: EntityPropertySeed, callback: (v: any) => any): any {
                if (!propSeed.fake) {
                    if (propSeed.value !== undefined) callback(propSeed.value);
                    return;
                }

                if (property.isReference) {
                    if (property.type !== 'class') throw new Error(`${path}: only class properties can be references`);
                    assignReference.push({ path, entity: property.getResolvedClassSchema().getName(), reference: propSeed.reference, properties: propSeed.properties, callback });
                    return;
                } else if (property.isArray) {
                    const res: any[] = [];
                    if (!propSeed.array) return res;
                    const range = propSeed.array.max - propSeed.array.min;
                    const subPath = path + '.' + property.getSubType().name;
                    for (let i = 0; i < Math.ceil(Math.random() * range); i++) {
                        fake(subPath, property.getSubType(), propSeed.array.seed, (v) => {
                            res.push(v);
                        });
                    }

                    return callback(res);
                } else if (property.isMap) {
                    const res: { [name: string]: any } = {};
                    if (!propSeed.map) return res;
                    const map = propSeed.map;
                    const range = propSeed.map.max - propSeed.map.min;
                    const subPath = path + '.' + property.getSubType().name;
                    for (let i = 0; i < Math.ceil(Math.random() * range); i++) {
                        fake(subPath, property.getSubType(), propSeed.map.seed, (v) => {
                            res[fakerValue(subPath, map.key.faker)] = v;
                        });
                    }
                    return callback(res);
                } else if (property.type === 'class' || property.type === 'partial') {
                    const foreignSchema = property.getResolvedClassSchema();
                    const item = plainToClass(foreignSchema, {});
                    for (const prop of foreignSchema.getProperties()) {
                        if (!propSeed.properties[prop.name]) continue;

                        fake(path + '.' + prop.name, prop, propSeed.properties[prop.name], (v) => {
                            item[prop.name] = v;
                        });
                    }
                    return callback(item);
                } else if (property.type === 'boolean') {
                    callback(Math.random() > 0.5);
                } else if (property.type === 'enum') {
                    const keys = getEnumValues(property.getResolvedClassType());
                    callback(keys[keys.length * Math.random() | 0]);
                } else {
                    return callback(fakerValue(path, propSeed.faker));
                }
            }

            function create(entity: ClassSchema, properties: { [name: string]: EntityPropertySeed }) {
                if (!added[entity.getName()]) added[entity.getName()] = [];

                const item = plainToClass(entity, {});

                for (const [propName, propSeed] of Object.entries(properties)) {
                    const property = entity.getProperty(propName);
                    fake(entity.getClassName() + '.' + propName, property, propSeed, (v) => {
                        item[property.name] = v;
                    });
                }

                for (const reference of entity.references) {
                    if (reference.isArray) continue;
                    if (reference.backReference) continue;
                    item[reference.name] = db.getReference(reference.getResolvedClassSchema(), item[reference.name]);
                }

                session.add(item);
                added[entity.getName()].push(item);
                return item;
            }

            for (const [entityName, entitySeed] of Object.entries(seed.entities)) {
                if (!entitySeed || !entitySeed.active) continue;
                const entity = db.getEntity(entityName);

                if (entitySeed.truncate) {
                    await db.query(entity).deleteMany();
                }

                for (let i = 0; i < entitySeed.amount; i++) {
                    create(entity, entitySeed.properties);
                }
            }

            //assign references
            const dbCandidates: { [entityName: string]: any[] } = {};
            for (const ref of assignReference) {
                const entity = db.getEntity(ref.entity);

                let candidates = added[ref.entity] ||= [];
                if (ref.reference === 'random') {
                    //note: I know there are faster ways, but this gets the job done for now
                    candidates = dbCandidates[ref.entity] ||= await db.query(entity).limit(1000).find();
                }

                if (!candidates.length) {
                    if (ref.reference === 'random') {
                        throw new Error(`Entity ${ref.entity} has no items in the database. Used in ${ref.path}.`);
                    }
                    if (ref.reference === 'random-seed') {
                        throw new Error(`Entity ${ref.entity} has no seeded items. Used in ${ref.path}.`);
                    }
                }

                if (ref.reference === 'create') {
                    ref.callback(create(entity, ref.properties));
                } else {
                    ref.callback(candidates[candidates.length * Math.random() | 0]);
                }
            }

            await session.commit();
        } finally {
            db.logger.active = true;
        }
    }

    @http.GET('_orm-browser/query')
    @t.any
    async httpQuery(@http.query() dbName: string, @http.query() entityName: string, @http.query() query: string): Promise<QueryResult> {
        const [, entity] = this.getDbEntity(dbName, entityName);
        const res = await this.query(dbName, entityName, query);
        if (isArray(res.result)) {
            const serialize = jsonSerializer.for(entity);
            res.result = res.result.map(v => serialize.partialSerialize(v));
        }
        return res;
    }

    @rpc.action()
    @t.any
    async query(dbName: string, entityName: string, query: string): Promise<QueryResult> {
        const res: QueryResult = {
            executionTime: 0,
            log: [],
            result: undefined
        };

        const [db, entity] = this.getDbEntity(dbName, entityName);
        const oldLogger = db.logger.logger;
        const loggerTransport = new MemoryLoggerTransport;
        db.logger.setLogger(new Logger([loggerTransport]));

        try {
            const fn = new Function(`return function(database, ${entity.getClassName()}) {return ${query}}`)();
            const start = performance.now();
            res.result = await fn(db, entity);
            res.executionTime = performance.now() - start;
        } catch (error) {
            res.error = String(error);
        } finally {
            res.log = loggerTransport.messageStrings;
            if (oldLogger) db.logger.setLogger(oldLogger);
        }

        return res;
    }

    @rpc.action()
    @t.number
    async getCount(dbName: string, entityName: string, @t.map(t.any) filter: { [name: string]: any }): Promise<number> {
        const [db, entity] = this.getDbEntity(dbName, entityName);

        return await db.query(entity).filter(filter).count();
    }

    @rpc.action()
    @t.any
    async getItems(
        dbName: string,
        entityName: string,
        @t.map(t.any) filter: { [name: string]: any },
        @t.map(t.any) sort: { [name: string]: any },
        limit: number,
        skip: number
    ): Promise<{ items: any[], executionTime: number }> {
        const [db, entity] = this.getDbEntity(dbName, entityName);
        const start = performance.now();
        const items = await db.query(entity).filter(filter).sort(sort).limit(limit).skip(skip).find();
        return { items, executionTime: performance.now() - start };
    }

    @rpc.action()
    @t.any
    async create(dbName: string, entityName: string): Promise<any> {
        const [db, entity] = this.getDbEntity(dbName, entityName);
        return plainToClass(entity, {});
    }

    @rpc.action()
    @t.any
    async commit(@t.any commit: DatabaseCommit) {
        // console.log(inspect(commit, false, 2133));

        function isNewIdWrapper(value: any): value is { $___newId: number } {
            return isObject(value) && '$___newId' in value;
        }

        for (const [dbName, c] of Object.entries(commit)) {
            const db = this.getDb(dbName);
            const session = db.createSession();

            try {
                const updates: Promise<any>[] = [];
                for (const [entityName, removes] of Object.entries(c.removed)) {
                    const entity = db.getEntity(entityName);
                    const query = session.query(entity);

                    for (const remove of removes) {
                        updates.push(query.filter(db.getReference(entity, remove)).deleteOne());
                    }
                }

                const addedItems = new Map<number, any>();

                for (const [entityName, added] of Object.entries(c.added)) {
                    const entity = db.getEntity(entityName);
                    const addedIds = c.addedIds[entityName];

                    for (let i = 0; i < added.length; i++) {
                        addedItems.set(addedIds[i], plainToClass(entity, added[i]));
                    }
                }

                for (const [entityName, ids] of Object.entries(c.addedIds)) {
                    const entity = db.getEntity(entityName);
                    const added = c.added[entityName];
                    for (let i = 0; i < added.length; i++) {
                        const id = ids[i];
                        const add = added[i];

                        const item = addedItems.get(id);

                        for (const reference of entity.references) {
                            if (reference.backReference) continue;

                            //note, we need to operate on `added` from commit
                            // since `item` from addedItems got already converted and $___newId is lost.
                            const v = add[reference.name];
                            if (reference.isArray) {

                            } else {
                                if (isNewIdWrapper(v)) {
                                    //reference to not-yet existing record,
                                    //so place the actual item in it, so the UoW accordingly saves
                                    item[reference.name] = addedItems.get(v.$___newId);
                                } else {
                                    //regular reference to already existing record,
                                    //so convert to reference
                                    item[reference.name] = db.getReference(reference.getResolvedClassSchema(), item[reference.name]);
                                }
                            }
                        }
                        session.add(item);
                    }
                }

                await session.commit();

                for (const [entityName, changes] of Object.entries(c.changed)) {
                    const entity = db.getEntity(entityName);
                    const query = session.query(entity);

                    for (const change of changes) {
                        //todo: convert $set from json to class
                        const $set = change.changes.$set;
                        if (!$set) continue;
                        for (const reference of entity.references) {
                            if (reference.backReference) continue;

                            const v = $set[reference.name];
                            if (v === undefined) continue;
                            if (isNewIdWrapper(v)) {
                                $set[reference.name] = addedItems.get(v.$___newId);
                            } else {
                                $set[reference.name] = db.getReference(reference.getResolvedClassSchema(), $set[reference.name]);
                            }
                        }
                        updates.push(query.filter(db.getReference(entity, change.pk)).patchOne(change.changes));
                    }
                }

                await Promise.all(updates);
            } catch (error) {
                //todo: rollback
                throw error;
            }
        }
    }
}
