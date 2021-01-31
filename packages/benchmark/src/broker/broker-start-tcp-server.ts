import { BrokerServer } from "@deepkit/framework";

export async function main() {
    const server = new BrokerServer('localhost:55552');
    await server.start();
}
