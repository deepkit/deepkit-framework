import {DatabaseAdapter, DatabaseAdapterQueryFactory, DatabaseSession, Entity} from '@super-hornet/marshal-orm';
import {ClassSchema, getClassSchema} from '@super-hornet/marshal';
import {ClassType} from '@super-hornet/core';
import {MongoDatabaseQuery} from './query';
import {MongoQueryResolver} from './query.resolver';
import {MongoQueryModel} from './query.model';
import {MongoPersistence} from './persistence';
import {MongoClient} from './client/client';

export class MongoDatabaseQueryFactory extends DatabaseAdapterQueryFactory {
    constructor(
        private client: MongoClient,
        private databaseSession: DatabaseSession<any>,
    ) {
        super();
    }

    createQuery<T extends Entity>(
        classType: ClassType<T>
    ): MongoDatabaseQuery<T> {
        const classSchema = getClassSchema(classType);
        const queryResolver = new MongoQueryResolver<T>(classSchema, this.databaseSession);
        const model = new MongoQueryModel<T>();
        model.withIdentityMap = this.databaseSession.withIdentityMap;
        return new MongoDatabaseQuery(classSchema, model, queryResolver);
    }
}

export class MongoDatabaseAdapter implements DatabaseAdapter {
    public readonly client: MongoClient;

    constructor(
        connectionString: string
    ) {
        this.client = new MongoClient(connectionString);
    }

    getName(): string {
        return 'mongo';
    }

    createPersistence(databaseSession: DatabaseSession<any>): MongoPersistence {
        return new MongoPersistence(this.client);
    }

    queryFactory(databaseSession: DatabaseSession<any>): MongoDatabaseQueryFactory {
        return new MongoDatabaseQueryFactory(this.client, databaseSession);
    }

    disconnect(force?: boolean): void {
        this.client.close();
    }

    async migrate(classSchemas: Iterable<ClassSchema>) {
        // for (const schema of classSchemas) {
        //     const collection = await this.connection.getCollection(schema);
        //     //collection not existing yet, so create lock
        //     for (const [name, index] of schema.indices.entries()) {
        //         const fields: { [name: string]: 1 } = {};
        //
        //         if (index.fields.length === 1 && index.fields[0] === '_id') continue;
        //
        //         for (const f of index.fields) {
        //             fields[f] = 1;
        //         }
        //
        //         const options: any = {
        //             name: name
        //         };
        //         if (index.options.unique) options.unique = true;
        //         if (index.options.sparse) options.sparse = true;
        //
        //         try {
        //             await collection.createIndex(fields, options);
        //         } catch (error) {
        //             console.log('failed index', name, '. Recreate ...');
        //             //failed, so drop and re-create
        //             await collection.dropIndex(name);
        //             await collection.createIndex(fields, options);
        //         }
        //     }
        // }
    };
}
