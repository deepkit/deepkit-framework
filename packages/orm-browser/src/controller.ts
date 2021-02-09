import { isObject } from '@deepkit/core';
import { Database, DatabaseAdapter } from '@deepkit/orm';
import { BrowserControllerInterface, DatabaseCommit, DatabaseInfo } from '@deepkit/orm-browser-api';
import { rpc } from '@deepkit/rpc';
import { ClassSchema, plainToClass, serializeSchemas, t } from '@deepkit/type';
import { inspect } from 'util';

export class BrowserController implements BrowserControllerInterface {
    constructor(protected databases: Database[]) { }

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
    @t.number
    async getCount(dbName: string, entityName: string, @t.map(t.any) filter: { [name: string]: any }): Promise<number> {
        const [db, entity] = this.getDbEntity(dbName, entityName);

        return await db.query(entity).filter(filter).count();
    }

    @rpc.action()
    @t.array(t.any)
    async getItems(dbName: string, entityName: string, @t.map(t.any) filter: { [name: string]: any }, limit: number, skip: number): Promise<any[]> {
        const [db, entity] = this.getDbEntity(dbName, entityName);

        return await db.query(entity).filter(filter).limit(limit).skip(skip).find();
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
        console.log(inspect(commit, false, 2133));

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
                        console.log('add', item);
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