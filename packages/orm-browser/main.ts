#!/usr/bin/env node

import 'reflect-metadata';
import { Application, KernelModule, OrmBrowserController } from '@deepkit/framework';
import { AppModule } from '@deepkit/app';
import { join } from 'path';
import { Database, DatabaseRegistry } from '@deepkit/orm';
import { registerStaticHttpController } from '@deepkit/http';
import { InjectorContext } from '@deepkit/injector';

Database.registry = [];
const databaseRegistry = new DatabaseRegistry(new InjectorContext());
databaseRegistry.readDatabase(process.argv.slice(2));

const appModule = new AppModule({
    providers: [
        {provide: OrmBrowserController, useValue: new OrmBrowserController(Database.registry)},
    ],
    controllers: [
        OrmBrowserController
    ],

    imports: [
        KernelModule.configure({
            port: 9090,
            broker: {
                startOnBootstrap: false,
            }
        })
    ]
}).setup((module, config) => {
    const localPathPrefix = __dirname.includes('orm-browser/dist') ? '../../' : './';
    const localPath = join(__dirname, localPathPrefix, 'node_modules/@deepkit/orm-browser-gui/dist/orm-browser-gui');
    registerStaticHttpController(module, '/', localPath);
});

new Application(appModule).run(['server:listen']);
