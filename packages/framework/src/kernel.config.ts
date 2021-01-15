/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
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

import { createConfig } from './injector/injector';
import { t } from '@deepkit/type';

export const kernelConfig = createConfig({
    host: t.string.default('localhost'), //binding to 127.0.0.1 is roughly 20% slower.
    port: t.number.default(8080),
    httpsPort: t.number.optional.description('If httpsPort and ssl is defined, then the https server is started additional to the http-server.'),
    selfSigned: t.boolean.optional.description('If for ssl: true the certificate and key should be automatically generated.'),
    keepAliveTimeout: t.number.optional,
    path: t.string.default('/'),
    workers: t.number.default(1),
    ssl: t.boolean.default(false).description("Enables HTTPS server"),
    sslOptions: t.any.description("Same interface as tls.SecureContextOptions & tls.TlsOptions."),
    sslKey: t.string.optional.description('A file path to a ssl key file for https'),
    sslCertificate: t.string.optional.description('A file path to a certificate file for https'),
    sslCa: t.string.optional.description('A file path to a ca file for https'),
    sslCrl: t.string.optional.description('A file path to a crl file for https'),
    server: t.any, //todo: change to t.classType(Server)
    maxPayload: t.number.optional,
    publicDir: t.string.optional.description('A path to a folder that should be served per default. Relative to cwd.'),
    debug: t.boolean.default(false),
    debugUrl: t.string.default('_debug'),
    varPath: t.string.default('var/'),
    debugStorePath: t.string.default('debug/').description('Relative to {varPath} option'),
    debugSqlitePath: t.string.default('debug/deepkit-debug.sqlite').description('Relative to {varPath} option'),
    httpLog: t.boolean.default(true),

    databases: t.array(t.any).optional.description('ClassType[] of Database classes'),
    migrateOnStartup: t.boolean.default(false).description('Whether all registered database should be migrated automatically on startup.'),
    migrationDir: t.string.default('migrations'),
});

export class KernelConfigAll extends kernelConfig.all() { }
