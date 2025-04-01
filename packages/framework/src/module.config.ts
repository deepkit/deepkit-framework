/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { HttpConfig } from '@deepkit/http';

const isWindows = 'undefined' !== typeof process ? process.platform === 'win32' : false;

export class BrokerConfig {
    /**
     * @description If startOnBootstrap is true, the broker server starts at this address. Unix socket path or host:port combination
     */
    listen: string = isWindows ? 'localhost:8811' : 'var/broker.sock';

    /**
     * @description If a different broker server should be used, this is its address. Unix socket path or host:port combination.
     */
    host: string | string[] = isWindows ? 'localhost:8811' : 'var/broker.sock';

    /**
     * @description Automatically starts a single broker in the main process. Disable it if you have a custom broker node.
     */
    startOnBootstrap: boolean = true;
}

export class FrameworkConfig {
    host: string = '0.0.0.0'; //binding to localhost is roughly 20% faster.
    port: number = 8080;
    /**
     * @description If httpsPort and ssl is defined, then the https server is started additional to the http-server.
     */
    httpsPort?: number;

    /**
     * @description If for ssl: true the certificate and key should be automatically generated.
     */
    selfSigned?: boolean;

    path: string = '/';

    /**
     * The compression level to use when using the zlib module.
     * 0 means no compression, and 9 is the maximum compression.
     */
    compression: number = 6;

    /**
     * @description A value of 0 means the main process handles requests alone. A value of > 0 means the main process does not handle any requests and anything is redirected to workers.
     */
    workers: number = 0;

    /**
     * When server is shutting down gracefully, this timeout is used to wait for all connections to be closed.
     * Default is 5 seconds.
     */
    gracefulShutdownTimeout: number = 5;

    /**
     * @description Enables HTTPS server.
     */
    ssl: boolean = false;

    /**
     * @description Same interface as tls.SecureContextOptions & tls.TlsOptions.
     */
    sslOptions?: any;

    /**
     * @description A file path to a ssl key file for https.
     */
    sslKey?: string;

    /**
     * @description A file path to a certificate file for https.
     */
    sslCertificate?: string;

    /**
     * @description A file path to a ca file for https.
     */
    sslCa?: string;

    /**
     * @description A file path to a ca file for https
     */
    sslCrl?: string;

    /**
     * @description custom server created by node http/https module.
     */
    server?: any;

    maxPayload?: number;

    /**
     * @description A path to a folder that should be served per default. Relative to cwd.
     */
    publicDir?: string;

    /**
     * @description Per default the folder specified in publicDir is available under /. Change that to a URL prefix of your choice.
     */
    publicDirPrefix: string = '/';

    debug: boolean = false;

    /**
     * @description If set, allows to call RPC methods via HTTP. The value is the base URL for the RPC calls.
     * Use e.g. `/rpc/v1`
     */
    httpRpcBasePath: string = '';

    debugUrl: string = '_debug';

    /**
     * Whether profiling is enabled. This is automatically enabled when debug is enabled,
     * but can be enabled separately.
     */
    profile: boolean = false;

    /**
     * @description IP:Port or unix socket name or named pipes.
     */
    debugBrokerHost?: string;

    varPath: string = 'var/';

    /**
     * @description Relative to {varPath} option.
     */
    debugStorePath: string = 'debug/';

    /**
     * @description print http request logs to logger.
     */
    httpLog: boolean = true;

    /**
     * @description The session ClassType
     */
    session?: any;

    /**
     * @description Whether all registered database should be migrated automatically on startup.
     */
    migrateOnStartup: boolean = false;

    migrationDir: string = 'migrations';

    broker: BrokerConfig = new BrokerConfig;

    /**
     * Will be forwarded to HttpModule.
     * @see HttpConfig
     */
    http: HttpConfig = new HttpConfig;

    /**
     * If true logs all routes and rpc controllers on startup.
     */
    logStartup: boolean = true;
}
