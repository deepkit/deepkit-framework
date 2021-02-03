import 'reflect-metadata';
import { Server } from "http";
import { RpcKernel, SimpleInjector } from "@deepkit/rpc";
import WebSocket from 'ws';
import { BrowserControllerInterface } from "@deepkit/orm-browser-api";
import { BrowserController } from "./src/controller";
import { isAbsolute, join } from 'path';
import { Database } from '@deepkit/orm';

async function main() {
    const server = new Server((req, res) => {
    });
    const host = 'localhost';
    const port = 9090;

    server.listen(port, host, () => {
        console.log(`ORM browser listening at http://${host}:${port}/`);
    });

    Database.registry = [];

    for (const path of process.argv.slice(2)) {
        require(isAbsolute(path) ? path : join(process.cwd(), path));
    }

    for (const db of Database.registry) {
        console.log(`Found database ${db.name} with adapter ${db.adapter.getName()}`);
    }

    const injector = new SimpleInjector();
    injector.set(BrowserController, new BrowserController(Database.registry));

    const kernel = new RpcKernel(injector);
    kernel.registerController(BrowserControllerInterface, BrowserController);

    const wsServer = new WebSocket.Server({ server: server });
    wsServer.on('connection', (ws: any) => {
        const connection = kernel.createConnection({
            write(b) {
                ws.send(b);
            },
            bufferedAmount(): number {
                return ws.bufferedAmount;
            }
        });

        ws.on('message', async (message: any) => {
            connection.feed(message);
        });

        ws.on('close', async () => {
            connection.close();
        });
    });
}

main();