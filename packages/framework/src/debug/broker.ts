import { inject, injectable } from '@deepkit/injector';
import { BaseBroker } from '../broker/broker';
import { eventDispatcher } from '@deepkit/event';
import { onServerMainBootstrap, onServerMainShutdown } from '../application-server';
import { NetTcpRpcClientAdapter, NetTcpRpcServer } from '@deepkit/rpc-tcp';
import { BrokerKernel } from '@deepkit/broker';
import { kernelConfig } from '../kernel.config';
import { join } from 'path';

@injectable()
export class DebugBroker extends BaseBroker {
    constructor(
        @inject(kernelConfig.token('varPath')) varPath: string
    ) {
        super(new NetTcpRpcClientAdapter(join(varPath, 'debug-broker.socket')));
    }
}

@injectable()
export class DebugBrokerListener {
    protected kernel: BrokerKernel = new BrokerKernel;
    protected server = new NetTcpRpcServer(this.kernel, join(this.varPath, 'debug-broker.socket'));

    constructor(
        @inject(kernelConfig.token('varPath')) protected varPath: string,
        protected broker: DebugBroker,
    ) {
    }

    @eventDispatcher.listen(onServerMainBootstrap)
    async onMainBootstrap() {
        console.log('debug broker start');
        await this.server.start();
    }

    @eventDispatcher.listen(onServerMainShutdown)
    async onMainShutdown() {
        await this.server.close();
        await this.broker.disconnect();
    }
}
