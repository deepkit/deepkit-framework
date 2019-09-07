import * as WebSocket from "ws";
import {Injectable, Inject} from "injection-js";
import {getSerializedErrorPair, JSONError, ServerMessageAll} from "@marcj/glut-core";
import { getEntityName, getEntitySchema } from "@marcj/marshal";


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

    public ack(id: number) {
        this.write({type: 'ack', id: id});
    }

    public sendError(id: number, errorObject: any, code?: string) {
        const [entityName, error] = getSerializedErrorPair(errorObject);

        this.write({type: 'error', id: id, entityName, error, code: error.code || code});
    }
}
