import { BaseBroker } from '../broker/broker.js';
import { eventDispatcher } from '@deepkit/event';
import { onServerMainBootstrap, onServerMainShutdown } from '../application-server.js';
import { RpcTcpClientAdapter, RpcTcpServer } from '@deepkit/rpc-tcp';
import { BrokerKernel } from '@deepkit/broker';
import { FrameworkConfig } from '../module.config.js';

export class DebugBroker extends BaseBroker {
    constructor(brokerHost: FrameworkConfig['debugBrokerHost']) {
        super(new RpcTcpClientAdapter(brokerHost));
    }
}

export class DebugBrokerListener {
    protected kernel: BrokerKernel = new BrokerKernel;
    protected server = new RpcTcpServer(this.kernel, this.brokerHost);

    constructor(protected brokerHost: FrameworkConfig['debugBrokerHost'], protected broker: DebugBroker) {
    }

    @eventDispatcher.listen(onServerMainBootstrap)
    async onMainBootstrap() {
        await this.server.start();
    }

    @eventDispatcher.listen(onServerMainShutdown)
    async onMainShutdown() {
        await this.server.close();
        await this.broker.disconnect();
    }
}
