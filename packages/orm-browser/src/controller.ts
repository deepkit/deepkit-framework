import { Database, DatabaseAdapter } from '@deepkit/orm';
import { BrowserControllerInterface, DatabaseInfo } from '@deepkit/orm-browser-api';
import { rpc } from '@deepkit/rpc';
import { ClassSchema, plainToClass, PropertySchemaSerialized, serializeSchemas, t } from '@deepkit/type';

export class BrowserController implements BrowserControllerInterface {
    constructor(protected databases: Database[]) { }

    protected extractDatabaseInfo(db: Database): DatabaseInfo {
        return new DatabaseInfo(db.name, (db.adapter as DatabaseAdapter).getName(), serializeSchemas([...db.entities]));
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
    @t.array(t.any)
    async getItems(dbName: string, entityName: string): Promise<any[]> {
        const [db, entity] = this.getDbEntity(dbName, entityName);

        return await db.query(entity).find();
    }

    @rpc.action()
    @t.any
    async create(dbName: string, entityName: string): Promise<any> {
        const [db, entity] = this.getDbEntity(dbName, entityName);
        return plainToClass(entity, {});
    }

    @rpc.action()
    @t.any
    async add(dbName: string, entityName: string, @t.array(t.any) items: any[]): Promise<any> {
        const [db, entity] = this.getDbEntity(dbName, entityName);
        const session = db.createSession();

        for (const item of items) {
            session.add(plainToClass(entity, item));
        }

        await session.commit();
    }
}