import {Collection, MongoClient, MongoClientOptions} from 'mongodb';
import {getCollectionName, getDatabaseName, getEntityName, t} from '@super-hornet/marshal';
import {ClassType, ParsedHost} from '@super-hornet/core';
import {DatabaseConnection} from '@super-hornet/marshal-orm';
import {getBSONDecoder} from '@super-hornet/marshal-bson';
import {DEEP_SORT} from './query.model';
import { deserialize } from 'bson';

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

export class MongoConnection implements DatabaseConnection {
    protected client?: MongoClient;
    protected lastConnect?: Promise<MongoClient>;

    constructor(
        public config: MongoConnectionConfig
    ) {
    }

    isInTransaction(): boolean {
        return false;
    }

    close(force?: boolean) {
        if (this.client) this.client.close(force);
    }

    async connect(): Promise<MongoClient> {
        if (this.lastConnect) return await this.lastConnect;
        if (this.client) return this.client;

        return this.lastConnect = new Promise(async (resolve, reject) => {
            const auth = this.config.username && this.config.password ? {
                username: this.config.username,
                password: this.config.password,
            } : undefined;

            try {
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
            } catch (error) {
                this.lastConnect = undefined;
                reject(error);
            }

            this.lastConnect = undefined;
            resolve(this.client);
        });
    }

    protected async command(db: string, command: any, options: any): Promise<any> {
        return (await this.connect()).db(db).command(command, options);
    }

    public async find(
        classType: ClassType<any>,
        filter: any, projection?: any,
        sort?: DEEP_SORT<any>, skip?: number, limit?: number
    ): Promise<any[]> {
        await this.connect();
        const dbName = getDatabaseName(classType) || this.config.defaultDatabase;
        const collectionName = resolveCollectionName(classType);
        const batchSize = 10001;

        // const start = performance.now();
        const cmd: any = {
            find: collectionName,
            batchSize,
            filter,
        };

        if (projection !== undefined) cmd.projection = projection;
        if (sort !== undefined) cmd.sort = sort;
        if (skip !== undefined) cmd.skip = skip;
        if (limit !== undefined) cmd.limit = limit;

        const res = await this.command(dbName, cmd, {
            raw: true,
            batchSize
        });
        // console.log('find took', performance.now() - start, 'ms');

        return this.fetchCursor(dbName, collectionName, batchSize, classType, res);
    }

    protected async fetchCursor(dbName, collectionName, batchSize: number, classType: ClassType<any>, res: Buffer): Promise<any[]> {
        const schema = t.schema({
            errmsg: t.string.optional,
            ok: t.boolean,
            cursor: {
                id: t.string,
                firstBatch: t.array(classType),
                nextBatch: t.array(classType),
            },
        });

        // const start = performance.now();
        const parser = getBSONDecoder(schema);
        const parsed = parser(res);
        // console.log('parseObject took', performance.now() - start, 'ms');

        if (!parsed.ok) throw new Error(parsed.errmsg);
        if (!parsed.cursor) return [];

        if (parsed.cursor.firstBatch.length < batchSize) {
            return parsed.cursor.firstBatch;
        }

        while (true) {
            const more = await this.command(dbName, {
                getMore: parsed.cursor,
                collection: collectionName,
                batchSize
            }, {raw: true, batchSize});
            const parsedMore = parser(more);
            if (!parsedMore.ok) {
                throw new Error(parsed.errmsg);
            }
            parsed.cursor.firstBatch.push(...parsedMore.cursor.nextBatch);
            if (parsedMore.cursor.nextBatch.length < batchSize) {
                return parsed.cursor.firstBatch;
            }
        }
    }

    public async aggregate(classType: ClassType<any>, pipeline: any[]): Promise<any[]> {
        await this.connect();
        const dbName = getDatabaseName(classType) || this.config.defaultDatabase;
        const collectionName = resolveCollectionName(classType);
        const batchSize = 10001;

        // const start = performance.now();
        const res = await this.command(dbName, {
            aggregate: collectionName,
            pipeline: pipeline,
            cursor: {
                batchSize
            }
        }, {
            raw: true,
        });
        // console.log('aggregate took', performance.now() - start, 'ms');

        return this.fetchCursor(dbName, collectionName, batchSize, classType, res);
    }

    public async insertMany(classType: ClassType<any>, items: any[]) {
        await this.connect();
        const dbName = getDatabaseName(classType) || this.config.defaultDatabase;
        const collectionName = resolveCollectionName(classType);

        await this.command(dbName, {
            insert: collectionName,
            documents: items,
            // writeConcern: {w: 1}
        }, {});
    }

    public async updateMany(classType: ClassType<any>, items: { q: any, u: any }[]) {
        await this.connect();
        const dbName = getDatabaseName(classType) || this.config.defaultDatabase;
        const collectionName = resolveCollectionName(classType);

        await this.command(dbName, {
            update: collectionName,
            updates: items,
            // writeConcern: {w: 1}
        }, {});
    }

    public async getCollection(classType: ClassType<any>): Promise<Collection> {
        return (await this.connect())
            .db(getDatabaseName(classType) || this.config.defaultDatabase)
            .collection(resolveCollectionName(classType));
    }
}
