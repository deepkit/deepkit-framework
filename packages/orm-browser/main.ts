#!/usr/bin/env node

import 'reflect-metadata';
import { Application, KernelModule, OrmBrowserController } from '@deepkit/framework';
import { AppModule, findParentPath } from '@deepkit/app';
import { Database, DatabaseRegistry } from '@deepkit/orm';
import { registerStaticHttpController } from '@deepkit/http';
import { InjectorContext } from '@deepkit/injector';

Database.registry = [];
const databaseRegistry = new DatabaseRegistry(new InjectorContext());
databaseRegistry.readDatabase(process.argv.slice(2));

const appModule = new AppModule({
    providers: [
        { provide: OrmBrowserController, useValue: new OrmBrowserController(Database.registry) },
    ],
    controllers: [
        OrmBrowserController
    ],

    imports: [
        KernelModule.configure({
            port: 9090
        })
    ]
}).setup((module, config) => {
    const localPath = findParentPath('orm-browser-gui/dist/orm-browser-gui');
    if (!localPath) throw new Error('orm-browser-gui not installed');
    registerStaticHttpController(module, '/', localPath);
});

new Application(appModule).run(['server:start']);
