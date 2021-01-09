import { BrokerClient, BrokerKernel, BrokerChannel, BrokerDirectClientAdapter } from "@deepkit/broker";
import { asyncOperation, ClassType, ParsedHost, parseHost } from "@deepkit/core";
import { ClientTransportAdapter, IdInterface, TransportConnectionHooks } from "@deepkit/rpc";
import { ClassSchema, FieldDecoratorResult, getClassSchema, t } from "@deepkit/type";
import { existsSync, unlinkSync } from "fs";
import { connect, createServer, Server, Socket } from "net";
import { inject, injectable } from "../injector/injector";
import { brokerConfig } from "./broker.config";

class TcpWriter {
    constructor(public socket: Socket) {
    }

    write(buffer: Uint8Array) {
        this.socket.write(buffer);
    }
}

const defaultPort = 8811;

@injectable()
export class BrokerTcpServer {
    protected host: ParsedHost = parseHost(this.listen);
    protected server?: Server;
    protected kernel?: BrokerKernel;

    constructor(public listen: string) {
        if (this.host.isUnixSocket && existsSync(this.host.unixSocket)) {
            unlinkSync(this.host.unixSocket);
        }
    }

    start() {
        return asyncOperation((resolve, reject) => {
            this.server = createServer();
            this.kernel = new BrokerKernel();

            this.server.on('listening', () => {
                resolve(true);
            });

            this.server.on('error', (err) => {
                reject(new Error('Could not start broker server: ' + err));
            });

            this.server.on('connection', (socket) => {
                const connection = this.kernel?.createConnection(new TcpWriter(socket))

                socket.on('data', (data) => {
                    connection!.feed(data);
                });

                socket.on('close', () => {
                    connection!.close();
                });
            });

            if (this.host.isUnixSocket) {
                this.server.listen(this.host.unixSocket);
            } else {
                this.server.listen(this.host.port || defaultPort, this.host.host);
            }
        });
    }

    close() {
        this.server?.close();
    }
}

export const enum EntityChannelMessageType {
    remove,
    patch,
    add,
}

interface EntityChannelMessageAdd<T> {
    type: EntityChannelMessageType.add,
    id: string | number,
    item: T,
}

const entityChannelMessageAdd = t.schema({
    type: t.literal(EntityChannelMessageType.add).discriminant,
    id: t.union(t.string, t.number),
}, { name: 'EntityChannelMessageAdd' });

interface EntityChannelMessageRemove<T> {
    type: EntityChannelMessageType.remove,
    ids: (string | number)[],
}

const entityChannelMessageRemove = t.schema({
    type: t.literal(EntityChannelMessageType.remove).discriminant,
    ids: t.array(t.union(t.string, t.number)),
}, { name: 'EntityChannelMessageRemove' });

export interface EntityPatches {
    $set?: { [path: string]: any };
    $unset?: { [path: string]: number };
    $inc?: { [path: string]: number };
}

const entityPatch: ClassSchema<EntityPatches> = t.schema({
    $set: t.map(t.any).optional,
    $unset: t.map(t.number).optional,
    $inc: t.map(t.number).optional,
});

interface EntityChannelMessagePatch<T> {
    type: EntityChannelMessageType.patch,
    id: string | number,
    version: number,
    item: Partial<T>,
    patch: EntityPatches,
}

const entityChannelMessagePatch = t.schema({
    type: t.literal(EntityChannelMessageType.patch).discriminant,
    id: t.union(t.string, t.number),
    version: t.number,
    patch: t.type(entityPatch)
}, { name: 'EntityChannelMessagePatch' });

type EntityChannelMessage<T extends IdInterface> = EntityChannelMessageAdd<T>
    | EntityChannelMessageRemove<T>
    | EntityChannelMessagePatch<T>;

export class EntityBrokerChannel<T extends IdInterface> extends BrokerChannel<EntityChannelMessage<T>> {
    publishAdd(item: T) {
        this.publish({ type: EntityChannelMessageType.add, id: item.id, item });
    }

    publishRemove(ids: (string | number)[]) {
        this.publish({ type: EntityChannelMessageType.remove, ids });
    }

    publishPatch(id: string | number, version: number, patch: EntityPatches, item: Partial<T>) {
        this.publish({ type: EntityChannelMessageType.patch, id, version, patch, item });
    }
}

export class BaseBroker extends BrokerClient {
    protected getEntityChannelMessageSchema<T>(schema: ClassSchema<T>): FieldDecoratorResult<any> {
        const jit = schema.jit;
        if (!jit.entityChannelMessage) {
            jit.entityChannelMessage = t.union(
                entityChannelMessageRemove,
                entityChannelMessagePatch.extend({ item: t.partial(schema) }),
                entityChannelMessageAdd.extend({ item: schema })
            );
        }
        return jit.entityChannelMessage;
    }

    public entityChannel<T extends IdInterface>(schemaOrType: ClassSchema<T> | ClassType<T>): EntityBrokerChannel<T> {
        const schema = getClassSchema(schemaOrType);
        let channel = this.activeChannels.get(schema.getName());
        if (channel) return channel as EntityBrokerChannel<T>;

        const decorator = this.getEntityChannelMessageSchema(schema);
        channel = new EntityBrokerChannel('dk/e/' + schema.getName(), decorator, this);
        this.activeChannels.set(channel.channel, channel);

        return channel as EntityBrokerChannel<T>;
    }
}

export class Broker extends BaseBroker {
    constructor(
        @inject(brokerConfig.token('host')) protected url: string) {
        super(new BrokerTcpClientAdapter(parseHost(url)));
    }
}

export class DirectBroker extends BaseBroker {
    constructor(rpcKernel: BrokerKernel) {
        super(new BrokerDirectClientAdapter(rpcKernel));
    }
}


export class BrokerTcpClientAdapter implements ClientTransportAdapter {
    constructor(
        public host: ParsedHost
    ) {
    }

    public async connect(connection: TransportConnectionHooks) {
        const port = this.host.port || defaultPort;
        const socket = this.host.isUnixSocket ? connect({ path: this.host.unixSocket }) : connect({
            port: port,
            host: this.host.host
        });

        socket.on('data', (data) => {
            connection.onMessage(data);
        });

        socket.on('close', () => {
            connection.onClose();
        });

        socket.on('error', (error: any) => {
            connection.onError(error);
        });

        socket.on('connect', async () => {
            connection.onConnected({
                disconnect() {
                    socket.end();
                },
                send(message) {
                    socket.write(message);
                }
            });
        });
    }
}
