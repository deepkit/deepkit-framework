import {afterEach, expect, test} from '@jest/globals';
import {uuid} from '@deepkit/type';
import {ChildProcess, spawn, spawnSync} from 'child_process';
import {existsSync, mkdirSync, rmdirSync} from 'fs';
import {sleep} from '@deepkit/core';
import {createConnection} from 'net';

interface MongoInstance {
    unixPath: string;
    closeRequested: boolean;
    process: ChildProcess
}

const createdEnvs: MongoEnv[] = [];

afterEach(() => {
    for (const env of createdEnvs) {
        env.close();
    }
    createdEnvs.splice(0, createdEnvs.length);
});

export class MongoEnv {
    protected instances = new Map<string, MongoInstance>();
    protected tempFolder = `/tmp/mongo-env/` + uuid();

    constructor() {
        mkdirSync(this.tempFolder, {recursive: true});
        createdEnvs.push(this);
    }

    close() {
        for (const p of this.instances.values()) {
            if (!p.process.killed) p.process.kill();
        }

        if (existsSync(this.tempFolder)) {
            rmdirSync(this.tempFolder, {recursive: true});
        }
    }

    protected getInstance(name: string): MongoInstance {
        const instance = this.instances.get(name);
        if (!instance) throw new Error(`No mongo instance with name ${name} found`);
        return instance;
    }

    public async addReplicaSet(host: string, member: string, priority: number, votes: number): Promise<any> {
        const unixPath = this.getInstance(member).unixPath;
        const line = {host: unixPath, priority: priority, votes: votes};
        await this.execute(host, `rs.add(${JSON.stringify(line)})`);
    }

    public async waitUntilBeingPrimary(name: string): Promise<any> {
        await this.wait(name, 'db.isMaster()', (res: any) => res.ismaster, 'never became primary');
    }

    public async waitUntilBeingSecondary(name: string): Promise<any> {
        await this.wait(name, 'db.isMaster()', (res: any) => res.secondary, 'never became secondary');
    }

    protected async wait(name: string, cmd: string, checker: (res: any) => boolean, errorMessage: string) {
        for (let i = 0; i < 20; i++) {
            const res = await this.executeJson(name, cmd);
            if (checker(res)) return;
            await sleep(0.3);
        }
        throw new Error(`${name}: ${errorMessage}`);
    }

    public async executeJson(name: string, cmd: string): Promise<any> {
        const res = await this.execute(name, `JSON.stringify(${cmd})`);
        try {
            return JSON.parse(res);
        } catch (error) {
            console.log('Could not parse JSON: ' + res);
        }
    }

    public async execute(name: string, cmd: string) {
        const instance = this.getInstance(name);

        const args: string[] = [
            '--quiet',
            '--host', instance.unixPath
        ];

        console.log('execute', name, cmd);
        const res = spawnSync('mongo', args, {
            input: cmd,
            encoding: 'utf8'
        });
        if (res.status !== 0) {
            console.error('command stderr:', res.stderr);
            throw new Error(`Could not execute on ${name} command: ${cmd}`);
        }
        return res.stdout;
    }

    public async addMongo(name: string, replSet?: string) {
        const unixPath = `${this.tempFolder}/${name}.sock`;
        const dbPath = `${this.tempFolder}/${name}.db`;
        mkdirSync(dbPath);

        const args: string[] = [
            '--dbpath', dbPath,
            '--bind_ip', unixPath,
            '--port', '0',
        ];

        if (replSet) args.push('--replSet', replSet);

        console.log('execute: mongod ' + args.join(' '));
        const p = spawn('mongod', args, {
            stdio: 'ignore',
        });

        const instance = {
            unixPath: unixPath,
            closeRequested: false,
            process: p
        };

        this.instances.set(name, instance);

        //wait for up
        for (let i = 0; i < 10; i++) {
            const connected = await new Promise<boolean>((resolve) => {
                const connection = createConnection(unixPath);
                connection.on('error', () => {
                    connection.end();
                    resolve(false);
                });
                connection.on('connect', () => {
                    connection.end();
                    resolve(true);
                });
            });
            if (connected) {
                return;
            }

            await sleep(0.3);
        }
        p.kill();
        this.instances.delete(name);
        throw new Error(`Could not boot ${name} at ${unixPath} (db=${dbPath})`);
    }

}
