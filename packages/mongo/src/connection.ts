import {Collection, MongoClient, MongoClientOptions} from "mongodb";
import {getDatabaseName} from "@marcj/marshal";
import {resolveCollectionName} from "./database-session";
import {ClassType} from "@marcj/estdlib";

export class Connection {
    protected client?: MongoClient;

    constructor(
        public host: string,
        public defaultDatabase: string,
        public username?: string,
        public password?: string,
    ) {
    }

    async close(force?: boolean) {
        if (this.client) {
            this.client.close(force);
        }
    }

    async connect(): Promise<MongoClient> {
        if (this.client) return this.client;

        const auth = this.username && this.password ? {
            username: this.username,
            password: this.password,
        } : undefined;

        this.client = await MongoClient.connect(`mongodb://${this.host}/exampleDb`, {
            auth: auth,
            useNewUrlParser: true,
        } as MongoClientOptions);
        this.client.db()

        return this.client;
    }

    public async getCollection(classType: ClassType<any>): Promise<Collection> {
        return (await this.connect())
            .db(getDatabaseName(classType) || this.defaultDatabase)
            .collection(resolveCollectionName(classType));
    }
}
