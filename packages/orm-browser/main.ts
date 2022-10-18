#!/usr/bin/env node

import 'reflect-metadata';
import { getDirname } from "@deepkit/platform"
import { FrameworkModule, OrmBrowserController } from '@deepkit/framework';
import { App, AppModule, findParentPath } from '@deepkit/app';
import { Database, DatabaseRegistry } from '@deepkit/orm';
import { registerStaticHttpController } from '@deepkit/http';
import { InjectorContext } from '@deepkit/injector';

const _dirname = getDirname();

Database.registry = [];
const databaseRegistry = new DatabaseRegistry(InjectorContext.forProviders([]));
databaseRegistry.readDatabase(process.argv.slice(2));

const appModule = new AppModule({
    providers: [
        { provide: OrmBrowserController, useValue: new OrmBrowserController(Database.registry) },
    ],
    controllers: [
        OrmBrowserController
    ],
    imports: [
        new FrameworkModule({
            port: 9090
        })
    ]
}).setup((module, config) => {
    const localPath = findParentPath('node_modules/@deepkit/orm-browser-gui/dist/orm-browser-gui', _dirname);
    if (!localPath) throw new Error('node_modules/@deepkit/orm-browser-gui not installed in ' + _dirname);
    registerStaticHttpController(module, {path: '/', localPath, controllerName: 'OrmBrowserController'});
});

App.fromModule(appModule).loadConfigFromEnv({prefix: 'ORM_BROWSER_'}).run(['server:start']);
