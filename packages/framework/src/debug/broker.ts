import { BrokerBus, BrokerDeepkitAdapter } from '@deepkit/broker';
import { RpcTcpClientAdapter } from '@deepkit/rpc-tcp';

import { FrameworkConfig } from '../module.config.js';

function getHost(config: FrameworkConfig) {
    return config.debugBrokerHost || config.broker.host;
}

export class DebugBrokerBus extends BrokerBus {
    constructor(config: FrameworkConfig) {
        super(
            new BrokerDeepkitAdapter({
                servers: [
                    {
                        url: '',
                        transport: new RpcTcpClientAdapter(getHost(config)),
                    },
                ],
            }),
        );
    }
}
