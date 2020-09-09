import {ClientMessageAll,} from '@super-hornet/framework-shared';
import {ClientTransportAdapter, TransportConnectionHooks} from './client';

export class WebSocketClientAdapter implements ClientTransportAdapter {
    constructor(public url: string) {
    }

    public connect(connection: TransportConnectionHooks) {
        const socket = new WebSocket(this.url);

        socket.onmessage = (event: MessageEvent) => {
            connection.onMessage(event.data.toString());
        };

        socket.onclose = () => {
            connection.onClose();
        };

        socket.onerror = (error: any) => {
            connection.onError(error);
        };

        socket.onopen = async () => {
            connection.onConnected({
                disconnect() {
                    socket.close();
                },
                send(message: ClientMessageAll) {
                    socket.send(JSON.stringify(message));
                }
            });
        };
    }
}
