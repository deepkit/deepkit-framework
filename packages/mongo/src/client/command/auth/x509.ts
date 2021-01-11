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

import { MongoAuth } from './auth';
import { BaseResponse, Command } from '../command';
import { MongoClientConfig } from '../../client';
import { t } from '@deepkit/type';


class AuthenticateCommand extends t.class({
    authenticate: t.literal(1),
    mechanism: t.string,
    $db: t.string,
    username: t.string.optional,
}) {
}

class AuthenticateResponse extends t.extendClass(BaseResponse, {}) {
}

export class X509Auth implements MongoAuth {
    async auth(command: Command, config: MongoClientConfig): Promise<void> {
        await command.sendAndWait(AuthenticateCommand, {
            authenticate: 1,
            mechanism: 'MONGODB-X509',
            $db: '$external',
            username: config.authUser
        }, AuthenticateResponse);
    }
}
