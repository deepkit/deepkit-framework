import { BrokerServer } from "@deepkit/framework";

const server = new BrokerServer('localhost:55552');
server.start();