import { Server } from '@deepkit/broker';
import { RpcTcpClientAdapter } from '@deepkit/rpc-tcp';
import { BrokerConfig } from './module.config';

export function getBrokerServers(config: BrokerConfig): Server[] {
    const servers: Server[] = [];
    const hosts = Array.isArray(config.host) ? config.host : [config.host];
    for (const host of hosts) {
        servers.push({ url: '', transport: new RpcTcpClientAdapter(host) });
    }
    return servers;
}
