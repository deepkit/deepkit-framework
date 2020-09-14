import {Client} from './client';
import {WebSocketClientAdapter} from './websocket-client';

export class DeepkitClient extends Client {
    constructor(url: string) {
        super(new WebSocketClientAdapter(url));
    }
}
