import 'reflect-metadata';
import {ExchangeServer} from "../src/exchange-server";
import {unlinkSync} from "fs";

unlinkSync('/tmp/glut-lock-benchmark');
const server = new ExchangeServer('/tmp/glut-lock-benchmark');
server.start();

