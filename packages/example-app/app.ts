#!/usr/bin/env ts-node-script
import 'reflect-metadata';
import { Application, createCrudRoutes, FrameworkModule, onServerMainBootstrapDone } from '@deepkit/framework';
import { Author, Book, SQLiteDatabase, User } from './src/database';
import { MainController } from './src/controller/main.http';
import { UsersCommand } from './src/controller/users.cli';
import { ApiConsoleModule } from '@deepkit/api-console-module';
import { config } from './src/config';
import { JSONTransport, Logger } from '@deepkit/logger';
import { createListener } from '@deepkit/event';
import { HttpRequest, HttpResponse } from '../http/src/model';
import * as uws from 'uWebSockets.js';

const bookStoreCrud = createCrudRoutes([Author, Book]);

// const uws = require('uWebSockets.js');

class Header {
    public range: any;

    constructor(protected request: uws.HttpRequest) {
        this.range = request.getHeader('range');
    }
}

class UWSRequestWrapper {
    protected url: string;
    public headers: Header;

    constructor(protected request: uws.HttpRequest) {
        this.url = request.getUrl();
        this.headers = new Header(request);
    }

    getUrl() {
        return this.url;
    }

    getMethod() {
        return this.request.getMethod();
    }
}


class UWSResponseWrapper {
    headers: {[name: string]: string} = {};
    statusCode: number = 200;

    constructor(protected response: uws.HttpResponse) {
    }

    once(type: string, cb: Function) {

    }

    writeHead() {
        this.response.writeStatus('200 OK');
    }

    end(data: any) {
        if (data) {
            this.response.end(data);
        } else {
            this.response.end();
        }
    }

    status(code: number) {
        this.response.writeStatus('200 OK').end();
    }

    setHeader(name: string, value: string) {
        this.response.writeHeader(name, value + '');
        this.headers[name] = value;
    }

    getHeader(name: string) {
        return this.headers[name];
    }

    hasHeader(name: string) {
        return !!this.headers[name];
    }
}

class UWSHttpServer {
    cb(req: HttpRequest, res: HttpResponse) {};

    app = uws.App({
    }).get('/*', (response: any, request: any) => {
        response.status = function(code: number) {
            response.writeStatus('200 OK');
        }
        response.onAborted(() => {

        });
        this.cb(new UWSRequestWrapper(request) as any, new UWSResponseWrapper(response) as any);
    }).listen(8080, (listenSocket: any) => {

    });

    on(type: 'request', cb: (req: HttpRequest, res: HttpResponse) => void) {
        this.cb = cb;
    }
}

new Application({
    config: config,
    providers: [SQLiteDatabase],
    controllers: [MainController, UsersCommand],
    listeners: [
        createListener(onServerMainBootstrapDone, (event, logger, environment) => {
            logger.log(`Environment <yellow>${environment}</yellow>`);
        }, Logger, config.token('environment')),
    ],
    imports: [
        createCrudRoutes([User], { identifier: 'username', identifierChangeable: true }),
        bookStoreCrud,

        new ApiConsoleModule({ path: '/api' }).filter(filter => filter.excludeModules(bookStoreCrud)),
        new ApiConsoleModule({
            path: '/api/bookstore',
            markdown: `
             # Bookstore

             Welcome to my little bookstore API. Feel free to manage the content.

             Have fun
            `
        })
            .filter(filter => filter.forModules(bookStoreCrud)),

        new FrameworkModule({
            publicDir: 'public',
            httpLog: true,
            server: new UWSHttpServer(),
            migrateOnStartup: true,
        }),
    ]
}).setup((module, config) => {
    if (config.environment === 'development') {
        module.getImportedModuleByClass(FrameworkModule).configure({debug: true});
    }

    if (config.environment === 'production') {
        //enable logging JSON messages instead of formatted strings
        module.setupProvider(Logger).setTransport([new JSONTransport]);
    }
})
    .loadConfigFromEnv()
    .run();
