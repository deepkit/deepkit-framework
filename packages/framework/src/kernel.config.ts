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

import {createConfig} from './injector/injector';
import {t} from '@deepkit/type';

export const kernelConfig = createConfig({
    host: t.string.default('localhost'), //binding to 127.0.0.1 is roughly 20% slower.
    port: t.number.default(8080),
    path: t.string.default('/'),
    workers: t.number.default(1),
    server: t.any, //todo: change to t.classType(Server)
    maxPayload: t.number.optional,
    publicDir: t.string.default('public/'),
    debug: t.boolean.default(false),
    httpLog: t.boolean.default(true),
});

export class KernelConfigAll extends kernelConfig.all() {}
