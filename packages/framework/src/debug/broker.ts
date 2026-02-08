import { BrokerBus, BrokerDeepkitAdapter } from '@deepkit/broker';

import { getBrokerServers } from '../broker.js';
import { FrameworkConfig } from '../module.config.js';

export class DebugBrokerBus extends BrokerBus {
    constructor(config: FrameworkConfig) {
        super(new BrokerDeepkitAdapter({ servers: getBrokerServers(config.broker) }));
    }
}
