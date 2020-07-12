import {
    BaseQuery,
    DatabaseAdapter, DatabaseAdapterQueryFactory,
    DatabaseQueryModel, DatabaseSession,
    DatabaseType,
    Entity,
    Formatter,
    Sort
} from "@super-hornet/marshal-orm";
import {ClassSchema, f, getClassSchema, t} from "@super-hornet/marshal";
import {ClassType, ParsedHost, parseHost} from "@super-hornet/core";
import {MongoConnection} from "./connection";
import {MongoDatabaseQuery} from "./query";
import {MongoQueryResolver} from "./resolver";
import {MongoQueryModel} from "./query.model";
import {classToMongo, partialClassToMongo} from "./mapping";

export class MongoDatabaseConfig {
    public host: ParsedHost;
    public username?: string;
    public password?: string;

    public srv: boolean = false;

    public ssl: boolean = false;
    public sslCA?: ReadonlyArray<Buffer | string>;
    public sslCRL?: ReadonlyArray<Buffer | string>;
    public sslCert?: Buffer | string;
    public sslKey?: Buffer | string;
    public sslPass?: Buffer | string;

    constructor(hostOrUnix: string, public defaultDatabase: string) {
        this.host = parseHost(hostOrUnix);
    }
}

export class MongoDatabaseQueryFactory extends DatabaseAdapterQueryFactory {
    constructor(
        private connection: MongoConnection,
        private databaseSession: DatabaseSession<any>,
    ) {
        super();
    }

    createQuery<T extends Entity>(
        classType: ClassType<T>
    ): MongoDatabaseQuery<T> {
        const classSchema = getClassSchema(classType);
        const queryResolver = new MongoQueryResolver<T>(classSchema, this.databaseSession, this.connection);
        const model = new MongoQueryModel<T>();
        return new MongoDatabaseQuery(classSchema, model, queryResolver);
    }
}

export class MongoDatabaseAdapter implements DatabaseAdapter {
    public readonly connection: MongoConnection;

    constructor(
        public config: MongoDatabaseConfig
    ) {
        this.connection = new MongoConnection(config);
    }

    queryFactory(databaseSession: DatabaseSession<any>): MongoDatabaseQueryFactory {
        return new MongoDatabaseQueryFactory(this.connection, databaseSession);
    }

    disconnect(force?: boolean): void {
        this.connection.close(force);
    }

    getType(): DatabaseType {
        return 'mongo';
    }

    async add<T>(classSchema: ClassSchema<T>, item: T): Promise<void> {
        const collection = await this.connection.getCollection(classSchema.classType);
        const mongoItem = classToMongo(classSchema.classType, item);

        const result = await collection.insertOne(mongoItem);

        if (result.insertedId) {
            if (classSchema.getPrimaryField().type === 'objectId' && result.insertedId && result.insertedId.toHexString) {
                (<any>item)[classSchema.getPrimaryField().name] = result.insertedId.toHexString();
            }
        }
    }

    async patch<T>(classSchema: ClassSchema<T>, primaryKey: any, item: Partial<T>): Promise<void> {
        const collection = await this.connection.getCollection(classSchema.classType);
        const updateStatement: { [name: string]: any } = {};
        updateStatement['$set'] = partialClassToMongo(classSchema.classType, item);
        await collection.updateMany(partialClassToMongo(classSchema.classType, primaryKey), updateStatement);
    }

    async update<T>(classSchema: ClassSchema<T>, primaryKey: any, item: T): Promise<void> {
        const collection = await this.connection.getCollection(classSchema.classType);
        const mongoItem = classToMongo(classSchema.classType, item);
        await collection.findOneAndReplace(partialClassToMongo(classSchema.classType, primaryKey), mongoItem);
    }

    async remove<T>(classSchema: ClassSchema<T>, primaryKey: any): Promise<void> {
        const collection = await this.connection.getCollection(classSchema.classType);
        await collection.deleteOne(partialClassToMongo(classSchema.classType, primaryKey));
    }
}
