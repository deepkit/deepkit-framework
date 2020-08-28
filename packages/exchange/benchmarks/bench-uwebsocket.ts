import {bench} from '@super-hornet/core';
import {App} from 'uWebSockets.js';
import * as WebSocket from 'ws';

App({
    // /* There are more SSL options, cut for brevity */
    // key_file_name: 'misc/key.pem',
    // cert_file_name: 'misc/cert.pem',
}).ws('/*', {

    /* There are many common helper features */
    idleTimeout: 30,
    maxBackpressure: 1024,
    maxPayloadLength: 512,
    compression: 0,

    /* For brevity we skip the other events (upgrade, open, ping, pong, close) */
    message: (ws, message, isBinary) => {
        /* You can do app.publish('sensors/home/temperature', '22C') kind of pub/sub as well */
        // console.log('got message', message);
        /* Here we echo the message back, using compression if available */
        let ok = ws.send(message, isBinary);
    }

}).get('/*', (res, req) => {
    /* It does Http as well */
    res.writeStatus('200 OK').writeHeader('IsExample', 'Yes').end('Hello there!');
}).listen(8080, (listenSocket) => {
    // if (listenSocket) {
    //     console.log('Listening to port 9001');
    //     const socket = new WebSocket('ws://localhost:9001');
    //     socket.binaryType = 'arraybuffer';
    //
    //     socket.onerror = (error: any) => {
    //         throw new Error(`Could not connect to: ${error}`);
    //     };
    //
    //     socket.onopen = async () => {
    //         await bench(10_000, 'uwebSockets', async () => {
    //             await new Promise((resolve) => {
    //                 socket.onmessage = () => {
    //                     resolve();
    //                 };
    //                 socket.send(Buffer.alloc(2));
    //             });
    //         });
    //     };
    // }
});

