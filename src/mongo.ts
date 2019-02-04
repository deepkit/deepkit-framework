import {MongoClient, Db, Collection} from 'mongodb';
import {Database} from '@marcj/marshal-mongo';
import {arrayHasItem, sleep, isString} from "@kamille/core";

export class MongoPool {
    protected connection?: Mongo;
    protected db?: Database;

    public get(): Mongo {
        if (!this.connection) {
            this.connection = new Mongo('deepkit');
        }

        return this.connection;
    }

    public database(): Database {
        if (!this.db) {
            const mongo = this.get();
            this.db = new Database(() => mongo.connect(), mongo.dbName);
        }

        return this.db;
    }
}

export class SingleMongoPool extends MongoPool {
    constructor(private mongo: Mongo) {
        super();
    }

    get(): Mongo {
        return this.mongo;
    }

    database(): Database {
        return new Database(() => this.get().connect(), this.mongo.dbName);
    }
}

export class MongoLock {
    private holding = false;
    private safeGuardOnExitUnsubscribe?: Function;
    private timeoutTimer?: any;

    constructor(
        private id: string,
        private locks: Collection
    ) {
    }

    /**
     * @param timeout in seconds
     */
    public async acquire(timeout: number = 30) {
        while (!await this.tryLock(timeout)) {
            await sleep(0.01);
        }

        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }

        this.timeoutTimer = setTimeout(async () => {
            await this.release();
        }, timeout * 1000);

        // //make 99% sure we delete the lock even when process dies.
        // this.safeGuardOnExitUnsubscribe = onProcessExit(async () => {
        //     await this.release();
        // });
    }

    public async prolong(seconds: number) {
        if (!this.holding) {
            throw new Error('Lock already expired, could not prolong.');
        }

        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }

        this.timeoutTimer = setTimeout(async () => {
            await this.release();
        }, seconds * 1000);

        await this.locks.updateOne({
            name: this.id
        }, {
            expire: Date.now() / 1000 + seconds
        });
    }

    public isLocked() {
        return this.holding;
    }

    private async tryLock(timeout: number) {
        const now = Date.now() / 1000;

        try {
            await this.locks.deleteMany({
                expire: {$lt: now}
            });

            await this.locks.insertOne({
                name: this.id,
                expire: now + timeout,
                inserted: now
            });
            this.holding = true;
        } catch (error) {
            if (error.code === 11000) {
                //unique clash, means lock already acquired.
            }

            this.holding = false;
            return false;
        }

        return true;
    }

    public async release() {
        this.holding = false;

        if (this.safeGuardOnExitUnsubscribe) {
            this.safeGuardOnExitUnsubscribe();
        }

        await this.locks.deleteMany({
            name: this.id
        });
    }
}

export class Mongo {
    protected connection?: MongoClient;
    protected host = 'localhost:7802';

    protected indexes:
        { [collectionName: string]: (string | { name: string, unique: boolean })[] }

        = {
        files: [{name: 'id', unique: true}, 'path', 'job', 'project'],
        jobs: [{name: 'id', unique: true}, 'project', 'server', 'status'],
        projects: [{name: 'id', unique: true}, 'name'],
        accounts: [{name: 'id', unique: true}],
        accountMembers: ['user'],
        tokens: [{name: 'token', unique: true}, 'role'],
        nodes: [{name: 'id', unique: true}, 'token'],
        jobQueue: ['job', 'priority', 'added'],
        locks: [{name: 'name', unique: true}],
        cluster: [{name: 'id', unique: true}],
        users: [{name: 'id', unique: true}, {name: 'username', unique: true}],
    };

    constructor(public dbName: string, host?: string) {
        if (host) {
            this.host = host;
        }
    }

    public async collection(collectionName: string): Promise<Collection> {
        return (await this.database()).collection(collectionName);
    }

    public async database(): Promise<Db> {
        return (await this.connect()).db(this.dbName);
    }

    public async acquireLock(id: string, timeout?: number): Promise<MongoLock> {
        const lock = new MongoLock(id, await this.collection('__locks'));
        await lock.acquire(timeout);

        return lock;
    }

    public async disconnect() {
        if (this.connection) {
            await this.connection.close();
        }
    }

    public async connect(): Promise<MongoClient> {
        if (!this.connection) {

            this.connection = await MongoClient.connect('mongodb://' + this.host + '/' + this.dbName, {
                reconnectTries: Number.MAX_VALUE,
                reconnectInterval: 1000
            });

            const existinCollections = await this.connection.db(this.dbName).listCollections().toArray();

            for (const collectionName in this.indexes) {
                if (!this.indexes.hasOwnProperty(collectionName)) continue;

                if (!arrayHasItem(existinCollections, collectionName)) {
                    try {
                        await this.connection.db(this.dbName).createCollection(collectionName);
                    } catch (error) {

                    }
                }
                const collection = await this.collection(collectionName);

                for (const index of this.indexes[collectionName]) {
                    if (isString(index)) {
                        if (await collection.indexExists(index + '_1')) {
                            await collection.dropIndex(index + '_1');
                        }

                        if (!await collection.indexExists(index)) {
                            try {
                                await collection.createIndex([index], {
                                    name: index
                                });
                            } catch (error) {
                                console.error(`Could not create index for ${collectionName}::${index}`, error);
                            }
                        }
                    } else {
                        if (await collection.indexExists(index.name + '_1')) {
                            await collection.dropIndex(index.name + '_1');
                        }

                        if (!await collection.indexExists(index.name)) {
                            try {
                                await collection.createIndex([index.name], {
                                    unique: index.unique,
                                    name: index.name
                                });
                            } catch (error) {
                                console.error(`Could not create complex index for ${collectionName}::${index.name}`, error);
                            }
                        }
                    }
                }
            }
        }

        return this.connection;
    }
}
