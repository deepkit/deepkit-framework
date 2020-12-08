/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {ClientMessageAll, ConnectionMiddleware, ConnectionWriterInterface} from '@deepkit/framework-shared';
import {injectable} from '../injector/injector';
import {EntityStorage} from '../autosync/entity-storage';

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
