import {DatabaseAdapter, DatabaseAdapterQueryFactory, DatabaseSession, Entity} from "@super-hornet/marshal-orm";
import {getClassSchema} from "@super-hornet/marshal";
import {ClassType, ParsedHost, parseHost} from "@super-hornet/core";
import {MongoConnection} from "./connection";
import {MongoDatabaseQuery} from "./query";
import {MongoQueryResolver} from "./query.resolver";
import {MongoQueryModel} from "./query.model";
import {MongoPersistence} from "./persistence";

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
        const queryResolver = new MongoQueryResolver<T>(classSchema, this.databaseSession);
        const model = new MongoQueryModel<T>();
        model.withIdentityMap = this.databaseSession.withIdentityMap;
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

    getName(): string {
        return 'mongo';
    }

    createConnection(): MongoConnection {
        //todo: add connection pooling
        // return new MongoConnection(this.config);
        return this.connection;
    }

    createPersistence(databaseSession: DatabaseSession<any>): MongoPersistence {
        return new MongoPersistence(this.connection);
    }

    queryFactory(databaseSession: DatabaseSession<any>): MongoDatabaseQueryFactory {
        return new MongoDatabaseQueryFactory(this.connection, databaseSession);
    }

    disconnect(force?: boolean): void {
        this.connection.close(force);
    }
}
