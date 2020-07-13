import {Collection, MongoClient, MongoClientOptions} from "mongodb";
import {getCollectionName, getDatabaseName, getEntityName} from "@super-hornet/marshal";
import {ClassType, ParsedHost} from "@super-hornet/core";

export function resolveCollectionName<T>(classType: ClassType<T>): string {
    return getCollectionName(classType) || getEntityName(classType);
}

export interface MongoConnectionConfig {
    host: ParsedHost;
    srv: boolean;
    defaultDatabase: string;
    username?: string;
    password?: string;

    ssl: boolean;
    sslCA?: ReadonlyArray<Buffer | string>;
    sslCRL?: ReadonlyArray<Buffer | string>;
    sslCert?: Buffer | string;
    sslKey?: Buffer | string;
    sslPass?: Buffer | string;
}

export class MongoConnection {
    protected client?: MongoClient;

    constructor(
        public config: MongoConnectionConfig
    ) {
    }

    close(force?: boolean) {
        if (this.client) this.client.close(force);
    }

    async connect(): Promise<MongoClient> {
        if (this.client) return this.client;

        const auth = this.config.username && this.config.password ? {
            username: this.config.username,
            password: this.config.password,
        } : undefined;

        const proto = this.config.srv ? 'mongodb+srv' : 'mongodb';
        this.client = await MongoClient.connect(`${proto}://${this.config.host.toString()}/${this.config.defaultDatabase}`, {
            auth: auth,
            useUnifiedTopology: true,
            ssl: this.config.ssl,
            sslCA: this.config.sslCA,
            sslCRL: this.config.sslCRL,
            sslCert: this.config.sslCert,
            sslKey: this.config.sslKey,
            sslPass: this.config.sslPass,
            useNewUrlParser: true,
        } as MongoClientOptions);

        return this.client;
    }

    public async getCollection(classType: ClassType<any>): Promise<Collection> {
        return (await this.connect())
            .db(getDatabaseName(classType) || this.config.defaultDatabase)
            .collection(resolveCollectionName(classType));
    }
}
