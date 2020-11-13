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
import {Config, DebugControllerInterface, DebugControllerSymbol} from '@deepkit/framework-debug-shared';
import {rpc} from '@deepkit/framework-shared';
import {ApplicationConfig} from '../application-config';
import { Configuration } from '../configuration';


@rpc.controller(DebugControllerSymbol)
export class DebugController implements DebugControllerInterface {
    constructor(private applicationConfig: ApplicationConfig, private config: Configuration) {
    }

    @rpc.action()
    configuration(): Config {
        return {
            applicationConfig: this.applicationConfig,
            configuration: this.config.getAll(),
        };
    }
}
