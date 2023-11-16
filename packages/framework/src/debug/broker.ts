import { RpcTcpClientAdapter } from '@deepkit/rpc-tcp';
import { Broker, BrokerDeepkitAdapter } from '@deepkit/broker';
import { FrameworkConfig } from '../module.config.js';

function getHost(config: FrameworkConfig) {
    return config.debugBrokerHost || config.broker.host;
}

export class DebugBroker extends Broker {
    constructor(config: FrameworkConfig) {
        super(new BrokerDeepkitAdapter({ servers: [{ url: '', transport: new RpcTcpClientAdapter(getHost(config)) }] }));
    }
}
