import {Server} from 'http';

export class ApplicationConfig {
    host: string = 'localhost'; //binding to 127.0.0.1 is roughly 20% slower.

    port: number = 8080;

    path: string = '/';

    workers: number = 1;

    server?: Server;

    maxPayload?: number;

    publicDir: string = 'public/';

    migrationDir: string = 'migration/';
}
