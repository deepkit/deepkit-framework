import {createServer} from 'http';
import {unlinkSync} from 'fs';
import {pathExistsSync} from 'fs-extra';

const net = createServer();

net.on("request", function (request, response) {
    response.writeHead(200, {
        "Content-Type": 'plain/text',
        "Content-Length": 5
    });

    response.end("12345");
});

// if (pathExistsSync('/tmp/bench.sock')) unlinkSync('/tmp/bench.sock');

net.listen(8080, async () => {
    console.log('running');
});