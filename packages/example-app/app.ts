#!/usr/bin/env ts-node-script
import 'reflect-metadata';
import { Application, createCrudRoutes, KernelModule, onServerMainBootstrapDone } from '@deepkit/framework';
import { Author, Book, SQLiteDatabase, User } from './src/database';
import { MainController } from './src/controller/main.http';
import { UsersCommand } from './src/controller/users.cli';
import { ApiConsoleModule } from '@deepkit/api-console-module';
import { config } from './src/config';
import { JSONTransport, Logger } from '@deepkit/logger';
import { createListener } from '@deepkit/event';
import { ClassType } from '@deepkit/core';

function log(logger: InstanceType<ClassType<Logger>>) {
    logger.log()
}

Application.create({
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
        createCrudRoutes([Author, Book]),
        new ApiConsoleModule({ path: '/api' }),
        new KernelModule({
            publicDir: 'public',
            httpLog: true,
            migrateOnStartup: true,
        }),
    ]
}).setup((module, config) => {
    if (config.environment === 'development') {
        //activate kernel debug=true
    }

    if (config.environment === 'production') {
        //enable logging JSON messages instead of formatted strings
        module.setupProvider(Logger).setTransport([new JSONTransport]);
    }
})
    .loadConfigFromEnv()
    .run();
