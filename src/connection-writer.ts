import * as WebSocket from "ws";
import {Injectable, Inject} from "injection-js";
import {ServerMessageAll} from "@kamille/core";


@Injectable()
export class ConnectionWriter {
    constructor(
        @Inject('socket') protected socket: WebSocket,
    ) {
    }

    public write(message: ServerMessageAll) {
        if (this.socket.readyState === this.socket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }

    public complete(id: number) {
        this.write({type: 'complete', id: id});
    }

    public sendError(id: number, error: any) {
        this.write({type: 'error', id: id, error: error instanceof Error ? error.message : error});
    }
}
