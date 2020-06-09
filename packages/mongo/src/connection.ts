import {Collection, MongoClient, MongoClientOptions} from "mongodb";
import {getDatabaseName} from "@marcj/marshal";
import {resolveCollectionName} from "./database-session";
import {ClassType} from "@marcj/estdlib";

export class Connection {
    protected client?: MongoClient;

    public srv: boolean = false;

    public ssl: boolean = false;
    public sslCA?: ReadonlyArray<Buffer | string>;
    public sslCRL?: ReadonlyArray<Buffer | string>;
    public sslCert?: Buffer | string;
    public sslKey?: Buffer | string;
    public sslPass?: Buffer | string;

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

        const proto = this.srv ? 'mongodb+srv' : 'mongodb';
        this.client = await MongoClient.connect(`${proto}://${this.host}/${this.defaultDatabase}`, {
            auth: auth,
            ssl: this.ssl,
            sslCA: this.sslCA,
            sslCRL: this.sslCRL,
            sslCert: this.sslCert,
            sslKey: this.sslKey,
            sslPass: this.sslPass,
            useNewUrlParser: true,
        } as MongoClientOptions);

        return this.client;
    }

    public async getCollection(classType: ClassType<any>): Promise<Collection> {
        return (await this.connect())
            .db(getDatabaseName(classType) || this.defaultDatabase)
            .collection(resolveCollectionName(classType));
    }
}
