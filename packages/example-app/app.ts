#!/usr/bin/env ts-node-script
import 'reflect-metadata';
import { Application, KernelModule } from '@deepkit/framework';
import { SQLiteDatabase } from './src/database';
import { MainController } from './src/controller/main.http';
import { UsersCommand } from './src/controller/users.cli';
import { ApiConsoleModule } from '@deepkit/api-console-module';
// import { JSONTransport, Logger } from '@deepkit/logger';

Application.create({
    controllers: [MainController, UsersCommand],
    imports: [
        ApiConsoleModule,
        KernelModule.configure({
            debug: true, publicDir: 'public', httpLog: true,
            databases: [SQLiteDatabase], migrateOnStartup: true
        }),
    ]
}).setup((module) => {
    //enable logging JSON messages instead of formatted strings
    // module.setupProvider(Logger).setTransport([new JSONTransport]);
})
    .loadConfigFromEnvVariables('APP_')
    .run();
