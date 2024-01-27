import { BrokerBus, BrokerDeepkitAdapter } from '@deepkit/broker';
import { FrameworkConfig } from '../module.config.js';
import { getBrokerServers } from '../broker';

export class DebugBrokerBus extends BrokerBus {
    constructor(config: FrameworkConfig) {
        super(new BrokerDeepkitAdapter({ servers: getBrokerServers(config.broker) }));
    }
}
