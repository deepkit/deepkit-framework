import {MongoConnection} from './connection';
import {parse as parseUrl} from 'url';
import {parse as parseQueryString} from 'querystring';
import {ClassSchema, getClassSchema, plainSerializer} from '@deepkit/marshal';
import {resolveSrvHosts} from './dns';
import {Host} from './host';
import {isErrorRetryableRead, isErrorRetryableWrite, MongoError} from './error';
import {ConnectionOptions} from './options';
import {arrayRemoveItem, ClassType, eachPair, singleStack, sleep} from '@deepkit/core';
import {Command} from './command/command';

/**
 * Default URL:
 * mongodb://mongodb0.example.com:27017
 *
 * ReplicaSet UR:
 * mongodb://mongodb0.example.com:27017,mongodb1.example.com:27017,mongodb2.example.com:27017/?replicaSet=myRepl
 *
 * Shared URL:
 * mongodb://mongos0.example.com:27017,mongos1.example.com:27017,mongos2.example.com:27017
 *
 * SVR URL:
 * mongodb+srv://server.example.com/
 */
export class MongoClientConfig {
    public readonly hosts: Host[] = [];
    protected hostsFetchedMS?: number;

    /**
     * In seconds.
     */
    srvCacheTimeout: number = 3600;

    defaultDb?: string;
    authUser?: string;
    authPassword?: string;

    options: ConnectionOptions = new ConnectionOptions;

    isSrv: boolean = false;
    srvDomain: string = '';

    constructor(
        connectionString: string
    ) {
        this.parseConnectionString(connectionString);
    }

    protected parseConnectionString(url: string) {
        //we replace only first `,` with `/,` so we get additional host names in parsed.path
        url = url.replace(',', '/,');

        const parsed = parseUrl(url);
        //e.g. for `mongodb://peter:asd@localhost,127.0.0.1,yetanother/asd`
        //parsed.pathname contains now /,127.0.0.1,yetanother/asd
        //and parsed.hostname localhost. Thus we merge those, when we detect `/,` in path
        const hostnames: string[] = [];
        let defaultDb = parsed.pathname ? parsed.pathname.substr(1) : '';

        if (!parsed.hostname) throw new Error('No hostname found in connection string');
        hostnames.push(`${parsed.hostname}:${parsed.port || 27017}`);

        if (parsed.pathname && parsed.pathname.startsWith('/,')) {
            //we got multiple host names
            const lastSlash = parsed.pathname.lastIndexOf('/');
            if (lastSlash === 0) {
                //no database name provided, so whole path contains host names
                //offset `2` because `/,`
                hostnames.push(...parsed.pathname.substr(2).split(','));
                defaultDb = '';
            } else {
                hostnames.push(...parsed.pathname.substr(2, lastSlash).split(','));
                defaultDb = parsed.pathname.substr(lastSlash + 1);
            }
        }

        this.hosts.splice(0, this.hosts.length);
        for (const hostname of hostnames) {
            const [host, port] = hostname.split(':');
            this.hosts.push(new Host(host, port ? parseInt(port, 10) : 27017));
        }

        this.defaultDb = defaultDb;
        if (parsed.auth) {
            const firstColon = parsed.auth.indexOf(':');
            if (firstColon === -1) {
                this.authUser = parsed.auth;
            } else {
                this.authUser = parsed.auth.substr(0, firstColon);
                this.authPassword = parsed.auth.substr(firstColon + 1);
            }
        }

        this.options = plainSerializer.for(ConnectionOptions).validatedDeserialize(parsed.query ? parseQueryString(parsed.query) : {});

        if (url.startsWith('mongodb+srv://')) {
            this.isSrv = true;
            this.srvDomain = this.hosts[0].hostname;
        }
    }

    //see https://docs.mongodb.com/manual/reference/connection-string/#urioption.authSource
    getAuthSource(): string {
        return this.options.authSource || this.defaultDb || 'admin';
    }

    protected async resolveSrvHosts() {
        return await resolveSrvHosts(this.srvDomain);
    }

    newHost(hostname: string, port: number) {
        const host = new Host(hostname, port);
        this.hosts.push(host);
    }

    protected findHostBy(hostname: string, port: number): Host {
        for (const host of this.hosts) {
            if (host.hostname === hostname && host.port === port) return host;
        }
        throw new MongoError(`Could not find host ${hostname}:${port}`);
    }

    deleteHost(hostname: string, port: number) {
        const host = this.findHostBy(hostname, port);
        arrayRemoveItem(this.hosts, host);
        for (const connection of host.connections) {
            connection.close();
        }
    }

    resolveCollectionName(schema: ClassSchema | ClassType): string {
        schema = getClassSchema(schema);
        return schema.collectionName || schema.name || 'unknown';
    }

    @singleStack()
    async getHosts(): Promise<Host[]> {
        if (this.isSrv) {
            if (this.srvDomain === 'example.com') return [];
            if (this.hostsFetchedMS) {
                const diff = (Date.now() - this.hostsFetchedMS) / 1000;
                if (diff < this.srvCacheTimeout) return this.hosts;
            }

            const hostsData = await this.resolveSrvHosts();
            const options = {...hostsData.options ? parseQueryString(hostsData.options) : {}};
            const partialOptions = plainSerializer.for(ConnectionOptions).validatedDeserialize(options) as {};
            for (const [k, v] of eachPair(partialOptions)) {
                this.options[k] = v;
            }
            const hosts = hostsData.hosts;

            const removedHosts = new Map<string, Host>();
            for (const host of this.hosts) {
                removedHosts.set(host.id, host);
            }

            for (const host of hosts) {
                const id = `${host.hostname}:${host.port}`;
                if (removedHosts.has(id)) {
                    removedHosts.delete(id);
                } else {
                    //we got a new one
                    this.newHost(host.hostname, host.port);
                }
            }

            //removedHosts contains now all no longer valid hosts
            for (const removedHost of removedHosts.values()) {
                this.deleteHost(removedHost.hostname, removedHost.port);
            }

            this.hostsFetchedMS = Date.now();

            //default to SSL true if it's not specified
            if (this.options.ssl === undefined) {
                this.options.ssl = true;
            }
        }

        return this.hosts;
    }
}

interface ConnectionRequest {
    writable?: boolean;
    nearest?: boolean;
}

export class MongoClient {
    /**
     * Connections, might be in any state, not necessarily connected.
     */
    protected connections: MongoConnection[] = [];

    protected inCloseProcedure: boolean = false;

    public readonly config: MongoClientConfig;

    constructor(
        connectionString: string
    ) {
        this.config = new MongoClientConfig(connectionString);
    }

    protected async waitForAllConnectionsToConnect(throws: boolean = false): Promise<void> {
        const promises: Promise<any>[] = [];
        for (const connection of this.connections) {
            if (connection.connectingPromise) {
                promises.push(connection.connectingPromise);
            }
        }

        if (promises.length) {
            if (throws) {
                await Promise.all(promises);
            } else {
                await Promise.allSettled(promises);
            }
        }
    }

    public resolveCollectionName(schema: ClassSchema | ClassType): string {
        return this.config.resolveCollectionName(schema);
    }

    // protected async getConnectedForType(request: ConnectionRequest): Promise<MongoConnection | void> {
    //     const hosts = await this.config.getHosts();
    //     const host = this.findHostForRequest(hosts, request);
    //
    //     for (const connection of host.connections) {
    //         if (connection.isConnected()) return connection;
    //     }
    // }

    protected async ensureHostsConnected(throws: boolean = false) {
        //make sure each host has at least one connection
        //getHosts automatically updates hosts (mongodb-srv) and returns new one,
        //so we don't need any interval to automatically update it.
        const hosts = await this.config.getHosts();
        for (const host of hosts) {
            if (host.connections.length) continue;
            this.newConnection(host);
        }

        await this.waitForAllConnectionsToConnect(throws);
    }

    protected newConnection(host: Host) {
        const connection = new MongoConnection(host, this.config, (connection) => {
            arrayRemoveItem(host.connections, connection);
            arrayRemoveItem(this.connections, connection);
            //onClose does not automatically reconnect. Only new commands re-establish connections.
        });
        host.connections.push(connection);
        this.connections.push(connection);
    }

    protected async createAdditionalConnectionForRequest(request: ConnectionRequest): Promise<void> {
        if (this.connections.length >= this.config.options.maxPoolSize) return;

        const hosts = await this.config.getHosts();
        const host = this.findHostForRequest(hosts, request);
        if (!host) throw new MongoError(`Could not find host for connection request. (writable=${request.writable}, hosts=${hosts.length})`);

        this.newConnection(host);
    }

    protected findHostForRequest(hosts: Host[], request: ConnectionRequest): Host {
        //todo, handle request.nearest
        for (const host of hosts) {
            if (request.writable && host.isWritable()) return host;
            if (!request.writable && host.isReadable()) return host;
        }

        throw new MongoError(`Could not find host for connection request. (writable=${request.writable}, hosts=${hosts.length})`);
    }

    public async connect() {
        await this.ensureHostsConnected(true);
    }

    public close() {
        this.inCloseProcedure = true;

        //import to work on the copy, since Connection.onClose modifies this.connections.
        const connections = this.connections.slice(0);
        for (const connection of connections) {
            connection.close();
        }
    }

    public async execute<T extends Command>(command: T): Promise<ReturnType<T['execute']>> {
        const maxRetries = 10;
        const request = {writable: command.needsWritableHost()};
        await this.ensureHostsConnected(true);

        for (let i = 1; i <= maxRetries; i++) {
            const connection = this.getConnectionFast(request);

            try {
                return await connection.execute(command);
            } catch (error) {
                if (command.needsWritableHost()) {
                    if (!isErrorRetryableWrite(error)) throw error;
                } else {
                    if (!isErrorRetryableRead(error)) throw error;
                }

                if (i == maxRetries) {
                    throw error;
                }
                await sleep(0.25);
            }
        }

        throw new MongoError(`Could not execute command since no connection found: ${command}`);
    }

    /**
     * A sync method to get a connection the fast way. This is for most common use-cases ideal.
     */
    getConnectionFast(request: ConnectionRequest): MongoConnection {
        //todo: implement load-balancing
        // extract to a ConnectionPool class, which we can better unit-test
        for (const connection of this.connections) {
            if (!connection.isConnected()) continue;
            if (connection.activeCommands) continue;

            if (request.nearest) throw new Error('Nearest not implemented yet');

            if (request.writable && !connection.host.isWritable()) continue;

            if (!request.writable) {
                if (connection.host.isSecondary() && !this.config.options.secondaryReadAllowed) continue;
                if (!connection.host.isReadable()) continue;
            }

            return connection;
        }

        throw new Error('No connection found. WIP');
    }
}