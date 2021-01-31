/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BenchSuite } from '../../bench';

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

export async function main() {
    const bench = new BenchSuite('grpc-js', 2);
    let called = 0;

    const PROTO_PATH = __dirname + '/helloworld.proto';

    const packageDefinition = protoLoader.loadSync(
        PROTO_PATH,
        {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
        });
    const hello_proto = grpc.loadPackageDefinition(packageDefinition).helloworld;

    /**
     * Implements the SayHello RPC method.
     */
    function sayHello(call, callback) {
        called++;
        callback(null, { message: 'Hello ' + call.request.name });
    }

    const server = new grpc.Server();
    server.addService(hello_proto.Greeter.service, { sayHello: sayHello });
    server.bindAsync('localhost:50051', grpc.ServerCredentials.createInsecure(), () => {
        server.start();
    });


    const client = new hello_proto.Greeter('localhost:50051',
        grpc.credentials.createInsecure());


    bench.addAsync('action', async () => {
        await new Promise((resolve) => {
            client.sayHello({ name: 'foo' }, function (err, response) {
                resolve(undefined);
            });
        });
    });

    await bench.runAsync();
    server.forceShutdown();
    console.log('called', called);
}
