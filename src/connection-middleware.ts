import {EntityStorage} from "./entity-storage";
import {ClientMessageAll, ConnectionMiddleware, ConnectionWriter} from "@marcj/glut-core";
import {Injectable} from "injection-js";

/**
 * Extends the ConnectionMiddleware to make sure entityStorage decrease the usage of EntitySubject when it got unsubscribed.
 */
@Injectable()
export class ServerConnectionMiddleware extends ConnectionMiddleware {
    constructor(
        public readonly writer: ConnectionWriter,
        protected entityStorage: EntityStorage,
    ) {
        super(writer);
    }

    public async messageIn(message: ClientMessageAll) {
        if (message.name === 'entity/unsubscribe') {
            const sent = this.entitySent[message.forId];
            this.entityStorage.decreaseUsage(sent.classType, sent.id);
        }

        return super.messageIn(message);
    }
}
