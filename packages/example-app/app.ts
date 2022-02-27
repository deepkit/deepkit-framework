#!/usr/bin/env ts-node-script
import { createCrudRoutes, FrameworkModule } from '@deepkit/framework';
import { Author, Book, SQLiteDatabase } from './src/database';
import { MainController } from './src/controller/main.http';
import { UsersCommand } from './src/controller/users.cli';
import { Config } from './src/config';
import { JSONTransport, Logger } from '@deepkit/logger';
import { App } from '@deepkit/app';
import { RpcController } from './src/controller/rpc.controller';

const bookStoreCrud = createCrudRoutes([Author, Book]);

new App({
    config: Config,
    providers: [SQLiteDatabase, MainController],
    controllers: [MainController, UsersCommand, RpcController],
    listeners: [
        //todo: make that possible again
        // createListener(onServerMainBootstrapDone, (event, logger, environment) => {
        //     logger.log(`Environment <yellow>${environment}</yellow>`);
        // }, Logger, config.token('environment')),
    ],
    imports: [
        // createCrudRoutes([User], { identifier: 'username', identifierChangeable: true }),
        // bookStoreCrud,

        // new ApiConsoleModule({ path: '/api' }).filter(filter => filter.excludeModules(bookStoreCrud)),
        // new ApiConsoleModule({
        //     path: '/api/bookstore',
        //     markdown: `
        //      # Bookstore
        //
        //      Welcome to my little bookstore API. Feel free to manage the content.
        //
        //      Have fun
        //     `
        // }).filter(filter => filter.forModules(bookStoreCrud)),

        new FrameworkModule({
            publicDir: 'public',
            httpLog: true,
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
