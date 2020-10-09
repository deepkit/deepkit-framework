import {inject, Injector} from './injector/injector';
import {Database} from '@deepkit/orm';
import {ClassType} from '@deepkit/core';
import {DynamicModule} from './decorator';
import {ClassSchema, getClassSchema} from '@deepkit/type';

/**
 * Class to register a new database and resolve a schema/type to a database.
 */
export class Databases {
    protected databaseMap = new Map<string, Database<any>>();

    constructor(
        @inject().root() protected injector: Injector,
        @inject('orm.databases') public databaseTypes: ClassType<Database<any>>[]
    ) {
    }

    public onShutDown() {
        for (const database of this.databaseMap.values()) {
            database.disconnect();
        }
    }

    public init() {
        for (const databaseType of this.databaseTypes) {
            const database = this.injector.get(databaseType);

            for (const classSchema of database.classSchemas.values()) {
                classSchema.data['orm.database'] = database;
            }

            if (this.databaseMap.has(database.name)) {
                throw new Error(`Database with name ${database.name} already registered`);
            }
            this.databaseMap.set(database.name, database);
        }
    }

    static for(...databases: ClassType<Database<any>>[]): DynamicModule {
        return {
            root: true,
            module: class {
            },
            providers: [
                ...databases,
                {provide: 'orm.databases', useValue: databases},
            ],
        };
    }

    getDatabaseForEntity(entity: ClassSchema | ClassType): Database<any> {
        const schema = getClassSchema(entity);
        const database = schema.data['orm.database'];
        if (!database) throw new Error(`Class ${schema.getClassName()} is not assigned to a database`);
        return database;
    }

    getDatabases() {
        return this.databaseMap.values();
    }

    getDatabase(name: string): Database<any> | undefined {
        return this.databaseMap.get(name);
    }

}
