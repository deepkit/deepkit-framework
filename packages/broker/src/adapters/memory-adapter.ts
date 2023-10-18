import { BrokerDeepkitAdapter } from './deepkit-adapter.js';
import { BrokerKernel } from '../kernel.js';
import { RpcDirectClientAdapter } from '@deepkit/rpc';


export class BrokerMemoryAdapter extends BrokerDeepkitAdapter {
    constructor() {
        const kernel = new BrokerKernel();
        const client = new RpcDirectClientAdapter(kernel);
        super(client);
    }
}

