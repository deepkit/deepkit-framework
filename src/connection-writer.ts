import {WebSocket} from "uWebSockets.js";
import {Inject, Injectable} from "injection-js";
import {getSerializedErrorPair, ServerMessageAll} from "@marcj/glut-core";


@Injectable()
export class ConnectionWriter {
    protected chunkIds = 0;

    constructor(
        @Inject('socket') protected socket: WebSocket,
    ) {
    }

    public write(message: ServerMessageAll) {
        if (this.socket.readyState === this.socket.OPEN) {
            const json = JSON.stringify(message);

            this.socket.getBufferedAmount();
            const chunkSize = 1024 * 50; //50kb

            if (json.length > chunkSize) {
                const chunkId = this.chunkIds++;

                let position = 0;
                this.socket.send("@batch-start:" + ((message as any)['id'] || 0) + ":" + chunkId + ":" + json.length);
                while (position * chunkSize < json.length) {
                    const chunk = json.substr(position * (chunkSize), chunkSize);
                    position++;
                    this.socket.send("@batch:" + chunkId + ":" + chunk);
                }
                this.socket.send("@batch-end:" + chunkId);
            } else {
                this.socket.send(json);
            }
        }
    }

    public complete(id: number) {
        this.write({type: 'complete', id: id});
    }

    public ack(id: number) {
        this.write({type: 'ack', id: id});
    }

    public sendError(id: number, errorObject: any, code?: string) {
        const [entityName, error, stack] = getSerializedErrorPair(errorObject);

        this.write({type: 'error', id: id, entityName, error, stack, code: error.code || code});
    }
}
