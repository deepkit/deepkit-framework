import {Collection, MongoClient, MongoClientOptions} from 'mongodb';
import {ClassSchema, t} from '@super-hornet/marshal';
import {ParsedHost} from '@super-hornet/core';
import {DatabaseConnection} from '@super-hornet/marshal-orm';
import {getBSONDecoder} from '@super-hornet/marshal-bson';
import {DEEP_SORT} from './query.model';


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

    protected countSchema = t.schema({
        errmsg: t.string.optional,
        ok: t.boolean,
        n: t.number,
    });

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

    resolveCollectionName(classSchema: ClassSchema): string {
        const name = classSchema.collectionName || classSchema.name;
        if (!name) throw new Error(`No @Entity defined in class ${classSchema.getClassName()}.`);
        return name;
    }

    resolveDatabaseName(classSchema: ClassSchema): string {
        return classSchema.databaseName || this.config.defaultDatabase;
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

    public async count(
        classSchema: ClassSchema,
        filter: any,
        skip?: number,
        limit?: number,
    ): Promise<number> {
        await this.connect();
        const dbName = this.resolveDatabaseName(classSchema);
        const collectionName = this.resolveCollectionName(classSchema);

        const cmd: any = {
            count: collectionName,
            query: filter,
        };

        if (skip !== undefined) cmd.skip = skip;
        if (limit !== undefined) cmd.limit = limit;

        const res = await this.command(dbName, cmd, {
            raw: true
        });

        const parser = getBSONDecoder(this.countSchema);
        const parsed = parser(res);

        if (parsed.errmsg) throw new Error(`Mongo count error: ${parsed.errmsg}`);

        return parsed.n;
    }

    public async find(
        classSchema: ClassSchema,
        filter: any, projection?: any,
        sort?: DEEP_SORT<any>,
        skip?: number,
        limit?: number
    ): Promise<any[]> {
        await this.connect();
        const dbName = this.resolveDatabaseName(classSchema);
        const collectionName = this.resolveCollectionName(classSchema);
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

        return this.fetchCursor(dbName, collectionName, batchSize, classSchema, res);
    }

    protected async fetchCursor(dbName, collectionName, batchSize: number, classSchema: ClassSchema, res: Buffer): Promise<any[]> {
        const schema = t.schema({
            errmsg: t.string.optional,
            ok: t.boolean,
            cursor: {
                id: t.string,
                firstBatch: t.array(classSchema),
                nextBatch: t.array(classSchema),
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
                if (parsed.errmsg) throw new Error(parsed.errmsg);
                return parsed.cursor.firstBatch;
            }

            parsed.cursor.firstBatch.push(...parsedMore.cursor.nextBatch);
            if (parsedMore.cursor.nextBatch.length < batchSize) {
                return parsed.cursor.firstBatch;
            }
        }
    }

    public async aggregate(classSchema: ClassSchema, pipeline: any[], resultSchema?: ClassSchema): Promise<any[]> {
        await this.connect();
        const dbName = this.resolveDatabaseName(classSchema);
        const collectionName = this.resolveCollectionName(classSchema);
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

        return this.fetchCursor(dbName, collectionName, batchSize, resultSchema || classSchema, res);
    }

    public async insertMany(classSchema: ClassSchema, items: any[]) {
        await this.connect();
        const dbName = this.resolveDatabaseName(classSchema);
        const collectionName = this.resolveCollectionName(classSchema);

        await this.command(dbName, {
            insert: collectionName,
            documents: items,
            // writeConcern: {w: 1}
        }, {});
    }

    public async updateMany(classSchema: ClassSchema, items: { q: any, u: any }[]) {
        await this.connect();
        const dbName = this.resolveDatabaseName(classSchema);
        const collectionName = this.resolveCollectionName(classSchema);

        await this.command(dbName, {
            update: collectionName,
            updates: items,
            ordered: false,
            // writeConcern: {w: 1}
        }, {});
    }

    public async getCollection(classSchema: ClassSchema): Promise<Collection> {
        const dbName = this.resolveDatabaseName(classSchema);
        const collectionName = this.resolveCollectionName(classSchema);

        return (await this.connect())
            .db(dbName)
            .collection(collectionName);
    }
}
