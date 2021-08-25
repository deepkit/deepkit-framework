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

const bookStoreCrud = createCrudRoutes([Author, Book]);

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
