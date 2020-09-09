import {unlinkSync} from 'fs';
import {ExchangeServer} from '../src/exchange/exchange-server';

unlinkSync('/tmp/super-hornet-lock-benchmark');
const server = new ExchangeServer('/tmp/super-hornet-lock-benchmark');
server.start();

