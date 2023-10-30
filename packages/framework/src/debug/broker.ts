import { eventDispatcher } from '@deepkit/event';
import { onServerMainBootstrap, onServerMainShutdown } from '../application-server.js';
import { RpcTcpClientAdapter, RpcTcpServer } from '@deepkit/rpc-tcp';
import { Broker, BrokerKernel, BrokerDeepkitAdapter } from '@deepkit/broker';
import { FrameworkConfig } from '../module.config.js';

export class DebugBroker extends Broker {
    constructor(brokerHost: FrameworkConfig['debugBrokerHost']) {
        super(new BrokerDeepkitAdapter({ servers: [{ url: '', transport: new RpcTcpClientAdapter(brokerHost) }] }));
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
        await this.broker.disconnect();
        await this.server.close();
    }
}
