import * as WebSocket from 'ws';

const wsServer = new WebSocket.Server({
    port: 8080,
}).on('connection', (ws, req) => {
    console.log('new connection.');
    ws.on('message', (message) => {
        console.log('message', message);
        ws.send(message);
    });
});

