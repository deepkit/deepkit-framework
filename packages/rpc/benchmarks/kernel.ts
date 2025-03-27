import { add, run } from '@deepkit/bench';
import { rpc } from '../src/decorators.js';
import { RpcKernel } from '../src/server/kernel.js';
import { MessageFlag, writeAction } from '../src/protocol.js';

let calls = 0;

class Controller {
    @rpc.action()
    myAction() {
        calls++;
    }
}

const kernel = new RpcKernel;
kernel.registerController(Controller, 'main');

const message = new Uint8Array(32);
message[0] = MessageFlag.TypeAction;
writeAction(message, 0);

add('kernel createConnection', () => {
    const connection = kernel.createConnection({
        bufferedAmount(): number {
            return 0;
        },
        clientAddress(): string {
            return '';
        },
        close() {
        },
        write(data: Uint8Array) {

        },
    });

    connection.close();
});

const connection = kernel.createConnection({
    bufferedAmount(): number {
        return 0;
    },
    clientAddress(): string {
        return '';
    },
    close() {
    },
    write(data: Uint8Array) {

    },
});

connection.feed(message);
connection.feed(message);
console.log('calls', calls);

add('connection.feed', () => {
    connection.feed(message);
});

let i = 0;
add('test', () => {
    i++;
});

run();

console.log('i', i);
