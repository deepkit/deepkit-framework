import {ExchangeServer} from "../src/exchange-server";
import {unlinkSync} from "fs";

unlinkSync('/tmp/super-hornet-lock-benchmark');
const server = new ExchangeServer('/tmp/super-hornet-lock-benchmark');
server.start();

