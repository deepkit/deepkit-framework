import {unlinkSync} from 'fs';
import {ExchangeServer} from '../src/exchange/exchange-server';

unlinkSync('/tmp/deepkit-lock-benchmark');
const server = new ExchangeServer('/tmp/deepkit-lock-benchmark');
server.start();

