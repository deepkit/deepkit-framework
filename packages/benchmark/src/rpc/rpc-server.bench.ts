import 'reflect-metadata';
import { ClassType } from "@deepkit/core";
import { createRpcMessage, DirectClient, readRpcMessage, rpc, rpcAction, RpcKernel } from "@deepkit/rpc";
import { BenchSuite } from "../bench";

class SimpleInjector {
    get(classType: ClassType) {
        return new classType;
    }
}

export async function main() {
    const bench1 = new BenchSuite('protocol');
    const bson = createRpcMessage(0, 4, rpcAction, { controller: 'asd', method: 'asd' });
    readRpcMessage(bson).parseBody(rpcAction);

    bench1.add('encode', () => {
        const message = createRpcMessage(0, 4, rpcAction, { controller: 'asd', method: 'asd' });
    });

    bench1.add('decode', () => {
        const message = readRpcMessage(bson);
        const body = message.parseBody(rpcAction);
    });

    bench1.run();

    let called = 0;

    class Controller {
        @rpc.action()
        action(value: string): string {
            called++;
            return value;
        }
    }

    const kernel = new RpcKernel(new SimpleInjector());
    kernel.registerController('myController', Controller);

    // const connection = kernel.createConnection({ write: (v) => console.log(readRpcMessage(v)) });
    // connection.handleMessage(createRpcMessage(0, RpcTypes.ActionType, rpcActionType, { controller: 'myController', method: 'action' }));

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    const bench = new BenchSuite('controller');
    const res = await controller.action('foo');

    bench.addAsync('action', async () => {
        const res = await controller.action('foo');
    });

    await bench.runAsync();

    console.log('called', called);
}