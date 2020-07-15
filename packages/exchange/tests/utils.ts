import {Exchange, ExchangeConfig} from "../index";
import {ExchangeServer} from "../src/exchange-server";

const closers: Function[] = [];

export function closeCreatedExchange() {
    for (const close of closers) close();
}

export async function createExchange(): Promise<Exchange> {
    //todo, generate temp file for socket
    const socketPath = '/tmp/bla.sock';

    const server = new ExchangeServer(socketPath);
    await server.start();

    closers.push(() => {
        server.close();
    });
    const client = new Exchange(ExchangeConfig.forUrl(socketPath));
    await client.connect();
    return client;
}
