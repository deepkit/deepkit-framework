import { afterEach } from '@jest/globals';
import { uuid } from '@deepkit/type';
import { ChildProcess, spawn, spawnSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { asyncOperation, sleep } from '@deepkit/core';
import { createConnection, Server, Socket } from 'net';
import { connect, createServer } from 'node:net';
import { rmSync } from 'node:fs';

class MongoInstance {
    proxy: Server;

    constructor(
        public name: string,
        public port: number,
        public process: ChildProcess,
    ) {
        this.proxy = this.createProxy();
    }

    createProxy() {
        if (this.proxy?.listening) this.proxy.close();

        return createServer(async (clientSocket) => {
            await sleep(this.connectionDelay);
            if (this.connectionDrop) {
                clientSocket.destroy();
                return;
            }

            this.connections.push(clientSocket);
            const mongoSocket = connect(this.port, 'localhost');

            if (this.connectionDropAfterBytes) {
                let totalBytes = 0;
                clientSocket.on('data', (data) => {
                    totalBytes += data.length;
                    if (totalBytes >= this.connectionDropAfterBytes) {
                        clientSocket.destroy();
                    }
                });
            }
            clientSocket.pipe(mongoSocket);
            mongoSocket.pipe(clientSocket);

            clientSocket.on('close', () => {
                this.connections.splice(this.connections.indexOf(clientSocket), 1);
                mongoSocket.end();
            });

            mongoSocket.on('close', () => {
                clientSocket.end();
            });
        });
    }

    stopProxy() {
        this.proxy?.close();
    }

    proxyPort: number = 0;
    connections: Socket[] = [];

    connectionDelay: number = 0;
    connectionDrop = false;

    connectionDropAfterBytes: number = 0;

    closeConnections() {
        for (const connection of this.connections) {
            connection.end();
        }
    }

    public getUrl(): string {
        return `mongodb://127.0.0.1:${this.proxyPort}`;
    }
}

const portRangeStart = Number(process.env.MONGO_PORT_RANGE_START || 27000);
const mongoImage = process.env.MONGO_IMAGE || 'mongo:5';

const createdEnvs: MongoEnv[] = [];

afterEach(() => {
    for (const env of createdEnvs) {
        env.closeAll();
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

    constructor(
        protected name: string = 'default',
        protected startPort: number = portRangeStart,
    ) {
        mkdirSync(this.tempFolder, { recursive: true });
        createdEnvs.push(this);
    }

    closeAll() {
        for (const p of this.instances.values()) {
            if (!p.process.killed) p.process.kill();
        }

        if (existsSync(this.tempFolder)) {
            rmSync(this.tempFolder, { recursive: true });
        }
    }

    protected getInstance(name: string): MongoInstance {
        const instance = this.instances.get(name);
        if (!instance) throw new Error(`No mongo instance with name ${name} found`);
        return instance;
    }

    public async addReplicaSet(host: string, member: string, priority: number, votes: number): Promise<any> {
        const instance = this.getInstance(member);
        const line = { host: 'host.docker.internal:' + instance.port, priority: priority, votes: votes };
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
        for (let i = this.startPort; i < this.startPort + 1000; i++) {
            if (!this.isPortReserved(i)) {
                this.reservedPorts.push(i);
                return i;
            }
        }
        throw new Error('Could not find free port');
    }

    stop(name: string) {
        const args: string[] = [
            'stop',
            `mongo-env-${name}`,
        ];

        console.log(name, 'execute: docker ' + args.join(' '));
        spawnSync('docker', args, {
            stdio: 'inherit',
        });
    }

    protected async ensureNetwork() {
        const args: string[] = [
            'network',
            'create',
            '--attachable',
            'mongo-env',
        ];

        spawnSync('docker', args, {
            encoding: 'utf8',
        });
    }

    public async execute(name: string, cmd: string) {
        const instance = this.getInstance(name);

        const args: string[] = [
            'run',
            '--rm',
            '--network', 'mongo-env',
            '-i',
            mongoImage,
            'mongo',
            '--host', instance.name,
        ];

        console.log(name, 'execute: docker ' + args.join(' '), cmd);
        const res = spawnSync('docker', args, {
            input: cmd,
            encoding: 'utf8',
        });
        console.log('executed', res);
        if (res.status !== 0) {
            console.error('command stderr:', res.stderr);
            throw new Error(`Could not execute on ${name} command "${cmd}": ${res.stderr} ${res.stdout}`);
        }
        return res.stdout;
    }

    public async addMongo(name: string = '', replSet?: string): Promise<MongoInstance> {
        const port = this.getFreePort();
        if (!name) name = 'mongo' + port;

        await this.ensureNetwork();

        // todo, rework to allow specifying a network, which will
        //  be created automatically + hostname. this fixes replicaSet
        const args: string[] = [
            'run',
            '--rm',
            '--hostname', name,
            '--name', `mongo-env-${name}`,
            '--network', 'mongo-env',
            '-p', `${port}:27017`,
            '--add-host=host.docker.internal:host-gateway',
            mongoImage,
            '--bind_ip_all',
        ];

        if (replSet) args.push('--replSet', replSet);

        console.log(name, 'execute: docker ' + args.join(' '));
        const p = spawn('docker', args, {
            // stdio: 'ignore',
            stdio: 'pipe',
        });
        p.stderr.pipe(process.stderr);

        const instance = new MongoInstance(
            name,
            port,
            p,
        );

        const listening = asyncOperation<void>((resolve, reject) => {
            p.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Mongo exited with code ${code}`));
                }
                instance.proxy.close();
                this.releasePort(port);
                this.instances.delete(name);
            });

            p.stdout.on('data', (data) => {
                if (data.toString().includes('Listening on')) {
                    resolve();
                }
            });
        });

        await listening;

        await asyncOperation<void>((resolve) => {
            instance.proxy.listen(undefined, () => {
                instance.proxyPort = (instance.proxy.address() as { port: number }).port;
                resolve();
            });
        });

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

            await sleep(0.1);
        }
        p.kill();
        this.instances.delete(name);
        throw new Error(`Could not boot ${name} at ${instance.port}`);
    }

}
