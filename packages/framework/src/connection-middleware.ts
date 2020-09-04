import {ClientMessageAll, ConnectionMiddleware, ConnectionWriterInterface} from "@super-hornet/framework-shared";
import {injectable} from './injector/injector';
import {EntityStorage} from './autosync/entity-storage';

/**
 * Extends the ConnectionMiddleware to make sure entityStorage decrease the usage of EntitySubject when it got unsubscribed.
 */
@injectable()
export class ServerConnectionMiddleware extends ConnectionMiddleware {
    constructor(
        protected entityStorage: EntityStorage,
    ) {
        super();
    }

    public async messageIn(
        message: ClientMessageAll,
        writer: ConnectionWriterInterface
    ) {
        if (message.name === 'entity/unsubscribe') {
            const sent = this.entitySent[message.forId];
            this.entityStorage.decreaseUsage(sent.classType, sent.id);
        }

        return super.messageIn(message, writer);
    }
}
