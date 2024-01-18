import { RpcWebSocketClient } from "@deepkit/rpc";
import type { MainController } from "@app/server/controller/main.controller";
import { Injectable } from "@angular/core";
import { BenchmarkController } from "@app/server/controller/benchmark.controller";
import { BenchmarkControllerInterface } from "@app/common/benchmark";

@Injectable()
export class ControllerClient {
    main = this.client.controller<MainController>('/main');
    benchmark = this.client.controller(BenchmarkControllerInterface);

    constructor(private client: RpcWebSocketClient) {
    }
}
