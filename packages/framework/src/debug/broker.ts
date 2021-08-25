import { inject, injectable } from '@deepkit/injector';
import { BaseBroker } from '../broker/broker';
import { eventDispatcher } from '@deepkit/event';
import { onServerMainBootstrap, onServerMainShutdown } from '../application-server';
import { NetTcpRpcClientAdapter, NetTcpRpcServer } from '@deepkit/rpc-tcp';
import { BrokerKernel } from '@deepkit/broker';
import { frameworkConfig } from '../module.config';

@injectable()
export class DebugBroker extends BaseBroker {
    constructor(
        @inject(frameworkConfig.token('debugBrokerHost')) brokerHost: string
    ) {
        super(new NetTcpRpcClientAdapter(brokerHost));
    }
}

@injectable()
export class DebugBrokerListener {
    protected kernel: BrokerKernel = new BrokerKernel;
    protected server = new NetTcpRpcServer(this.kernel, this.brokerHost);

    constructor(
        @inject(frameworkConfig.token('debugBrokerHost')) protected brokerHost: string,
        protected broker: DebugBroker,
    ) {
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
