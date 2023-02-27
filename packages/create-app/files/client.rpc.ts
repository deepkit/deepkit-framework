import { RpcWebSocketClient } from '@deepkit/rpc';

//`import type` is important, since we do not want to import server code in the runtime.
import type { HelloWorldControllerRpc } from './src/controller/hello-world.rpc';

async function main() {
    const client = new RpcWebSocketClient('http://localhost:8080');

    try {
        const controller = client.controller<HelloWorldControllerRpc>('/main');

        const result = await controller.hello('World');
        console.log('result:', result);
    } catch (error) {
        console.error('Error: Did you start the server with `npm run app server:start` ?');
        throw error;
    } finally {
        client.disconnect();
    }
}

main();
