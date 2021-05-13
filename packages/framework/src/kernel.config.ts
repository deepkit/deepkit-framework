/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { t } from '@deepkit/type';
import { AppModuleConfig } from '@deepkit/app';
import { Session } from './session';

export const kernelConfig = new AppModuleConfig({
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
    httpLog: t.boolean.default(true),

    session: t.any.default(Session).description('The session ClassType'),
    databases: t.array(t.any).optional.description('ClassType[] of Database classes'),
    migrateOnStartup: t.boolean.default(false).description('Whether all registered database should be migrated automatically on startup.'),
    migrationDir: t.string.default('migrations'),
});

export class KernelConfigAll extends kernelConfig.all() { }
