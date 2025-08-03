import { RpcWebSocketClient } from '@deepkit/rpc';
import { inject } from '@angular/core';
import type { AdminController } from '@app/server/controller/admin.controller';
import type { MainController } from '@app/server/controller/main.controller';

export function injectAdminRpc() {
    const client = inject(RpcWebSocketClient);
    return client.controller<AdminController>('admin');
}

export function injectMainRpc() {
    const client = inject(RpcWebSocketClient);
    return client.controller<MainController>('main');
}
