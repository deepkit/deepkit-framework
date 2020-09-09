import {Client} from './client';
import {WebSocketClientAdapter} from './websocket-client';

export class SuperHornetClient extends Client {
    constructor(url: string) {
        super(new WebSocketClientAdapter(url));
    }
}
