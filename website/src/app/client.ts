import { Injectable } from '@angular/core';
import { BenchmarkControllerInterface } from '@app/common/benchmark';
import { BenchmarkController } from '@app/server/controller/benchmark.controller';
import type { MainController } from '@app/server/controller/main.controller';

import { RpcWebSocketClient } from '@deepkit/rpc';

@Injectable()
export class ControllerClient {
    main = this.client.controller<MainController>('/main');
    benchmark = this.client.controller(BenchmarkControllerInterface);

    constructor(private client: RpcWebSocketClient) {}
}
