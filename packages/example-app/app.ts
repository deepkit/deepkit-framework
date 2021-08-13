#!/usr/bin/env ts-node-script
import 'reflect-metadata';
import { Application, KernelModule } from '@deepkit/framework';
import { SQLiteDatabase } from './src/database';
import { MainController } from './src/controller/main.http';
import { UsersCommand } from './src/controller/users.cli';
import { ApiConsoleModule } from '@deepkit/api-console-module';
import { config } from './src/config';
// import { JSONTransport, Logger } from '@deepkit/logger';

Application.create({
    config: config,
    providers: [SQLiteDatabase],
    controllers: [MainController, UsersCommand],
    imports: [
        ApiConsoleModule.configure({basePath: '/api'}),
        KernelModule.configure({
            debug: true, publicDir: 'public', httpLog: true,
            migrateOnStartup: true
        }),
    ]
}).setup((module) => {
    //enable logging JSON messages instead of formatted strings
    // module.setupProvider(Logger).setTransport([new JSONTransport]);
})
    .loadConfigFromEnvFile('.env')
    .loadConfigFromEnvVariables('APP_')
    .run();
