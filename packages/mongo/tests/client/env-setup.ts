import { afterEach } from '@jest/globals';
import { uuid } from '@deepkit/type';
import { ChildProcess, spawn, spawnSync } from 'child_process';
import { existsSync, mkdirSync, rmdirSync } from 'fs';
import { sleep } from '@deepkit/core';
import { createConnection } from 'net';

interface MongoInstance {
    port: number;
    closeRequested: boolean;
    process: ChildProcess;
}

const portRangeStart = Number(process.env.MONGO_PORT_RANGE_START || 27000);
const mongoImage = process.env.MONGO_IMAGE || 'mongo:5';

const createdEnvs: MongoEnv[] = [];

afterEach(() => {
    for (const env of createdEnvs) {
        env.close();
    }
    createdEnvs.splice(0, createdEnvs.length);
});

async function isPortFree(port: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const connection = createConnection(port);
        connection.on('error', () => {
            connection.end();
            resolve(true);
        });
        connection.on('connect', () => {
            connection.end();
            resolve(false);
        });
    });
}

export class MongoEnv {
    protected reservedPorts: number[] = [];
    protected instances = new Map<string, MongoInstance>();
    protected tempFolder = `/tmp/mongo-env/` + uuid();

    constructor() {
        mkdirSync(this.tempFolder, { recursive: true });
        createdEnvs.push(this);
    }

    close() {
        for (const p of this.instances.values()) {
            if (!p.process.killed) p.process.kill();
        }

        if (existsSync(this.tempFolder)) {
            rmdirSync(this.tempFolder, { recursive: true });
        }
    }

    protected getInstance(name: string): MongoInstance {
        const instance = this.instances.get(name);
        if (!instance) throw new Error(`No mongo instance with name ${name} found`);
        return instance;
    }

    public async addReplicaSet(host: string, member: string, priority: number, votes: number): Promise<any> {
        const instance = this.getInstance(member);
        const line = {host: 'host.docker.internal:' + instance.port, priority: priority, votes: votes};
        await this.execute(host, `rs.add(${JSON.stringify(line)})`);
    }

    public async waitUntilBeingPrimary(name: string): Promise<any> {
        await this.wait(name, 'db.isMaster()', (res: any) => res.ismaster, 'never became primary');
    }

    public async waitUntilBeingSecondary(name: string): Promise<any> {
        await this.wait(name, 'db.isMaster()', (res: any) => res.secondary, 'never became secondary');
    }

    protected async wait(name: string, cmd: string, checker: (res: any) => boolean, errorMessage: string) {
        for (let i = 0; i < 300; i++) {
            const res = await this.executeJson(name, cmd);
            if (checker(res)) return;
            await sleep(0.3);
        }
        console.log(await this.execute('primary', 'rs.status()'));
        console.log(await this.execute(name, 'rs.status()'));
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

    protected isPortReserved(port: number): boolean {
        return this.reservedPorts.includes(port);
    }

    protected releasePort(port: number) {
        const index = this.reservedPorts.indexOf(port);
        if (index !== -1) {
            this.reservedPorts.splice(index, 1);
        }
    }

    protected getFreePort(): number {
        for (let i = portRangeStart; i < portRangeStart + 1000; i++) {
            if (!this.isPortReserved(i)) {
                this.reservedPorts.push(i);
                return i;
            }
        }
        throw new Error('Could not find free port');
    }

    public async execute(name: string, cmd: string) {
        const instance = this.getInstance(name);

        const args: string[] = [
            'run',
            '--rm',
            '-i',
            mongoImage,
            'mongo',
            '--quiet',
            '--host', 'host.docker.internal',
            '--port', `${instance.port}`,
        ];

        console.log(name, 'execute: docker ' + args.join(' '), cmd);
        const res = spawnSync('docker', args, {
            input: cmd,
            encoding: 'utf8',
        });
        if (res.status !== 0) {
            console.error('command stderr:', res.stderr);
            throw new Error(`Could not execute on ${name} command "${cmd}": ${res.stderr} ${res.stdout}`);
        }
        return res.stdout;
    }

    public async addMongo(name: string, replSet?: string): Promise<MongoInstance> {
        const port = this.getFreePort();

        // todo, rework to allow specifying a network, which will
        //  be created automatically + hostname. this fixes replicaSet
        const args: string[] = [
            'run',
            '--rm',
            '-p', `${port}:27017`,
            '--add-host=host.docker.internal:host-gateway',
            mongoImage,
            '--bind_ip_all'
        ];

        if (replSet) args.push('--replSet', replSet);

        console.log(name, 'execute: docker ' + args.join(' '));
        const p = spawn('docker', args, {
            // stdio: 'ignore',
            stdio: 'pipe',
        });

        p.on('exit', () => {
            this.releasePort(port);
            this.instances.delete(name);
        });

        const listening = new Promise<void>((resolve) => {
            p.stdout.on('data', (data) => {
                if (data.toString().includes('Listening on')) {
                    resolve();
                }
            });
        });

        await listening;

        const instance = {
            closeRequested: false,
            process: p,
            port: port,
        };

        this.instances.set(name, instance);

        //wait for up
        for (let i = 0; i < 100; i++) {
            const connected = await new Promise<boolean>((resolve) => {
                const connection = createConnection(instance.port);
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
                return instance;
            }

            await sleep(0.3);
        }
        p.kill();
        this.instances.delete(name);
        throw new Error(`Could not boot ${name} at ${instance.port}`);
    }

}
