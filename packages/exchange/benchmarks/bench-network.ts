import {createServer} from 'net';

let i = 0;
let bytes = 0;

setInterval(() => {
    console.log('got', i, 'data events', bytes / 1024 / 1024 / 1024, 'GiB');
}, 2000);

const net = createServer();
net.on('connection', (socket) => {
    socket.on('data', (message: Buffer) => {
        i++;
        // console.log('got data', i, message.byteLength, message.toString('ascii'));
        bytes += message.byteLength;
        socket.write(message);
    });
    socket.on('error', (error) => {
        console.log('error jo', error);
    });
});

// if (pathExistsSync('/tmp/bench.sock')) unlinkSync('/tmp/bench.sock');

net.listen(1111, async () => {
    console.log('running');
});